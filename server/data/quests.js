// ====== 每日任务 + 成就 + 主动技能 CD ======
// @file data/quests
// @module data-quests
// @description 每日任务配置、T-040 成就列表、主动技能 CD 配置

// 初始材料池唯一定义在 equipment.js，此处引用（避免双份定义漂移）
const { INITIAL_MATERIAL_POOL } = require('./equipment');

// 每日任务（T-040 静态 + T-102 远征）
const DAILY_QUESTS = [
  { id: 'hunt50', name: '每日狩猎', desc: '击杀 50 只怪物', target: 50, reward: { gold: 500 } },
  { id: 'battle20', name: '每日冒险', desc: '完成 20 场战斗', target: 20, reward: { exp: 200 } },
  { id: 'alloc1', name: '每日分配', desc: '分配 1 次属性点', target: 1, reward: { gold: 100 } },
  { id: 'affix1', name: '每日词条', desc: '装备/卸下 1 个词条', target: 1, reward: { materialPool: INITIAL_MATERIAL_POOL, count: 1 } },
  { id: 'enchant1', name: '每日附魔', desc: '完成 1 次附魔', target: 1, reward: { gold: 300 } },
  { id: 'buy1', name: '每日消费', desc: '在商店购买 1 件商品', target: 1, reward: { gold: 50 } },
  { id: 'expedition1', name: '远征探索', desc: '完成 1 次远征', target: 1, reward: { gold: 200 } },
];
const DAILY_CHEST = { id: 'daily_chest', need: 5 };

// 成就（T-040 静态 10项）
const ACHIEVEMENTS = [
  { id: 'first', name: '初次冒险', desc: '创建角色', title: '冒险者', reward: { gold: 100 } },
  { id: 'kill100', name: '百战不殆', desc: '击杀 100 只怪物', title: '战士', reward: { gold: 500 } },
  { id: 'kill1000', name: '千斩之锋', desc: '击杀 1000 只怪物', title: '百人斩', reward: { gold: 5000, equipPool: ['bronze_sword','iron_spear','iron_armor','crystal_ring'] } },
  { id: 'kill10000', name: '万军之破', desc: '击杀 10000 只怪物', title: '万军破', reward: { gold: 50000, equipPool: ['thunder_lance','sea_armor','holy_blade','light_wings','knight_blade','golem_armor'] } },
  { id: 'lv100', name: '满级达成', desc: '达到 Lv.100', title: '百级强者', reward: { gold: 10000 } },
  { id: 'ascend', name: '登神之路', desc: '完成登神', title: '半神', reward: { gold: 50000, equipPool: ['dragon_slayer','void_blade','dragon_armor','abyss_cloak','dragon_eye'] } },
  { id: 'affix50', name: '词条大师', desc: '装备过 50 种不同词条', title: '词条大师', reward: { affixLevel: 4 } },
  { id: 'gold1m', name: '财富自由', desc: '累计获得 100 万金币', title: '金主', reward: { gold: 100000 } },
  { id: 'reinc1', name: '转生者', desc: '完成 1 次转生', title: '轮回者', reward: { reincPoints: 1 } },
  { id: 'collect10', name: '收集者', desc: '装备图鉴收集 10种', title: '收藏家', reward: { gold: 5000 } }
];

// 主动技能 CD 配置
const ACTIVE_SKILL_CD = { 1: 5, 2: 4, 3: 3, 4: 2 };

module.exports = { DAILY_QUESTS, DAILY_CHEST, ACHIEVEMENTS, ACTIVE_SKILL_CD };
