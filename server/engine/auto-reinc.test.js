// ====== 内测工具：一键转生（用金币按"高级经验卷轴"购买力速升等级后连续转生） ======
// 规则：
//   1) targetLevel 必须 >= 100（转生条件）
//   2) 每轮：算出当前等级 → targetLevel 所需经验，按高级经验卷轴（800 金币 / 3000 经验）折算卷轴数
//        卷轴数 = ceil(所需经验 / 3000)，花费金币 = 卷轴数 × 800
//   3) 金币不够时停止，返回已完成轮数（部分成功）
//   4) 每轮转生走 doReincarnate（等级/经验/属性重置，永久加成累加，转生点按公式给）
//   5) 通关条件（龙岛）沿用 doReincarnate 校验
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../engine');
const { expToNext } = require('../data');

describe('内测：一键转生 autoReincarnate', () => {
  beforeEach(() => engine.__resetSeams());
  afterEach(() => engine.__resetSeams());

  function makeReadyPlayer(username, level = 100, reincarnation = 0) {
    const p = engine.createCharacter(username, username);
    p.level = level;
    p.godhood = 'god';
    p.faith = 5000;
    p.reincarnation = reincarnation;
    p.stats = { maxClearedArea: 'longdao' };
    p.attributes = { atk: 200, def: 200, hp: 200, agi: 200 };
    p.equips = [];
    p.equipped = { weapon: null, armor: null, accessory: null };
    p.reincPoints = 0;
    p.gold = 0;
    return p;
  }

  // 从 level=1、exp=0 升到 targetLevel 所需总经验
  function expNeededFrom1(targetLevel) {
    let sum = 0;
    for (let l = 1; l < targetLevel; l++) sum += expToNext(l);
    return sum;
  }

  it('1) 参数校验：targetLevel < 100 拒绝', () => {
    const p = makeReadyPlayer('ar1');
    const r = engine.autoReincarnate(p, 1, 99);
    assert.equal(r.success, false);
    assert.match(r.message, /100/);
  });

  it('2) 参数校验：times < 1 拒绝', () => {
    const p = makeReadyPlayer('ar2');
    const r = engine.autoReincarnate(p, 0, 100);
    assert.equal(r.success, false);
  });

  it('3) 金币足够：完成指定轮数，等级重置、转生次数/点数正确', () => {
    const p = makeReadyPlayer('ar3', 100, 0);
    p.gold = 1e9;
    const goldBefore = p.gold;
    const r = engine.autoReincarnate(p, 3, 100);
    assert.equal(r.success, true);
    assert.equal(r.completed, 3, '完成 3 轮');
    assert.equal(p.reincarnation, 3, '转生 3 次');
    // 第 1 次 10 点（特殊值）+ 第 2/3 次各 floor(100/50)=2 点
    assert.equal(p.reincPoints, 10 + 2 + 2);
    assert.equal(p.level, 1, '最终等级重置为 1');
    // 金币消耗：第 1 轮等级已是 100 不用买；第 2、3 轮从 1 级升到 100
    const oneRun = Math.ceil(expNeededFrom1(100) / 3000) * 800;
    assert.equal(goldBefore - p.gold, oneRun * 2);
  });

  it('4) 金币不足：部分完成并说明还差多少', () => {
    const p = makeReadyPlayer('ar4', 100, 0);
    // 第 1 轮（已是 100 级）免费；给的钱只够第 2 轮一半
    const oneRun = Math.ceil(expNeededFrom1(100) / 3000) * 800;
    p.gold = Math.floor(oneRun / 2);
    const r = engine.autoReincarnate(p, 3, 100);
    assert.equal(r.success, true);
    assert.equal(r.completed, 1, '只完成第 1 轮（免费那次）');
    assert.equal(p.reincarnation, 1);
    assert.match(r.message, /金币不足/);
    assert.equal(r.stoppedAt, 2);
  });

  it('5) 金币为 0 且等级不足 100：一轮也完成不了', () => {
    const p = makeReadyPlayer('ar5', 1, 0);
    p.gold = 0;
    const r = engine.autoReincarnate(p, 2, 100);
    assert.equal(r.success, true);
    assert.equal(r.completed, 0);
    assert.equal(p.reincarnation, 0, '没有发生转生');
  });

  it('6) 从 1 级带部分经验开始：经验抵扣后按需买卷轴', () => {
    const p = makeReadyPlayer('ar6', 1, 0);
    p.gold = 1e9;
    // 预置一些经验，应减少卷轴购买量
    p.exp = 100000;
    const goldBefore = p.gold;
    const r = engine.autoReincarnate(p, 1, 100);
    assert.equal(r.success, true);
    assert.equal(r.completed, 1);
    const need = expNeededFrom1(100) - 100000;
    const cost = Math.ceil(need / 3000) * 800;
    assert.equal(goldBefore - p.gold, cost, '按扣掉已有经验后的缺口买卷轴');
  });

  it('7) 未通关龙岛：直接失败', () => {
    const p = makeReadyPlayer('ar7', 100, 0);
    p.stats = { maxClearedArea: 'gaomanshan' };
    p.gold = 1e9;
    const r = engine.autoReincarnate(p, 1, 100);
    assert.equal(r.success, false);
    assert.match(r.message, /龙岛/);
  });
});
