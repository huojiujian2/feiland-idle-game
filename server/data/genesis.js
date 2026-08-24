// ====== 创世系统：数据定义 ======
// @file data/genesis
// @module data-genesis
// @description 二转解锁的"创世之书"：种族表、技能池、神谕文案、数值预算公式。
// 世界库本体（玩家创造的怪物/装备）存于 store 的 meta.genesis（全服共享）。

const { AREAS, MONSTER_SKILLS } = require('./index');

// ---------- 种族（决定可选"特性"= 怪物技能池） ----------
const GENESIS_RACES = {
  dragon:   { name: '龙裔',   skills: ['fire_breath', 'tail_sweep', 'roar'],           omen: '龙焰与硫磺的气息弥漫开来' },
  beast:    { name: '荒兽',   skills: ['bite', 'charge', 'claw'],                      omen: '大地随低吼声微微震颤' },
  elf:      { name: '精灵',   skills: ['star_arrow', 'wing_blade', 'magic_bolt'],      omen: '月光在林间凝成银丝' },
  undead:   { name: '亡灵',   skills: ['soul_drain', 'soul_split', 'dark_slash'],      omen: '空气骤然冷得像坟墓' },
  element:  { name: '元素体', skills: ['element_storm', 'steam_blast', 'ice_breath'],  omen: '四周的风开始无序地旋转' },
  demon:    { name: '魔族',   skills: ['void_tear', 'realm_rift', 'void_nova'],        omen: '空间的裂缝中渗出低语' },
  machine:  { name: '构装体', skills: ['steam_blast', 'time_stop', 'charge'],          omen: '齿轮咬合的轰鸣自虚空中响起' },
  divine:   { name: '神眷',   skills: ['holy_smite', 'divine_judgment', 'god_smash'],  omen: '一道无声的白光划破天穹' },
};
// 通用特性池（任何种族都可额外选）
const COMMON_SKILLS = ['bite', 'roar', 'claw', 'poison'];

// 自创怪最多携带的特性数 / 最多挂的掉落物数
const MAX_MONSTER_SKILLS = 2;
const MAX_MONSTER_DROPS = 2;

// ---------- 装备创世参数 ----------
const EQUIP_SLOTS = {
  weapon:    { name: '武器' },
  armor:     { name: '护甲' },
  accessory: { name: '饰品' },
};
// 允许玩家分配的基础属性键（百分比类如 exp/gold/critDmg 价值难定，不开放）
const EQUIP_STAT_KEYS = {
  atk: { name: '攻击' }, def: { name: '防御' }, hp: { name: '生命' },
  mp: { name: '法力' }, str: { name: '力量' }, spi: { name: '精神' },
  agi: { name: '敏捷' }, con: { name: '体质' },
};
// 每件装备最多属性种类数
const MAX_EQUIP_STATS = 4;
// 自创装备品质固定为史诗（合成表可被合入传说池）
const GENESIS_EQUIP_QUALITY = 'epic';

// ---------- 数值上限（防滥用） ----------
const LIMITS = {
  nameMax: 12,
  descMax: 60,
  perPlayerEachKind: 30,
  monsterCostGold: 5000,
  equipCostGold: 8000,
};

// ---------- 预算公式 ----------
// 怪物预算：以目标地图现有怪为基准。
// 返回 null 表示该地图没有基础怪（不可投放）。
function getMonsterBudget(area) {
  if (!area || !Array.isArray(area.monsters) || area.monsters.length === 0) return null;
  const maxOf = (k) => Math.max(...area.monsters.map(m => m[k] || 0));
  const avgOf = (k) => area.monsters.reduce((s, m) => s + (m[k] || 0), 0) / area.monsters.length;
  const sumMax = maxOf('hp') + maxOf('atk') + maxOf('def') + maxOf('agi');
  const caps = {
    hp: Math.ceil(maxOf('hp') * 1.2),
    atk: Math.ceil(maxOf('atk') * 1.2),
    def: Math.ceil(maxOf('def') * 1.2),
    agi: Math.ceil(maxOf('agi') * 1.2),
  };
  const totalBudget = Math.ceil(sumMax * 1.0);   // 预算 = 基础最强怪总点数
  return {
    caps,                 // 每维硬上限
    totalBudget,          // 四维总点数预算
    exp: Math.round(avgOf('exp')),   // 经验/金币由系统按图锁定，玩家不可填
    gold: Math.max(1, Math.round(avgOf('gold'))),
  };
}

