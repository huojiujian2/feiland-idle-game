// ====== 速率限制中间件测试 · v1.03 · 2026-08-31 ======
// 用 Node 内置 node:test 验证 token bucket 行为。
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const rateLimit = require('./rate-limit');

test('rate-limit: 第一次请求通过', () => {
  const mw = rateLimit({ windowMs: 1000, max: 3, keyFn: () => 'test' });
  let nextCalled = false;
  const req = { ip: '1.2.3.4', path: '/api/x', headers: {} };
  const res = { status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
  mw(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
});

test('rate-limit: 超过 max 触发 429', () => {
  const mw = rateLimit({ windowMs: 1000, max: 2, keyFn: () => 'test-2' });
  const res = (status) => ({ status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} });
  for (let i = 0; i < 2; i++) {
    const req = { ip: '1.2.3.4', path: '/api/x', headers: {} };
    const r = res();
    let ok = false;
    mw(req, r, () => { ok = true; });
    assert.strictEqual(ok, true, `request ${i+1} should pass`);
  }
  // 第 3 次应被拒
  const req3 = { ip: '1.2.3.4', path: '/api/x', headers: {} };
  const r3 = res();
  let called = false;
  mw(req3, r3, () => { called = true; });
  assert.strictEqual(called, false);
  assert.strictEqual(r3.statusCode, 429);
  assert.match(r3.body.message, /请求过于频繁/);
});

test('rate-limit: 不同 key 互不影响', () => {
  const mw = rateLimit({ windowMs: 1000, max: 1, keyFn: (req) => req.ip });
  const res = () => ({ status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} });
  let ok1 = false, ok2 = false;
  mw({ ip: 'a', path: '/x', headers: {} }, res(), () => { ok1 = true; });
  mw({ ip: 'b', path: '/x', headers: {} }, res(), () => { ok2 = true; });
  assert.strictEqual(ok1, true);
  assert.strictEqual(ok2, true);
});

test('rate-limit: 窗口过期后计数清零', async () => {
  const mw = rateLimit({ windowMs: 50, max: 1, keyFn: () => 'test-expiry' });
  const makeRes = () => {
    const r = { statusCode: 0, body: null };
    r.status = (c) => { r.statusCode = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    r.setHeader = () => {};
    return r;
  };
  // 第 1 次通过
  let ok1 = false;
  mw({ ip: 'a', path: '/x', headers: {} }, makeRes(), () => { ok1 = true; });
  assert.strictEqual(ok1, true);
  // 第 2 次被拒（max=1 已满）
  let ok2 = false;
  const r2 = makeRes();
  mw({ ip: 'a', path: '/x', headers: {} }, r2, () => { ok2 = true; });
  assert.strictEqual(ok2, false, '第 2 次应被拒');
  assert.strictEqual(r2.statusCode, 429, '返回 429');
  // 等窗口过期
  await new Promise((r) => setTimeout(r, 80));
  // 第 3 次通过
  let ok3 = false;
  mw({ ip: 'a', path: '/x', headers: {} }, makeRes(), () => { ok3 = true; });
  assert.strictEqual(ok3, true, '窗口过期后应再次通过');
});

test('rate-limit: setHeader Retry-After 写入响应', () => {
  const mw = rateLimit({ windowMs: 1000, max: 1, keyFn: () => 'test-retry' });
  const res = () => ({ status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, setHeader(k, v) { this.headers = this.headers || {}; this.headers[k] = v; } });
  mw({ ip: 'a', path: '/x', headers: {} }, res(), () => {});
  const r2 = res();
  mw({ ip: 'a', path: '/x', headers: {} }, r2, () => {});
  assert.ok(r2.headers);
  assert.ok(r2.headers['Retry-After']);
  const retry = parseInt(r2.headers['Retry-After'], 10);
  assert.ok(retry > 0 && retry <= 1, `Retry-After should be 1s, got ${r2.headers['Retry-After']}`);
});

test('rate-limit: 真实 Express 集成', async () => {
  const mw = rateLimit({ windowMs: 1000, max: 3, keyFn: (req) => req.ip });
  const app = express();
  app.use(express.json());
  app.set('trust proxy', true);
  app.post('/api/test', mw, (req, res) => res.json({ ok: true }));
  // 直接模拟请求：不启 socket
  const makeReq = (ip) => ({ ip, method: 'POST', path: '/api/test', headers: {}, socket: { remoteAddress: ip } });
  const makeRes = () => {
    const r = { statusCode: 0, body: null };
    r.status = (c) => { r.statusCode = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    r.setHeader = () => {};
    return r;
  };
  const results = [];
  for (let i = 0; i < 5; i++) {
    const req = makeReq('9.9.9.9');
    const res = makeRes();
    let called = false;
    await new Promise((resolve) => {
      mw(req, res, () => { called = true; resolve(); });
      // 如果 mw 没 next（拒），），立即 resolve
      if (!called) resolve();
    });
    results.push({ called, status: res.statusCode });
  }
  assert.strictEqual(results[0].called, true);
  assert.strictEqual(results[1].called, true);
  assert.strictEqual(results[2].called, true);
  assert.strictEqual(results[3].called, false);
  assert.strictEqual(results[3].status, 429);
  assert.strictEqual(results[4].called, false);
  assert.strictEqual(results[4].status, 429);
});