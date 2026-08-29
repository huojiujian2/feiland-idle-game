// ====== 职业 / 登神 / 转生 / 转生点商店 / 离线收益汇总 ======
const { getNow } = require('./state');
const {
  JOB_TREE, ASCENSION, AREA_ORDER, expToNext,
} = require('../data');
const { AREAS } = require('../data');
const { refreshDailyIfNeeded, checkAchievements } = require('./daily');
const { migratePlayer, grantGold, grantExpWithLevelUp } = require('./player');

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
  // v6：转生点公式改为按等级
  //   第一次转生（rc=0→1）：固定 10 点（特殊值，激励玩家转生）
  //   后续转生（rc≥1）：floor(等级 / 50)
  //   100 级 → 2 点；200 级 → 4 点；500 级 → 10 点；1000 级 → 20 点
  const newRc = (player.reincarnation || 0) + 1;
  const earnedPoints = newRc === 1
    ? 10
    : Math.max(0, Math.floor((player.level || 0) / 50));

  player.reincarnation = newRc;
  player.reincPoints = (player.reincPoints || 0) + earnedPoints;

  // v4：转生时**累加** permanentBuffs（保留商店购买的加成）
  //   经验/金币：每次转生只增加 0.01（与商店"经验祝福·微"同速率），封顶 0.60
  //   基础 4 维：每次转生只增加 1（与经验/金币统一）
  //   之前转生给 +0.02/+5 会让玩家感觉到"转生 1 次比买 1 次多涨得多"，与"统一累加"不符
  //   现在统一改成 +0.01/+1，玩家可以从"经验祝福·微"的 +0.01 一直买到封顶
  // v9：4 个属性之魂的 baseXPercent 也要保留（v8 引入，bug 修复）
  //   之前 v4 修复时还没这个字段，所以不覆盖丢失的字段变成"清零"
  const prev = player.permanentBuffs || {};
  player.permanentBuffs = {
    expBonus: Math.min(0.60, (prev.expBonus || 0) + 0.01),
    goldBonus: Math.min(0.60, (prev.goldBonus || 0) + 0.01),
    baseAtkBonus: (prev.baseAtkBonus || 0) + 1,
    baseDefBonus: (prev.baseDefBonus || 0) + 1,
    baseHpBonus: (prev.baseHpBonus || 0) + 1,
    baseAgiBonus: (prev.baseAgiBonus || 0) + 1,
    // v9：保留 4 个属性之魂买的百分比增幅
    baseAtkPercent: prev.baseAtkPercent || 0,
    baseDefPercent: prev.baseDefPercent || 0,
    baseHpPercent: prev.baseHpPercent || 0,
    baseAgiPercent: prev.baseAgiPercent || 0,
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
    text: `【轮回 ${player.reincarnation}】转生成功！获得 ${earnedPoints} 转生点，永久 +${Math.round(player.permanentBuffs.expBonus*100)}% 经验/+${Math.round(player.permanentBuffs.goldBonus*100)}% 金币/基础属性 +1`
  });
  checkAchievements(player);
  return { success: true, earnedPoints, reincarnation: player.reincarnation };
}

// ====== 内测工具：一键转生 ======
// 原理：用当前金币按"高级经验卷轴"（800 金币 / 3000 经验）的购买力把等级速拉到 targetLevel，
//       然后走正常 doReincarnate，重复 times 轮。金币不够时停在断点，返回已完成轮数。
// 注意：内测专用，后续删除经验卷轴时同步删除。
const AUTO_REINC_SCROLL_EXP = 3000;   // 高级经验卷轴经验
const AUTO_REINC_SCROLL_COST = 800;  // 高级经验卷轴价格
function autoReincarnate(player, times, targetLevel) {
  player = migratePlayer(player);
  const n = Math.floor(Number(times) || 0);
  const lv = Math.floor(Number(targetLevel) || 0);
  if (n < 1) return { success: false, message: '转生次数至少为 1' };
  if (lv < 100) return { success: false, message: '目标等级不能低于 100（转生需要 Lv.100）' };

  // 通关条件提前校验（转生后保留进度，只需检查一次）
  const maxClearedArea = player.stats?.maxClearedArea || 'gaomanshan';
  if (AREA_ORDER.indexOf(maxClearedArea) < AREA_ORDER.indexOf('longdao')) {
    return { success: false, message: '需先通关「龙岛」才可转生' };
  }

  let completed = 0;
  for (let i = 1; i <= n; i++) {
    // 1) 计算当前等级 → 目标等级的缺口经验（已有经验可抵扣）
    if (player.level < lv) {
      let need = 0;
      for (let l = player.level; l < lv; l++) need += expToNext(l);
      need -= player.exp || 0;
      if (need > 0) {
        const scrolls = Math.ceil(need / AUTO_REINC_SCROLL_EXP);
        const cost = scrolls * AUTO_REINC_SCROLL_COST;
        if (player.gold < cost) {
          return {
            success: true, completed, stoppedAt: i,
            message: `金币不足：第 ${i} 轮需 ${scrolls} 张高级经验卷轴（${cost} 金币），当前仅 ${player.gold} 金币`,
          };
        }
        player.gold -= cost;
        grantExpWithLevelUp(player, need);
      }
    }
    // 2) 正常转生（等级/经验/属性重置，永久加成累加）
    const r = doReincarnate(player);
    if (!r.success) return { success: false, message: `第 ${i} 轮转生失败：${r.message}` };
    completed = i;
  }
  return {
    success: true, completed,
    message: `一键转生完成：共 ${completed} 轮（目标 Lv.${lv}）`,
  };
}

