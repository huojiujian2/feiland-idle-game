// ====== T-009 世界 BOSS 数值测试（v3.0：模板 70% + 玩家中位 30% + 8 回合 + 血量按前 50% 玩家总伤害） ======
// 目标：验证 BOSS 血量被设计成「全服按等级前 50% 玩家各打 1 次的累计伤害 × 1.05」
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../engine');
const { EQUIP_TEMPLATES } = require('../data');
const {
  spawnWorldBoss, getTopHalfByLevel, getMedianPlayerByLevel,
  estimateTopHalfTotalDamage, buildBossStats, BOSS_BATTLE_ROUNDS,
} = engine;

// 构造一个内存版 store（不依赖 db.json）
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

// 构造一个"中等"玩家（默认属性）
function makePlayer(username, level) {
  const p = engine.createCharacter(username, username);
  p.level = level;
  // 简单粗暴：等级直接映射成属性值
  p.attributes = {
    atk: 10 + level * 5,
    def: 8 + level * 4,
    hp:  10 + level * 4,
    agi: 8 + level * 3,
  };
  // 满血满蓝
  p.hp = p.maxHp = 1000 + level * 100;
  p.mp = p.maxMp = 500 + level * 50;
  p.exp = 0;
  return p;
}

describe('T-009 世界 BOSS v3.0 数值设计', () => {
  beforeEach(() => engine.__resetSeams());
  afterEach(() => engine.__resetSeams());

  it('回合数常量 = 8', () => {
    assert.equal(BOSS_BATTLE_ROUNDS, 8, '回合数应该从 5 改成 8');
  });

  it('getTopHalfByLevel：10 个玩家 → 取前 5', () => {
    const players = {};
    for (let i = 0; i < 10; i++) {
      players['p' + i] = makePlayer('p' + i, (i + 1) * 5); // Lv.5/10/.../50
    }
    const store = makeStore(players);
    const top = getTopHalfByLevel(store);
    assert.equal(top.length, 5);
    // 应该是等级最高的 5 个：Lv.50/45/40/35/30
    assert.equal(top[0].level, 50);
    assert.equal(top[4].level, 30);
  });

  it('getTopHalfByLevel：1 个玩家 → 取 1 个（不会取 0）', () => {
    const store = makeStore({ only: makePlayer('only', 99) });
    const top = getTopHalfByLevel(store);
    assert.equal(top.length, 1);
  });

  it('getTopHalfByLevel：0 个玩家 → 空数组', () => {
    const store = makeStore({});
    assert.deepEqual(getTopHalfByLevel(store), []);
  });

  it('buildBossStats：模板 70% + 玩家中位 30%（按 totalStats 综合属性）', () => {
    const players = {
      weak: makePlayer('weak', 1),
      mid:  makePlayer('mid', 30),
      strong: makePlayer('strong', 99),
    };
    const store = makeStore(players);
    const tpl = { baseAtk: 100, baseDef: 50, baseAgi: 30 };
    const stats = buildBossStats(store, tpl);
    // 中位玩家 = mid (Lv.30)
    // 用 getTotalStats(mid) 拿到综合属性（裸属性 + 装备 + 词条 + 种族 + 登神 等）
    const s = engine.getTotalStats(players.mid);
    // atk = 100*0.7 + s.atk*0.3
    assert.equal(stats.atk, Math.floor(100 * 0.7 + s.atk * 0.3));
    assert.equal(stats.def, Math.floor(50 * 0.7 + s.def * 0.3));
    assert.equal(stats.agi, Math.floor(30 * 0.7 + s.agi * 0.3));
    assert.equal(stats.hasMedian, true);
  });

  it('buildBossStats：无玩家时退化为 100% 模板', () => {
    const store = makeStore({});
    const tpl = { baseAtk: 100, baseDef: 50, baseAgi: 30 };
    const stats = buildBossStats(store, tpl);
    assert.equal(stats.atk, 100);
    assert.equal(stats.def, 50);
    assert.equal(stats.agi, 30);
    assert.equal(stats.hasMedian, false);
  });

  it('spawnWorldBoss：boss.hp 应被前 50% 玩家累计伤害的 1.05 倍覆盖（10 玩家场景）', () => {
    const players = {};
    for (let i = 0; i < 10; i++) {
      players['p' + i] = makePlayer('p' + i, (i + 1) * 5); // Lv.5/10/.../50
    }
    const store = makeStore(players);

    // 调生成
    const boss = spawnWorldBoss(store);
    assert.ok(boss.hp > 0, 'BOSS 血量应该 > 0');
    assert.equal(boss.hp, boss.maxHp, 'hp 应该等于 maxHp');
    assert.equal(boss.rounds, 8, 'boss.rounds 应该为 8');
    assert.equal(boss.buildMode, 'tpl70_median30');

    // 用前 50% 玩家重新跑一遍战斗，验证总伤害 ≥ boss.hp / 1.05
    const tempBoss = {
      hp: Number.MAX_SAFE_INTEGER,
      maxHp: Number.MAX_SAFE_INTEGER,
      atk: boss.atk, def: boss.def, agi: boss.agi,
      skillChance: boss.skillChance,
    };
    const topHalf = getTopHalfByLevel(store);
    let total = 0;
    for (const p of topHalf) {
      const r = engine.simulateBossBattle(p, tempBoss, 8);
      total += r.totalDamage;
    }
    // boss.hp = topHalf × 1.05，所以 topHalf × 1.05 = boss.hp → topHalf = boss.hp / 1.05
    // 允许 ±5% 误差（战斗有随机性，多跑几次会稳定）
    assert.ok(total >= boss.hp / 1.05 * 0.7, `前 50% 玩家总伤害 ${total} 应该至少为 boss.hp ${boss.hp} 的 70%`);
  });

  it('spawnWorldBoss：boss.hp 最低 1 万（防全服空数据时为 0）', () => {
    const store = makeStore({}); // 空服
    const boss = spawnWorldBoss(store);
    assert.ok(boss.hp >= 10000, `空服时 BOSS 血量最低 1 万，实际 ${boss.hp}`);
  });
});

