// ====== 装备模板 + 品质颜色 + 锻造配置 ======
// @file data/equipment
// @module data-equipment
// @description 所有装备模板（普通 → 传说）、品质颜色、锻造/合成配置

// 装备模板表（key = templateId）
const EQUIP_TEMPLATES = {
  // 武器
  wooden_spear:    { name: '木矛',       slot: 'weapon',    quality: 'normal', reqLevel: 1,  stats: { atk: 3 } },
  bronze_sword:    { name: '青铜剑',     slot: 'weapon',    quality: 'fine',   reqLevel: 5,  stats: { atk: 8, str: 2 } },
  iron_spear:      { name: '铁制长矛',   slot: 'weapon',    quality: 'fine',   reqLevel: 15, stats: { atk: 18, str: 4 } },
  thunder_lance:   { name: '雷霆长枪',   slot: 'weapon',    quality: 'epic',   reqLevel: 30, stats: { atk: 40, str: 8, spi: 5 } },
  holy_blade:      { name: '圣光之刃',   slot: 'weapon',    quality: 'epic',   reqLevel: 50, stats: { atk: 80, str: 12, spi: 10 } },
  knight_blade:    { name: '骑士斩剑',   slot: 'weapon',    quality: 'epic',   reqLevel: 70, stats: { atk: 130, str: 18, con: 10 } },
  dragon_slayer:   { name: '屠龙者',     slot: 'weapon',    quality: 'legend', reqLevel: 90, stats: { atk: 220, str: 30, spi: 15 } },
  void_blade:      { name: '虚空之刃',   slot: 'weapon',    quality: 'legend', reqLevel: 100, stats: { atk: 350, str: 40, spi: 25, agi: 20 } },

  // 护甲
  leather_armor:   { name: '皮甲',       slot: 'armor',     quality: 'normal', reqLevel: 5,  stats: { def: 5, hp: 20 } },
  iron_armor:       { name: '铁甲',       slot: 'armor',     quality: 'fine',   reqLevel: 15, stats: { def: 15, hp: 50 } },
  sea_armor:       { name: '海灵胸甲',   slot: 'armor',     quality: 'epic',   reqLevel: 30, stats: { def: 35, hp: 120, con: 5 } },
  light_wings:     { name: '光之翼甲',   slot: 'armor',     quality: 'epic',   reqLevel: 50, stats: { def: 60, hp: 250, agi: 10 } },
  golem_armor:     { name: '傀儡重甲',   slot: 'armor',     quality: 'epic',   reqLevel: 70, stats: { def: 100, hp: 500, con: 15 } },
  dragon_armor:    { name: '龙鳞战甲',   slot: 'armor',     quality: 'legend', reqLevel: 90, stats: { def: 180, hp: 1000, con: 25 } },
  abyss_cloak:    { name: '深渊斗篷',   slot: 'armor',     quality: 'legend', reqLevel: 100, stats: { def: 280, hp: 2000, con: 35, agi: 15 } },

  // 饰品
  beast_tooth:     { name: '兽牙吊坠',   slot: 'accessory', quality: 'normal', reqLevel: 1,  stats: { atk: 2, gold: 0.05 } },
  crystal_ring:    { name: '水晶戒指',   slot: 'accessory', quality: 'fine',   reqLevel: 15, stats: { mp: 30, spi: 3 } },
  sea_amulet:     { name: '海灵护符',   slot: 'accessory', quality: 'epic',   reqLevel: 30, stats: { mp: 80, spi: 8, exp: 0.1 } },
  angel_feather:  { name: '天使之羽',   slot: 'accessory', quality: 'epic',   reqLevel: 50, stats: { hp: 200, mp: 100, exp: 0.15 } },
  dragon_eye:     { name: '龙之眼',     slot: 'accessory', quality: 'legend', reqLevel: 90, stats: { atk: 50, def: 50, exp: 0.25 } },
  // Lv.130+ 高阶装备
  starforged_blade: { name: '星辰锻造之刃', slot: 'weapon', quality: 'legend', reqLevel: 130, stats: { atk: 500, str: 60, spi: 40, agi: 25 } },
  element_crown:    { name: '元素王冠',     slot: 'armor',  quality: 'legend', reqLevel: 130, stats: { def: 380, hp: 3500, con: 50, spi: 30 } },
  godheart_orb:     { name: '神心宝珠',     slot: 'accessory', quality: 'legend', reqLevel: 130, stats: { atk: 200, def: 200, critDmg: 0.30, allAttr: 0.05 } },
  realm_breaker:    { name: '界域破碎者',   slot: 'weapon', quality: 'legend', reqLevel: 150, stats: { atk: 800, str: 100, spi: 80, agi: 50 } },
  void_dragonscale: { name: '虚空龙鳞甲',   slot: 'armor',  quality: 'legend', reqLevel: 150, stats: { def: 600, hp: 6000, con: 80, agi: 30 } },
  eternity_band:    { name: '永恒之环',     slot: 'accessory', quality: 'legend', reqLevel: 150, stats: { atk: 350, def: 350, critDmg: 0.40, ignoreDef: 0.20 } },
  creators_blade:   { name: '造物主之剑',   slot: 'weapon', quality: 'legend', reqLevel: 180, stats: { atk: 1500, str: 200, spi: 150, agi: 80 } },
  god_plate:        { name: '神祇战甲',     slot: 'armor',  quality: 'legend', reqLevel: 180, stats: { def: 1000, hp: 12000, con: 150, spi: 100 } },
  origin_eye:       { name: '原初之眼',     slot: 'accessory', quality: 'legend', reqLevel: 180, stats: { atk: 600, def: 600, critDmg: 0.60, allAttr: 0.15, dmgTaken: -0.20 } },
  // ====== 中段过渡装备（Lv.50-90）======
  ranger_bow:        { name: '游侠长弓',     slot: 'weapon', quality: 'fine',   reqLevel: 50,  stats: { atk: 60, agi: 15 } },
  paladin_shield:    { name: '圣骑士盾',     slot: 'armor',  quality: 'fine',   reqLevel: 60,  stats: { def: 50, hp: 300, con: 10 } },
  sage_robe:         { name: '贤者长袍',     slot: 'armor',  quality: 'epic',   reqLevel: 80,  stats: { def: 80, hp: 500, spi: 20 } },
  warlord_blade:     { name: '战神之刃',     slot: 'weapon', quality: 'epic',   reqLevel: 90,  stats: { atk: 200, str: 30, spi: 15 } },
  timekeeper_amulet: { name: '时光守护者吊坠', slot: 'accessory', quality: 'epic', reqLevel: 70, stats: { atk: 50, def: 50, exp: 0.20, gold: 0.10 } },
  // ====== 高阶元素/位面装备（Lv.100-150）======
  abyss_devourer:    { name: '深渊吞噬者',   slot: 'weapon', quality: 'legend', reqLevel: 110, stats: { atk: 380, str: 50, spi: 40, agi: 20 } },
  dragon_lord_plate: { name: '龙王战甲',     slot: 'armor',  quality: 'legend', reqLevel: 110, stats: { def: 320, hp: 2800, con: 45, spi: 25 } },
  phoenix_feather:   { name: '凤凰之羽',     slot: 'accessory', quality: 'legend', reqLevel: 120, stats: { atk: 120, def: 120, lifesteal: 0.10, critDmg: 0.20 } },
  realm_walker_boots:{ name: '界域行者之靴', slot: 'armor', quality: 'legend', reqLevel: 140, stats: { def: 250, hp: 1500, agi: 40, dodge: 0.10 } },
  // ====== 终极装备（Lv.200-250）======
  infinity_edge:     { name: '无尽之刃',     slot: 'weapon', quality: 'legend', reqLevel: 200, stats: { atk: 2500, str: 300, spi: 200, agi: 120, crit: 0.10 } },
  chrono_armor:      { name: '时之甲',       slot: 'armor',  quality: 'legend', reqLevel: 220, stats: { def: 1800, hp: 25000, con: 200, agi: 60, dmgTaken: -0.25 } },
  omni_eye:          { name: '全知之眼',     slot: 'accessory', quality: 'legend', reqLevel: 250, stats: { atk: 1000, def: 1000, critDmg: 1.00, allAttr: 0.20, dmgTaken: -0.30, lifesteal: 0.15 } },
};

