// ====== T-014 nextBuffs 是单次增量（不是「下级总值 - 当前值」） ======
// 修复前 bug：nextBuffs.expBonus = min(0.60 - current, 0.01)
//             → 当 current = 0.46 时 nextBuffs = 0.14，前端算 nextBuffs - permanentBuffs = 0.14 - 0.46 = -0.32 = -32%
//             → 前端显示「转生 1 次后将获得：-32%」（用户截图看到的 "-45%" 类似问题）
// 修复后：nextBuffs 直接返回单次增量（+0.01/+1），不做差值运算
//         封顶保护由 doReincarnate 里的 Math.min 兜底
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../engine');

describe('T-014 nextBuffs 是单次增量（不是差值）', () => {
  beforeEach(() => engine.__resetSeams());
  afterEach(() => engine.__resetSeams());

  function makePlayer(username) {
    const p = engine.createCharacter(username, username);
    p.level = 100;
    p.godhood = 'god';
    p.faith = 5000;
    p.reincarnation = 0;
    p.stats = { maxClearedArea: 'longdao' };
    p.attributes = { atk: 200, def: 200, hp: 200, agi: 200 };
    p.equips = [];
    p.equipped = { weapon: null, armor: null, accessory: null };
    return p;
  }

  it('1) 当前 expBonus = 0：nextBuffs.expBonus 应 = 0.01（+1%）', () => {
    const p = makePlayer('u1');
    p.permanentBuffs = {
      expBonus: 0, goldBonus: 0,
      baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0,
    };
    const info = engine.getReincarnationInfo(p);
    assert.equal(info.nextBuffs.expBonus, 0.01);
    assert.equal(info.nextBuffs.goldBonus, 0.01);
    assert.equal(info.nextBuffs.baseAtkBonus, 1);
  });

  it('2) 当前 expBonus = 0.46（接近封顶）：nextBuffs.expBonus 仍 = 0.01（不是 -0.45）', () => {
    const p = makePlayer('u2');
    p.permanentBuffs = {
      expBonus: 0.46, goldBonus: 0.46,
      baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0,
    };
    const info = engine.getReincarnationInfo(p);
    // 关键：nextBuffs 是单次增量 +0.01，永远是正数
    assert.equal(info.nextBuffs.expBonus, 0.01,
      'nextBuffs 是单次增量，不会变成负数');
    assert.equal(info.nextBuffs.goldBonus, 0.01);
  });

  it('3) 当前 expBonus = 0.60（已封顶）：nextBuffs.expBonus 应 = 0（再加也是 0）', () => {
    const p = makePlayer('u3');
    p.permanentBuffs = {
      expBonus: 0.60, goldBonus: 0.60,
      baseAtkBonus: 50, baseDefBonus: 50, baseHpBonus: 50, baseAgiBonus: 50,
    };
    const info = engine.getReincarnationInfo(p);
    // 关键：封顶后 nextBuffs 应该是 0（再加也加不上去）
    assert.equal(info.nextBuffs.expBonus, 0, '封顶后经验 nextBuffs 应为 0');
    assert.equal(info.nextBuffs.goldBonus, 0, '封顶后金币 nextBuffs 应为 0');
    // 基础 4 维无封顶，永远 +1
    assert.equal(info.nextBuffs.baseAtkBonus, 1);
    assert.equal(info.nextBuffs.baseDefBonus, 1);
    assert.equal(info.nextBuffs.baseHpBonus, 1);
    assert.equal(info.nextBuffs.baseAgiBonus, 1);
  });

  it('3.5) 接近封顶时（0.595）：nextBuffs.expBonus 应 = 0.01 - 0.005 = 0.005（不会超封顶）', () => {
    const p = makePlayer('u3b');
    p.permanentBuffs = {
      expBonus: 0.595, goldBonus: 0.595,
      baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0,
    };
    const info = engine.getReincarnationInfo(p);
    // 0.595 + 0.01 = 0.605 → 实际只能拿到 0.005
    assert.ok(Math.abs(info.nextBuffs.expBonus - 0.005) < 1e-9,
      `0.595 时 nextBuffs 应为 0.005，实际 ${info.nextBuffs.expBonus}`);
  });

  it('3.6) v9 最终设计：转生给 flat +1（baseXBonus），增幅（baseXPercent）只来自商店购买', () => {
    const p = makePlayer('u3c');
    p.permanentBuffs = {
      expBonus: 0, goldBonus: 0,
      baseAtkPercent: 0.02, baseDefPercent: 0.02, baseHpPercent: 0.02, baseAgiPercent: 0.02,
    };
    const info = engine.getReincarnationInfo(p);
    // 转生单次增量：基础 4 维 flat +1（前端"转生 1 次后将获得：各 +1"）
    assert.equal(info.nextBuffs.baseAtkBonus, 1, 'nextBuffs.baseAtkBonus = 1（flat）');
    assert.equal(info.nextBuffs.baseDefBonus, 1, 'nextBuffs.baseDefBonus = 1（flat）');
    assert.equal(info.nextBuffs.baseHpBonus, 1, 'nextBuffs.baseHpBonus = 1（flat）');
    assert.equal(info.nextBuffs.baseAgiBonus, 1, 'nextBuffs.baseAgiBonus = 1（flat）');
    // 增幅不在 nextBuffs 里承诺（baseXPercent 由转生点商店购买，转生只保留不加）
    assert.equal(info.nextBuffs.baseAtkPercent, undefined, 'nextBuffs 不含 baseAtkPercent');
    // permanentBuffs 原样返回当前增幅（前端"攻击/防御/生命/敏捷增幅"显示用）
    assert.equal(info.permanentBuffs.baseAtkPercent, 0.02, 'permanentBuffs.baseAtkPercent 原样返回');
  });

  it('4) 多次调用结果一致（幂等）', () => {
    const p = makePlayer('u4');
    p.permanentBuffs = {
      expBonus: 0.20, goldBonus: 0.30,
      baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0,
    };
    const info1 = engine.getReincarnationInfo(p);
    const info2 = engine.getReincarnationInfo(p);
    assert.deepEqual(info1.nextBuffs, info2.nextBuffs);
  });

  it('5) 真实转生流程：permanentBuffs=0.46 → 转生 1 次 → permanentBuffs 应 = min(0.60, 0.47) = 0.47（封顶生效）', () => {
    const p = makePlayer('u5');
    p.permanentBuffs = {
      expBonus: 0.46, goldBonus: 0.46,
      baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0,
    };
    // 真实转生
    engine.doReincarnate(p);
    // 0.46 + 0.01 = 0.47，未超封顶
    assert.ok(Math.abs(p.permanentBuffs.expBonus - 0.47) < 1e-9,
      `expBonus 应为 0.47，实际 ${p.permanentBuffs.expBonus}`);
  });

  it('6) 真实转生流程：permanentBuffs=0.595 → 转生 1 次 → 应封顶 0.60', () => {
    const p = makePlayer('u6');
    p.permanentBuffs = {
      expBonus: 0.595, goldBonus: 0.595,
      baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0,
    };
    engine.doReincarnate(p);
    // 0.595 + 0.01 = 0.605 → 封顶 0.60
    assert.equal(p.permanentBuffs.expBonus, 0.60);
  });
});
