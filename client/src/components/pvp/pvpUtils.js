// ====== PvP 工具函数 ======
// @file components/pvp/pvpUtils
// @module pvp-utils
// @description PvP 视图使用的纯函数：属性标签格式化、槽位、购买条件

const statLabels = {
  atk: '攻击', def: '防御', hp: 'HP', mp: 'MP', agi: '敏捷',
  str: '力量', con: '体质', spi: '精神',
  crit: '暴击率', critDmg: '暴击伤害', dodge: '闪避率',
  lifesteal: '吸血', thorns: '反伤',
  dmgTaken: '减伤', ignoreDef: '破防', shieldRegen: '护盾回复',
  lowHpAtk: '低血增伤', lowHpDef: '低血减伤', dodgeAtk: '闪避反击',
  killExp: '击杀经验', killGold: '击杀金币', firstTurnAgi: '先手加速',
  stackAtk: '叠加攻击', consumeCut: '消耗降低', weakAtk: '对弱增伤',
  exp: '经验', gold: '金币', mpRegen: '法力回复'
};

const slotLabels = { weapon: '武器', armor: '护甲', accessory: '饰品' };

function statLabel(key) { return statLabels[key] || key; }
function slotLabel(s) { return slotLabels[s] || s; }

function formatStat(key, v) {
  if (typeof v !== 'number') return v;
  // 百分比类 stat
  const percentKeys = ['crit','critDmg','dodge','lifesteal','thorns','dmgTaken','ignoreDef','shieldRegen','lowHpAtk','lowHpDef','dodgeAtk','killExp','killGold','firstTurnAgi','stackAtk','consumeCut','weakAtk','exp','gold','mpRegen'];
  if (percentKeys.includes(key)) return Math.round(v * 100) + '%';
  // HP/MP 整数
  if (key === 'hp' || key === 'mp') return Math.round(v);
  // 攻击/防御/敏捷
  return Math.round(v);
}

function canBuyItem(item, playerLevel, arenaCoins) {
  if (!item) return false;
  if ((playerLevel || 1) < item.reqLevel) return false;
  if ((arenaCoins || 0) < item.price) return false;
  return true;
}

function buyBtnText(item, playerLevel, arenaCoins) {
  if ((playerLevel || 1) < item.reqLevel) return `需 Lv.${item.reqLevel}`;
  if ((arenaCoins || 0) < item.price) return '币不足';
  return '购买';
}

// 战斗记录
function getRecResult(rec) {
  return rec.result === 'win' ? 'win' : 'lose';
}
function getRecResultText(rec) {
  return rec.result === 'win' ? '胜' : '负';
}

export {
  statLabels, slotLabels,
  statLabel, slotLabel, formatStat,
  canBuyItem, buyBtnText,
  getRecResult, getRecResultText,
};
