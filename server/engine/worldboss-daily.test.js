// ====== T-010 世界 BOSS 每日一次挑战（时区统一修复） ======
// 背景 bug：BOSS 重生/过期用本地时间（北京 0 点），但 spawnDayKey / lastBossAttackDay
//   判定用 UTC 日期（toISOString().slice(0,10)，比北京晚 8 小时），导致：
//   1) 北京 0:00-8:00 打过的玩家，8 点 UTC 翻日后同一天能再打一次
//   2) 昨天打过的玩家，今天新 BOSS 0 点重生后在 0:00-8:00 窗口反而被拒
//   3) BOSS 在北京 8 点（UTC 翻日）被 spawnDayKey 判定"跨日"而额外重生一次
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('./index.js');

function makeStore(players) {
  const meta = {};
  return {
    getMeta: () => meta,
    setMeta: (m) => { Object.assign(meta, m); },
    getPlayer: (u) => players[u],
    setPlayer: (u, p) => { players[u] = p; },
    getAllPlayers: () => Object.values(players),
    save: () => {},
  };
}

function makePlayer(username, level) {
  const p = engine.createCharacter(username, username);
  p.level = level;
  p.attributes = { atk: 10 + level * 5, def: 8 + level * 4, hp: 10 + level * 4, agi: 8 + level * 3 };
  p.hp = p.maxHp = 1000 + level * 100;
  p.mp = p.maxMp = 500 + level * 50;
  p.exp = 0;
  return p;
}

// 北京时间辅助：直接构造绝对时间戳（不依赖运行机器时区）
const bj = (s) => new Date(s + '+08:00').getTime();

describe('T-010 世界 BOSS 每日一次（北京时区统一）', () => {
  beforeEach(() => engine.__resetSeams());
  afterEach(() => engine.__resetSeams());

  it('1) 同一自然日内：打过一次后当天再打（含 UTC 翻日窗口）应被拒绝', () => {
    const store = makeStore({ u1: makePlayer('u1', 50) });
    // 北京 8/29 07:00（UTC 仍是 8/28）打第一次
    engine.__setNow(() => bj('2026-08-29T07:00:00'));
    const r1 = engine.attackWorldBoss(store, 'u1');
    assert.equal(r1.success, true, '当天第一次应成功');
    // 北京 8/29 09:00（UTC 已翻到 8/29）再打 → 仍是同一北京日，应被拒绝
    engine.__setNow(() => bj('2026-08-29T09:00:00'));
    const r2 = engine.attackWorldBoss(store, 'u1');
    assert.equal(r2.success, false, 'UTC 翻日不应重置当日挑战次数');
    assert.match(r2.message, /次数已用完/);
  });

  it('2) BOSS 不会因 UTC 翻日被提前重生（北京同一天返回同一只）', () => {
    const store = makeStore({ u1: makePlayer('u1', 50) });
    // 北京 8/29 00:30 生成 BOSS
    engine.__setNow(() => bj('2026-08-29T00:30:00'));
    const b1 = engine.getActiveBoss(store);
    const id1 = b1.id;
    b1.hp = b1.hp - 123; // 模拟已造成伤害
    // 北京 8/29 09:00（UTC 翻日）→ 不应触发"跨日重生"
    engine.__setNow(() => bj('2026-08-29T09:00:00'));
    const b2 = engine.getActiveBoss(store);
    assert.equal(b2.id, id1, '同一北京日 BOSS 不应重生');
    assert.equal(b2.hp, b1.hp, 'BOSS 血量不应被重置');
  });

  it('3) 昨日已挑战：今日 BOSS 0 点重生后立即可打（0:00-8:00 窗口）', () => {
    const store = makeStore({ u1: makePlayer('u1', 50) });
    // 北京 8/29 20:00 打当日 BOSS
    engine.__setNow(() => bj('2026-08-29T20:00:00'));
    const r1 = engine.attackWorldBoss(store, 'u1');
    assert.equal(r1.success, true, '昨日第一次应成功');
    // 北京 8/30 00:30（新 BOSS 已重生，UTC 仍是 8/29）→ 应立即可打
    engine.__setNow(() => bj('2026-08-30T00:30:00'));
    const r2 = engine.attackWorldBoss(store, 'u1');
    assert.equal(r2.success, true, '次日 0 点 BOSS 重生后应立即可挑战（不应被 UTC 日期拦截）');
  });

  it('4) 北京次日 0 点后：BOSS 强制结算并重生，玩家可再次挑战', () => {
    const store = makeStore({ u1: makePlayer('u1', 50) });
    engine.__setNow(() => bj('2026-08-29T10:00:00'));
    const r1 = engine.attackWorldBoss(store, 'u1');
    assert.equal(r1.success, true);
    // 北京 8/30 01:00：昨日 BOSS 过期结算 + 重生 + 可挑战
    engine.__setNow(() => bj('2026-08-30T01:00:00'));
    const b = engine.getActiveBoss(store);
    assert.equal(b.spawnDayKey, '2026-08-30', '重生后 spawnDayKey 应为北京日期');
    const r2 = engine.attackWorldBoss(store, 'u1');
    assert.equal(r2.success, true, '次日应恢复挑战资格');
  });
});