// 品质颜色
const QUALITY_COLORS = {
  normal: '#9d9bb8',
  fine: '#5eda7a',
  epic: '#9d8cf0',
  legend: '#d4af5e'
};

// 品质顺序（升级/合成基础）
const QUALITY_ORDER = ['normal', 'fine', 'epic', 'legend'];

// 装备锻造配置
const UPGRADE_LEVEL_MAX = 10;
const UPGRADE_BASE_GOLD = 200;  // 基础金币（每级再乘品质系数）
const QUALITY_GOLD_MULT = { normal: 1, fine: 1.5, epic: 2.5, legend: 4 };
const QUALITY_STAT_MULT = { normal: 1, fine: 1, epic: 1, legend: 1 }; // 保留
// 升级所需材料（按品质）
const UPGRADE_MATERIAL_BY_QUALITY = {
  normal: { name: '青铜矿', perLevel: 1 },
  fine:   { name: '铁矿', perLevel: 1 },
  epic:   { name: '飞龙鳞片', perLevel: 1 },
  legend: { name: '龙鳞', perLevel: 1 },
};

// 合成：3 件同品质 → 1 件高一阶品质
const QUALITY_NEXT = { normal: 'fine', fine: 'epic', epic: 'legend', legend: null };

// 商店物品（可用金币购买）
// 设计约定：只卖普通/优良品质装备 + 经验卷轴；血蓝药剂已删除（每场战斗后自动满血满蓝）
const SHOP_ITEMS = [
  // 消耗品
  { id: 'exp_scroll', name: '经验卷轴', price: 200, desc: '获得500经验', type: 'consumable' },
  { id: 'exp_scroll_great', name: '高级经验卷轴', price: 800, desc: '获得3000经验', type: 'consumable' },
  // 装备
  { id: 'wooden_spear', name: '木矛', price: 100, desc: '攻击+3', type: 'equip' },
  { id: 'leather_armor', name: '皮甲', price: 150, desc: '防御+5 HP+20', type: 'equip' },
  { id: 'beast_tooth', name: '兽牙吊坠', price: 80, desc: '攻击+2 金币+5%', type: 'equip' },
  { id: 'iron_spear', name: '铁制长矛', price: 300, desc: '攻击+18 力量+4', type: 'equip' },
  { id: 'iron_armor', name: '铁甲', price: 400, desc: '防御+15 HP+50', type: 'equip' },
  { id: 'crystal_ring', name: '水晶戒指', price: 350, desc: 'MP+30 灵巧+3', type: 'equip' },
];

