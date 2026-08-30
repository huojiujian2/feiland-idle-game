// ====== 日常任务 / 周月键 / 成就 / 引导 ======
const { getNow, getRand } = require('./state');
const { genUid } = require('./utils');
const {
  DAILY_QUESTS, DAILY_CHEST, ACHIEVEMENTS,
  INITIAL_MATERIAL_POOL, AFFIX_TREE, JOB_TREE, expToNext, createEquipItem,
} = require('../data');
const { assertSettlementReward } = require('./settlement');

// 周期键
function getTodayKey() {
  const d = new Date(getNow());
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}
function getMonthKey() {
  const d = new Date(getNow());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
function getCurrentWeekKey() {
  const now = new Date(getNow());
  now.setHours(0, 0, 0, 0);
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function getDailyKey() { return getTodayKey(); }
function getWeeklyKey() { return getCurrentWeekKey(); }
function getMonthlyKey() { return getMonthKey(); }

// 每日任务
function createDailyQuests() {
  return DAILY_QUESTS.map(q => ({ id: q.id, progress: 0, target: q.target, done: false, claimed: false }));
}
function refreshDailyIfNeeded(player) {
  const today = getTodayKey();
  if (player.dailyResetAt !== today) {
    player.dailyQuests = createDailyQuests();
    player.dailyChestClaimed = false;
    player.dailyResetAt = today;
  }
}
function updateDailyProgress(player, questId, inc = 1) {
  refreshDailyIfNeeded(player);
  const dq = (player.dailyQuests || []).find(q => q.id === questId);
  if (!dq || dq.done) return;
  dq.progress = Math.min(dq.target, (dq.progress || 0) + inc);
  if (dq.progress >= dq.target) dq.done = true;
}

// 任务统计
function ensureQuestStats(player) {
  if (!player.questStats) player.questStats = { totalGoldEarned: 0, affixSeen: [], seenEquipTemplates: [] };
  if (!Array.isArray(player.questStats.affixSeen)) player.questStats.affixSeen = [];
  if (!Array.isArray(player.questStats.seenEquipTemplates)) player.questStats.seenEquipTemplates = [];
  if (!Number.isFinite(player.questStats.totalGoldEarned)) player.questStats.totalGoldEarned = 0;
}

// 通用发奖（延迟绑定：grantGold/grantExpWithLevelUp 在 player.js 中实现，由 routes 注入）
let _grantGold = (player, amount) => { player.gold += amount; };
let _grantExpWithLevelUp = (player, exp) => { player.exp += exp; };
function setGrantHandlers({ grantGold, grantExpWithLevelUp }) {
  if (grantGold) _grantGold = grantGold;
  if (grantExpWithLevelUp) _grantExpWithLevelUp = grantExpWithLevelUp;
}

// 成就检查（用到 grantGold 的副作用：checkAchievements 内部不直接发奖，但 grantGold 会调用它）
function checkAchievements(player) {
  if (!player.achievements) player.achievements = {};
  const setUnlock = (id) => {
    if (!player.achievements[id]) player.achievements[id] = { unlocked: false, claimed: false, unlockAt: 0 };
    if (!player.achievements[id].unlocked) {
      player.achievements[id].unlocked = true;
      player.achievements[id].unlockAt = getNow();
    }
  };
  if (player.killCount >= 100) setUnlock('kill100');
  if (player.killCount >= 1000) setUnlock('kill1000');
  if (player.killCount >= 10000) setUnlock('kill10000');
  if (player.level >= 100) setUnlock('lv100');
  if (player.godhood) setUnlock('ascend');
  if (player.reincarnation >= 1) setUnlock('reinc1');
  const seen = (player.questStats && player.questStats.affixSeen) || [];
  if (seen.length >= 50) setUnlock('affix50');
  if ((player.questStats && player.questStats.totalGoldEarned || 0) >= 1000000) setUnlock('gold1m');
  const seenEquips = (player.questStats && player.questStats.seenEquipTemplates) || [];
  if (seenEquips.length >= 10) setUnlock('collect10');
}

function claimDaily(player, questId) {
  refreshDailyIfNeeded(player);
  const dq = (player.dailyQuests || []).find(q => q.id === questId);
  if (!dq) return { success: false, status: 404, message: '任务不存在' };
  if (!dq.done) return { success: false, status: 409, message: '未完成' };
  if (dq.claimed) return { success: true, status: 200, message: '已领取', already: true };
  const tpl = DAILY_QUESTS.find(q => q.id === questId);
  let reward = null;
  let chosenMat = null;
  let chosenCount = 0;
  if (tpl.reward.gold) {
    reward = { gold: tpl.reward.gold };
  } else if (tpl.reward.exp) {
    reward = { exp: tpl.reward.exp };
  } else if (tpl.reward.materialPool) {
    chosenMat = tpl.reward.materialPool[Math.floor(getRand()() * tpl.reward.materialPool.length)] || INITIAL_MATERIAL_POOL[0];
    chosenCount = tpl.reward.count || 1;
    reward = { materials: [{ name: chosenMat, count: chosenCount }] };
  } else if (tpl.reward.materials) {
    reward = { materials: tpl.reward.materials };
  } else {
    reward = { gold: tpl.reward.gold || 0 };
  }
  const v = assertSettlementReward('daily', reward);
  if (!v.valid) return { success: false, status: 500, message: v.message };
  if (reward.gold) _grantGold(player, reward.gold);
  if (reward.exp) _grantExpWithLevelUp(player, reward.exp);
  if (reward.materials) {
    const mat = chosenMat || reward.materials[0].name;
    const c = chosenCount || reward.materials[0].count;
    const ex = player.inventory.find(i => i.name === mat);
    if (ex) ex.count += c;
    else player.inventory.push({ name: mat, count: c, type: 'material' });
  }
  dq.claimed = true;
  try { require('./active').addActivePoints(player, 'daily_claim', 1); } catch (_) {}
  if (!Array.isArray(player.settlementLedger)) player.settlementLedger = [];
  const entry = { id: `daily:${getTodayKey()}:${questId}`, at: getNow(), type: 'daily', reward, source: `/api/player/:username/quest/daily/${questId}/claim` };
  const vv = assertSettlementReward(entry.type, entry.reward);
  if (!vv.valid) return { success: false, status: 500, message: vv.message };
  player.settlementLedger.push(entry);
  if (player.settlementLedger.length > 100) player.settlementLedger.splice(0, player.settlementLedger.length - 100);
  return { success: true, status: 200 };
}

function claimChest(player) {
  refreshDailyIfNeeded(player);
  if (player.dailyChestClaimed) return { success: true, status: 200, already: true };
  const claimedCount = (player.dailyQuests || []).filter(q => q.claimed).length;
  if (claimedCount < DAILY_CHEST.need) return { success: false, status: 409, message: '需完成5项已领取' };
  const reward = null;
  const v = assertSettlementReward('chest', reward);
  if (!v.valid) return { success: false, status: 500, message: v.message };
  player.dailyChestClaimed = true;
  try { require('./active').addActivePoints(player, 'daily_claim', 1); } catch (_) {}
  if (!Array.isArray(player.settlementLedger)) player.settlementLedger = [];
  const entry = { id: `chest:${getTodayKey()}`, at: getNow(), type: 'chest', reward, source: `/api/player/:username/quest/chest/claim` };
  player.settlementLedger.push(entry);
  if (player.settlementLedger.length > 100) player.settlementLedger.splice(0, player.settlementLedger.length - 100);
  return { success: true, status: 200 };
}

function claimAchievement(player, achId) {
  refreshDailyIfNeeded(player);
  const ach = ACHIEVEMENTS.find(a => a.id === achId);
  if (!ach) return { success: false, status: 404, message: '成就不存在' };
  const rec = (player.achievements || {})[achId];
  if (!rec || !rec.unlocked) return { success: false, status: 409, message: '未达成' };
  if (rec.claimed) return { success: true, status: 200, already: true };
  let titleToGrant = ach.title;
  if (achId === 'ascend') {
    titleToGrant = player.godhood === 'god' ? '神灵' : '半神';
  }
  const reward = {};
  let chosenEquipTpl = null;
  let chosenAff = null;
  if (ach.reward.gold) reward.gold = ach.reward.gold;
  if (ach.reward.equipPool) {
    chosenEquipTpl = ach.reward.equipPool[Math.floor(getRand()() * ach.reward.equipPool.length)];
    reward.equips = [{ templateId: chosenEquipTpl }];
  }
  if (ach.reward.affixLevel) {
    const pool = AFFIX_TREE[ach.reward.affixLevel] || [];
    if (pool.length) {
      chosenAff = pool[Math.floor(getRand()() * pool.length)];
      reward.affixId = chosenAff.id;
    }
  }
  if (ach.reward.reincPoints) reward.reincPoints = ach.reward.reincPoints;
  if (titleToGrant) reward.title = titleToGrant;
  const v = assertSettlementReward('achievement', reward);
  if (!v.valid) return { success: false, status: 500, message: v.message };
  if (ach.reward.gold) _grantGold(player, ach.reward.gold);
  if (chosenEquipTpl) {
    const item = createEquipItem(chosenEquipTpl, genUid());
    if (item) {
      addEquipToSortedPositionLocal(player, item);
      ensureQuestStats(player);
      if (!player.questStats.seenEquipTemplates.includes(chosenEquipTpl)) player.questStats.seenEquipTemplates.push(chosenEquipTpl);
    }
  }
  if (chosenAff) {
    player.inventory.push({ name: chosenAff.name, count: 1, type: 'affix', affixId: chosenAff.id });
    ensureQuestStats(player);
    if (!player.questStats.affixSeen.includes(chosenAff.id)) player.questStats.affixSeen.push(chosenAff.id);
    player.logs.push({ time: getNow(), type: 'achievement', text: `获得大师词条：${chosenAff.name}` });
  }
  if (ach.reward.reincPoints) {
    player.reincPoints = (player.reincPoints || 0) + ach.reward.reincPoints;
  }
  rec.claimed = true;
  if (titleToGrant) {
    if (!player.titles || typeof player.titles !== 'object' || Array.isArray(player.titles)) player.titles = {};
    if (!player.titles[titleToGrant]) player.titles[titleToGrant] = true;
    if (!player.currentTitle) player.currentTitle = titleToGrant;
    rec.grantedTitle = titleToGrant;
  }
  if (!Array.isArray(player.settlementLedger)) player.settlementLedger = [];
  const entry = { id: `ach:${achId}`, at: getNow(), type: 'achievement', reward, source: `/api/player/:username/quest/achievement/${achId}/claim` };
  player.settlementLedger.push(entry);
  if (player.settlementLedger.length > 100) player.settlementLedger.splice(0, player.settlementLedger.length - 100);
  return { success: true, status: 200 };
}

// 引导步骤
function normalizeTutorialStep(v) {
  if (!Number.isFinite(v)) return 0;
  let n = Math.floor(v);
  if (n < 0) return 0;
  if (n > 6) return 6;
  return n;
}
function updateTutorialStep(player, nextStep) {
  // getPlayerView 由 view 模块提供，这里延迟绑定
  let _view = (p) => p;
  if (!_view.__wrapped) {
    _view = require('./view').getPlayerView;
  }
  if (!Number.isInteger(nextStep) || nextStep < 0 || nextStep > 6) return { success: false, status: 400, message: 'step 非法' };
  const cur = normalizeTutorialStep(player.tutorialStep);
  if (nextStep === 6) {
    if (cur === 6) return { success: true, status: 200, data: _view(player) };
    player.tutorialStep = 6;
    return { success: true, status: 200, data: _view(player) };
  }
  if (nextStep === cur) return { success: false, status: 409, message: '步骤不连续' };
  if (nextStep !== cur + 1) return { success: false, status: 409, message: '步骤不连续' };
  if (cur === 2 && nextStep === 3) {
    const dq = (player.dailyQuests || []).find(q => q.id === 'alloc1');
    if (!dq || !dq.done) return { success: false, status: 409, message: '条件未满足' };
  }
  if (cur === 4 && nextStep === 5) {
    if (player.level < 5) return { success: false, status: 409, message: '条件未满足' };
  }
  player.tutorialStep = nextStep;
  return { success: true, status: 200, data: _view(player) };
}

// 词条/职业工具
function findAffix(affixId) {
  for (const lv of [1, 2, 3, 4]) {
    const found = AFFIX_TREE[lv].find(a => a.id === affixId);
    if (found) return found;
  }
  return null;
}
function getJobStage(player) {
  if (!player.jobPath) return 0;
  const tree = JOB_TREE[player.jobPath];
  let stage = 0;
  for (let i = 0; i < tree.stages.length; i++) {
    if (player.level >= tree.stages[i].level) stage = i + 1;
  }
  return stage;
}
function getPassiveSlots(player) {
  const stage = getJobStage(player);
  return stage + 1;
}
function getAvailableAffixLevels(player) {
  const lv = player.level;
  if (lv >= 80) return [1, 2, 3, 4];
  if (lv >= 50) return [1, 2, 3];
  if (lv >= 20) return [1, 2];
  return [1];
}

// 周重置（外部需 store，调用方负责持久化 via withTransaction/safeSave）
function maybeResetWeeklyBossKills(store) {
  const meta = store.getMeta();
  const cur = getCurrentWeekKey();
  if (!meta.bossWeek) {
    meta.bossWeek = cur;
    store.setMeta(meta);
    return false;
  }
  if (meta.bossWeek !== cur) {
    for (const p of store.getAllPlayers()) {
      if ((p.bossKills || 0) !== 0) p.bossKills = 0;
    }
    meta.bossWeek = cur;
    store.setMeta(meta);
    console.log(`BOSS榜周重置: ${cur}`);
    return true;
  }
  return false;
}

module.exports = {
  getTodayKey, getMonthKey, getCurrentWeekKey, getDailyKey, getWeeklyKey, getMonthlyKey,
  createDailyQuests, refreshDailyIfNeeded, updateDailyProgress,
  ensureQuestStats, checkAchievements,
  claimDaily, claimChest, claimAchievement,
  normalizeTutorialStep, updateTutorialStep,
  findAffix, getJobStage, getPassiveSlots, getAvailableAffixLevels,
  maybeResetWeeklyBossKills,
  setGrantHandlers,
};

// v1.02 本地版"按排序插入"（与 items.js 同步）
const SLOT_ORDER_DAILY = { weapon: 0, armor: 1, accessory: 2 };
function getEquipSortKeyDaily(item) {
  if (!item || !item.stats) return 0;
  let max = 0;
  for (const v of Object.values(item.stats)) {
    if (typeof v === 'number' && v > max) max = v;
  }
  return max;
}
function compareEquipDaily(a, b) {
  const sa = SLOT_ORDER_DAILY[a.slot] ?? 99;
  const sb = SLOT_ORDER_DAILY[b.slot] ?? 99;
  if (sa !== sb) return sa - sb;
  const va = getEquipSortKeyDaily(a);
  const vb = getEquipSortKeyDaily(b);
  if (va !== vb) return vb - va;
  const qOrder = { mythic: 5, legend: 4, epic: 3, fine: 2, normal: 1 };
  return (qOrder[b.quality] || 0) - (qOrder[a.quality] || 0);
}
function addEquipToSortedPositionLocal(player, item) {
  if (!item) return;
  player.equips = player.equips || [];
  let insertIdx = player.equips.length;
  for (let i = 0; i < player.equips.length; i++) {
    if (compareEquipDaily(item, player.equips[i]) < 0) {
      insertIdx = i;
      break;
    }
  }
  player.equips.splice(insertIdx, 0, item);
}
