// ====== /api/diag/memory 与 /api/diag/health 集成测试 ======
const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('http');
const { registerDiagRoutes } = require('./diag');

const path = require('path');
const fs = require('fs');
const os = require('os');

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-test-'));

function setupStore() {
  process.env.DB_ENGINE = 'json';
  process.env.DB_PATH = path.join(TMP_DIR, 'db-' + Date.now() + '.json');
  try { delete require.cache[require.resolve('../store')]; } catch (_) {}
  try { delete require.cache[require.resolve('../store-json')]; } catch (_) {}
  try { delete require.cache[require.resolve('../store-sqlite')]; } catch (_) {}
  return require('../store');
}

// 零依赖 HTTP 客户端：用 node http 模块 + 解析 JSON
function makeRequest(app, method, path) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      const req = http.request({ host: '127.0.0.1', port, path, method }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          server.close();
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, body: { raw: body } });
          }
        });
      });
      req.on('error', (e) => { server.close(); reject(e); });
      req.end();
    });
  });
}

describe('/api/diag/* 诊断路由', () => {
  let store, app;
  before(() => {
    store = setupStore();
    store.__setDisableSave(true);
    app = express();
    app.use(express.json());
    registerDiagRoutes(app, store);
  });
  afterEach(() => {
    // 每个用例后恢复 JWT_SECRET 到测试环境的默认值
    // 防止 SECRET 污染到其他测试或共享 dev server 进程
    try { require('../middleware/auth').__resetSecret(); } catch (_) {}
  });
  after(() => {
    store.__setDisableSave(false);
    delete process.env.DB_ENGINE;
    delete process.env.DB_PATH;
  });

  it('GET /api/diag/health 返回 ok=true', async () => {
    const res = await makeRequest(app, 'GET', '/api/diag/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.ok, true);
    assert.ok(typeof res.body.data.ts === 'number');
  });

  it('GET /api/diag/memory 返回内存 + store 统计', async () => {
    // 先加几个玩家和 arenaBots 缓存数据
    for (let i = 0; i < 5; i++) {
      store.setPlayer(`p${i}`, { username: `p${i}`, name: `P${i}` });
      store.arenaBotsCacheSet(`p${i}`, { time: Date.now(), bots: [{ username: 'b' }] });
    }
    const res = await makeRequest(app, 'GET', '/api/diag/memory');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const d = res.body.data;
    // memory 字段
    assert.ok(typeof d.memory.heapUsedMB === 'number');
    assert.ok(typeof d.memory.heapTotalMB === 'number');
    assert.ok(typeof d.memory.heapPct === 'number');
    assert.ok(typeof d.memory.heapLimitMB === 'number');
    assert.ok(d.memory.heapPct >= 0 && d.memory.heapPct <= 100);
    // store 字段
    assert.equal(d.store.playerCount, 5);
    assert.ok(d.store.arenaBotsCache.size >= 5, `arenaBotsCache.size 应 >= 5, 实际 ${d.store.arenaBotsCache.size}`);
    assert.ok(typeof d.store.dbSizeMB === 'number');
    // uptime + ts
    assert.ok(typeof d.uptimeSeconds === 'number');
    assert.ok(typeof d.ts === 'number');
  });

  it('/api/diag/memory 不暴露用户敏感信息（无 PII）', async () => {
    store.setPlayer('p_secret', { username: 'p_secret', name: 'SecretPlayer', token: 'should_not_leak' });
    const res = await makeRequest(app, 'GET', '/api/diag/memory');
    const bodyStr = JSON.stringify(res.body);
    assert.equal(bodyStr.indexOf('should_not_leak'), -1, '不应包含 token');
    assert.equal(bodyStr.indexOf('SecretPlayer'), -1, '不应包含玩家 name');
  });

  // ===== /api/diag/auth-debug：401 排查工具 =====
  it('/api/diag/auth-debug 返回 secret 指纹（不暴露原值）', async () => {
    const res = await makeRequest(app, 'GET', '/api/diag/auth-debug');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const d = res.body.data;
    assert.equal(typeof d.secretFingerprint, 'string');
    assert.equal(d.secretFingerprint.length, 12);
    assert.equal(typeof d.secretLength, 'number');
    assert.equal(typeof d.isDevSecret, 'boolean');
    assert.equal(typeof d.tokenProvided, 'boolean');
    assert.equal(typeof d.authMode, 'string');
    assert.equal(typeof d.jwtSecretEnvSet, 'boolean');
    // 不应包含 secret 原文
    assert.equal(JSON.stringify(res.body).indexOf('feiland-dev-secret'), -1, '不应暴露 secret 原文');
  });

  it('/api/diag/auth-debug 验证有效 token', async () => {
    const { signToken } = require('../middleware/auth');
    const tok = signToken({ username: 'alice' });
    const res = await makeRequest(app, 'GET', `/api/diag/auth-debug?token=${encodeURIComponent(tok)}`);
    assert.equal(res.status, 200);
    const d = res.body.data;
    assert.equal(d.tokenProvided, true);
    assert.equal(d.tokenValid, true);
    assert.equal(d.tokenError, null);
    assert.equal(d.tokenClaims.username, 'alice');
    assert.equal(d.tokenExpired, false);
  });

  it('/api/diag/auth-debug 识别伪造 token（SECRET 改了场景）', async () => {
    const { signToken, __setSecret } = require('../middleware/auth');
    __setSecret('original-secret');
    const tok = signToken({ username: 'bob' });
    // 模拟服务器重启后 SECRET 改了
    __setSecret('new-secret-after-restart');
    const res = await makeRequest(app, 'GET', `/api/diag/auth-debug?token=${encodeURIComponent(tok)}`);
    const d = res.body.data;
    assert.equal(d.tokenValid, false);
    assert.equal(d.tokenError, 'signature_mismatch（SECRET 改了！）');
  });

  it('/api/diag/auth-debug 识别过期 token', async () => {
    const { signToken } = require('../middleware/auth');
    // TTL=-1000 = 已过期
    const tok = signToken({ username: 'carol' }, -1000);
    const res = await makeRequest(app, 'GET', `/api/diag/auth-debug?token=${encodeURIComponent(tok)}`);
    const d = res.body.data;
    assert.equal(d.tokenValid, false);
    assert.equal(d.tokenExpired, true);
    assert.match(d.tokenError, /token_expired/);
  });
});