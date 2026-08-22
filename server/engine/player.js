// ====== 角色：创建 / 数据迁移 / 加点 / 力量等阶 ======
const { getNow } = require('./state');
const { STRATEGIES, JOB_TREE, expToNext } = require('../data');
const {
  getTodayKey, getMonthKey, createDailyQuests, ensureQuestStats, checkAchievements,
  refreshDailyIfNeeded, normalizeTutorialStep,
} = require('./daily');

// 力量等阶（含神格）
function getStageFull(level, godhood) {
  if (godhood === 'god') return '神';
  if (godhood === 'demigod') return '半神';
  if (level >= 200) return '传说';
  if (level >= 150) return '史诗';
  if (level >= 100) return '稀有';
  if (level >= 60) return '精英';
  if (level >= 30) return '普通+';
  return '普通';
}

// 创建新角色
function createCharacter(username, charName) {
  const now = getNow();
  const p = {
    username,
    name: charName || username,
    race: '鹰人',
    raceStage: 0,
    level: 1,
    exp: 0,
    job: '无',
    jobPath: null,
    godhood: null,
    faith: 0,
    attributes: { atk: 5, def: 4, hp: 5, agi: 8 },
    attrPoints: 0,
    skillPoints: 0,
    affixes: { active: null, passive: [] },
    hp: 100, maxHp: 100,
    mp: 50, maxMp: 50,
    gold: 0,
    killCount: 0,
    reincarnation: 0,
    bossKills: 0,
    stats: { maxClearedArea: 'gaomanshan' },
    currentArea: 'gaomanshan',
    lastActiveAt: now,
    inventory: [],
    equips: [],
    equipped: { weapon: null, armor: null, accessory: null },
    laws: [],
    logs: [],
    lastTick: now,
    createdAt: now,
    strategy: 'balanced',
    strategyChangedAt: 0,
    dailyQuests: createDailyQuests(),
    dailyResetAt: getTodayKey(),
    dailyChestClaimed: false,
    achievements: {},
    questStats: { totalGoldEarned: 0, affixSeen: [], seenEquipTemplates: [] },
    titles: [],
    currentTitle: null,
    reincPoints: 0,
    tutorialStep: 0,
    combatStats: { totalWins: 0, totalLosses: 0, totalDraws: 0, todayKills: 0, monthKills: 0, todayResetAt: getTodayKey(), monthResetAt: getMonthKey() },
    pvpStats: { wins: 0, losses: 0, rating: 1000, streak: 0, bestStreak: 0, lastPvpAt: 0 },
    attrPresets: [],
  };
  p.achievements['first'] = { unlocked: true, claimed: false, unlockAt: now };
  return p;
}

