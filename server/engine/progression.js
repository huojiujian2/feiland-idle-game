// ====== 职业 / 登神 / 转生 / 转生点商店 / 离线收益汇总 ======
const { getNow, getRand } = require('./state');
const {
  JOB_TREE, ASCENSION, AREA_ORDER, expToNext,
} = require('../data');
const { AREAS } = require('../data');
const { refreshDailyIfNeeded, checkAchievements } = require('./daily');
const { migratePlayer, grantGold } = require('./player');

// recalcMaxStats 注入
let _recalcMaxStats = () => {};
function setRecalcMaxStatsHandler(fn) { if (typeof fn === 'function') _recalcMaxStats = fn; }
function recalc(player) { return _recalcMaxStats(player); }

// 选择职业
function chooseJob(player, jobPath) {
  if (player.level < 11) return { success: false, message: '需要 Lv.11' };
  if (player.jobPath) return { success: false, message: '已选择职业' };
  if (!JOB_TREE[jobPath]) return { success: false, message: '职业不存在' };
  player.jobPath = jobPath;
  player.job = JOB_TREE[jobPath].stages[0].name;
  player.logs.push({ time: getNow(), type: 'job', text: `${JOB_TREE[jobPath].stages[0].desc}，职业：${player.job}！解锁2个被动词条槽位` });
  return { success: true };
}

// 登神
function attemptAscension(player) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  if (player.godhood === 'god') return { success: false, message: '已是神灵' };
  const target = player.godhood === null ? 'demigod' : 'god';
  const asc = ASCENSION[target];
  const attrs = player.attributes;
  if (player.level < asc.reqLevel) return { success: false, message: `需要 Lv.${asc.reqLevel}` };
  const minAttr = Math.min(attrs.atk || 0, attrs.def || 0, attrs.hp || 0, attrs.agi || 0);
  const reqAttr = asc.reqAttr || 50;
  if (minAttr < reqAttr) {
    return { success: false, message: `每项属性需达到 ${reqAttr}（最低项当前 ${minAttr}）` };
  }
  if (player.laws.length < asc.reqLaws) return { success: false, message: `需学会至少 ${asc.reqLaws} 个法则` };
  if (asc.reqFaith && player.faith < asc.reqFaith) return { success: false, message: `需要信仰值 ${asc.reqFaith}（当前 ${player.faith}）` };
  player.godhood = target;
  recalc(player);
  player.hp = player.maxHp;
  player.mp = player.maxMp;
  player.logs.push({ time: getNow(), type: 'ascend', text: `${asc.desc}！你已登临${asc.name}之位！${asc.bonusText}` });
  checkAchievements(player);
  return { success: true };
}

// 转生
function doReincarnate(player) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  if (player.level < 100) return { success: false, message: '需要 Lv.100 才能转生' };
  const maxClearedArea = player.stats?.maxClearedArea || 'gaomanshan';
  const curIdx = AREA_ORDER.indexOf(maxClearedArea);
  if (curIdx < AREA_ORDER.indexOf('longdao')) {
    return { success: false, message: '需先通关「龙岛」才可转生' };
  }
  const totalAttr = (player.attributes.atk || 0) + (player.attributes.def || 0) +
                    (player.attributes.hp || 0) + (player.attributes.agi || 0);
  const earnedPoints = Math.max(1, Math.floor(totalAttr / 100));

  player.reincarnation = (player.reincarnation || 0) + 1;
  player.reincPoints = (player.reincPoints || 0) + earnedPoints;

  const rc = player.reincarnation;
  player.permanentBuffs = {
    expBonus: Math.min(0.30, rc * 0.02),
    goldBonus: Math.min(0.30, rc * 0.02),
    baseAtkBonus: rc * 5,
    baseDefBonus: rc * 5,
    baseHpBonus: rc * 5,
    baseAgiBonus: rc * 5,
  };

  player.level = 1;
  player.exp = 0;
  player.attrPoints = 0;
  player.skillPoints = 0;
  player.attributes = { atk: 5, def: 4, hp: 5, agi: 8 };

  // 转生后回到初始地图（保留 maxClearedArea 作为历史成就记录）
  player.currentArea = 'gaomanshan';

  recalc(player);
  player.hp = player.maxHp;
  player.mp = player.maxMp;
  player.lastTick = getNow();

  player.logs = player.logs || [];
  player.logs.push({
    time: getNow(),
    type: 'reincarnate',
    text: `【轮回 ${player.reincarnation}】转生成功！获得 ${earnedPoints} 转生点，永久 +${Math.round(player.permanentBuffs.expBonus*100)}% 经验/+${Math.round(player.permanentBuffs.goldBonus*100)}% 金币/基础属性 +5`
  });
  checkAchievements(player);
  return { success: true, earnedPoints, reincarnation: player.reincarnation };
}

function getReincarnationInfo(player) {
  player = migratePlayer(player);
  const rc = player.reincarnation || 0;
  const nextCap = 30;
  return {
    reincarnation: rc,
    reincPoints: player.reincPoints || 0,
    permanentBuffs: player.permanentBuffs || {
      expBonus: 0, goldBonus: 0,
      baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0,
    },
    nextBuffs: {
      expBonus: Math.min(nextCap, (rc + 1) * 0.02),
      goldBonus: Math.min(nextCap, (rc + 1) * 0.02),
      baseAtkBonus: (rc + 1) * 5,
      baseDefBonus: (rc + 1) * 5,
      baseHpBonus: (rc + 1) * 5,
      baseAgiBonus: (rc + 1) * 5,
    },
    canReincarnate: (player.level >= 100) &&
      ((player.stats && player.stats.maxClearedArea &&
        AREA_ORDER.indexOf(player.stats.maxClearedArea) >= AREA_ORDER.indexOf('longdao')) || rc > 0),
    level: player.level,
  };
}

