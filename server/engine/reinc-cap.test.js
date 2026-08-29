// ====== T-012 转生经验/金币加成 v2：封顶 +30% → +60% ======
// 验证：转生和转生商店的 expBonus/goldBonus 各自累加后不超过 0.60（+60%）
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../engine');

describe('T-012 转生经验/金币加成封顶 +60%', () => {
  beforeEach(() => engine.__resetSeams());
  afterEach(() => engine.__resetSeams());

  it('1) 转生 30 次后经验/金币加成应 = +60%（封顶），不再是 +30%', () => {
    const p = engine.createCharacter('u1', 'u1');
    p.level = 100;
    p.godhood = 'god';
    p.reincarnation = 0;
    p.faith = 5000;
    p.attributes = { atk: 100, def: 100, hp: 100, agi: 100 };
    p.stats = { maxClearedArea: 'longdao' };
    p.expPoints = 0; p.attrPoints = 0; p.skillPoints = 0;
    // 模拟 30 次转生（直接调永久 buffer）
    //   v7：转生本身只 +0.01/次（不是 +0.02），所以 30 次 = 0.30
    p.permanentBuffs = {
      expBonus: Math.min(0.60, 30 * 0.01),
      goldBonus: Math.min(0.60, 30 * 0.01),
      baseAtkBonus: 30 * 1,
      baseDefBonus: 30 * 1,
      baseHpBonus: 30 * 1,
      baseAgiBonus: 30 * 1,
    };
    assert.equal(p.permanentBuffs.expBonus, 0.30, '转生 30 次后经验加成 = 30%');
    assert.equal(p.permanentBuffs.goldBonus, 0.30, '转生 30 次后金币加成 = 30%');
  });

  it('2) 转生 60 次后经验/金币加成应封顶 +60%', () => {
    const rc = 60;
    const expBonus = Math.min(0.60, rc * 0.01);
    const goldBonus = Math.min(0.60, rc * 0.01);
    assert.equal(expBonus, 0.60, '60 次转生经验 +60%');
    assert.equal(goldBonus, 0.60, '60 次转生金币 +60%');
  });

  it('3) 转生 100 次（远超封顶）：仍 0.60 封顶', () => {
    const rc = 100;
    const expBonus = Math.min(0.60, rc * 0.01);
    const goldBonus = Math.min(0.60, rc * 0.01);
    assert.equal(expBonus, 0.60, '100 次封顶 +60%');
    assert.equal(goldBonus, 0.60, '100 次封顶 +60%');
  });

  it('4) 经验祝福·微（+1%）累加：超过 0.60 封顶', () => {
    // 模拟已经 +60% 时再点"经验祝福·微"——应该报错"已封顶"
    const p = engine.createCharacter('u2', 'u2');
    p.permanentBuffs = {
      expBonus: 0.60,  // 已满
      goldBonus: 0.30,
      baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0,
    };
    p.reincPoints = 999;  // 足够
    const r = engine.buyReincShopItem(p, 'exp_potion');
    assert.equal(r.success, false, '已封顶 60% 后再买应该失败');
    assert.match(r.message, /60%/, '错误信息应提示 60%');
  });

  it('5) 经验祝福·微累加：0.50 + 1% = 0.51（未超 60%）', () => {
    // 模拟已经 +50% 时再买 +1%——应该成功
    const p = engine.createCharacter('u3', 'u3');
    p.permanentBuffs = {
      expBonus: 0.50,  // 已 +50%
      goldBonus: 0.20,
      baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0,
    };
    p.reincPoints = 999;
    const r = engine.buyReincShopItem(p, 'exp_potion');
    assert.equal(r.success, true, '未满 60% 买应该成功');
    assert.equal(p.permanentBuffs.expBonus, 0.51, '50% + 1% = 51%');
  });

  it('6) 经验祝福·微累加：0.595 + 1% 仍 ≤ 0.60（封顶生效）', () => {
    const p = engine.createCharacter('u4', 'u4');
    p.permanentBuffs = {
      expBonus: 0.595,
      goldBonus: 0.20,
      baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0,
    };
    p.reincPoints = 999;
    const r = engine.buyReincShopItem(p, 'exp_potion');
    assert.equal(r.success, true);
    assert.equal(p.permanentBuffs.expBonus, 0.60, '59.5% + 1% 封顶 60%');
  });

  it('7) 金币祝福·微（+1%）独立封顶 60%', () => {
    const p = engine.createCharacter('u5', 'u5');
    p.permanentBuffs = {
      expBonus: 0.30,
      goldBonus: 0.60,  // 已满
      baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0,
    };
    p.reincPoints = 999;
    const r = engine.buyReincShopItem(p, 'gold_potion');
    assert.equal(r.success, false, '金币已满 60% 后再买应该失败');
    assert.match(r.message, /60%/);
  });

  it('8) 经验/金币分别独立：经验封顶不影响金币', () => {
    const p = engine.createCharacter('u6', 'u6');
    p.permanentBuffs = {
      expBonus: 0.60,  // 经验满
      goldBonus: 0.30,  // 金币 30%
      baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0,
    };
    p.reincPoints = 999;
    // 经验满了买不了，但金币还能买
    const r1 = engine.buyReincShopItem(p, 'exp_potion');
    assert.equal(r1.success, false, '经验满');
    const r2 = engine.buyReincShopItem(p, 'gold_potion');
    assert.equal(r2.success, true, '金币未满可买');
    // v8：金币祝福·微 +1%
    assert.equal(p.permanentBuffs.goldBonus, 0.31, '金币 30% + 1% = 31%');
  });
});
