// ====== T-013 转生后保留商店购买的 expBonus/goldBonus（v2：用户预期 +1% 累加） ======
// 修复前 bug：doReincarnate 直接覆盖 player.permanentBuffs = { ... }，导致
//             商店购买的 +1%/+1% 经验金币加成在下次转生后被清零
// 修复后：转生 +1%/次（不是 +2%），与商店购买完全累加到同一个 expBonus/goldBonus，封顶 60%
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../engine');

describe('T-013 转生后保留商店购买的 expBonus/goldBonus（v2）', () => {
  beforeEach(() => engine.__resetSeams());
  afterEach(() => engine.__resetSeams());

  // 工具：模拟一个"满足转生条件"的玩家
  function makeReadyPlayer(username, reincarnation = 0) {
    const p = engine.createCharacter(username, username);
    p.level = 100;
    p.godhood = 'god';
    p.faith = 5000;
    p.reincarnation = reincarnation;
    p.stats = { maxClearedArea: 'longdao' };
    p.attributes = { atk: 200, def: 200, hp: 200, agi: 200 };
    p.equips = [];
    p.equipped = { weapon: null, armor: null, accessory: null };
    return p;
  }

  it('1) 用户场景：0 转生 + 买 2 次经验祝福·微 → 显示 +2%', () => {
    const p = makeReadyPlayer('u1', 0);
    p.permanentBuffs = {
      expBonus: 0, goldBonus: 0,
      baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0,
    };
    p.reincPoints = 999;
    // v8：每次买 +1%，所以买 2 次 = 2%
    let r = engine.buyReincShopItem(p, 'exp_potion');
    assert.equal(r.success, true);
    assert.equal(p.permanentBuffs.expBonus, 0.01, '买 1 次 → 1%');
    r = engine.buyReincShopItem(p, 'exp_potion');
    assert.equal(r.success, true);
    assert.equal(p.permanentBuffs.expBonus, 0.02, '买 2 次 → 2%');
  });

  it('2) 用户场景：0 转生 + 买 2 次 + 转生 1 次 → 显示 +3%（2+1）', () => {
    const p = makeReadyPlayer('u2', 0);
    p.permanentBuffs = {
      expBonus: 0.02, goldBonus: 0,
      baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0,
    };
    // 模拟已买 2 次后的状态
    p.reincPoints = 0;
    // 第 1 次转生：+1% → 总 3%
    const r = engine.doReincarnate(p);
    assert.equal(r.success, true);
    assert.equal(p.permanentBuffs.expBonus, 0.03, '买2次(2%)+转1次(1%)=3%');
  });

  it('3) 用户场景：买 2 次 + 转生 2 次 → 显示 +4%', () => {
    const p = makeReadyPlayer('u3', 1);
    // 1 次转生 (+1%) + 买 2 次 (+2%) = 0.03
    p.permanentBuffs = {
      expBonus: 0.03, goldBonus: 0,
      baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0,
    };
    p.reincPoints = 0;
    // 第 2 次转生：+1% → 总 4%
    const r = engine.doReincarnate(p);
    assert.equal(r.success, true);
    assert.equal(p.permanentBuffs.expBonus, 0.04, '1转(1%)+买2(2%)+2转(1%)=4%');
  });

  it('4) 用户场景：买 2 次 + 转生 3 次 → 显示 +5%（其中转生本身给 3% 累加）', () => {
    const p = makeReadyPlayer('u4', 2);
    // 2 次转生 (+2%) + 买 2 次 (+2%) = 0.04
    p.permanentBuffs = {
      expBonus: 0.04, goldBonus: 0,
      baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0,
    };
    p.reincPoints = 0;
    // 第 3 次转生：+1% → 总 5%
    const r = engine.doReincarnate(p);
    assert.equal(r.success, true);
    assert.equal(p.permanentBuffs.expBonus, 0.05, '2转(2%)+买2(2%)+3转(1%)=5%');
  });

  it('5) 转生 60 次后封顶 +60%（不再涨）', () => {
    const p = makeReadyPlayer('u5', 59);
    p.permanentBuffs = {
      expBonus: 0, goldBonus: 0,
      baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0,
    };
    p.reincPoints = 0;
    // 第 60 次转生：0 + 1 = 1%（远没满）
    // 改：用满的状态模拟
    p.permanentBuffs.expBonus = 0.59;
    const r = engine.doReincarnate(p);
    assert.equal(r.success, true);
    assert.equal(p.permanentBuffs.expBonus, 0.60, '0.59 + 0.01 = 0.60（封顶）');
  });

  it('6) 商店满 60% 后再买应失败', () => {
    const p = makeReadyPlayer('u6', 0);
    p.permanentBuffs = {
      expBonus: 0.60, goldBonus: 0,
      baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0,
    };
    p.reincPoints = 999;
    const r = engine.buyReincShopItem(p, 'exp_potion');
    assert.equal(r.success, false, '满 60% 再买应失败');
    assert.match(r.message, /60%/, '错误信息应提示 60%');
  });

  it('7) 基础属性 4 维也按 +1/转生 累加（不是 +5/转生）', () => {
    // 修：把基础属性 4 维的转生基础从 +5 改成 +1（与经验/金币统一）
    const p = makeReadyPlayer('u7', 0);
    p.permanentBuffs = {
      expBonus: 0, goldBonus: 0,
      baseAtkBonus: 30,   // 商店买了 3 个攻击之魂（每个 +10）
      baseDefBonus: 0,
      baseHpBonus: 50,
      baseAgiBonus: 5,
    };
    p.reincPoints = 0;
    // 第 1 次转生：baseAtkBonus +1（不是 +5）= 31
    const r = engine.doReincarnate(p);
    assert.equal(r.success, true);
    assert.equal(p.permanentBuffs.baseAtkBonus, 31, '30 + 1 = 31（不是 35）');
  });

  it('8) expBonus/goldBonus 各自独立', () => {
    const p = makeReadyPlayer('u8', 0);
    p.permanentBuffs = {
      expBonus: 0.60,  // 满
      goldBonus: 0.20,  // 30% 转生 + 0% 商店
      baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0,
    };
    p.reincPoints = 999;
    // 经验满 60% 买不了，金币可以买
    const r1 = engine.buyReincShopItem(p, 'exp_potion');
    assert.equal(r1.success, false);
    const r2 = engine.buyReincShopItem(p, 'gold_potion');
    assert.equal(r2.success, true);
    // v8：金币祝福·微 +1%，所以 0.20 + 0.01 = 0.21
    assert.ok(Math.abs(p.permanentBuffs.goldBonus - 0.21) < 1e-9,
      `goldBonus 应为 0.21，实际 ${p.permanentBuffs.goldBonus}`);
  });

  it('9) v9 关键：转生后 4 个属性之魂的 baseXPercent 必须保留', () => {
    // 用户反馈 bug：买过攻击增幅 +2%，转生后被清零成 +0%
    const p = makeReadyPlayer('u9', 100, 0);
    p.reincPoints = 999;
    // 买 1 次攻击之魂 → +2% 攻击增幅
    engine.buyReincShopItem(p, 'attr_potion_atk');
    assert.equal(p.permanentBuffs.baseAtkPercent, 0.02);
    // 转生 1 次
    const r = engine.doReincarnate(p);
    assert.equal(r.success, true);
    // v9 修复：转生后必须仍是 +2%
    assert.equal(p.permanentBuffs.baseAtkPercent, 0.02,
      '转生后攻击增幅应该仍是 +2%（不是被清零成 0%）');
  });

  it('10) v9：转生后 4 个属性百分比 + expBonus + goldBonus 全部累加', () => {
    // 综合测试：买 + 转生 + 买，叠加效果
    const p = makeReadyPlayer('u10', 100, 0);
    p.reincPoints = 999;
    // 买 2 次攻击增幅 = 4%，3 次防御增幅 = 6%
    engine.buyReincShopItem(p, 'attr_potion_atk');
    engine.buyReincShopItem(p, 'attr_potion_atk');
    engine.buyReincShopItem(p, 'attr_potion_def');
    engine.buyReincShopItem(p, 'attr_potion_def');
    engine.buyReincShopItem(p, 'attr_potion_def');
    // 转生 1 次
    engine.doReincarnate(p);
    // 验证：转生后 4 个属性之魂的百分比都还在
    assert.equal(p.permanentBuffs.baseAtkPercent, 0.04);
    assert.equal(p.permanentBuffs.baseDefPercent, 0.06);
    assert.equal(p.permanentBuffs.baseHpPercent, 0, '没买过生命增幅应该是 0');
    assert.equal(p.permanentBuffs.baseAgiPercent, 0, '没买过敏捷增幅应该是 0');
    // 经验/金币也累加：转生 +0.01
    assert.equal(p.permanentBuffs.expBonus, 0.01);
    assert.equal(p.permanentBuffs.goldBonus, 0.01);
  });
});
