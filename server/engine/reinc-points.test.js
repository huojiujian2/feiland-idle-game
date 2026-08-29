// ====== T-015 转生点公式 + 商店递增价格 ======
// 规则：
//   1) 第一次转生（rc=0→1）：100 级 → 10 点
//   2) 后续转生：floor(等级 / 100)
//        100 → 2, 200 → 4, 500 → 10, 1000 → 20
//   3) 商店商品购买第 N 次时，价格 = N 点（每个商品独立计数）
//        累计消耗 = 1 + 2 + ... + N = N(N+1)/2
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../engine');

describe('T-015 转生点公式 + 商店递增价格', () => {
  beforeEach(() => engine.__resetSeams());
  afterEach(() => engine.__resetSeams());

  // 工具：模拟"满足转生条件"的玩家
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
    return p;
  }

  // ============================================
  // 转生点获取
  // ============================================
  describe('转生点获取公式', () => {
    it('1) 第一次转生（rc=0→1）100 级 → 10 点（特殊值）', () => {
      const p = makeReadyPlayer('u1', 100, 0);
      const r = engine.doReincarnate(p);
      assert.equal(r.success, true);
      assert.equal(r.earnedPoints, 10, '第一次转生 100 级 = 10 点');
    });

    it('2) 第二次转生（rc=1→2）100 级 → 2 点', () => {
      const p = makeReadyPlayer('u2', 100, 1);
      const r = engine.doReincarnate(p);
      assert.equal(r.success, true);
      assert.equal(r.earnedPoints, 2, '第二次转生 100 级 = 2 点（floor(100/100)）');
    });

    it('3) 第三次转生（rc=2→3）200 级 → 4 点', () => {
      const p = makeReadyPlayer('u3', 200, 2);
      const r = engine.doReincarnate(p);
      assert.equal(r.success, true);
      assert.equal(r.earnedPoints, 4, '第三次转生 200 级 = 4 点（floor(200/100)）');
    });

    it('4) 第四次转生（rc=3→4）500 级 → 10 点', () => {
      const p = makeReadyPlayer('u4', 500, 3);
      const r = engine.doReincarnate(p);
      assert.equal(r.success, true);
      assert.equal(r.earnedPoints, 10);
    });

    it('5) 第五次转生（rc=4→5）1000 级 → 20 点', () => {
      const p = makeReadyPlayer('u5', 1000, 4);
      const r = engine.doReincarnate(p);
      assert.equal(r.success, true);
      assert.equal(r.earnedPoints, 20);
    });

    it('6) 第一次转生 150 级 → 仍是 10 点（不按等级，仅第一次给 10）', () => {
      // 第一次是特殊值，跟等级无关
      const p = makeReadyPlayer('u6', 150, 0);
      const r = engine.doReincarnate(p);
      assert.equal(r.earnedPoints, 10);
    });

    it('7) 第二次转生 200 级 → 4 点（floor(200/50)=4）', () => {
      const p = makeReadyPlayer('u7', 200, 1);
      const r = engine.doReincarnate(p);
      assert.equal(r.earnedPoints, 4, '200 级 = floor(200/50) = 4');
    });

    it('8) 第二次转生 500 级 → 10 点（floor(500/50)=10）', () => {
      const p = makeReadyPlayer('u8', 500, 1);
      const r = engine.doReincarnate(p);
      assert.equal(r.earnedPoints, 10, '500 级 = floor(500/50) = 10');
    });
  });

  // ============================================
  // 商店递增价格
  // ============================================
  describe('商店递增价格（每个商品独立计数）', () => {
    it('1) 经验祝福·微 第 1 次购买：1 点', () => {
      const p = makeReadyPlayer('u1', 100, 0);
      p.reincPoints = 999;
      const r = engine.buyReincShopItem(p, 'exp_potion');
      assert.equal(r.success, true);
      assert.equal(r.cost, 1, '第 1 次价格 = 1');
      assert.equal(p.reincPoints, 998, '扣 1 点后剩 998');
    });

    it('2) 经验祝福·微 第 2 次购买：2 点', () => {
      const p = makeReadyPlayer('u2', 100, 0);
      p.reincPoints = 999;
      engine.buyReincShopItem(p, 'exp_potion');
      const r = engine.buyReincShopItem(p, 'exp_potion');
      assert.equal(r.success, true);
      assert.equal(r.cost, 2, '第 2 次价格 = 2');
      // 第 1 次扣 1（剩 998），第 2 次扣 2（剩 996）→ 累计扣 3
      assert.equal(p.reincPoints, 996, '扣 1+2=3 后剩 996');
    });

    it('3) 经验祝福·微 第 N 次购买：N 点（累加成本 = 1+2+...+N）', () => {
      const p = makeReadyPlayer('u3', 100, 0);
      p.reincPoints = 1000;
      let totalCost = 0;
      for (let n = 1; n <= 10; n++) {
        const r = engine.buyReincShopItem(p, 'exp_potion');
        assert.equal(r.success, true);
        assert.equal(r.cost, n, `第 ${n} 次价格 = ${n}`);
        totalCost += n;
        // 累计消耗 = N(N+1)/2
        const expected = n * (n + 1) / 2;
        assert.equal(totalCost, expected, `第 ${n} 次累计消耗 = ${expected}`);
        assert.equal(1000 - p.reincPoints, expected, '实际扣的点数应等于累计消耗');
      }
    });

    it('4) 不同商品独立计数：买经验 3 次 + 攻击 2 次 → 经验第 4 次还是 4 点（不是 5 点）', () => {
      const p = makeReadyPlayer('u4', 100, 0);
      p.reincPoints = 999;
      engine.buyReincShopItem(p, 'exp_potion');     // 经验 1
      engine.buyReincShopItem(p, 'exp_potion');     // 经验 2
      engine.buyReincShopItem(p, 'exp_potion');     // 经验 3
      engine.buyReincShopItem(p, 'attr_potion_atk');// 攻击 1
      engine.buyReincShopItem(p, 'attr_potion_atk');// 攻击 2
      // 经验第 4 次
      const r1 = engine.buyReincShopItem(p, 'exp_potion');
      assert.equal(r1.cost, 4, '经验第 4 次价格 = 4（不累加攻击次数）');
      // 攻击第 3 次
      const r2 = engine.buyReincShopItem(p, 'attr_potion_atk');
      assert.equal(r2.cost, 3, '攻击第 3 次价格 = 3（不累加经验次数）');
    });

    it('5) 转生点不够时购买失败（不扣点）', () => {
      const p = makeReadyPlayer('u5', 100, 0);
      p.reincPoints = 2;
      // 第 1 次 = 1 点，买得起
      let r = engine.buyReincShopItem(p, 'exp_potion');
      assert.equal(r.success, true);
      assert.equal(p.reincPoints, 1);
      // 第 2 次 = 2 点，买不起
      r = engine.buyReincShopItem(p, 'exp_potion');
      assert.equal(r.success, false);
      assert.equal(p.reincPoints, 1, '买不起时不应扣点');
    });

    it('6) 商品「下一次价格」= 已买次数 + 1（在 getReincShop 返回 cost = 下次购买的实际价格）', () => {
      // 通过 getReincShop 拿"当前状态下"商品列表
      // cost 字段应反映该商品"已经买过 N 次后再买"的价格
      const p = makeReadyPlayer('u6', 100, 0);
      p.reincPoints = 999;
      const shop1 = engine.getReincShop(p);
      // 第一次 cost 应该 = 1
      const expItem1 = shop1.find(i => i.id === 'exp_potion');
      assert.equal(expItem1.cost, 1, '没买过前 cost = 1');

      engine.buyReincShopItem(p, 'exp_potion');
      engine.buyReincShopItem(p, 'exp_potion');

      const shop2 = engine.getReincShop(p);
      const expItem2 = shop2.find(i => i.id === 'exp_potion');
      assert.equal(expItem2.cost, 3, '买过 2 次后 cost = 3（第 3 次价格）');
    });
  });

  // ============================================
  // 商店物品效果（v8）：
  //   经验/金币祝福·微：+1% / 0.01
  //   攻击/防御/生命/敏捷之魂：+2% / 0.02 基础属性永久增幅（不是 flat）
  // ============================================
  describe('商店物品效果（v8）', () => {
    it('7) 经验祝福·微 每买 1 次 +0.01 (1%)，封顶 0.60', () => {
      const p = makeReadyPlayer('u7', 100, 0);
      p.reincPoints = 999;
      engine.buyReincShopItem(p, 'exp_potion');
      assert.equal(p.permanentBuffs.expBonus, 0.01);
      engine.buyReincShopItem(p, 'exp_potion');
      assert.equal(p.permanentBuffs.expBonus, 0.02);
    });

    it('7.5) 财富祝福·微 每买 1 次 +0.01 (1%)', () => {
      const p = makeReadyPlayer('u7b', 100, 0);
      p.reincPoints = 999;
      engine.buyReincShopItem(p, 'gold_potion');
      assert.equal(p.permanentBuffs.goldBonus, 0.01);
    });

    it('8) 攻击之魂 每买 1 次 +0.02 (2%) 基础攻击永久增幅（v8 改为百分比）', () => {
      const p = makeReadyPlayer('u8', 100, 0);
      p.reincPoints = 999;
      engine.buyReincShopItem(p, 'attr_potion_atk');
      // v8：不是 flat +10，而是百分比 +0.02
      assert.equal(p.permanentBuffs.baseAtkPercent, 0.02, '买 1 次攻击之魂 → +2%');
      assert.equal(p.permanentBuffs.baseAtkBonus, undefined, 'baseAtkBonus 不再使用');
      engine.buyReincShopItem(p, 'attr_potion_atk');
      assert.equal(p.permanentBuffs.baseAtkPercent, 0.04, '买 2 次 → +4%');
    });

    it('8.5) 4 个属性之魂都改百分比：def/hp/agi 各 +0.02', () => {
      const p = makeReadyPlayer('u8b', 100, 0);
      p.reincPoints = 999;
      engine.buyReincShopItem(p, 'attr_potion_def');
      assert.equal(p.permanentBuffs.baseDefPercent, 0.02);
      engine.buyReincShopItem(p, 'attr_potion_hp');
      assert.equal(p.permanentBuffs.baseHpPercent, 0.02);
      engine.buyReincShopItem(p, 'attr_potion_agi');
      assert.equal(p.permanentBuffs.baseAgiPercent, 0.02);
    });

    it('9) 经验祝福·微 买满 60 次到封顶 0.60（v8 改为 +1%/次）', () => {
      const p = makeReadyPlayer('u9', 100, 0);
      p.reincPoints = 2000;
      for (let n = 0; n < 60; n++) {
        engine.buyReincShopItem(p, 'exp_potion');
      }
      assert.equal(p.permanentBuffs.expBonus, 0.60, '60 次 × 0.01 = 0.60（封顶）');
    });
  });

  // ============================================
  // 购买后实时刷新（不重新进 Tab）
  //   场景：连续买 3 次经验祝福·微 → 下次 cost = 4，boughtCount = 3
  //   必须不需要重新调用 getReincShop(player) 就能从返回值拿到这些信息
  //   （v7 已经在 buyReincShopItem 返回值里带 cost + boughtCount）
  // ============================================
  describe('购买后实时刷新（buyReincShopItem 返回值带 cost + boughtCount）', () => {
    it('10) 买 1 次后 buyReincShopItem 返回值含 cost=1, boughtCount=1', () => {
      const p = makeReadyPlayer('u10', 100, 0);
      p.reincPoints = 999;
      const r = engine.buyReincShopItem(p, 'exp_potion');
      assert.equal(r.success, true);
      assert.equal(r.cost, 1);
      assert.equal(r.boughtCount, 1);
    });

    it('11) 买 3 次后 boughtCount=3、cost=3、boughtCount++ 累加', () => {
      const p = makeReadyPlayer('u11', 100, 0);
      p.reincPoints = 999;
      let r;
      r = engine.buyReincShopItem(p, 'exp_potion');
      assert.equal(r.boughtCount, 1);
      r = engine.buyReincShopItem(p, 'exp_potion');
      assert.equal(r.boughtCount, 2);
      r = engine.buyReincShopItem(p, 'exp_potion');
      assert.equal(r.boughtCount, 3);
      assert.equal(r.cost, 3, '第 3 次价格 = 3');
    });

    it('12) 购买后 getReincShop(player) 不需要"重新进 Tab"——立刻返回新 cost', () => {
      // 关键：买完一次就立刻拿新 cost，前端不需要任何额外操作
      const p = makeReadyPlayer('u12', 100, 0);
      p.reincPoints = 999;

      const shopBefore = engine.getReincShop(p);
      const before = shopBefore.find(i => i.id === 'exp_potion');
      assert.equal(before.cost, 1, '买前 cost = 1');
      assert.equal(before.boughtCount, 0);

      engine.buyReincShopItem(p, 'exp_potion');

      const shopAfter = engine.getReincShop(p);  // 立刻拿（不重进 Tab）
      const after = shopAfter.find(i => i.id === 'exp_potion');
      assert.equal(after.cost, 2, '买 1 次后 cost = 2（实时）');
      assert.equal(after.boughtCount, 1, '买 1 次后 boughtCount = 1（实时）');
    });
  });
});