function getReincarnationInfo(player) {
  player = migratePlayer(player);
  const rc = player.reincarnation || 0;
  // v5：nextBuffs 返回实际能获得的增量（封顶时为 0）
  // 单次转生基础增量 = 0.01/+1；距离封顶还差多少就只返回多少
  // 封顶时当前已经是 0.60，实际能获得 0（前端显示 +0%）
  const currentExp = (player.permanentBuffs && player.permanentBuffs.expBonus) || 0;
  const currentGold = (player.permanentBuffs && player.permanentBuffs.goldBonus) || 0;
  const REINC_BONUS_STEP = 0.01;
  const REINC_BONUS_CAP = 0.60;
  const nextExpBonus = currentExp >= REINC_BONUS_CAP
    ? 0
    : Math.min(REINC_BONUS_STEP, REINC_BONUS_CAP - currentExp);
  const nextGoldBonus = currentGold >= REINC_BONUS_CAP
    ? 0
    : Math.min(REINC_BONUS_STEP, REINC_BONUS_CAP - currentGold);
  return {
    reincarnation: rc,
    reincPoints: player.reincPoints || 0,
    permanentBuffs: player.permanentBuffs || {
      expBonus: 0, goldBonus: 0,
      baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0,
    },
    nextBuffs: {
      expBonus: nextExpBonus,
      goldBonus: nextGoldBonus,
      // 基础 4 维无上限，永远 +1
      baseAtkBonus: 1,
      baseDefBonus: 1,
      baseHpBonus: 1,
      baseAgiBonus: 1,
    },
    canReincarnate: (player.level >= 100) &&
      ((player.stats && player.stats.maxClearedArea &&
        AREA_ORDER.indexOf(player.stats.maxClearedArea) >= AREA_ORDER.indexOf('longdao')) || rc > 0),
    level: player.level,
  };
}

// 转生点商店（v8 重做）
//   每个商品"已买次数"独立计数，存放在 player.reincShopCounts[itemId]
//   购买价格 = 已买次数 + 1（第 1 次 1 点，第 2 次 2 点，第 N 次 N 点）
//   累计消耗 = 1 + 2 + ... + N = N(N+1)/2
//   单次购买效果：
//     - 经验祝福·微 / 财富祝福·微：+0.01（+1%）
//     - 攻击之魂 / 防御之魂 / 生命之魂 / 敏捷之魂：+0.02（+2% 基础属性永久增幅）
//     - 材料宝盒：5 个自选高级材料（固定 5 个，不随次数变化）
//     - 金币大礼包：9000 金币（固定，不随次数变化）
// 经验/金币加成类有封顶 +60%，其他无封顶
const REINC_BUFF_CAP = 0.60;
const MATERIAL_BOX_OPTIONS = ['法则碎片', '深渊之石', '龙血', '光明晶'];
// 商品的"基础效果"配置（不含 cost，因为 cost 动态计算）
const REINC_SHOP_ITEMS = [
  { id: 'exp_potion', name: '经验祝福·微', desc: '永久增加 1% 经验加成（累计上限 +60%）', type: 'buff', apply: (p) => {
    p.permanentBuffs = p.permanentBuffs || {};
    p.permanentBuffs.expBonus = Math.min(REINC_BUFF_CAP, (p.permanentBuffs.expBonus || 0) + 0.01);
  }},
  { id: 'gold_potion', name: '财富祝福·微', desc: '永久增加 1% 金币加成（累计上限 +60%）', type: 'buff', apply: (p) => {
    p.permanentBuffs = p.permanentBuffs || {};
    p.permanentBuffs.goldBonus = Math.min(REINC_BUFF_CAP, (p.permanentBuffs.goldBonus || 0) + 0.01);
  }},
  // v8：4 个属性之魂改为"基础属性永久增幅 +2%"（不是 flat +10/+50）
  { id: 'attr_potion_atk', name: '攻击之魂', desc: '永久增加 2% 攻击基础值（累计永久增幅）', type: 'buff', apply: (p) => {
    p.permanentBuffs = p.permanentBuffs || {};
    p.permanentBuffs.baseAtkPercent = (p.permanentBuffs.baseAtkPercent || 0) + 0.02;
  }},
  { id: 'attr_potion_def', name: '防御之魂', desc: '永久增加 2% 防御基础值（累计永久增幅）', type: 'buff', apply: (p) => {
    p.permanentBuffs = p.permanentBuffs || {};
    p.permanentBuffs.baseDefPercent = (p.permanentBuffs.baseDefPercent || 0) + 0.02;
  }},
  { id: 'attr_potion_hp', name: '生命之魂', desc: '永久增加 2% 生命基础值（累计永久增幅）', type: 'buff', apply: (p) => {
    p.permanentBuffs = p.permanentBuffs || {};
    p.permanentBuffs.baseHpPercent = (p.permanentBuffs.baseHpPercent || 0) + 0.02;
  }},
  { id: 'attr_potion_agi', name: '敏捷之魂', desc: '永久增加 2% 敏捷基础值（累计永久增幅）', type: 'buff', apply: (p) => {
    p.permanentBuffs = p.permanentBuffs || {};
    p.permanentBuffs.baseAgiPercent = (p.permanentBuffs.baseAgiPercent || 0) + 0.02;
  }},
  { id: 'material_box', name: '材料宝盒', desc: '自选获得 5 个高级材料（法则碎片/深渊之石/龙血/光明晶）', type: 'material', apply: (p, option) => {
    const mat = option;
    const existing = p.inventory.find(i => i.name === mat);
    if (existing) existing.count += 5;
    else p.inventory.push({ name: mat, count: 5, type: 'material' });
    return `获得 5 个 ${mat}`;
  }},
  { id: 'gold_pack', name: '金币大礼包', desc: '直接获得 9000 金币', type: 'gold', apply: (p) => {
    grantGold(p, 9000);
    return '获得 9000 金币';
  }},
];

