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
// v0.8+：自创装备品质可三选一（玩家手动选择，预算公式按所选品质 × 不同倍率）
//   epic = 1.0× 预算（基础）
//   legend = 1.4× 预算（要求目标图 reqLevel ≥ 90）
//   mythic = 2.0× 预算（要求目标图 reqLevel ≥ 180）
const GENESIS_EQUIP_QUALITY_CHOICES = ['epic', 'legend', 'mythic'];
const GENESIS_EQUIP_QUALITY_MULT = { epic: 1.0, legend: 1.4, mythic: 2.0 };
const GENESIS_EQUIP_QUALITY_MIN_LEVEL = { epic: 1, legend: 90, mythic: 180 };
// 旧版兼容常量（自创装备默认 epic，等同之前行为）
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

// 装备预算：v0.9 全品质锚点 + 分段线性插值
//   1. 参照不再只看 epic 模板（epic 最高只有 Lv90，导致高等级图预算冻结），
//      而是把该槽位所有品质模板折算成"epic 等效点数"后按等级插值；
//   2. 百分比类属性（exp/critDmg/减伤等）按权重折算成等效点数，不再直接加总；
//   3. 品质倍率与真实装备强度对齐（真实数据中 mythic ≈ 同级 epic 的 3.4 倍）。
const PERCENT_STAT_WEIGHTS = {
  // 每 1%（0.01）的等效点数
  exp: 2, gold: 1.5, crit: 40, critDmg: 12, allAttr: 70,
  ignoreDef: 18, lifesteal: 25, dodge: 25, dmgTaken: 80,
};
// 品质折算系数（相对 epic = 1），由现有模板强度分布校准
const QUALITY_EPIC_RATIO = { normal: 0.22, fine: 0.45, epic: 1, legend: 1.8, mythic: 3.4 };

function equipStatTotal(stats) {
  let sum = 0;
  for (const [k, v] of Object.entries(stats || {})) {
    const w = PERCENT_STAT_WEIGHTS[k];
    sum += w ? Math.abs(v) * 100 * w : v;   // 百分比按权重折点数；普通属性 1:1
  }
  return sum;
}

// 每槽位 × 等级的最强真实装备锚点表（模块加载时算一次）
//   每个锚点存：等级、真实装备点数（按 PERCENT_STAT_WEIGHTS 折算后）、所属品质、装备名
const REAL_ANCHORS = (() => {
  const m = {};
  for (const [id, t] of Object.entries(require('./equipment').EQUIP_TEMPLATES)) {
    if (id.startsWith('custom_')) continue;
    if (!m[t.slot]) m[t.slot] = [];
    m[t.slot].push({
      lv: t.reqLevel,
      pts: equipStatTotal(t.stats),       // 真实点数
      quality: t.quality,
      name: t.name,
    });
  }
  for (const slot of Object.keys(m)) m[slot].sort((a, b) => a.lv - b.lv);
  return m;
})();

// 每槽位每个等级的最强真实装备点数（用于内插）
//   1. 区间内（lv ≤ 最强锚点）：取 lv 及以下最强
//   2. 区间外（lv > 最强锚点）：封顶到最强锚点（不外推）
function strongestAtOrBefore(slot, lv) {
  const arr = REAL_ANCHORS[slot] || [];
  if (arr.length === 0) return 0;
  let best = null;
  for (const a of arr) {
    if (a.lv > lv) break;
    if (!best || a.pts > best.pts) best = a;
  }
  const last = arr[arr.length - 1];
  if (lv > last.lv) return last.pts;
  return best ? best.pts : last.pts;
}

// v2.0 创世自创装备的"递增累积"系统
//   核心规则：
//   1. 锚点 = "系统装备最大属性点"（同地图同槽位所有真实装备中真实点数最高的）
//   2. 自创预算 = 锚点 × 1.1（首次），或上次自创该地图该槽位投入世界后的 maxPts × 1.1
//   3. 硬上限 = 锚点 × 10（防止无限堆叠）
//   4. 玩家造出装备后，"投入世界"（注入到 meta.genesis.equipsMax）即更新该地图该槽位的 maxPts
//   5. 删除自创装备不回退 maxPts（防刷分）
//
//   这套设计的好处：
//   - 起点 = 系统装备的 1.1 倍 → 自创比系统强
//   - 持续造同图装备 → 越来越强（每次 ×1.1）
//   - 上限 10× → 长期玩能造 10 倍强度的装备
//   - 不需要品质折扣 / 词条灵活度等模糊参数
const CREATION_GROWTH = 1.1;       // 每次自创比上次强 10%
const CREATION_CAP_MULT = 10;      // 硬上限 = 系统最强 × 10

