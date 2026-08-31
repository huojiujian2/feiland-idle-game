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
});