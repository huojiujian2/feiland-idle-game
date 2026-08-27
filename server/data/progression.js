// ====== 进阶系统：种族进化 + 附魔配方 + 法则 + 登神 ======
// @file data/progression
// @module data-progression
// @description 种族进化路线、附魔配方、法则系统、登神配置

// 种族进化表
const RACE_EVOLUTION = {
  鹰人: {
    name: '鹰人', stage: 0, desc: '凡尘大陆的低等种族，拥有飞行的天赋',
    bonusText: '初始种族，无额外加成',
    nextEvolution: '翼人'
  },
  翼人: {
    name: '翼人', stage: 1, desc: '鹰人进化而成，光属性亲和，拥有更强的飞行能力',
    bonus: { str: 5, con: 5, spi: 10, agi: 10, cha: 10 },
    bonusText: '全属性+5~10，光属性亲和',
    reqLevel: 30,
    reqMaterial: { name: '天使之羽', count: 1 },
    nextEvolution: '天使'
  },
  天使: {
    name: '天使', stage: 2, desc: '翼人的终极进化形态，神圣属性的化身',
    bonus: { str: 20, con: 20, spi: 30, agi: 20, cha: 30 },
    bonusText: '全属性大幅提升，神圣属性，经验+20%',
    reqLevel: 80,
    reqMaterial: { name: '光明晶', count: 5 },
    nextEvolution: null
  }
};

// 附魔配方表
// v2.5：desc 改成"实际加到战斗属性的效果"——隐藏系数（str ×2 / con def×1.5+hp×5 / spi ×3）展开成直观的"攻击+X / 防御+Y / HP+Z / MP+W"
//   百分比字段（exp/gold）保留"经验+10% / 金币+15%"格式
const ENCHANT_RECIPES = [
  { id: 'atk_enchant', name: '攻击附魔', desc: '攻击+5', slot: 'weapon',
    cost: 200, materials: [{ name: '青铜矿', count: 3 }], bonus: { atk: 5 } },
  { id: 'def_enchant', name: '防御附魔', desc: '防御+5', slot: 'armor',
    cost: 200, materials: [{ name: '铁矿', count: 3 }], bonus: { def: 5 } },
  { id: 'hp_enchant', name: '生命附魔', desc: 'HP+50', slot: 'armor',
    cost: 300, materials: [{ name: '草药', count: 5 }], bonus: { hp: 50 } },
  { id: 'str_enchant', name: '力量附魔', desc: '攻击+6', slot: 'weapon',
    cost: 500, materials: [{ name: '飞龙鳞片', count: 2 }], bonus: { str: 3 } },
  { id: 'spi_enchant', name: '精神附魔', desc: 'MP+9', slot: 'accessory',
    cost: 500, materials: [{ name: '海灵石', count: 2 }], bonus: { spi: 3 } },
  { id: 'agi_enchant', name: '敏捷附魔', desc: '敏捷+3', slot: 'accessory',
    cost: 500, materials: [{ name: '风羽玉露', count: 2 }], bonus: { agi: 3 } },
  { id: 'exp_enchant', name: '经验附魔', desc: '经验获取+10%', slot: 'accessory',
    cost: 1000, materials: [{ name: '附魔卷轴', count: 1 }], bonus: { exp: 0.10 } },
  { id: 'gold_enchant', name: '贪婪附魔', desc: '金币获取+15%', slot: 'weapon',
    cost: 1000, materials: [{ name: '炼金材料', count: 3 }], bonus: { gold: 0.15 } },
  { id: 'legend_atk', name: '传说·破灭', desc: '攻击+40', slot: 'weapon',
    cost: 5000, materials: [{ name: '龙血', count: 1 }, { name: '附魔卷轴', count: 3 }], bonus: { atk: 20, str: 10 } },
  { id: 'legend_def', name: '传说·不朽', desc: '防御+35 HP+250', slot: 'armor',
    cost: 5000, materials: [{ name: '龙鳞', count: 2 }, { name: '附魔卷轴', count: 3 }], bonus: { def: 20, con: 10, hp: 200 } },
  { id: 'myth_spi', name: '神话·灵蕴', desc: '攻击+10 MP+245', slot: 'accessory',
    cost: 8000, materials: [{ name: '深渊之石', count: 1 }, { name: '光明晶', count: 3 }, { name: '附魔卷轴', count: 5 }], bonus: { spi: 15, mp: 200, atk: 10 } }
];
const MAX_ENCHANT_SLOTS = 3;

// 法则系统
const LAWS = [
  { id: 'law_destruction', name: '破坏法则', desc: '理解破坏的本质，伤害+15%',
    reqLevel: 100, cost: { name: '法则碎片', count: 5 }, bonus: { damage: 0.15 } },
  { id: 'law_guardian', name: '守护法则', desc: '理解守护的意义，减伤+15%',
    reqLevel: 100, cost: { name: '法则碎片', count: 5 }, bonus: { defense: 0.15 } },
  { id: 'law_spacetime', name: '时空法则', desc: '触及时间与空间，经验+25%',
    reqLevel: 105, cost: { name: '法则碎片', count: 8 }, bonus: { exp: 0.25 } },
  { id: 'law_life', name: '生命法则', desc: '领悟生命真谛，自动回血+10%',
    reqLevel: 105, cost: { name: '法则碎片', count: 8 }, bonus: { heal: 0.10 } },
  { id: 'law_wealth', name: '财富法则', desc: '万物皆有价，金币+30%',
    reqLevel: 110, cost: { name: '法则碎片', count: 10 }, bonus: { gold: 0.30 } },
  { id: 'law_annihilation', name: '湮灭法则', desc: '终极法则，全属性加成10%',
    reqLevel: 120, cost: { name: '法则碎片', count: 20 }, bonus: { allAttr: 0.10 } }
];

// 登神系统
const ASCENSION = {
  demigod: {
    name: '半神', reqLevel: 100,
    reqAttr: 50,
    reqLaws: 3,
    desc: '凝聚法则之心，踏入半神领域。全属性+50，HP/MP翻倍',
    bonus: { atk: 50, def: 50, hp: 50, agi: 50 },
    bonusText: '全属性+50，HP/MP上限×2'
  },
  god: {
    name: '神灵', reqLevel: 120,
    reqAttr: 100,
    reqLaws: 5,
    reqFaith: 5000,
    desc: '点燃神火，登临神座。全属性+200，获得神威特性',
    bonus: { atk: 200, def: 200, hp: 200, agi: 200 },
    bonusText: '全属性+200，解锁信仰系统'
  }
};

module.exports = { RACE_EVOLUTION, ENCHANT_RECIPES, MAX_ENCHANT_SLOTS, LAWS, ASCENSION };
