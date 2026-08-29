// ====== 战斗策略 + 世界 BOSS 配置 ======
// @file data/strategy
// @module data-strategy
// @description T-004 战斗策略（6 种）+ 世界 BOSS 模板（3 种）

// 战斗策略（T-004 单一数据源）
const STRATEGIES = {
  aggressive: { name: '全力进攻', desc: 'ATK+15% DEF-10%', reqLevel: 1, effects: { atk: 0.15, def: -0.10 } },
  defensive: { name: '稳健防守', desc: 'DEF+15% ATK-10% 回复+50%', reqLevel: 1, effects: { def: 0.15, atk: -0.10, regen: 0.50 } },
  balanced: { name: '平衡', desc: '无加成', reqLevel: 1, effects: {} },
  greedy: { name: '贪婪掠夺', desc: 'GOLD+30% EXP-20% 掉落+5%', reqLevel: 20, effects: { gold: 0.30, exp: -0.20, drop: 0.05 } },
  desperate: { name: '背水一战', desc: 'ATK+40% DEF-30%', reqLevel: 40, effects: { atk: 0.40, def: -0.30, desperateAtk: 0.20, hpThreshold: 0.30 } },
  training: { name: '极限修炼', desc: 'EXP+50% GOLD-50% 怪物ATK+20%', reqLevel: 60, effects: { exp: 0.50, gold: -0.50, monsterAtk: 0.20 } }
};
const STRATEGY_CD_MS = 5 * 60 * 1000;

// 世界 BOSS 配置（全服共享血量）
//   v3.1：去掉材料奖励（参与奖 / 最后一击奖都不再发材料）
//   v3.1：基础奖励只剩 gold/exp，按伤害占比发；前三另有"等级进度"额外奖，4-20 名有固定排名奖
const WORLD_BOSS_TEMPLATES = [
  {
    id: 'void_lord',
    name: '虚空领主',
    icon: 'skull',
    desc: '从深渊裂隙爬出的古老存在，吞噬一切凝视它的生命',
    baseHp: 100000,
    baseAtk: 500,
    baseDef: 200,
    baseAgi: 80,
    skillChance: 0.30,
    rewards: { gold: 5000, exp: 2000 },
    finalHitRewards: { gold: 10000, exp: 5000 },
  },
  {
    id: 'abyss_serpent',
    name: '深渊巨蛇',
    icon: 'dna',
    desc: '盘踞在深渊裂隙的无尽之蛇，每一片鳞都蕴含腐蚀之力',
    baseHp: 80000,
    baseAtk: 400,
    baseDef: 250,
    baseAgi: 60,
    skillChance: 0.25,
    rewards: { gold: 4000, exp: 1500 },
    finalHitRewards: { gold: 8000, exp: 3500 },
  },
  {
    id: 'titan_soul',
    name: '泰坦之魂',
    icon: 'sparkle',
    desc: '远古泰坦死后不灭的灵魂，携带着失落纪元的怒火',
    baseHp: 150000,
    baseAtk: 700,
    baseDef: 350,
    baseAgi: 50,
    skillChance: 0.20,
    rewards: { gold: 8000, exp: 3000 },
    finalHitRewards: { gold: 15000, exp: 7000 },
  },
];

// v3.2 排名奖配置
//   前 3 名：按 levelBonus × 比例拿"等级进度奖"（lv bonus = floor(boss.hp * 0.01)）
const TOP3_RATIO = [0.50, 0.30, 0.20];  // 第 1/2/3 名占 levelBonus 的比例
//   4-20 名：取参与奖上限 = BOSS 基础 gold/exp × 1.0（在 worldboss.js 里按 boss.rewards 计算）
const RANK_BONUS_MAX_RANK = 20;  // 4~20 名都拿这个固定奖

// BOSS 自动刷新间隔（毫秒）
const WORLD_BOSS_SPAWN_INTERVAL_MS = 30 * 60 * 1000;

module.exports = { STRATEGIES, STRATEGY_CD_MS, WORLD_BOSS_TEMPLATES, WORLD_BOSS_SPAWN_INTERVAL_MS, TOP3_RATIO, RANK_BONUS_MAX_RANK };
