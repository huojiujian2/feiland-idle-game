// ====== 角色视图：getPlayerView / 战力评分 / 只读规范化 ======
const { getNow } = require('./state');
const {
  AREAS, RACE_EVOLUTION, JOB_TREE, STRATEGIES, STRATEGY_CD_MS,
  DAILY_QUESTS, DAILY_CHEST, ACHIEVEMENTS,
  AFFIX_LEVELS, AFFIX_TREE, ENCHANT_RECIPES, LAWS, ASCENSION,
  expToNext,
} = require('../data');
const { getStageFull, getTotalStats, getEquipBonus, getLawBonus, getCombatStats } = require('./stats');
const { refreshDailyIfNeeded, findAffix, getJobStage, getPassiveSlots, getAvailableAffixLevels, normalizeTutorialStep } = require('./daily');
const { migratePlayer, getReadonlyPlayer } = require('./player');
let _sanitizeExpedition = null;
let _getDailyActiveView = null;
let _guildHelpers = null;
try { _sanitizeExpedition = require('./expedition').sanitizeExpedition; } catch (_) {}
try { _getDailyActiveView = require('./active').getDailyActiveView; } catch (_) {}
try { _guildHelpers = require('./guild'); } catch (_) {}

function getPowerScore(player) {
  const total = getTotalStats(player);
  return Math.floor(total.atk + total.def + total.hp + total.agi);
}