// 数据迁移（原地修改）
function migratePlayer(player) {
  if (!player.equips) player.equips = [];
  if (!player.equipped) player.equipped = { weapon: null, armor: null, accessory: null };
  if (player.skillPoints === undefined) player.skillPoints = 0;
  if (player.jobPath === undefined) player.jobPath = null;
  if (player.raceStage === undefined) player.raceStage = 0;
  if (player.godhood === undefined) player.godhood = null;
  if (player.faith === undefined) player.faith = 0;
  if (!player.laws) player.laws = [];
  if (!player.inventory) player.inventory = [];
  if (player.killCount === undefined) player.killCount = 0;
  if (!player.combatStats) player.combatStats = { totalWins: 0, totalLosses: 0, totalDraws: 0, todayKills: 0, monthKills: 0, todayResetAt: getTodayKey(), monthResetAt: getMonthKey() };
  if (!Number.isFinite(player.combatStats.totalWins)) player.combatStats.totalWins = 0;
  if (!Number.isFinite(player.combatStats.totalLosses)) player.combatStats.totalLosses = 0;
  if (!Number.isFinite(player.combatStats.totalDraws)) player.combatStats.totalDraws = 0;
  if (!Number.isFinite(player.combatStats.todayKills)) player.combatStats.todayKills = 0;
  if (!Number.isFinite(player.combatStats.monthKills)) player.combatStats.monthKills = 0;
  if (player.combatStats.todayResetAt !== getTodayKey()) {
    player.combatStats.todayKills = 0;
    player.combatStats.todayResetAt = getTodayKey();
  }
  if (player.combatStats.monthResetAt !== getMonthKey()) {
    player.combatStats.monthKills = 0;
    player.combatStats.monthResetAt = getMonthKey();
  }
  if (player.reincarnation === undefined) player.reincarnation = 0;
  if (player.bossKills === undefined) player.bossKills = 0;
  if (!player.stats || typeof player.stats !== 'object') player.stats = {};
  if (!player.stats.maxClearedArea) player.stats.maxClearedArea = 'gaomanshan';
  if (!Number.isFinite(player.lastActiveAt)) player.lastActiveAt = player.lastTick || getNow();
  if (typeof player.strategy !== 'string' || !Object.hasOwn(STRATEGIES, player.strategy)) player.strategy = 'balanced';
  if (!Number.isFinite(player.strategyChangedAt)) player.strategyChangedAt = 0;

  if (player.attributes && player.attributes.strength !== undefined && player.attributes.atk === undefined) {
    const old = player.attributes;
    player.attributes = {
      atk: (old.strength || 5),
      def: (old.constitution || 4),
      hp: (old.constitution || 4),
      agi: (old.agility || 8)
    };
  }
  if (!player.attributes) player.attributes = { atk: 5, def: 4, hp: 5, agi: 8 };

  if (!player.affixes) {
    player.affixes = { active: null, passive: [] };
    if (player.skills && player.skills.length > 0) player.skills = [];
  }

  if (player.inventory.length > 0) {
    player.inventory = player.inventory.filter(i => i.type !== 'equip');
  }
  const addEnchantField = (item) => { if (item && !item.enchants) item.enchants = []; };
  player.equips.forEach(addEnchantField);
  Object.values(player.equipped).forEach(addEnchantField);

  if (!Array.isArray(player.dailyQuests)) player.dailyQuests = createDailyQuests();
  if (typeof player.dailyResetAt !== 'string') player.dailyResetAt = getTodayKey();
  if (typeof player.dailyChestClaimed !== 'boolean') player.dailyChestClaimed = false;
  if (!player.achievements || typeof player.achievements !== 'object') player.achievements = {};
  if (!player.questStats) player.questStats = { totalGoldEarned: 0, affixSeen: [], seenEquipTemplates: [] };
  if (!Array.isArray(player.questStats.affixSeen)) player.questStats.affixSeen = [];
  if (!Array.isArray(player.questStats.seenEquipTemplates)) player.questStats.seenEquipTemplates = [];
  if (!Number.isFinite(player.questStats.totalGoldEarned)) player.questStats.totalGoldEarned = 0;
  if (!Array.isArray(player.titles)) player.titles = [];
  if (player.currentTitle !== null && typeof player.currentTitle !== 'string') player.currentTitle = null;
  if (!Number.isFinite(player.reincPoints)) player.reincPoints = 0;
  if (!Number.isFinite(player.tutorialStep)) player.tutorialStep = 0;
  player.tutorialStep = normalizeTutorialStep(player.tutorialStep);
  if (!Array.isArray(player.attrPresets)) player.attrPresets = [];
  if (!player.pvpStats || typeof player.pvpStats !== 'object') player.pvpStats = {};
  if (!Number.isFinite(player.pvpStats.wins)) player.pvpStats.wins = 0;
  if (!Number.isFinite(player.pvpStats.losses)) player.pvpStats.losses = 0;
  if (!Number.isFinite(player.pvpStats.rating)) player.pvpStats.rating = 1000;
  if (!Number.isFinite(player.pvpStats.streak)) player.pvpStats.streak = 0;
  if (!Number.isFinite(player.pvpStats.bestStreak)) player.pvpStats.bestStreak = 0;
  if (!Number.isFinite(player.pvpStats.lastPvpAt)) player.pvpStats.lastPvpAt = 0;
  if (!player.achievements['first']) {
    player.achievements['first'] = { unlocked: true, claimed: false, unlockAt: player.createdAt || getNow() };
  }
  refreshDailyIfNeeded(player);
  checkAchievements(player);
  return player;
}