// 列出所有有基础怪的地图的预算（创世之书页直接给前端用，避免双端公式分叉）
function listAllMonsterBudgets() {
  const out = {};
  for (const area of Object.values(AREAS)) {
    const b = getMonsterBudget(area);
    if (b) out[area.id] = { name: area.name, minLevel: area.minLevel, ...b };
  }
  return out;
}

// 装备预算：参照同图等级段同槽位的史诗模板总属性 ×100%。
function getEquipBudget(areaId, slot) {
  const area = AREAS[areaId];
  if (!area) return null;
  const lv = area.minLevel;
  // 找 reqLevel 与目标图等级最接近的同槽位史诗模板做基准
  const epics = Object.entries(require('./equipment').EQUIP_TEMPLATES)
    .filter(([id, t]) => t.quality === 'epic' && t.slot === slot && !id.startsWith('custom_'));
  if (epics.length === 0) return null;
  epics.sort((a, b) => Math.abs(a[1].reqLevel - lv) - Math.abs(b[1].reqLevel - lv));
  const base = epics[0][1];
  const total = Object.values(base.stats).reduce((s, v) => s + v, 0);
  return {
    totalBudget: Math.max(5, total),   // 同槽位史诗同总点数
    refName: base.name,
    refReqLevel: base.reqLevel,
    reqLevel: lv,
  };
}

// 列出所有地图×槽位的装备预算（创世之书前端用）
function listAllEquipBudgets() {
  const out = {};
  for (const area of Object.values(AREAS)) {
    const slots = {};
    for (const slot of Object.keys(EQUIP_SLOTS)) {
      const b = getEquipBudget(area.id, slot);
      if (b) slots[slot] = b;
    }
    if (Object.keys(slots).length > 0) out[area.id] = slots;
  }
  return out;
}

// ---------- 神谕文案 ----------
const ORACLE_TEMPLATES = {
  monster: [
    '你低语真名……「{name}」自{area}的尘土中降生。{omen}。',
    '世界听见了你的意志——「{name}」已在{area}睁开双眼。',
    '命运的书页翻动，「{name}」踏入{area}，从此这片土地有了新的传说。',
    '你以造物主之名落笔，「{name}」于{area}的阴影中成形。',
  ],
  equip: [
    '熔炉共鸣，「{name}」在千万次锤炼后诞生，静待有缘人。',
    '你将意志注入顽铁——「{name}」自此有了灵魂。',
    '星轨交汇的一瞬，「{name}」自锻造台上浮起，寒光凛冽。',
    '古老的附魔文字亮起又熄灭：「{name}」已铸成。',
  ],
  delete: [
    '你抹去了真名，「{name}」化作尘埃，回归虚无。',
    '书页燃尽，「{name}」从世界中悄然退场。',
  ],
};
function oracleText(kind, vars) {
  const pool = ORACLE_TEMPLATES[kind] || [];
  const tpl = pool[Math.floor(Math.random() * pool.length)] || '{name}';
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

module.exports = {
  AREAS,
  GENESIS_RACES, COMMON_SKILLS, MAX_MONSTER_SKILLS, MAX_MONSTER_DROPS,
  EQUIP_SLOTS, EQUIP_STAT_KEYS, MAX_EQUIP_STATS, GENESIS_EQUIP_QUALITY,
  LIMITS,
  getMonsterBudget, getEquipBudget, listAllMonsterBudgets, listAllEquipBudgets,
  oracleText,
};
