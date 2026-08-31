// ====== JWT + 密码哈希测试 · v1.03 · 2026-08-31 ======
// 用 Node 内置 node:test，覆盖：
//   1. JWT 签名 / 校验 / 过期 / 篡改
//   2. 中间件 401/403 行为
//   3. 密码哈希：bcrypt / pbkdf2 / 旧明文 三种格式
//   4. requirePlayerSelf 借名攻击防护

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const express = require('express');

const auth = require('./auth');
const password = require('./password');

// 注入固定 secret（避免 dev warning + 测试稳定）
auth.__setSecret('test-secret-' + crypto.randomBytes(16).toString('hex'));

test('JWT 签名 + 校验正常', () => {
  const tok = auth.signToken({ username: 'alice' });
  assert.strictEqual(typeof tok, 'string');
  assert.strictEqual(tok.split('.').length, 3);
  const payload = auth.verifyToken(tok);
  assert.ok(payload);
  assert.strictEqual(payload.username, 'alice');
  assert.ok(payload.iat);
  assert.ok(payload.exp > payload.iat);
});

test('JWT 篡改 payload 校验失败', () => {
  const tok = auth.signToken({ username: 'alice' });
  // 篡改 payload（中间段）
  const parts = tok.split('.');
  parts[1] = parts[1].replace(/^./, 'X'); // 改一个字符
  const bad = parts.join('.');
  const payload = auth.verifyToken(bad);
  assert.strictEqual(payload, null);
});

test('JWT 篡改签名校验失败', () => {
  const tok = auth.signToken({ username: 'alice' });
  const parts = tok.split('.');
  parts[2] = 'AAAA' + parts[2].slice(4);
  const payload = auth.verifyToken(parts.join('.'));
  assert.strictEqual(payload, null);
});

test('JWT 过期校验失败', () => {
  // 签发已过期的 token
  const tok = auth.signToken({ username: 'alice' }, -1000); // 负 TTL → 已过期
  const payload = auth.verifyToken(tok);
  assert.strictEqual(payload, null);
});

test('JWT 不合法字符串校验返回 null', () => {
  assert.strictEqual(auth.verifyToken(null), null);
  assert.strictEqual(auth.verifyToken(''), null);
  assert.strictEqual(auth.verifyToken('not.a.jwt'), null);
  assert.strictEqual(auth.verifyToken('only-one-part'), null);
  assert.strictEqual(auth.verifyToken('a.b'), null);
});

test('extractToken 解析 Bearer', () => {
  assert.strictEqual(auth.extractToken({ headers: { authorization: 'Bearer xyz' } }), 'xyz');
  assert.strictEqual(auth.extractToken({ headers: { Authorization: 'Bearer abc.def.ghi' } }), 'abc.def.ghi');
  assert.strictEqual(auth.extractToken({ headers: {} }), null);
  assert.strictEqual(auth.extractToken({ headers: { authorization: 'Basic xyz' } }), null);
});

test('requireAuth AUTH_MODE=enforce 拒绝无 token', () => {
  process.env.AUTH_MODE = 'enforce';
  const app = express();
  let nextCalled = false;
  app.get('/protected', auth.requireAuth, (req, res) => { nextCalled = true; res.send('ok'); });
  return new Promise((resolve) => {
    const s = app.listen(0, async () => {
      const port = s.address().port;
      const r = await fetch(`http://localhost:${port}/protected`);
      assert.strictEqual(r.status, 401);
      assert.strictEqual(nextCalled, false);
      s.close();
      resolve();
    });
  });
});

test('requireAuth 接受合法 token', () => {
  process.env.AUTH_MODE = 'enforce';
  const app = express();
  let capturedUser = null;
  app.get('/protected', auth.requireAuth, (req, res) => {
    capturedUser = req.user;
    res.send('ok');
  });
  const tok = auth.signToken({ username: 'bob' });
  return new Promise((resolve) => {
    const s = app.listen(0, async () => {
      const port = s.address().port;
      const r = await fetch(`http://localhost:${port}/protected`, {
        headers: { authorization: `Bearer ${tok}` },
      });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(capturedUser.username, 'bob');
      s.close();
      resolve();
    });
  });
});