// 加点（grantGold/grantExpWithLevelUp 注入到 daily 模块）
function grantGold(player, amount) {
  if (!amount) return;
  player.gold += amount;
  ensureQuestStats(player);
  player.questStats.totalGoldEarned += amount;
  checkAchievements(player);
}
function grantExpWithLevelUp(player, exp) {
  if (!exp) return;
  player.exp += exp;
  const now = getNow();
  while (player.exp >= expToNext(player.level)) {
    player.exp -= expToNext(player.level);
    player.level++;
    player.attrPoints += 3;
    player.skillPoints += 1;
    player.maxHp += 20;
    player.maxMp += 10;
    player.hp = player.maxHp;
    player.mp = player.maxMp;
    if (player.jobPath) {
      const tree = JOB_TREE[player.jobPath];
      for (const stage of tree.stages) {
        if (stage.level === player.level) {
          player.job = stage.name;
          player.logs.push({ time: now, type: 'job', text: `${stage.desc}，职业进阶为：${stage.name}！被动词条槽位+1` });
        }
      }
    }
  }
  if (exp > 0) player.logs.push({ time: now, type: 'levelup', level: player.level, text: `获得 ${exp} 经验` });
  checkAchievements(player);
}

// 分配属性点
function allocateAttributes(player, allocation) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  const total = (allocation.atk || 0) + (allocation.def || 0) + (allocation.hp || 0) + (allocation.agi || 0);
  if (total > player.attrPoints) return { success: false, message: '属性点不足' };
  if (total < 1) return { success: false, message: '请至少分配1点' };
  player.attributes.atk += allocation.atk || 0;
  player.attributes.def += allocation.def || 0;
  player.attributes.hp += allocation.hp || 0;
  player.attributes.agi += allocation.agi || 0;
  player.attrPoints -= total;
  recalcMaxStats(player);
  updateDailyProgressSafe(player, 'alloc1', 1);
  checkAchievements(player);
  return { success: true };
}

// 一键自动加点
function autoAllocateAttributes(player) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  if (!player.attrPoints || player.attrPoints <= 0) {
    return { success: false, message: '没有可分配的属性点' };
  }

  let weights;
  if (player.jobPath && JOB_TREE[player.jobPath]) {
    const growth = JOB_TREE[player.jobPath].growth || {};
    weights = {
      atk: Math.max(0.1, growth.atk || 1),
      def: Math.max(0.1, growth.def || 1),
      hp: Math.max(0.1, growth.hp || 1),
      agi: Math.max(0.1, growth.agi || 1)
    };
  } else {
    weights = { atk: 1.2, def: 1.0, hp: 1.0, agi: 1.1 };
  }

  const total = weights.atk + weights.def + weights.hp + weights.agi;
  const points = player.attrPoints;

  let atk = Math.floor(points * weights.atk / total);
  let def = Math.floor(points * weights.def / total);
  let hp = Math.floor(points * weights.hp / total);
  let agi = points - atk - def - hp;

  const sum = atk + def + hp + agi;
  if (sum !== points) {
    const maxKey = Object.keys(weights).reduce((a, b) => weights[a] >= weights[b] ? a : b);
    if (maxKey === 'atk') atk += (points - sum);
    else if (maxKey === 'def') def += (points - sum);
    else if (maxKey === 'hp') hp += (points - sum);
    else agi += (points - sum);
  }

  player.attributes.atk += atk;
  player.attributes.def += def;
  player.attributes.hp += hp;
  player.attributes.agi += agi;
  player.attrPoints = 0;
  recalcMaxStats(player);
  updateDailyProgressSafe(player, 'alloc1', 1);
  checkAchievements(player);

  return {
    success: true,
    allocated: { atk, def, hp, agi },
    job: player.jobPath || null
  };
}

