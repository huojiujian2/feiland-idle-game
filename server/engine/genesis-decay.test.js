// ====== 创世装备衰减测试 · v1.03 · 2026-08-31 ======
const test = require('node:test');
const assert = require('node:assert');
const engine = require('./index');

test('decayEquipsMax: 衰减 5% 一次', () => {
  const world = { equipsMax: { a1: { weapon: 1000 } } };
  // 直接调内部函数
  const genesis = require('./genesis');
  genesis.decayEquipsMax(world, 'a1', 'weapon', 100);
  // 1000 * 0.95 = 950，floor = 100 * 0.6 = 60，取 max = 950
  assert.strictEqual(world.equipsMax.a1.weapon, 950);
});

test('decayEquipsMax: 保底 floor', () => {
  const world = { equipsMax: { a1: { weapon: 100 } } };
  const genesis = require('./genesis');
  genesis.decayEquipsMax(world, 'a1', 'weapon', 1000);
  // 100 * 0.95 = 95，floor = 1000 * 0.6 = 600，取 max = 600
  assert.strictEqual(world.equipsMax.a1.weapon, 600);
});

test('decayEquipsMax: 多次衰减最终趋向 floor', () => {
  const world = { equipsMax: { a1: { weapon: 10000 } } };
  const genesis = require('./genesis');
  for (let i = 0; i < 50; i++) genesis.decayEquipsMax(world, 'a1', 'weapon', 1000);
  // 10000 * 0.95^50 ≈ 769
  assert.ok(world.equipsMax.a1.weapon >= 600 && world.equipsMax.a1.weapon <= 1000,
    `应接近 floor 600，实际 ${world.equipsMax.a1.weapon}`);
});

test('maybeDecayGenesisEquips: 首次调用衰减并记录 dayKey', () => {
  const { _fake } = require('./index');
  const tmp = require('path').join(require('os').tmpdir(), `genesis-decay-${Date.now()}.json`);
  process.env.DB_ENGINE = 'json';
  const store = require('../store');
  store.__setDbPath(tmp); store.__resetStore(); store.load();
  // 写一个装备 max
  store.getMeta().genesis = { monsters: [], equips: [], equipsMax: { a1: { weapon: 5000 } } };
  store.setMeta(store.getMeta());
  engine.maybeDecayGenesisEquips(store);
  // 应已衰减到 ≤ 5000 且 ≥ floor
  const v = store.getMeta().genesis.equipsMax.a1.weapon;
  assert.ok(v < 5000, `应衰减，实际 ${v}`);
  assert.ok(v >= 300, `不应低于 floor 300，实际 ${v}`);
  // 应记录 dayKey
  assert.ok(store.getMeta().lastDecayDayKey);
  store.__resetStore(); store.cancelSaveTimer();
  try { require('fs').unlinkSync(tmp) } catch (_) {}
  try { require('fs').unlinkSync(tmp + '.bak') } catch (_) {}
});

test('maybeDecayGenesisEquips: 同日二次调用为幂等', () => {
  const tmp = require('path').join(require('os').tmpdir(), `genesis-decay-idem-${Date.now()}.json`);
  process.env.DB_ENGINE = 'json';
  const store = require('../store');
  store.__setDbPath(tmp); store.__resetStore(); store.load();
  store.getMeta().genesis = { monsters: [], equips: [], equipsMax: { a1: { weapon: 5000 } } };
  store.setMeta(store.getMeta());
  engine.maybeDecayGenesisEquips(store);
  const v1 = store.getMeta().genesis.equipsMax.a1.weapon;
  engine.maybeDecayGenesisEquips(store); // 同日二次
  const v2 = store.getMeta().genesis.equipsMax.a1.weapon;
  assert.strictEqual(v1, v2, '同日二次调用不应再衰减');
  store.__resetStore(); store.cancelSaveTimer();
  try { require('fs').unlinkSync(tmp) } catch (_) {}
  try { require('fs').unlinkSync(tmp + '.bak') } catch (_) {}
});