// 工具：取商品已买次数
function getReincShopCount(player, itemId) {
  player.reincShopCounts = player.reincShopCounts || {};
  return player.reincShopCounts[itemId] || 0;
}
// 工具：取商品"下一次购买"的价格 = 已买次数 + 1
function getReincShopCost(player, itemId) {
  return getReincShopCount(player, itemId) + 1;
}
// 工具：累加已买次数
function bumpReincShopCount(player, itemId) {
  player.reincShopCounts = player.reincShopCounts || {};
  player.reincShopCounts[itemId] = (player.reincShopCounts[itemId] || 0) + 1;
}

// getReincShop：返回当前状态下的商品列表（含动态 cost）
//   cost = 已买次数 + 1
//   boughtCount 也返回给前端显示「第 N 次购买」
function getReincShop(player) {
  player = migratePlayer(player);
  return REINC_SHOP_ITEMS.map(item => {
    const bought = getReincShopCount(player, item.id);
    const cost = bought + 1;
    return {
      id: item.id,
      name: item.name,
      desc: item.desc,
      type: item.type,
      cost,                   // 下一次购买的价格（动态）
      boughtCount: bought,     // 已买次数
      nextCost: cost,          // 冗余字段，前端更易用
      options: item.id === 'material_box' ? MATERIAL_BOX_OPTIONS : undefined,
    };
  });
}

function buyReincShopItem(player, itemId, option) {
  player = migratePlayer(player);
  const item = REINC_SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return { success: false, message: '商品不存在' };
  // 材料宝盒：必须携带白名单内的自选材料
  if (item.id === 'material_box') {
    if (!option || !MATERIAL_BOX_OPTIONS.includes(option)) {
      return { success: false, message: `请选择要获得的材料（${MATERIAL_BOX_OPTIONS.join('/')}）` };
    }
  }
  // v7：封顶保护——经验/金币加成类满 60% 后禁止再买
  if (item.id === 'exp_potion') {
    const cur = (player.permanentBuffs || {}).expBonus || 0;
    if (cur >= REINC_BUFF_CAP) return { success: false, message: `经验加成已达上限 +${Math.round(REINC_BUFF_CAP * 100)}%` };
  }
  if (item.id === 'gold_potion') {
    const cur = (player.permanentBuffs || {}).goldBonus || 0;
    if (cur >= REINC_BUFF_CAP) return { success: false, message: `金币加成已达上限 +${Math.round(REINC_BUFF_CAP * 100)}%` };
  }
  // v7：动态价格 = 已买次数 + 1
  const cost = getReincShopCost(player, itemId);
  const points = player.reincPoints || 0;
  if (points < cost) {
    return { success: false, message: `转生点不足，需要 ${cost} 点（当前 ${points}）` };
  }
  player.reincPoints = points - cost;
  // v7：累加已买次数（影响下次价格）
  bumpReincShopCount(player, itemId);
  // 应用效果
  const result = item.apply(player, option);
  recalc(player);
  player.hp = player.maxHp;
  player.mp = player.maxMp;
  return {
    success: true,
    message: result || `兑换成功：${item.name}（第 ${getReincShopCount(player, itemId)} 次，已消耗 ${cost} 点）`,
    reincPoints: player.reincPoints,
    cost,                          // 本次实际扣的点数
    boughtCount: getReincShopCount(player, itemId),  // 买完后的次数
  };
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
  autoReincarnate, // 内测：一键转生
  getReincShop, buyReincShopItem,
  getOfflineSummary, updateOfflineSnapshot,
  setRecalcMaxStatsHandler,
};