test('requirePlayerSelf 防借名攻击（403）', () => {
  process.env.AUTH_MODE = 'enforce';
  const app = express();
  app.use(express.json());
  app.post('/api/player/:username/action', auth.requireAuth, auth.requirePlayerSelf, (req, res) => {
    res.json({ ok: true, username: req.user.username });
  });
  const aliceToken = auth.signToken({ username: 'alice' });
  return new Promise((resolve) => {
    const s = app.listen(0, async () => {
      const port = s.address().port;
      // alice 用 token 但 URL 是 bob → 403
      const r1 = await fetch(`http://localhost:${port}/api/player/bob/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${aliceToken}` },
        body: '{}',
      });
      assert.strictEqual(r1.status, 403);
      // alice 用 token + URL 是 alice → 200
      const r2 = await fetch(`http://localhost:${port}/api/player/alice/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${aliceToken}` },
        body: '{}',
      });
      assert.strictEqual(r2.status, 200);
      s.close();
      resolve();
    });
  });
});

test('requireSelfFromBody 防 body 借名（403）', () => {
  process.env.AUTH_MODE = 'enforce';
  const app = express();
  app.use(express.json());
  app.post('/api/arena/challenge', auth.requireAuth, auth.requireSelfFromBody, (req, res) => {
    res.json({ ok: true });
  });
  const aliceToken = auth.signToken({ username: 'alice' });
  return new Promise((resolve) => {
    const s = app.listen(0, async () => {
      const port = s.address().port;
      // alice token 但 body.username=bob → 403
      const r1 = await fetch(`http://localhost:${port}/api/arena/challenge`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${aliceToken}` },
        body: JSON.stringify({ username: 'bob', targetUsername: 'ghost' }),
      });
      assert.strictEqual(r1.status, 403);
      s.close();
      resolve();
    });
  });
});

test('AUTH_MODE=off 全部放行', () => {
  process.env.AUTH_MODE = 'off';
  const app = express();
  app.use(express.json());
  app.post('/api/player/:u/x', auth.requireAuth, auth.requirePlayerSelf, (req, res) => res.json({ ok: true }));
  return new Promise((resolve) => {
    const s = app.listen(0, async () => {
      const port = s.address().port;
      // 没 token 也能进
      const r = await fetch(`http://localhost:${port}/api/player/anyone/x`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      assert.strictEqual(r.status, 200);
      s.close();
      // 恢复 enforce 给后续测试
      process.env.AUTH_MODE = 'enforce';
      resolve();
    });
  });
});

// ====== 密码哈希测试 ======
test('密码哈希 — pbkdf2 fallback 哈希 + 校验', async () => {
  // 强制走 pbkdf2（不加载 bcrypt）
  // 直接构造 pbkdf2 格式字符串
  const crypto = require('crypto');
  const iter = 1000;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync('mypassword', salt, iter, 32, 'sha256').toString('hex');
  const stored = `pbkdf2$${iter}$${salt}$${hash}`;

  assert.strictEqual(await password.verifyPassword('mypassword', stored), true);
  assert.strictEqual(await password.verifyPassword('wrong', stored), false);
  assert.strictEqual(await password.verifyPassword('', stored), false);
});

test('密码哈希 — 旧明文兼容', async () => {
  // verifyPassword 应能识别明文
  assert.strictEqual(await password.verifyPassword('plain', 'plain'), true);
  assert.strictEqual(await password.verifyPassword('plain', 'different'), false);
});

test('密码哈希 — isLegacyPlaintext 检测', () => {
  assert.strictEqual(password.isLegacyPlaintext('plain'), true);
  assert.strictEqual(password.isLegacyPlaintext('pbkdf2$1$2$3'), false);
  assert.strictEqual(password.isLegacyPlaintext('$2a$10$abcdefghij'), false);
  assert.strictEqual(password.isLegacyPlaintext(''), true); // 空字符串也是 legacy
  assert.strictEqual(password.isLegacyPlaintext(undefined), false);
});

test('密码哈希 — hashPassword 异步（fallback pbkdf2）+ verifyPassword', async () => {
  const h = await password.hashPassword('test-password-123');
  assert.ok(h.startsWith('pbkdf2$') || /^\$2[aby]\$\d{2}\$/.test(h), `unexpected hash format: ${h.slice(0,20)}`);
  assert.strictEqual(await password.verifyPassword('test-password-123', h), true);
  assert.strictEqual(await password.verifyPassword('wrong', h), false);
});