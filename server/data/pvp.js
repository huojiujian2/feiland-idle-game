// ====== PvP 竞技场配置 ======
// @file data/pvp
// @module data-pvp
// @description 竞技场冷却、等级范围、赛季月数、排名奖励、竞技场装备、Bot 命名

// 竞技场通用配置
const PVP_CD_MS = 3 * 60 * 1000;  // 挑战冷却 3 分钟
const PVP_LEVEL_RANGE = 5;          // 等级差 ±5

// 竞技币 key
const PVP_CURRENCY_KEY = 'arenaCoins';

// 赛季：每 3 个月重置（季度）
const SEASON_MONTHS = 3;

// 排名阶级奖励（按周期结束时总积分快照发奖）
// 只有 1-100 名才有竞技币奖励
// 阶级 S/A/B/C/D/E（1/2-3/4-10/11-20/21-50/51-100）
const ARENA_RANK_REWARDS = {
  daily: [
    { tier: 'S', minRank: 1,  maxRank: 1,   coins: 300 },
    { tier: 'A', minRank: 2,  maxRank: 3,   coins: 200 },
    { tier: 'B', minRank: 4,  maxRank: 10,  coins: 100 },
    { tier: 'C', minRank: 11, maxRank: 20,  coins: 50 },
    { tier: 'D', minRank: 21, maxRank: 50,  coins: 30 },
    { tier: 'E', minRank: 51, maxRank: 100, coins: 15 }
  ],
  weekly: [
    { tier: 'S', minRank: 1,  maxRank: 1,   coins: 1500 },
    { tier: 'A', minRank: 2,  maxRank: 3,   coins: 1000 },
    { tier: 'B', minRank: 4,  maxRank: 10,  coins: 500 },
    { tier: 'C', minRank: 11, maxRank: 20,  coins: 250 },
    { tier: 'D', minRank: 21, maxRank: 50,  coins: 100 },
    { tier: 'E', minRank: 51, maxRank: 100, coins: 50 }
  ],
  monthly: [
    { tier: 'S', minRank: 1,  maxRank: 1,   coins: 6000 },
    { tier: 'A', minRank: 2,  maxRank: 3,   coins: 4000 },
    { tier: 'B', minRank: 4,  maxRank: 10,  coins: 2000 },
    { tier: 'C', minRank: 11, maxRank: 20,  coins: 1000 },
    { tier: 'D', minRank: 21, maxRank: 50,  coins: 500 },
    { tier: 'E', minRank: 51, maxRank: 100, coins: 200 }
  ]
};