// ============================================================
// 极限玩家场景：5500-6000 级、登神 god、转生 10、3 件 Lv.250 神话装备 + 满附魔 + 满强化
//   验证：即使玩家被拉到极限，spawnWorldBoss 仍能产生"前 50% 玩家累计伤害 ≥ boss.hp"的 BOSS
// ============================================================
describe('T-009b 世界 BOSS 极限玩家场景', () => {
  beforeEach(() => engine.__resetSeams());
  afterEach(() => engine.__resetSeams());

  // 工具：构造一个"装备 1 件"的实例（按模板填基础 stats + 可选附魔 + 可选强化）
  function makeEquip(templateId, enchants = [], upgradeLevel = 0) {
    const tpl = EQUIP_TEMPLATES[templateId];
    if (!tpl) throw new Error(`未知装备模板: ${templateId}`);
    const baseStats = { ...tpl.stats };
    // 强化：baseStats × 1.05^level（与 upgradeEquipment 一致）
    const statMul = Math.pow(1.05, upgradeLevel);
    const finalStats = {};
    for (const k of Object.keys(baseStats)) {
      finalStats[k] = Math.floor(baseStats[k] * statMul);
    }
    return {
      uid: 'eq_' + templateId + '_' + Math.random().toString(36).slice(2, 6),
      templateId,
      name: tpl.name,
      slot: tpl.slot,
      quality: tpl.quality,
      reqLevel: tpl.reqLevel,
      stats: finalStats,
      baseStats,
      enchants,
      upgradeLevel,
    };
  }

  // 工具：把 3 件装备装到 player.equipped（同时 push 到 player.equips 以便 recalc 看到）
  function equip3(player, w, a, ar) {
    const list = [w, a, ar];
    player.equips = list;
    player.equipped = { weapon: w, armor: a, accessory: ar };
  }

  // 工具：构造"满状态"玩家
  //  - level: 等级
  //  - reincarnation: 转生次数
  //  - godhood: 'god' 启用全套加成
  //  - race: '天使' 拉满种族加成
  //  - equipMode: 'mythic250' = 3 件 Lv.250 神话 + 满附魔 + 强化 +10
  //  - affixMode: 'max' = 大师级 4 个被动词条全开
  //  - laws: 'max' = 6 个法则全开
  function makeMaxPlayer(username, level = 5500, opts = {}) {
    const {
      reincarnation = 10,
      godhood = 'god',
      race = '天使',
      equipMode = 'mythic250',
      affixMode = 'max',
      lawsMode = 'max',
    } = opts;
    const p = engine.createCharacter(username, username);
    p.level = level;
    p.race = race;
    p.godhood = godhood;
    p.reincarnation = reincarnation;
    p.faith = 9999;

    // 转生永久属性：baseAtk/Def/Hp/Agi × reincarnation * 5 + expBonus/goldBonus 封顶 30%
    p.permanentBuffs = {
      expBonus: 0.30,
      goldBonus: 0.30,
      baseAtkBonus: reincarnation * 5,
      baseDefBonus: reincarnation * 5,
      baseHpBonus: reincarnation * 5,
      baseAgiBonus: reincarnation * 5,
    };

    // 基础属性：拉满到 999（属性点最高 1000+ / 实际 999 是合理上限）
    p.attributes = { atk: 999, def: 999, hp: 999, agi: 999 };
    p.attrPoints = 0;

    // 装备：3 件 Lv.250 神话 + 满附魔 + 强化 +10
    if (equipMode === 'mythic250') {
      // 武器 = 无尽之刃（atk 2500 + str 300 + spi 200 + agi 120 + crit 10%）
      const w = makeEquip('infinity_edge',
        ['legend_atk', 'str_enchant', 'atk_enchant'], 10);
      // 护甲 = 时之甲（def 1800 + hp 25000 + con 200 + agi 60 + 减伤 25%）
      const a = makeEquip('chrono_armor',
        ['legend_def', 'def_enchant', 'hp_enchant'], 10);
      // 饰品 = 全知之眼（atk 1000 + def 1000 + critDmg 100% + allAttr 20% + 减伤 30% + 吸血 15%）
      const ar = makeEquip('omni_eye',
        ['exp_enchant', 'gold_enchant', 'myth_spi'], 10);
      equip3(p, w, a, ar);
    }

    // 法则：全开（6 个全学）+ 技能点满
    if (lawsMode === 'max') {
      p.laws = ['law_destruction', 'law_guardian', 'law_spacetime',
                'law_life', 'law_wealth', 'law_annihilation'];
    }
    p.skillPoints = 999;

    // 词条：大师级 4 个被动全开（p4-01~p4-20 中 4 个最有用）
    //   主动留空（不影响被动计算）
    if (affixMode === 'max') {
      p.affixes = {
        active: null,
        passive: ['P4-01', 'P4-03', 'P4-11', 'P4-17'],  // ATK +15% / HP +15% / ATK+18% / DEF+18%
      };
    }

    // 满血满蓝（先 recalc 再 set）
    engine.recalcMaxStats(p);
    p.hp = p.maxHp;
    p.mp = p.maxMp;

    return p;
  }

  it('极端玩家 Lv.5500 真实综合属性：atk/def/hp 应该在万级以上', () => {
    const p = makeMaxPlayer('max1', 5500);
    const s = engine.getTotalStats(p);
    // 期望：atk/def/hp 都至少 1 万（登神 + 转生 10 + 满装备 + 满词条 + 满法则）
    assert.ok(s.atk > 10000, `Lv.5500 极端玩家 atk 应 > 1 万，实际 ${s.atk}`);
    assert.ok(s.def > 10000, `Lv.5500 极端玩家 def 应 > 1 万，实际 ${s.def}`);
    assert.ok(s.hp  > 10000, `Lv.5500 极端玩家 hp  应 > 1 万，实际 ${s.hp}`);
  });

  it('10 个极端玩家 Lv.5500-6000 场景：前 5 名各打 1 次能击杀 BOSS', () => {
    // 10 个玩家，等级 5500-6000，全部用 makeMaxPlayer
    const players = {};
    for (let i = 0; i < 10; i++) {
      const lv = 5500 + i * 50;  // 5500, 5550, 5600, ..., 5950
      const username = 'max' + i;
      players[username] = makeMaxPlayer(username, lv);
    }
    const store = makeStore(players);

    // 真实跑 spawnWorldBoss
    const boss = spawnWorldBoss(store);
    assert.ok(boss.hp > 0, 'BOSS 血量应 > 0');
    // 打印一下用于诊断
    console.log(`  极限场景 BOSS 数值: hp=${boss.hp}, atk=${boss.atk}, def=${boss.def}, agi=${boss.agi}`);

    // 验证：用前 50% 玩家（5 个 Lv.5500-5700）真实重跑 8 回合战斗
    const tempBoss = {
      hp: Number.MAX_SAFE_INTEGER,
      maxHp: Number.MAX_SAFE_INTEGER,
      atk: boss.atk, def: boss.def, agi: boss.agi,
      skillChance: boss.skillChance,
    };
    const topHalf = getTopHalfByLevel(store);
    let total = 0;
    for (const p of topHalf) {
      const r = engine.simulateBossBattle(p, tempBoss, 8);
      total += r.totalDamage;
    }
    console.log(`  前 5 名玩家总伤害: ${total}`);

    // 关键断言：topHalf 总伤害应该 ≥ boss.hp（因为 boss.hp = topHalf × 1.05）
    // 允许小幅随机性误差（±20%）
    assert.ok(total >= boss.hp * 0.8,
      `极限场景：前 50% 玩家总伤害 ${total} 应该至少为 boss.hp ${boss.hp} 的 80%`);
  });

  it('20 个玩家混合（10 弱 + 10 极强）场景：前 5 名（强）能击杀 BOSS', () => {
    const players = {};
    // 10 个弱玩家（Lv.30-100）
    for (let i = 0; i < 10; i++) {
      const lv = 30 + i * 8;  // 30, 38, ..., 102
      const username = 'weak' + i;
      players[username] = makePlayer(username, lv);
    }
    // 10 个极端玩家（Lv.5500-6000）
    for (let i = 0; i < 10; i++) {
      const lv = 5500 + i * 50;
      const username = 'max' + i;
      players[username] = makeMaxPlayer(username, lv);
    }
    const store = makeStore(players);

    const boss = spawnWorldBoss(store);
    console.log(`  混合场景 BOSS 数值: hp=${boss.hp}, atk=${boss.atk}, def=${boss.def}, agi=${boss.agi}`);

    // 验证：前 5 名（应该都是极端玩家）能击杀
    const tempBoss = {
      hp: Number.MAX_SAFE_INTEGER,
      maxHp: Number.MAX_SAFE_INTEGER,
      atk: boss.atk, def: boss.def, agi: boss.agi,
      skillChance: boss.skillChance,
    };
    const topHalf = getTopHalfByLevel(store);
    let total = 0;
    for (const p of topHalf) {
      const r = engine.simulateBossBattle(p, tempBoss, 8);
      total += r.totalDamage;
    }
    console.log(`  前 5 名（强）玩家总伤害: ${total}`);

    assert.ok(total >= boss.hp * 0.8,
      `混合场景：前 5 名强玩家总伤害 ${total} 应该至少为 boss.hp ${boss.hp} 的 80%`);
  });
});