function getPlayerView(player) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  const stage = getStageFull(player.level, player.godhood);
  const area = AREAS[player.currentArea];
  const total = getTotalStats(player);
  const eqBonus = getEquipBonus(player);
  const lawBonus = getLawBonus(player);
  const raceData = RACE_EVOLUTION[player.race];
  const nextRace = raceData && raceData.nextEvolution ? RACE_EVOLUTION[raceData.nextEvolution] : null;
  const jobStage = getJobStage(player);
  const passiveSlots = getPassiveSlots(player);

  let jobInfo = null;
  if (player.jobPath) {
    const tree = JOB_TREE[player.jobPath];
    jobInfo = {
      path: tree.id, pathName: tree.name, desc: tree.desc, icon: tree.icon,
      growth: tree.growth, talents: tree.talents, mechanics: tree.mechanics,
      stages: tree.stages, currentStage: player.job,
      jobStage,
      nextStage: tree.stages.find(s => s.level > player.level)
    };
  }

  const availableAffixLevels = getAvailableAffixLevels(player);
  const affixData = {};
  for (const lv of availableAffixLevels) {
    affixData[lv] = {
      level: lv,
      config: AFFIX_LEVELS[lv],
      active: AFFIX_TREE[lv].filter(a => a.slot === 'active'),
      passive: AFFIX_TREE[lv].filter(a => a.slot === 'passive')
    };
  }

  const equippedAffixes = {
    active: player.affixes.active ? findAffix(player.affixes.active) : null,
    passive: player.affixes.passive.map(id => findAffix(id)).filter(Boolean)
  };

  const enchantsBySlot = { weapon: [], armor: [], accessory: [] };
  for (const r of ENCHANT_RECIPES) enchantsBySlot[r.slot].push(r);

  const availableLaws = LAWS.map(l => ({
    ...l, learned: player.laws.includes(l.id),
    canLearn: player.level >= l.reqLevel && !player.laws.includes(l.id),
    locked: player.level < l.reqLevel
  }));

  const ascensionInfo = {
    godhood: player.godhood,
    faith: player.faith,
    demigod: { ...ASCENSION.demigod, canAscend: player.godhood === null },
    god: { ...ASCENSION.god, canAscend: player.godhood === 'demigod' },
    currentReq: player.godhood === null ? ASCENSION.demigod : ASCENSION.god
  };

  const strategy = player.strategy || 'balanced';
  const strategyChangedAt = Number.isFinite(player.strategyChangedAt) ? player.strategyChangedAt : 0;
  const strategyCdRemaining = strategyChangedAt === 0 ? 0 : Math.max(0, STRATEGY_CD_MS - (getNow() - strategyChangedAt));
  const strategies = Object.entries(STRATEGIES).map(([id, cfg]) => ({
    id, name: cfg.name, desc: cfg.desc, reqLevel: cfg.reqLevel,
    unlocked: player.level >= cfg.reqLevel,
    active: id === strategy
  }));

  const dailyQuestsView = (player.dailyQuests || []).map(dq => {
    const tpl = DAILY_QUESTS.find(q => q.id === dq.id) || {};
    return { id: dq.id, name: tpl.name || dq.id, desc: tpl.desc || '', progress: dq.progress, target: dq.target, done: !!dq.done, claimed: !!dq.claimed, reward: tpl.reward || null };
  });
  const claimedCount = (player.dailyQuests || []).filter(q => q.claimed).length;
  const chestView = { need: DAILY_CHEST.need, claimed: !!player.dailyChestClaimed, canClaim: claimedCount >= DAILY_CHEST.need && !player.dailyChestClaimed, reward: null };
  const achievementsView = ACHIEVEMENTS.map(a => {
    const rec = (player.achievements || {})[a.id] || { unlocked: false, claimed: false };
    let title = a.title;
    if (a.id === 'ascend') {
      title = rec.grantedTitle || (player.godhood === 'god' ? '神灵' : '半神');
      if (rec.claimed && !rec.grantedTitle) title = (player.titles || {})['神灵'] ? '神灵' : '半神';
    }
    return { id: a.id, name: a.name, desc: a.desc, unlocked: !!rec.unlocked, claimed: !!rec.claimed, reward: a.reward, title };
  });
  const dailyActiveView = _getDailyActiveView ? _getDailyActiveView(player) : null;
  const questView = { dailyQuests: dailyQuestsView, chest: chestView, achievements: achievementsView, titles: player.titles || {}, currentTitle: player.currentTitle || null, dailyActive: dailyActiveView };
  // T-103 公会轻量摘要（轮询仅透出 summary，不含 members/logs/store）
  let guildSummary = null;
  try {
    if (player.guildId && _guildHelpers && _guildHelpers.toGuildSummary) {
      let meta = null;
      try { meta = require('../store').getMeta(); } catch(_) {}
      if (!meta) try { meta = require('./index')._getStoreMeta?.(); } catch(_) {}
      if (meta && meta.guilds && meta.guilds[player.guildId]) {
        const playersMap = (()=>{ try{ return require('../store').__getRawData().players; } catch(_){ return {}; } })();
        guildSummary = _guildHelpers.toGuildSummary(meta.guilds[player.guildId], playersMap);
      } else {
        guildSummary = null;
      }
    }
  } catch (_) { guildSummary = null; }

  return {
    username: player.username, name: player.name, avatar: player.avatar || '', race: player.race, raceStage: player.raceStage,
    level: player.level, exp: player.exp, expNeeded: expToNext(player.level),
    job: player.job, jobPath: player.jobPath, godhood: player.godhood, faith: player.faith,
    stage, attributes: player.attributes, attrPoints: player.attrPoints, skillPoints: player.skillPoints,
    hp: player.hp, maxHp: player.maxHp, mp: player.mp, maxMp: player.maxMp,
    gold: player.gold, killCount: player.killCount || 0, reincarnation: player.reincarnation || 0, bossKills: player.bossKills || 0, powerScore: getPowerScore(player), currentArea: player.currentArea, areaName: area ? area.name : '未知',
    reincarnHintShown: !!player.reincarnHintShown,   // v0.9：满百级一次性提醒是否已弹出
    stats: player.stats,
    inventory: player.inventory, equips: player.equips, equipped: player.equipped,
    affixes: player.affixes, equippedAffixes, affixData, passiveSlots,
    totalStats: total, equipBonus: eqBonus,
    laws: player.laws, lawBonus, availableLaws, ascensionInfo,
    raceInfo: { current: raceData, next: nextRace },
    enchantsBySlot,
    computedCombatStats: getCombatStats(player),
    // v1.03 修复：老存档缺 logs 字段 → getPlayerView 崩溃
    //   修复前：player.logs.slice(-20) → TypeError: Cannot read 'slice' of undefined
    //   修复后：fallback 到 []，migratePlayer 也已保证 logs 字段存在（line 196）
    logs: Array.isArray(player.logs) ? player.logs.slice(-20).reverse() : [], lastTick: player.lastTick,
    canChooseJob: player.level >= 11 && !player.jobPath,
    canEvolve: nextRace ? (player.level >= nextRace.reqLevel) : false,
    jobInfo,
    strategy, strategyChangedAt, strategyCdRemaining, strategies,
    titles: player.titles || {}, titleExpiry: player.titleExpiry || {}, currentTitle: player.currentTitle || null,
    questView,
    // v1.03 冷数据优化：settlementLedger 从 view 移除 —— 客户端零引用（纯服务端防重放凭据），
    //   原来每次 view 响应携带 slice(-100)（含最大 6.5MB 的 fullResult 明细），纯浪费带宽和内存
    pvpStats: player.pvpStats,
    combatStats: player.combatStats,
    attrPresets: player.attrPresets || [],
    tutorialStep: normalizeTutorialStep(player.tutorialStep), tutorialDone: normalizeTutorialStep(player.tutorialStep) === 6,
    expedition: _sanitizeExpedition ? _sanitizeExpedition(player.expedition) : (player.expedition || null),
    expeditionHistory: Array.isArray(player.expeditionHistory) ? player.expeditionHistory.slice(0,20) : [],
    expeditionReports: player.expeditionReports || {},
    expeditionCodex: player.expeditionCodex || {},
    dailyActive: _getDailyActiveView ? _getDailyActiveView(player) : null,
    guild: guildSummary
  };
}

module.exports = {
  getPlayerView,
  getPowerScore,
  getReadonlyPlayer,
};
