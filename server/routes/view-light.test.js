// ====== /api/player/:u/view-light 路由测试 · v1.03 杠杆 2+4 ======
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');

const TMP = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'vl-'));

function setupStore() {
  process.env.DB_ENGINE = 'json';
  process.env.DB_PATH = require('path').join(TMP, 'db-' + Date.now() + Math.random().toString(36).slice(2,4) + '.json');
  ['./store', './store-json', './store-sqlite'].forEach(p => { try { delete require.cache[require.resolve(p)]; } catch (_) {} });
  return require('../store');
}

function makeRequest(app, method, url, headers = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      const req = http.request({ host: '127.0.0.1', port, path: url, method, headers }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => { server.close(); try { resolve({ status: res.statusCode, json: JSON.parse(body) }); } catch (_) { resolve({ status: res.statusCode, body }); } });
      });
      req.on('error', reject);
      req.end();
    });
  });
}

describe('/api/player/:u/view-light 端点', () => {
  let store, app;
  before(() => {
    store = setupStore();
    store.__setDisableSave(true);
    app = express();
    app.use(express.json());
    const { registerPlayerRoutes } = require('./player');
    registerPlayerRoutes(app, store);
    // 测试玩家
    store.setPlayer('test', {
      username: 'test', name: 'Tester', level: 10, exp: 0, lastTick: 1000,
      attributes: { atk: 10, def: 5, hp: 5, agi: 8 }, attrPoints: 0, skillPoints: 0,
      race: '鹰人', raceStage: 0, job: '无', jobPath: null, godhood: null, faith: 0,
      maxHp: 100, maxMp: 50, hp: 100, mp: 50,
      gold: 0, killCount: 0, reincarnation: 0,
      stats: { maxClearedArea: 'gaomanshan' },
      inventory: [], equips: [], equipped: { weapon: null, armor: null, accessory: null },
      affixes: { active: null, passive: [] },
      dailyQuests: [], achievements: {}, questStats: {},
      titles: {}, currentTitle: null,
      pvpStats: { wins: 0, losses: 0, rating: 1000 },
      combatStats: { totalWins: 0 },
      attrPresets: [],
      settlementLedger: [],
      cockfight: { history: [] },
      expedition: null, expeditionHistory: [], expeditionReports: {}, expeditionCodex: {},
      dailyActive: { points: 0, claimed: [], rewards: {} },
      guildId: null,
      laws: [],
    });
  });
  after(() => { store.__setDisableSave(false); delete process.env.DB_ENGINE; delete process.env.DB_PATH; });

  it('GET /view-light → 200 + cached:false（首次）', async () => {
    const r = await makeRequest(app, 'GET', '/api/player/test/view-light');
    assert.equal(r.status, 200);
    assert.equal(r.json.success, true);
    assert.equal(r.json.cached, false, '首次应当是 cached:false');
    assert.equal(r.json.data.player.level, 10);
  });

  it('GET /view-light 第二次 → cached:true（命中）', async () => {
    const r = await makeRequest(app, 'GET', '/api/player/test/view-light');
    assert.equal(r.json.cached, true, '第二次应当命中缓存');
    assert.equal(r.json.data.player.level, 10);
  });

  it('写入 player 后 → 缓存失效', async () => {
    // 修改 player（lastTick 变了）
    const p = store.getPlayer('test');
    p.lastTick = 2000;
    store.setPlayer('test', p);
    const r = await makeRequest(app, 'GET', '/api/player/test/view-light');
    assert.equal(r.json.cached, false, 'setPlayer 后应当失效');
  });

  it('GET /view-light 玩家不存在 → 404', async () => {
    const r = await makeRequest(app, 'GET', '/api/player/nonexist/view-light');
    assert.equal(r.status, 404);
  });

  it('GET /api/player/:u 仍然走 withTransaction（向后兼容）', async () => {
    const r = await makeRequest(app, 'GET', '/api/player/test');
    assert.equal(r.status, 200);
    assert.ok(r.json.data.player);
    // 旧接口响应结构不变
    assert.ok('data' in r.json);
    assert.ok('player' in r.json);
  });

  it('view 缓存命中时响应快（< 50ms）', async () => {
    // 预热一次
    await makeRequest(app, 'GET', '/api/player/test/view-light');
    const t0 = Date.now();
    const r = await makeRequest(app, 'GET', '/api/player/test/view-light');
    const dur = Date.now() - t0;
    assert.equal(r.json.cached, true);
    assert.ok(dur < 50, `缓存命中响应应当 < 50ms，实际 ${dur}ms`);
  });
});