// 竞技场限定装备（按等级梯度 5 档 × 每档武器+护甲+饰品，共 15 件）
const ARENA_EQUIPMENT = [
  // 第一档 Lv.20
  { id: 'arena_sword_1',  name: '竞技者之剑',   slot: 'weapon',    quality: 'legend', reqLevel: 20,  price: 800,  stats: { atk: 65, agi: 10 } },
  { id: 'arena_armor_1',  name: '竞技者胸甲',   slot: 'armor',     quality: 'legend', reqLevel: 20,  price: 800,  stats: { def: 35, hp: 80 } },
  { id: 'arena_ring_1',   name: '竞技者护符',   slot: 'accessory', quality: 'legend', reqLevel: 20,  price: 600,  stats: { atk: 20, def: 20, gold: 0.05 } },
  // 第二档 Lv.40
  { id: 'arena_sword_2',  name: '决斗家之剑',   slot: 'weapon',    quality: 'legend', reqLevel: 40,  price: 1500, stats: { atk: 120, agi: 18, crit: 0.05 } },
  { id: 'arena_armor_2',  name: '决斗家铠甲',   slot: 'armor',     quality: 'legend', reqLevel: 40,  price: 1500, stats: { def: 70, hp: 150, dmgTaken: -0.05 } },
  { id: 'arena_ring_2',   name: '决斗家徽章',   slot: 'accessory', quality: 'legend', reqLevel: 40,  price: 1200, stats: { atk: 35, def: 35, gold: 0.08, exp: 0.05 } },
  // 第三档 Lv.60
  { id: 'arena_sword_3',  name: '王者之刃',     slot: 'weapon',    quality: 'legend', reqLevel: 60,  price: 3000, stats: { atk: 200, agi: 25, crit: 0.08, lifesteal: 0.03 } },
  { id: 'arena_armor_3',  name: '王者战甲',     slot: 'armor',     quality: 'legend', reqLevel: 60,  price: 3000, stats: { def: 120, hp: 250, dmgTaken: -0.08, thorns: 0.05 } },
  { id: 'arena_ring_3',   name: '王者之眼',     slot: 'accessory', quality: 'legend', reqLevel: 60,  price: 2400, stats: { atk: 60, def: 60, gold: 0.12, exp: 0.08, critDmg: 0.10 } },
  // 第四档 Lv.80
  { id: 'arena_sword_4',  name: '冠军圣剑',     slot: 'weapon',    quality: 'legend', reqLevel: 80,  price: 5500, stats: { atk: 320, agi: 35, crit: 0.10, lifesteal: 0.05, ignoreDef: 0.10 } },
  { id: 'arena_armor_4',  name: '冠军圣铠',     slot: 'armor',     quality: 'legend', reqLevel: 80,  price: 5500, stats: { def: 200, hp: 400, dmgTaken: -0.10, thorns: 0.08, shieldRegen: 0.05 } },
  { id: 'arena_ring_4',   name: '冠军圣徽',     slot: 'accessory', quality: 'legend', reqLevel: 80,  price: 4500, stats: { atk: 100, def: 100, gold: 0.15, exp: 0.10, critDmg: 0.15, dodge: 0.03 } },
  // 第五档 Lv.100
  { id: 'arena_sword_5',  name: '传奇·战神剑', slot: 'weapon',    quality: 'legend', reqLevel: 100, price: 9000, stats: { atk: 500, agi: 50, crit: 0.12, lifesteal: 0.08, ignoreDef: 0.15, critDmg: 0.20 } },
  { id: 'arena_armor_5',  name: '传奇·战神甲', slot: 'armor',     quality: 'legend', reqLevel: 100, price: 9000, stats: { def: 320, hp: 600, dmgTaken: -0.15, thorns: 0.10, shieldRegen: 0.08, firstTurnAgi: 0.10 } },
  { id: 'arena_ring_5',   name: '传奇·战神印', slot: 'accessory', quality: 'legend', reqLevel: 100, price: 7500, stats: { atk: 160, def: 160, gold: 0.20, exp: 0.12, critDmg: 0.20, dodge: 0.05, hp: 200 } }
];

// 竞技场商店：永久称号（type: 'title'，购买后写入 player.titles，无过期时间）
//   titleKey 对应 data/titles.js 的 ARENA_SHOP_TITLES
const ARENA_TITLES = [
  { id: 'arena_title_immortal', type: 'title', titleKey: 'arena_immortal_star', name: '不朽星灵', desc: '竞技场商店永久称号', price: 10000 },
  { id: 'arena_title_samsara',  type: 'title', titleKey: 'arena_samsara_lord',  name: '轮回之主', desc: '竞技场商店永久称号', price: 10000 },
];

// Bot 随机名（分男女）
const BOT_NAMES = {
  male: [
    '雷欧', '亚伦', '凯尔', '赛拉斯', '艾伦', '诺亚', '伊桑', '泰勒', '奥利弗', '卢卡斯',
    '格雷', '泽恩', '雷恩', '凯恩', '芬恩', '科林', '马丁', '罗宾', '阿克', '菲利克斯',
    '维克多', '塞巴斯', '阿瑟', '加百列', '海因', '希尔', '托尔', '奥丁', '宙', '亚瑟'
  ],
  female: [
    '艾拉', '露娜', '伊莲娜', '米娅', '阿黛尔', '索菲亚', '薇拉', '尼娜', '艾琳', '莉莉',
    '维多利亚', '安娜', '凯瑟琳', '艾米丽', '夏洛特', '奥罗拉', '芙蕾', '梅娅', '赛琳', '伊娃',
    '阿特', '菲娅', '玛格丽特', '塞西尔', '海伦', '雅典娜', '芙兰', '莉兹', '希尔达', '蕾娜'
  ]
};

// Bot 职业前缀（用于生成职业化名字）
const BOT_JOB_PREF = {
  thunder: ['雷霆', '雷鸣', '电闪', '霹雳'],
  light:   ['光明', '圣光', '晨曦', '光辉'],
  wind:    ['风行', '疾风', '清风', '飙风'],
  knight:  ['坚盾', '钢壁', '堡垒', '守卫'],
  alchemy: ['炼金', '药水', '秘药', '工匠']
};

module.exports = {
  PVP_CD_MS, PVP_LEVEL_RANGE, PVP_CURRENCY_KEY, SEASON_MONTHS,
  ARENA_RANK_REWARDS, ARENA_EQUIPMENT, ARENA_TITLES,
  BOT_NAMES, BOT_JOB_PREF,
};