// 系统装备最大属性点（同地图同槽位所有真实装备中最强）
function systemMax(areaId, slot) {
  const area = AREAS[areaId];
  if (!area) return 0;
  const lv = area.minLevel;
  return strongestAtOrBefore(slot, lv);
}

// 工具：取得 (areaId, slot) 当前的世界最强 maxPts（首次返回 null）
function _getMaxPts(worldMax, areaId, slot) {
  if (!worldMax) return null;
  return worldMax[areaId]?.[slot] ?? null;
}

// 计算自创预算
//   worldMax：meta.genesis.equipsMax，可空
//   返回：{ totalBudget, refName, refReqLevel, reqLevel, quality, growthFrom }
//     growthFrom = 'system' | 'previous' | 'cap'  // 标记这次增长是基于什么
function getEquipBudget(areaId, slot, quality = 'epic', worldMax = null) {
  const area = AREAS[areaId];
  if (!area) return null;
  const sysMax = systemMax(areaId, slot);
  if (sysMax <= 0) return null;

  const prevMax = _getMaxPts(worldMax, areaId, slot);
  // 品质影响：自创装备品质越高，基础预算越高（神话 = 史诗 × 1.5）
  const QUALITY_RATIO = { epic: 1.0, legend: 1.25, mythic: 1.5 };
  const qRatio = QUALITY_RATIO[quality] || 1.0;

  // 计算增长源
  const baseFromSystem = Math.floor(sysMax * CREATION_GROWTH * qRatio);
  let budget;
  let growthFrom;
  if (prevMax === null) {
    budget = baseFromSystem;
    growthFrom = 'system';
  } else {
    const baseFromPrev = Math.floor(prevMax * CREATION_GROWTH);
    budget = baseFromPrev;
    growthFrom = 'previous';
  }

  // 硬上限
  const cap = Math.floor(sysMax * CREATION_CAP_MULT * qRatio);
  if (budget > cap) {
    budget = cap;
    growthFrom = 'cap';
  }

  // 找参照名
  const arr = REAL_ANCHORS[slot] || [];
  const ref = arr.reduce((best, a) =>
    !best || Math.abs(a.lv - area.minLevel) < Math.abs(best.lv - area.minLevel) ? a : best, null);

  return {
    totalBudget: Math.max(5, budget),
    refName: ref ? ref.name : '未知',
    refReqLevel: area.minLevel,
    reqLevel: area.minLevel,
    quality,
    growthFrom,                 // 这次增长源：system / previous / cap
    systemMax: sysMax,          // 该图该槽位系统装备最大属性点
    previousMax: prevMax,       // 该图该槽位上一件最强自创装备属性点（首次为 null）
    cap,                        // 硬上限
  };
}

// 列出所有地图×槽位×品质的装备预算（创世之书前端用）
//   worldMax：meta.genesis.equipsMax 映射表，可空
function listAllEquipBudgets(worldMax = null) {
  const out = {};
  for (const area of Object.values(AREAS)) {
    const slots = {};
    for (const slot of Object.keys(EQUIP_SLOTS)) {
      // 每个槽位给 epic/legend/mythic 三个预算档
      slots[slot] = {
        epic:  getEquipBudget(area.id, slot, 'epic',  worldMax),
        legend: getEquipBudget(area.id, slot, 'legend', worldMax),
        mythic: getEquipBudget(area.id, slot, 'mythic', worldMax),
      };
    }
    out[area.id] = slots;
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
  EQUIP_SLOTS, EQUIP_STAT_KEYS, MAX_EQUIP_STATS,
  GENESIS_EQUIP_QUALITY, // 旧版兼容
  GENESIS_EQUIP_QUALITY_CHOICES, GENESIS_EQUIP_QUALITY_MULT, GENESIS_EQUIP_QUALITY_MIN_LEVEL,
  LIMITS,
  getMonsterBudget, getEquipBudget, listAllMonsterBudgets, listAllEquipBudgets,
  systemMax,            // v2.0 暴露给 genesis engine 用于更新 equipsMax
  CREATION_GROWTH, CREATION_CAP_MULT,   // v2.0 常量
  oracleText,
};