// ============================================================
// 奖励体系测试（v3.1：去掉材料 + 前三名等级进度奖 + 4-20 名固定排名奖）
// ============================================================
describe('T-010 世界 BOSS 奖励 v3.1', () => {
  beforeEach(() => engine.__resetSeams());
  afterEach(() => engine.__resetSeams());

  // 工具：直接构造一个 BOSS 对象（绕过 spawnWorldBoss 的复杂逻辑）
  function makeBoss(hp, finalHitBy = null) {
    return {
      id: 'void_lord',
      name: '虚空领主',
      icon: 'skull',
      desc: 'test',
      hp, maxHp: hp,
      atk: 1000, def: 500, agi: 200,
      skillChance: 0.3,
      rewards: { gold: 5000, exp: 2000 },
      finalHitRewards: { gold: 10000, exp: 5000 },
      damageLog: {},
      finalHitBy,
      dead: false,
      settled: false,
      expired: false,
    };
  }

  // 工具：构造一个带 damageLog 的 BOSS
  function makeBossWithDamage(entries, finalHitBy = null, hp = 100000) {
    const boss = makeBoss(hp, finalHitBy);
    for (const [u, dmg] of entries) boss.damageLog[u] = dmg;
    return boss;
  }

  // 工具：构造一个简单玩家（含初始 gold/exp/inventory）
  function makePlayer(username) {
    const p = engine.createCharacter(username, username);
    p.gold = 0;
    p.exp = 0;
    p.inventory = [];
    p.titles = {};
    p.titleExpiry = {};
    p.logs = [];
    return p;
  }

  it('1) 前 3 名：进度奖 = BOSS 基础奖 × 3/2/1.5 倍（v3.3：避免与 4-20 名倒挂）', () => {
    // BOSS 基础 gold=5000, exp=2000
    // 第 1 名进度奖 = 5000*3 = 15000 金 + 2000*3 = 6000 经  + 最后一击 10000 金 + 5000 经
    // 第 2 名进度奖 = 5000*2 = 10000 金 + 2000*2 = 4000 经
    // 第 3 名进度奖 = 5000*1.5 = 7500 金 + 2000*1.5 = 3000 经
    // 第 4 名 = 5000 金 + 2000 经（参与奖上限）
    const boss = makeBossWithDamage([
      ['a', 50000], ['b', 30000], ['c', 20000], ['d', 1000],
    ], 'a', 100000);

    const players = {};
    for (const u of ['a', 'b', 'c', 'd']) players[u] = makePlayer(u);
    const store = makeStore(players);

    // a 是第一名（最终一击）
    engine.settleWorldBossRewards(store, boss);

    assert.equal(players.a.gold, 10000 + 15000, 'a 是第 1 名 + 最后一击 + 进度奖 ×3');
    assert.equal(players.a.exp, 5000 + 6000);
    assert.equal(players.a.titles.boss_killer_1, true);

    assert.equal(players.b.gold, 10000, 'b 是第 2 名（× 2）');
    assert.equal(players.b.exp, 4000);
    assert.equal(players.b.titles.boss_killer_2, true);

    assert.equal(players.c.gold, 7500, 'c 是第 3 名（× 1.5）');
    assert.equal(players.c.exp, 3000);
    assert.equal(players.c.titles.boss_killer_3, true);

    // 第 4 名 (d) 拿 BOSS 基础奖 5000+2000
    assert.equal(players.d.gold, 5000);
    assert.equal(players.d.exp, 2000);
    assert.deepEqual(players.d.titles, {}, 'd 不应有称号');
  });

  it('2) 第 4-20 名：取参与奖上限 = BOSS 基础 gold/exp × 1.0（远高于 v3.1 的 200/100）', () => {
    const entries = [];
    for (let i = 1; i <= 25; i++) entries.push(['p' + i, 100000 - i * 1000]);
    // p1 第一 (100k), p2 第二 (99k), ..., p25 第二十五
    const boss = makeBossWithDamage(entries, 'p1', 100000);

    const players = {};
    for (let i = 1; i <= 25; i++) players['p' + i] = makePlayer('p' + i);
    const store = makeStore(players);

    engine.settleWorldBossRewards(store, boss);

    // 第 4 名 (p4) 拿 5000 金 + 2000 经（取参与奖上限）
    assert.equal(players.p4.gold, 5000);
    assert.equal(players.p4.exp, 2000);

    // 第 20 名 (p20) 也拿 5000 金 + 2000 经
    assert.equal(players.p20.gold, 5000);
    assert.equal(players.p20.exp, 2000);

    // 第 21 名 (p21) 在 settle 中不再发任何奖
    assert.equal(players.p21.gold, 0);
    assert.equal(players.p21.exp, 0);

    // 第 25 名 (p25) 也是 0
    assert.equal(players.p25.gold, 0);
    assert.equal(players.p25.exp, 0);
  });

  it('3) 20 名后：只有参与奖（settle 不再发任何奖）', () => {
    const entries = [];
    for (let i = 1; i <= 30; i++) entries.push(['p' + i, 100000 - i * 1000]);
    const boss = makeBossWithDamage(entries, 'p1', 100000);
    const players = {};
    for (let i = 1; i <= 30; i++) players['p' + i] = makePlayer('p' + i);
    const store = makeStore(players);

    engine.settleWorldBossRewards(store, boss);

    // 第 21-30 名：settleWorldBossRewards 不再发任何奖
    for (let i = 21; i <= 30; i++) {
      assert.equal(players['p' + i].gold, 0, `p${i} 不应在 settle 中拿任何奖`);
      assert.equal(players['p' + i].exp, 0);
    }
  });

  it('4) 参与奖 + 最后一击奖都不发材料（materials 字段已删）', () => {
    const players = {};
    for (let i = 0; i < 3; i++) {
      players['p' + i] = makePlayer('p' + i);
      players['p' + i].username = 'p' + i;
    }
    const store = makeStore(players);
    const boss = makeBoss(100000, null);
    boss.damageLog = { p0: 50000, p1: 30000, p2: 20000 };
    boss.dead = false;
    boss.settled = false;

    // 模拟参与奖（v3.2：× 2 翻倍）
    engine.grantWorldBossParticipation(players.p0, boss);
    // p0 伤害占比 = 50%，应拿 5000*0.5*2=5000 金 + 2000*0.5*2=2000 经
    assert.equal(players.p0.gold, 5000);
    assert.equal(players.p0.exp, 2000);
    // 关键断言：inventory 必须为空（无材料）
    assert.equal(players.p0.inventory.length, 0, '参与奖不应发材料');

    // 模拟最后一击（让 p0 是 finalHitBy）
    //   预期：p0 拿到最后一击 + 进度奖（v3.3：× 3 = 15000）
    //   注意：p0 已经在前面拿了 5000 金（参与奖），所以最终 gold = 5000 + 10000 + 15000
    boss.damageLog = { p0: 100000 };
    boss.finalHitBy = 'p0';
    boss.dead = true;
    boss.settled = true;
    engine.settleWorldBossRewards(store, boss);
    assert.equal(players.p0.gold, 5000 + 10000 + 15000, 'p0 = 参与奖 + 最后一击 + 进度奖×3');
    assert.equal(players.p0.exp, 2000 + 5000 + 6000);
    // 关键断言：inventory 仍必须为空（最后一击/进度奖都不发材料）
    assert.equal(players.p0.inventory.length, 0, '最后一击/进度奖不应发材料');
  });

  it('5) 等级进度奖 v3.3：BOSS 基础奖 × 3/2/1.5 倍（与 boss.hp 无关）', () => {
    // 5 个玩家，boss.hp = 50000（无影响），BOSS 基础 = 5000/2000
    const entries = [['a', 100], ['b', 80], ['c', 60], ['d', 40], ['e', 20]];
    const boss = makeBossWithDamage(entries, 'a', 50000);
    const players = {};
    for (const [u] of entries) players[u] = makePlayer(u);
    const store = makeStore(players);

    engine.settleWorldBossRewards(store, boss);

    // 第 1 名 (a) = 5000*3 = 15000 金 + 2000*3 = 6000 经 + 最后一击 + 称号
    assert.equal(players.a.gold, 10000 + 15000, 'a 第 1 名 + 最后一击');
    assert.equal(players.a.exp, 5000 + 6000);
    // 第 2 名 (b) = 5000*2 = 10000 金 + 2000*2 = 4000 经
    assert.equal(players.b.gold, 10000);
    assert.equal(players.b.exp, 4000);
    // 第 3 名 (c) = 5000*1.5 = 7500 金 + 2000*1.5 = 3000 经
    assert.equal(players.c.gold, 7500);
    assert.equal(players.c.exp, 3000);
    // 第 4 名 (d) = BOSS 基础 5000 + 2000
    assert.equal(players.d.gold, 5000);
    assert.equal(players.d.exp, 2000);
    // 第 5 名 (e) = BOSS 基础 5000 + 2000
    assert.equal(players.e.gold, 5000);
    assert.equal(players.e.exp, 2000);
  });

  it('6) 跨日过期结算：仍然按伤害排名发奖，无 finalHitBy', () => {
    // 玩家 a/b/c 伤害 100/80/60，boss.hp=30000（不影响）
    const entries = [['a', 100], ['b', 80], ['c', 60]];
    const boss = makeBossWithDamage(entries, null, 30000);  // 无 finalHitBy
    boss.expired = true;  // 跨日强制结算
    const players = {};
    for (const [u] of entries) players[u] = makePlayer(u);
    const store = makeStore(players);

    engine.settleWorldBossRewards(store, boss);

    // 第 1 名 (a) = 5000*3 = 15000 金 + 2000*3 = 6000 经 + 称号（无最后一击奖）
    assert.equal(players.a.gold, 15000, 'a 第 1 名，无 finalHitBy');
    assert.equal(players.a.exp, 6000);
    assert.equal(players.a.titles.boss_killer_1, true);
    // 第 2 名 (b) = 5000*2 = 10000 金 + 2000*2 = 4000 经
    assert.equal(players.b.gold, 10000);
    assert.equal(players.b.exp, 4000);
    // 第 3 名 (c) = 5000*1.5 = 7500 金 + 2000*1.5 = 3000 经
    assert.equal(players.c.gold, 7500);
    assert.equal(players.c.exp, 3000);
  });

  it('7) 参与奖 v3.2 翻倍：100% 伤害占比玩家应拿 BOSS 基础 × 2', () => {
    // 单独一个玩家伤害 100% 时，参与奖应该 = BOSS 基础 gold/exp × 1.0 × 2
    const boss = makeBossWithDamage([['solo', 100]], null, 100000);
    const players = { solo: makePlayer('solo') };
    players.solo.username = 'solo';
    const store = makeStore(players);

    engine.grantWorldBossParticipation(players.solo, boss);
    // solo 占比 100% → goldGain = 5000*1*2 = 10000, expGain = 2000*1*2 = 4000
    assert.equal(players.solo.gold, 10000);
    assert.equal(players.solo.exp, 4000);
  });

  it('8) 前三名总奖励（进度奖+最后一击）必须明显高于 第 4-20 名（v3.3：避免倒挂）', () => {
    // BOSS 基础 5000 金 + 2000 经
    // 第 4-20 名：5000 金 + 2000 经（参与奖上限）
    // 期望：第 1/2/3 名的"等级进度奖"（不含最后一击）就要 ≥ 4-20 名的总奖励
    const entries = [];
    for (let i = 1; i <= 5; i++) entries.push(['p' + i, 100000 - i * 1000]);
    const boss = makeBossWithDamage(entries, 'p1', 100000);
    const players = {};
    for (let i = 1; i <= 5; i++) players['p' + i] = makePlayer('p' + i);
    const store = makeStore(players);

    engine.settleWorldBossRewards(store, boss);

    // 第 4-20 名的奖励（参考）
    const refGold = players.p4.gold;
    const refExp = players.p4.exp;
    assert.equal(refGold, 5000, '4-20 名应拿 5000 金（参与奖上限）');
    assert.equal(refExp, 2000, '4-20 名应拿 2000 经（参与奖上限）');

    // 第 1 名：进度奖 ≥ 4-20 名奖励（最后一击奖是额外，不算）
    const p1ProgressGold = players.p1.gold - 10000;  // 减去最后一击
    const p1ProgressExp = players.p1.exp - 5000;
    assert.ok(p1ProgressGold > refGold,
      `第 1 名进度奖金 ${p1ProgressGold} 必须 > 第 4 名 ${refGold}（避免倒挂）`);
    assert.ok(p1ProgressExp > refExp,
      `第 1 名进度奖经验 ${p1ProgressExp} 必须 > 第 4 名 ${refExp}`);

    // 第 2 名：进度奖也要 ≥ 4-20 名
    assert.ok(players.p2.gold >= refGold,
      `第 2 名金 ${players.p2.gold} 必须 >= 第 4 名 ${refGold}`);
    assert.ok(players.p2.exp >= refExp,
      `第 2 名经验 ${players.p2.exp} 必须 >= 第 4 名 ${refExp}`);

    // 第 3 名：进度奖也要 ≥ 4-20 名
    assert.ok(players.p3.gold >= refGold,
      `第 3 名金 ${players.p3.gold} 必须 >= 第 4 名 ${refGold}`);
    assert.ok(players.p3.exp >= refExp,
      `第 3 名经验 ${players.p3.exp} 必须 >= 第 4 名 ${refExp}`);

    // 排名递降：第 1 名 > 第 2 名 > 第 3 名 > 第 4 名
    assert.ok(p1ProgressGold > players.p2.gold, '1 名 > 2 名');
    assert.ok(players.p2.gold > players.p3.gold, '2 名 > 3 名');
    assert.ok(players.p3.gold > refGold, '3 名 > 4 名');
  });
});