// 属性预设
const MAX_ATTR_PRESETS = 5;
function saveAttrPreset(player, name) {
  player = migratePlayer(player);
  if (!name || !name.trim()) return { success: false, message: '请输入预设名称' };
  name = name.trim().slice(0, 12);
  if (player.attrPresets.length >= MAX_ATTR_PRESETS) {
    return { success: false, message: `最多保存 ${MAX_ATTR_PRESETS} 个预设` };
  }
  const preset = {
    id: 'preset_' + getNow() + '_' + Math.random().toString(36).substr(2, 6),
    name,
    attributes: { ...player.attributes },
    level: player.level,
    createdAt: getNow()
  };
  player.attrPresets.push(preset);
  return { success: true, preset };
}
function applyAttrPreset(player, presetId) {
  player = migratePlayer(player);
  const preset = player.attrPresets.find(p => p.id === presetId);
  if (!preset) return { success: false, message: '预设不存在' };
  if (!player.attrPoints || player.attrPoints <= 0) {
    return { success: false, message: '没有可分配的属性点' };
  }
  const totalAttr = preset.attributes.atk + preset.attributes.def + preset.attributes.hp + preset.attributes.agi;
  if (totalAttr <= 0) return { success: false, message: '预设数据无效' };
  const points = player.attrPoints;
  const ratio = {
    atk: preset.attributes.atk / totalAttr,
    def: preset.attributes.def / totalAttr,
    hp: preset.attributes.hp / totalAttr,
    agi: preset.attributes.agi / totalAttr
  };
  let atk = Math.floor(points * ratio.atk);
  let def = Math.floor(points * ratio.def);
  let hp = Math.floor(points * ratio.hp);
  let agi = points - atk - def - hp;
  player.attributes.atk += atk;
  player.attributes.def += def;
  player.attributes.hp += hp;
  player.attributes.agi += agi;
  player.attrPoints = 0;
  recalcMaxStats(player);
  updateDailyProgressSafe(player, 'alloc1', 1);
  checkAchievements(player);
  return { success: true, allocated: { atk, def, hp, agi } };
}
function deleteAttrPreset(player, presetId) {
  player = migratePlayer(player);
  const idx = player.attrPresets.findIndex(p => p.id === presetId);
  if (idx < 0) return { success: false, message: '预设不存在' };
  player.attrPresets.splice(idx, 1);
  return { success: true };
}

// recalcMaxStats：依赖 stats 模块
let _recalcMaxStats = (p) => {};
function setRecalcMaxStatsHandler(fn) {
  if (typeof fn === 'function') _recalcMaxStats = fn;
}
function recalcMaxStats(player) { return _recalcMaxStats(player); }

// updateDailyProgressSafe：避免循环依赖
let _updateDailyProgress = () => {};
function setUpdateDailyProgress(fn) {
  if (typeof fn === 'function') _updateDailyProgress = fn;
}
function updateDailyProgressSafe(player, questId, inc) { return _updateDailyProgress(player, questId, inc); }

function getReadonlyPlayer(player) { return migratePlayer(player); }

module.exports = {
  getStageFull,
  createCharacter,
  migratePlayer,
  grantGold,
  grantExpWithLevelUp,
  allocateAttributes,
  autoAllocateAttributes,
  saveAttrPreset,
  applyAttrPreset,
  deleteAttrPreset,
  getReadonlyPlayer,
  setRecalcMaxStatsHandler,
  setUpdateDailyProgress,
  MAX_ATTR_PRESETS,
};