// 力量等阶（文字版）
function getStage(level) {
  if (level <= 10) return { name: '凡人', color: '#9d9bb8' };
  if (level <= 30) return { name: '超凡·正式阶', color: '#9d8cf0' };
  if (level <= 60) return { name: '超凡·大师阶', color: '#7c6ef0' };
  if (level <= 100) return { name: '超凡·英雄阶', color: '#6c5ef0' };
  return { name: '传奇', color: '#d4af5e' };
}

// 升级所需经验
function expToNext(level) {
  return Math.floor(50 * Math.pow(level, 1.5));
}

// 生成装备实例
function createEquipItem(templateId, uid) {
  const t = EQUIP_TEMPLATES[templateId];
  if (!t) return null;
  return {
    uid: uid || (Date.now() + '_' + Math.random().toString(36).substr(2, 6)),
    templateId,
    name: t.name,
    slot: t.slot,
    quality: t.quality,
    reqLevel: t.reqLevel,
    stats: { ...t.stats }
  };
}

// 材料出售价格
const MATERIAL_PRICES = {
  '兽皮': 5, '草药': 8, '兽骨': 5, '青铜矿': 12,
  '泰坦之血碎片': 50, '飞龙鳞片': 30,
  '海灵石': 40, '铁矿': 15, '深海水晶': 60,
  '风羽玉露': 80, '光明晶': 100, '天使之羽': 200,
  '附魔卷轴': 150, '炼金材料': 80,
  '龙鳞': 300, '龙血': 500,
  '法则碎片': 1000, '深渊之石': 800
};

