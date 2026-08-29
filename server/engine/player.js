// ====== 角色：创建 / 数据迁移 / 加点 / 力量等阶 ======
const { getNow } = require('./state');
const { STRATEGIES, JOB_TREE, expToNext } = require('../data');
const {
  getTodayKey, getMonthKey, createDailyQuests, ensureQuestStats, checkAchievements,
  refreshDailyIfNeeded, normalizeTutorialStep,
} = require('./daily');
const { isValidTitleKey } = require('../data/titles');

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
    avatar: '', // v1.02：自定义头像 emoji（空 = 用 player.name 首字）
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
    titles: {},
    titleExpiry: {},
    currentTitle: null,
    reincPoints: 0,
    tutorialStep: 0,
    combatStats: { totalWins: 0, totalLosses: 0, totalDraws: 0, todayKills: 0, monthKills: 0, todayResetAt: getTodayKey(), monthResetAt: getMonthKey() },
    pvpStats: { wins: 0, losses: 0, rating: 1000, streak: 0, bestStreak: 0, lastPvpAt: 0 },
    attrPresets: [],
    settlementLedger: [],
    // 远征（T-102）：单活单 + 历史/报告/图鉴
    expedition: null,
    expeditionHistory: [],
    expeditionReports: {},
    expeditionCodex: {},
    // 灵鸡斗场（完全独立玩法，不与主游戏资源交互）
    cockfight: { points: 0, wins: 0, streak: 0, played: 0, loseStreak: 0, dayKey: '', usedToday: 0, banNext: null, current: null, history: [] },
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
  // v7：转生点商店购买次数（每个商品独立计数，用于动态价格）
  if (!player.reincShopCounts || typeof player.reincShopCounts !== 'object') player.reincShopCounts = {};
  if (player.bossKills === undefined) player.bossKills = 0;
  // v0.9：满百级转生一次性提醒的标记
  if (player.reincarnHintShown === undefined) player.reincarnHintShown = false;
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
  // v1.03：称号统一为对象结构（key → true）
  //   老存档是数组：已知称号 key 原样迁移；中文名成就称号（如"神灵"）以名字为 key 保留
  //   （数组上的字符串键属性 JSON.stringify 会丢弃，导致购买的永久称号不固化）
  if (Array.isArray(player.titles)) {
    const migrated = {};
    for (const t of player.titles) {
      if (typeof t === 'string' && t) migrated[t] = true;
    }
    player.titles = migrated;
  } else if (!player.titles || typeof player.titles !== 'object') {
    player.titles = {};
  }
  if (!player.titleExpiry || typeof player.titleExpiry !== 'object' || Array.isArray(player.titleExpiry)) {
    player.titleExpiry = {};
  }
  for (const k of Object.keys(player.titles)) {
    if (!isValidTitleKey(k)) delete player.titles[k];
  }
  for (const k of Object.keys(player.titleExpiry)) {
    const v = player.titleExpiry[k];
    if (!isValidTitleKey(k) || !Number.isFinite(v) || v <= 0) delete player.titleExpiry[k];
  }
  if (player.currentTitle !== null && typeof player.currentTitle !== 'string') player.currentTitle = null;
  if (player.currentTitle !== null) {
    if (!isValidTitleKey(player.currentTitle)) player.currentTitle = null;
    else {
      const exp = player.titleExpiry[player.currentTitle];
      if (Number.isFinite(exp) && exp <= getNow()) player.currentTitle = null;
    }
  }
  if (!Array.isArray(player.settlementLedger)) player.settlementLedger = [];
  else if (player.settlementLedger.length > 100) player.settlementLedger.splice(0, player.settlementLedger.length - 100);
  if (!Number.isFinite(player.reincPoints)) player.reincPoints = 0;
  if (!Number.isFinite(player.tutorialStep)) player.tutorialStep = 0;
  player.tutorialStep = normalizeTutorialStep(player.tutorialStep);
  if (!Array.isArray(player.attrPresets)) player.attrPresets = [];
  // v1.02：自定义头像字段迁移（缺失 → 留空走首字 fallback）
  if (typeof player.avatar !== 'string') player.avatar = '';
  // 灵鸡斗场状态迁移（老存档补字段）
  if (!player.cockfight || typeof player.cockfight !== 'object') {
    player.cockfight = { points: 0, wins: 0, streak: 0, played: 0, loseStreak: 0, dayKey: '', usedToday: 0, banNext: null, current: null, history: [] };
  }
  if (!Array.isArray(player.cockfight.history)) player.cockfight.history = [];
  // 过滤掉 null 项（旧版本可能 push null 占位，避免下面逻辑踩到）
  player.attrPresets = player.attrPresets.filter(Boolean);
  if (!player.pvpStats || typeof player.pvpStats !== 'object') player.pvpStats = {};
  if (!Number.isFinite(player.pvpStats.wins)) player.pvpStats.wins = 0;
  if (!Number.isFinite(player.pvpStats.losses)) player.pvpStats.losses = 0;
  if (!Number.isFinite(player.pvpStats.rating)) player.pvpStats.rating = 1000;
  if (!Number.isFinite(player.pvpStats.streak)) player.pvpStats.streak = 0;
  if (!Number.isFinite(player.pvpStats.bestStreak)) player.pvpStats.bestStreak = 0;
  if (!Number.isFinite(player.pvpStats.lastPvpAt)) player.pvpStats.lastPvpAt = 0;
  // T-102 远征字段迁移
  if (!('expedition' in player) || (player.expedition !== null && typeof player.expedition !== 'object')) player.expedition = null;
  if (player.expedition) {
    if (!Number.isFinite(player.expedition.startAt)) player.expedition = null;
    else if (!player.expedition.snapshot || typeof player.expedition.snapshot !== 'object' || !Number.isFinite(player.expedition.snapshot.atk) || !Number.isFinite(player.expedition.snapshot.maxHp)) {
      // 坏档缺 snapshot 时 claim 必 TypeError→500，又被单队并发 409 卡死新派遣 = 软锁
      player.expedition = null;
    } else {
      if (!Number.isFinite(player.expedition.baseEndAt)) player.expedition.baseEndAt = player.expedition.startAt + 30*60*1000;
      if (!Number.isFinite(player.expedition.endAt)) player.expedition.endAt = player.expedition.baseEndAt;
      if (!Number.isFinite(player.expedition.appliedTimeDelta)) player.expedition.appliedTimeDelta = 0;
      if (!Number.isFinite(player.expedition.baseGoldLossRate)) player.expedition.baseGoldLossRate = 0;
      if (!Number.isFinite(player.expedition.baseGoldLossRoll)) player.expedition.baseGoldLossRoll = 0;
      if (!['ongoing','ready'].includes(player.expedition.status)) player.expedition.status = 'ongoing';
      if (!Array.isArray(player.expedition.events)) player.expedition.events = [];
      for (const ev of player.expedition.events) {
        if (typeof ev.choiceChangeCount !== 'number') ev.choiceChangeCount = 0;
        if (ev.chosenId !== null && typeof ev.chosenId !== 'string') ev.chosenId = null;
        if (!Array.isArray(ev.choices)) ev.choices = [];
        for (const ch of ev.choices) {
          if (typeof ch.timeDelta !== 'number') ch.timeDelta = 0;
          if (!ch.outcome || typeof ch.outcome !== 'object') ch.outcome = { success: true, goldDelta: 0, message: '' };
          if (typeof ch.outcome.goldDelta !== 'number') ch.outcome.goldDelta = 0;
        }
      }
      if (!player.expedition.boss || typeof player.expedition.boss !== 'object') player.expedition.boss = null;
    }
  }
  if (!Array.isArray(player.expeditionHistory)) player.expeditionHistory = [];
  else if (player.expeditionHistory.length > 20) player.expeditionHistory.splice(0, player.expeditionHistory.length - 20);
  if (!player.expeditionReports || typeof player.expeditionReports !== 'object' || Array.isArray(player.expeditionReports)) player.expeditionReports = {};
  else {
    const keys = Object.keys(player.expeditionReports);
    if (keys.length > 20) {
      keys.sort((a,b)=> (player.expeditionReports[a].claimedAt||0) - (player.expeditionReports[b].claimedAt||0));
      for (let i=0;i<keys.length-20;i++) delete player.expeditionReports[keys[i]];
    }
  }
  if (!player.expeditionCodex || typeof player.expeditionCodex !== 'object' || Array.isArray(player.expeditionCodex)) player.expeditionCodex = {};
  for (const _aid of ['verdant_border','ancient_ruins','abyss_rift','dragon_nest']) {
    if (!player.expeditionCodex[_aid] || typeof player.expeditionCodex[_aid] !== 'object') player.expeditionCodex[_aid] = { dispatched: 0, claimed: 0, lastAt: 0, bossKills: 0 };
    else {
      if (!Number.isFinite(player.expeditionCodex[_aid].dispatched)) player.expeditionCodex[_aid].dispatched = 0;
      if (!Number.isFinite(player.expeditionCodex[_aid].claimed)) player.expeditionCodex[_aid].claimed = 0;
      if (!Number.isFinite(player.expeditionCodex[_aid].lastAt)) player.expeditionCodex[_aid].lastAt = 0;
      if (!Number.isFinite(player.expeditionCodex[_aid].bossKills)) player.expeditionCodex[_aid].bossKills = 0;
    }
  }
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
const MAX_ATTR_PRESETS = 3;
function saveAttrPreset(player, name, slot = null, attributes = null, delta = null) {
  player = migratePlayer(player);
  if (!name || !name.trim()) return { success: false, message: '请输入预设名称' };
  name = name.trim().slice(0, 24);
  // 三种使用方式：
  // 1. 老 API：saveAttrPreset(player, name) — push 到末尾
  // 2. 新 API：saveAttrPreset(player, name, slot, attributes, delta) — 精确写入 slot 槽位
  //    attributes 必填（用于"保存加点"时直接快照当前 attributes）
  //    delta 可选（同时把 delta 加到 player.attributes 上，等于立刻加点）
  if (slot !== null && slot !== undefined) {
    if (typeof slot !== 'number' || slot < 0 || slot >= MAX_ATTR_PRESETS) {
      return { success: false, message: '方案槽位无效' };
    }
    // 立刻把 delta 加到 player.attributes 上（如果有）
    if (delta && typeof delta === 'object') {
      player.attributes.atk = Math.max(0, (player.attributes.atk || 0) + (Number(delta.atk) || 0));
      player.attributes.def = Math.max(0, (player.attributes.def || 0) + (Number(delta.def) || 0));
      player.attributes.hp = Math.max(0, (player.attributes.hp || 0) + (Number(delta.hp) || 0));
      player.attributes.agi = Math.max(0, (player.attributes.agi || 0) + (Number(delta.agi) || 0));
      // 减掉对应的 attrPoints
      const used = (Number(delta.atk) || 0) + (Number(delta.def) || 0) + (Number(delta.hp) || 0) + (Number(delta.agi) || 0);
      if (player.attrPoints && player.attrPoints > 0) {
        player.attrPoints = Math.max(0, player.attrPoints - used);
      }
    }
    const attrs = attributes || { ...player.attributes };
    const preset = {
      id: 'preset_' + getNow() + '_' + Math.random().toString(36).substr(2, 6),
      name,
      attributes: { ...attrs },
      level: player.level,
      slot, // 记录槽位（可读性，前端主要用 index，但后端审计有用）
      createdAt: getNow()
    };
    // 精确写入 slot 槽位（如果数组不够长，先补 null）
    while (player.attrPresets.length <= slot) player.attrPresets.push(null);
    player.attrPresets[slot] = preset;
    return { success: true, preset };
  }
  // 老路径：push
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

  // 读取预设的 4 维比例
  const ra = Math.max(0, Number(preset.attributes.atk) || 0);
  const rd = Math.max(0, Number(preset.attributes.def) || 0);
  const rh = Math.max(0, Number(preset.attributes.hp)  || 0);
  const rg = Math.max(0, Number(preset.attributes.agi) || 0);
  const rsum = ra + rd + rh + rg;
  if (rsum <= 0) return { success: false, message: '预设数据无效' };
  const r = { atk: ra, def: rd, hp: rh, agi: rg };

  // 当前属性
  const cur = {
    atk: player.attributes.atk || 0,
    def: player.attributes.def || 0,
    hp:  player.attributes.hp  || 0,
    agi: player.attributes.agi || 0,
  };

  let points = player.attrPoints;
  const alloc = { atk: 0, def: 0, hp: 0, agi: 0 };
  const keys = ['atk', 'def', 'hp', 'agi'];

  // 两阶段：先按比例补齐到对齐值，剩余按比例分配（余数给比例最大的维度）
  let safety = 0;
  while (points > 0 && safety < 10) {
    safety++;

    // 阶段 A：补齐
    // k = max(cur[i] / r[i])，对 r[i] > 0 的维度
    // 目标值 = k * r[i]；缺口 = 目标值 - cur[i]（r[i] = 0 的维度跳过）
    let k = 0;
    for (const key of keys) {
      if (r[key] > 0) {
        const curRatio = cur[key] / r[key];
        if (curRatio > k) k = curRatio;
      }
    }
    const gap = {
      atk: r.atk > 0 ? Math.max(0, Math.round(k * r.atk - cur.atk)) : 0,
      def: r.def > 0 ? Math.max(0, Math.round(k * r.def - cur.def)) : 0,
      hp:  r.hp  > 0 ? Math.max(0, Math.round(k * r.hp  - cur.hp))  : 0,
      agi: r.agi > 0 ? Math.max(0, Math.round(k * r.agi - cur.agi)) : 0,
    };
    const gapTotal = gap.atk + gap.def + gap.hp + gap.agi;

    if (gapTotal > 0 && gapTotal <= points) {
      // 一次补齐：所有维度缺口加起来 ≤ 剩余点数 → 全部补完
      for (const key of keys) {
        cur[key] += gap[key];
        alloc[key] += gap[key];
      }
      points -= gapTotal;
      continue;
    }

    // 补不齐：把余点全给缺口最大的维度
    if (points > 0 && gapTotal > points) {
      let maxGapKey = null;
      let maxGap = 0;
      for (const key of keys) {
        if (gap[key] > maxGap) { maxGap = gap[key]; maxGapKey = key; }
      }
      if (maxGapKey && gap[maxGapKey] > 0) {
        const give = Math.min(gap[maxGapKey], points);
        cur[maxGapKey] += give;
        alloc[maxGapKey] += give;
        points -= give;
        continue;
      }
    }

    // 阶段 B：按比例分配剩余点（余数全给比例最大的维度）
    if (points > 0) {
      const m = { atk: 0, def: 0, hp: 0, agi: 0 };
      for (const key of keys) m[key] = Math.floor(points * (r[key] / rsum));
      let rem = points - m.atk - m.def - m.hp - m.agi;
      // 余数全给"预设里权重最大"的维度（按 r 降序，r 相同时按 keys 顺序）
      const order = [...keys].sort((a, b) => r[b] - r[a] || keys.indexOf(a) - keys.indexOf(b));
      const topKey = order[0];
      m[topKey] += rem;
      rem = 0;
      for (const key of keys) {
        cur[key] += m[key];
        alloc[key] += m[key];
      }
      points = 0;
      break;
    }
  }

  // 整数兜底
  for (const key of keys) alloc[key] = Math.round(alloc[key]);

  player.attributes.atk += alloc.atk;
  player.attributes.def += alloc.def;
  player.attributes.hp  += alloc.hp;
  player.attributes.agi += alloc.agi;
  player.attrPoints = 0;
  recalcMaxStats(player);
  updateDailyProgressSafe(player, 'alloc1', 1);
  checkAchievements(player);
  return { success: true, allocated: alloc };
}
// v0.9：按比例加点（"先补齐再分配"算法）
// 需求：5:1:1:1 + 当前属性 40:5:10:8 + 80 点
//   → 先按比例补齐到 50:10:10:10（用 17 点），剩 63
//   → 再按比例分配 42:7:7:7
//   → 最终 92:17:17:17
//
// 实现：迭代两阶段直到 attrPoints 耗尽
//   阶段 A（补齐）：找"按比例最落后的维度"，把该维度补到"其他维度的比例对齐值"，
//                  预算不足时只补能补的部分（按比例切分剩余）。
//   阶段 B（分配）：剩余点全部按比例分配。
function applyAttrPresetByRatio(player, ratio) {
  player = migratePlayer(player);
  if (!player.attrPoints || player.attrPoints <= 0) {
    return { success: false, message: '没有可分配的属性点' };
  }
  const ra = Math.max(0, Number(ratio.atk) || 0);
  const rd = Math.max(0, Number(ratio.def) || 0);
  const rh = Math.max(0, Number(ratio.hp) || 0);
  const rg = Math.max(0, Number(ratio.agi) || 0);
  const rsum = ra + rd + rh + rg;
  if (rsum <= 0) return { success: false, message: '比例数值无效' };

  const cur = {
    atk: player.attributes.atk || 0,
    def: player.attributes.def || 0,
    hp:  player.attributes.hp  || 0,
    agi: player.attributes.agi || 0,
  };
  const r = { atk: ra, def: rd, hp: rh, agi: rg };

  let points = player.attrPoints;
  const alloc = { atk: 0, def: 0, hp: 0, agi: 0 };

  // 主循环：交替"补齐"和"分配"，直到 points 耗尽或两阶段都加不动
  let safety = 0;
  while (points > 0 && safety < 10) {
    safety++;

    // 阶段 A：补齐
    // 找"按比例对齐后还差多少"最少的维度，作为基准缩放系数
    // k = max(cur[i] / r[i])，对所有 r[i] > 0 的维度
    let k = 0;
    for (const key of ['atk', 'def', 'hp', 'agi']) {
      if (r[key] > 0) {
        const curRatio = cur[key] / r[key];
        if (curRatio > k) k = curRatio;
      }
    }
    // 目标值 = k * r[i]；缺口 = 目标值 - cur[i]
    // v2.4：k 是浮点数（cur/r），乘 r 再减 cur 仍可能带小数（如 r=0 维度被其它维度推高 k）
    //   用 Math.round 兜底，保证 gap 是整数
    const gap = {
      atk: r.atk > 0 ? Math.max(0, Math.round(k * r.atk - cur.atk)) : 0,
      def: r.def > 0 ? Math.max(0, Math.round(k * r.def - cur.def)) : 0,
      hp:  r.hp  > 0 ? Math.max(0, Math.round(k * r.hp  - cur.hp))  : 0,
      agi: r.agi > 0 ? Math.max(0, Math.round(k * r.agi - cur.agi)) : 0,
    };
    const gapTotal = gap.atk + gap.def + gap.hp + gap.agi;

    if (gapTotal > 0 && gapTotal <= points) {
      // 一次补齐：所有维度缺口加起来 ≤ 剩余点数 → 全部补完
      for (const key of ['atk', 'def', 'hp', 'agi']) {
        cur[key] += gap[key];
        alloc[key] += gap[key];
      }
      points -= gapTotal;
      continue;  // 重新进入循环，继续补下一档（你的例子用 17 点补到 50:10:10:10）
    }

    // 补不齐（如测试 4：atk 缺口 90 但只有 10 点）
    //   优先把点数全给最落后的维度（让"补齐缺口"尽量接近一步到位）
    if (points > 0 && gapTotal > points) {
      // 找缺口最大的维度
      let maxGapKey = null;
      let maxGap = 0;
      for (const key of ['atk', 'def', 'hp', 'agi']) {
        if (gap[key] > maxGap) { maxGap = gap[key]; maxGapKey = key; }
      }
      if (maxGapKey && gap[maxGapKey] > 0) {
        // 全部补给最落后的维度
        const give = Math.min(gap[maxGapKey], points);
        cur[maxGapKey] += give;
        alloc[maxGapKey] += give;
        points -= give;
        continue;
      }
    }

    // 真正的"按比例分配"阶段（你的 70→63 阶段）
    //   v0.9.1：余数优先补给"比例最大的维度"（基数最大的优先拿余数）
    if (points > 0) {
      const m = { atk: 0, def: 0, hp: 0, agi: 0 };
      const keys = ['atk', 'def', 'hp', 'agi'];
      // 按比例向下取整分配
      for (const key of keys) m[key] = Math.floor(points * (r[key] / rsum));
      // 余数 = 总数 - 已分配
      let rem = points - m.atk - m.def - m.hp - m.agi;
      // 余数全给"比例最大"的维度（按比例数从大到小排序，依次拿余数）
      // 这样余数会按"权重"集中在比例最大的维度上
      const order = [...keys].sort((a, b) => r[b] - r[a] || keys.indexOf(a) - keys.indexOf(b));
      let i = 0;
      while (rem > 0) {
        m[order[i % order.length]] += 1;
        rem -= 1;
        i += 1;
      }
      for (const key of keys) {
        cur[key] += m[key];
        alloc[key] += m[key];
      }
      points = 0;
      break;
    }
  }

  // v2.4 兜底：保证 alloc 全部是整数（防御极端浮点残留）
  for (const key of ['atk', 'def', 'hp', 'agi']) {
    alloc[key] = Math.round(alloc[key]);
  }

  player.attributes.atk += alloc.atk;
  player.attributes.def += alloc.def;
  player.attributes.hp  += alloc.hp;
  player.attributes.agi += alloc.agi;
  player.attrPoints = 0;
  recalcMaxStats(player);
  updateDailyProgressSafe(player, 'alloc1', 1);
  checkAchievements(player);
  return { success: true, allocated: alloc };
}
function deleteAttrPreset(player, presetId) {
  player = migratePlayer(player);
  const idx = player.attrPresets.findIndex(p => p.id === presetId);
  if (idx < 0) return { success: false, message: '预设不存在' };
  player.attrPresets.splice(idx, 1);
  return { success: true };
}
// v0.8+：按 slot 索引删除（前端 3 槽位方案明确用 0/1/2，不用拿 id）
function deleteAttrPresetBySlot(player, slot) {
  player = migratePlayer(player);
  if (typeof slot !== 'number' || slot < 0 || slot >= MAX_ATTR_PRESETS) {
    return { success: false, message: '方案槽位无效' };
  }
  // 先清掉数组里可能出现的 null 占位（迁移时过滤）
  const cleanList = (player.attrPresets || []).filter(Boolean);
  // 找到"按 slot 索引"对应的真实位置（null 被过滤了，要按顺序映射）
  const target = cleanList[slot];
  if (!target) return { success: false, message: '方案槽位为空' };
  const idx = player.attrPresets.findIndex(p => p && p.id === target.id);
  if (idx < 0) return { success: false, message: '方案不存在' };
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
  applyAttrPresetByRatio,
  deleteAttrPreset,
  deleteAttrPresetBySlot,
  getReadonlyPlayer,
  setRecalcMaxStatsHandler,
  setUpdateDailyProgress,
  MAX_ATTR_PRESETS,
};