// 转生点商店
const REINC_SHOP_ITEMS = [
  { id: 'exp_potion', name: '经验药水(50%)', desc: '永久增加 1% 经验加成', cost: 10, type: 'buff', apply: (p) => {
    p.permanentBuffs = p.permanentBuffs || {};
    p.permanentBuffs.expBonus = (p.permanentBuffs.expBonus || 0) + 0.01;
  }},
  { id: 'gold_potion', name: '财富药水(50%)', desc: '永久增加 1% 金币加成', cost: 10, type: 'buff', apply: (p) => {
    p.permanentBuffs = p.permanentBuffs || {};
    p.permanentBuffs.goldBonus = (p.permanentBuffs.goldBonus || 0) + 0.01;
  }},
  { id: 'attr_potion_atk', name: '攻击之魂', desc: '永久增加 10 攻击基础值', cost: 20, type: 'buff', apply: (p) => {
    p.permanentBuffs = p.permanentBuffs || {};
    p.permanentBuffs.baseAtkBonus = (p.permanentBuffs.baseAtkBonus || 0) + 10;
  }},
  { id: 'attr_potion_def', name: '防御之魂', desc: '永久增加 10 防御基础值', cost: 20, type: 'buff', apply: (p) => {
    p.permanentBuffs = p.permanentBuffs || {};
    p.permanentBuffs.baseDefBonus = (p.permanentBuffs.baseDefBonus || 0) + 10;
  }},
  { id: 'attr_potion_hp', name: '生命之魂', desc: '永久增加 50 生命基础值', cost: 20, type: 'buff', apply: (p) => {
    p.permanentBuffs = p.permanentBuffs || {};
    p.permanentBuffs.baseHpBonus = (p.permanentBuffs.baseHpBonus || 0) + 50;
  }},
  { id: 'attr_potion_agi', name: '敏捷之魂', desc: '永久增加 5 敏捷基础值', cost: 20, type: 'buff', apply: (p) => {
    p.permanentBuffs = p.permanentBuffs || {};
    p.permanentBuffs.baseAgiBonus = (p.permanentBuffs.baseAgiBonus || 0) + 5;
  }},
  { id: 'material_box', name: '材料宝盒', desc: '随机获得 5 个高级材料', cost: 30, type: 'material', apply: (p) => {
    const mats = ['法则碎片', '深渊之石', '龙血', '光明晶'];
    const mat = mats[Math.floor(getRand()() * mats.length)];
    const existing = p.inventory.find(i => i.name === mat);
    if (existing) existing.count += 5;
    else p.inventory.push({ name: mat, count: 5, type: 'material' });
    return `获得 5 个 ${mat}`;
  }},
  { id: 'gold_pack', name: '金币大礼包', desc: '直接获得 50000 金币', cost: 15, type: 'gold', apply: (p) => {
    grantGold(p, 50000);
    return '获得 50000 金币';
  }},
];

function getReincShop() {
  return REINC_SHOP_ITEMS.map(item => ({
    id: item.id, name: item.name, desc: item.desc, cost: item.cost, type: item.type
  }));
}

function buyReincShopItem(player, itemId) {
  player = migratePlayer(player);
  const item = REINC_SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return { success: false, message: '商品不存在' };
  const points = player.reincPoints || 0;
  if (points < item.cost) {
    return { success: false, message: `转生点不足，需要 ${item.cost} 点（当前 ${points}）` };
  }
  player.reincPoints = points - item.cost;
  const result = item.apply(player);
  recalc(player);
  player.hp = player.maxHp;
  player.mp = player.maxMp;
  return { success: true, message: result || `兑换成功：${item.name}`, reincPoints: player.reincPoints };
}

// 离线收益
const OFFLINE_THRESHOLD_MS = 30 * 1000;

function getOfflineSummary(player) {
  player = migratePlayer(player);
  const now = getNow();
  const offlineDuration = now - (player.lastActiveAt || now);
  if (offlineDuration < OFFLINE_THRESHOLD_MS) return null;

  const snap = player.offlineSnapshot || {};
  let totalExpGained = player.exp - (snap.exp || 0);
  for (let l = snap.level || player.level; l < player.level; l++) {
    totalExpGained += expToNext(l);
  }
  return {
    offlineSeconds: Math.floor(offlineDuration / 1000),
    expGained: Math.max(0, Math.floor(totalExpGained)),
    goldGained: Math.max(0, player.gold - (snap.gold || 0)),
    killCount: Math.max(0, (player.killCount || 0) - (snap.killCount || 0)),
    levelUps: Math.max(0, player.level - (snap.level || player.level)),
    bossKills: Math.max(0, (player.bossKills || 0) - (snap.bossKills || 0)),
  };
}

function updateOfflineSnapshot(player) {
  player = migratePlayer(player);
  player.offlineSnapshot = {
    exp: player.exp,
    gold: player.gold,
    level: player.level,
    killCount: player.killCount || 0,
    bossKills: player.bossKills || 0,
  };
  player.lastActiveAt = getNow();
}

module.exports = {
  chooseJob, attemptAscension,
  doReincarnate, getReincarnationInfo,
  getReincShop, buyReincShopItem,
  getOfflineSummary, updateOfflineSnapshot,
  setRecalcMaxStatsHandler,
};