// 商店材料货架（解锁对应地图后可见可买）
// 定价规则：买入价 ≈ 卖出价 ×4（防止买卖套利）；法则碎片/深渊之石不上架（保留终局刷取价值）
const SHOP_MATERIALS = [
  { id: 'mat_beast_hide',    name: '兽皮',       price: 20,   requiredLevel: 1,  sourceMap: '高蛮山' },
  { id: 'mat_herb',          name: '草药',       price: 32,   requiredLevel: 5,  sourceMap: '密语森林' },
  { id: 'mat_bone',          name: '兽骨',       price: 20,   requiredLevel: 5,  sourceMap: '密语森林' },
  { id: 'mat_bronze',        name: '青铜矿',     price: 48,   requiredLevel: 15, sourceMap: '瀚海森林' },
  { id: 'mat_dragon_scale_s',name: '飞龙鳞片',   price: 120,  requiredLevel: 15, sourceMap: '瀚海森林' },
  { id: 'mat_titan_blood',   name: '泰坦之血碎片', price: 200, requiredLevel: 15, sourceMap: '瀚海森林' },
  { id: 'mat_iron',          name: '铁矿',       price: 60,   requiredLevel: 30, sourceMap: '东海之滨' },
  { id: 'mat_sea_stone',     name: '海灵石',     price: 160,  requiredLevel: 30, sourceMap: '东海之滨' },
  { id: 'mat_deep_crystal',  name: '深海水晶',   price: 240,  requiredLevel: 30, sourceMap: '东海之滨' },
  { id: 'mat_wind_dew',      name: '风羽玉露',   price: 320,  requiredLevel: 50, sourceMap: '天堂山' },
  { id: 'mat_light_crystal', name: '光明晶',     price: 400,  requiredLevel: 50, sourceMap: '天堂山' },
  { id: 'mat_angel_feather', name: '天使之羽',   price: 800,  requiredLevel: 50, sourceMap: '天堂山' },
  { id: 'mat_scroll',        name: '附魔卷轴',   price: 600,  requiredLevel: 70, sourceMap: '地精王城外围' },
  { id: 'mat_alchemy',       name: '炼金材料',   price: 320,  requiredLevel: 70, sourceMap: '地精王城外围' },
  { id: 'mat_dragon_scale',  name: '龙鳞',       price: 1200, requiredLevel: 90, sourceMap: '龙岛' },
  { id: 'mat_dragon_blood',  name: '龙血',       price: 2000, requiredLevel: 90, sourceMap: '龙岛' },
];

// 装备出售价格（按品质）
const EQUIP_SELL_PRICES = { normal: 20, fine: 80, epic: 300, legend: 1500 };

// 初始材料池（任务奖励随机抽）
const INITIAL_MATERIAL_POOL = ['草药', '兽皮', '兽骨', '青铜矿'];

module.exports = {
  EQUIP_TEMPLATES, QUALITY_COLORS, QUALITY_ORDER, QUALITY_NEXT,
  UPGRADE_LEVEL_MAX, UPGRADE_BASE_GOLD, QUALITY_GOLD_MULT, QUALITY_STAT_MULT,
  UPGRADE_MATERIAL_BY_QUALITY,
  SHOP_ITEMS, SHOP_MATERIALS, MATERIAL_PRICES, EQUIP_SELL_PRICES, INITIAL_MATERIAL_POOL,
  getStage, expToNext, createEquipItem,
};
