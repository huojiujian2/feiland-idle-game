// ====== Engine 统一入口：组装各子模块，注入循环引用，导出全部 API ======
// 用法：const e = require('./engine') 保持完全兼容原 require('./engine')

const utils = require('./utils');
const state = require('./state');
const daily = require('./daily');
const player = require('./player');
const stats = require('./stats');
const combat = require('./combat');
const pvp = require('./pvp');
const items = require('./items');
const progression = require('./progression');
const worldboss = require('./worldboss');
const idle = require('./idle');
const view = require('./view');
const genesis = require('./genesis');
const cockfight = require('./cockfight');
const settlement = require('./settlement');
const expedition = require('./expedition');
const active = require('./active');
const guild = require('./guild');

// ====== 绑定循环引用 ======
// recalcMaxStats：与原 engine.js 行为一致（基于词条加成的 baseHp）
const realRecalcMaxStats = (p) => {
  const eq = stats.getEquipBonus(p);
  const affix = stats.getAffixBonus(p);
  const raceBonus = stats.getRaceBonus(p);
  const godBonus = stats.getGodhoodBonus(p);
  const reincBonus = stats.getReincarnationBonus(p);
  const base = p.attributes;
  const godMult = p.godhood === 'demigod' ? 2 : (p.godhood === 'god' ? 3 : 1);
  const baseHp = 100 + (p.level - 1) * 20 + base.hp * 10 + eq.hp + (raceBonus.con || 0) * 5 + (raceBonus.hp || 0) + (godBonus.hp || 0) * 5 + reincBonus.baseHp;
  p.maxHp = Math.floor(baseHp * (1 + affix.hp) * godMult);
  p.maxMp = (50 + (p.level - 1) * 10 + eq.mp) * godMult;
  if (p.hp > p.maxHp) p.hp = p.maxHp;
  if (p.mp > p.maxMp) p.mp = p.maxMp;
};
player.setRecalcMaxStatsHandler(realRecalcMaxStats);
items.setRecalcMaxStatsHandler(realRecalcMaxStats);
progression.setRecalcMaxStatsHandler(realRecalcMaxStats);
// 世界 BOSS 不再需要 recalcMaxStats 接口（已移除旧 setRecalcMaxStatsHandler 调用）
idle.setRecalcMaxStatsHandler(realRecalcMaxStats);

// player 模块依赖 daily 的 updateDailyProgress
player.setUpdateDailyProgress((player, questId, inc) => daily.updateDailyProgress(player, questId, inc));

// daily 模块的 grantGold/grantExpWithLevelUp 由 player 模块提供
daily.setGrantHandlers({
  grantGold: (p, amount) => player.grantGold(p, amount),
  grantExpWithLevelUp: (p, exp) => player.grantExpWithLevelUp(p, exp),
});

// idle 模块的 grantGold 由 player 模块提供
idle.setGrantGoldHandler((p, amount) => player.grantGold(p, amount));

// pvp 的 createBot 需要 player.createCharacter + recalcMaxStats
pvp.setBotCharacterDeps({
  createCharacter: player.createCharacter,
  recalcMaxStats: realRecalcMaxStats,
});

// 远征注入
expedition.setGrantHandlers({ grantGold: (p, a) => player.grantGold(p, a), grantExpWithLevelUp: (p, e) => player.grantExpWithLevelUp(p, e) });
expedition.setProgressHandlers({ updateDailyProgress: (p, id, inc) => daily.updateDailyProgress(p, id, inc), checkAchievements: (p) => daily.checkAchievements(p) });

// 每日活跃注入
active.setGrantHandlers({ grantGold: (p, a) => player.grantGold(p, a), grantExpWithLevelUp: (p, e) => player.grantExpWithLevelUp(p, e) });

// 创世系统：把 store.getMeta 注入到 idle/genesis 两个引擎
let _store = null;
function setStore(store) {
  _store = store;
  if (!store || !store.getMeta) return;
  const getter = () => store.getMeta();
  idle.setMetaGetter(getter);
  genesis.setMetaGetter(getter);
  // 启动期把已存档的自创装备同步注册回装备模板表
  genesis.rehydrateFromMeta(store.getMeta());
}
function _getStoreMeta(){ try{ return _store ? _store.getMeta() : null; } catch(_){ return null; } }
function _getRawData(){ try{ if(_store && _store.__getRawData) return _store.__getRawData(); const s=require('../store'); return s.__getRawData(); } catch(_){ return { players:{}, meta:{} }; } }
function withTransaction(fn) {
  if (_store && typeof _store.withTransaction === 'function') return _store.withTransaction(fn);
  const s = require('../store');
  return s.withTransaction(fn);
}
function safeSave() {
  if (_store && typeof _store.safeSave === 'function') return _store.safeSave();
  const s = require('../store');
  return s.safeSave();
}
function getLastSaveError() {
  if (_store && typeof _store.getLastSaveError === 'function') return _store.getLastSaveError();
  try { const s = require('../store'); return s.getLastSaveError(); } catch(_) { return null; }
}
function cancelSaveTimer() {
  if (_store && typeof _store.cancelSaveTimer === 'function') return _store.cancelSaveTimer();
  try { const s = require('../store'); return s.cancelSaveTimer(); } catch(_) {}
}
function snapshot() {
  if (_store && typeof _store.snapshot === 'function') return _store.snapshot();
  try { const s = require('../store'); return s.snapshot(); } catch(_) { return JSON.stringify({}); }
}
function restore(snap) {
  if (_store && typeof _store.restore === 'function') return _store.restore(snap);
  try { const s = require('../store'); return s.restore(snap); } catch(_) {}
}

// ====== 统一导出（与原 engine.js 保持兼容） ======
module.exports = {
  // v1.03 冷数据归档（日志裁剪 + fullResult 明细剥离）
  runColdDataSweep: require('./cold-archive').runColdDataSweep,

  // 测试 seam
  getNow: state.getNow,
  __setNow: state.__setNow,
  __setRandom: state.__setRandom,
  __setDropRandom: state.__setDropRandom,
  __resetSeams: state.__resetSeams,

  // 存档事务（store 代理，setStore 注入后走 _store，否则直连 store 模块）
  withTransaction,
  safeSave,
  getLastSaveError,
  cancelSaveTimer,
  snapshot,
  restore,

  // 结算校验
  assertSettlementReward: settlement.assertSettlementReward,

  // 工具
  shouldDrop: utils.shouldDrop,
  buildBattleMonster: utils.buildBattleMonster,
  getActiveSkillCd: utils.getActiveSkillCd,
  shouldTriggerActiveSkill: utils.shouldTriggerActiveSkill,
  genUid: utils.genUid,

  // 角色
  createCharacter: player.createCharacter,
  migratePlayer: player.migratePlayer,
  getReadonlyPlayer: view.getReadonlyPlayer,
  allocateAttributes: player.allocateAttributes,
  autoAllocateAttributes: player.autoAllocateAttributes,
  saveAttrPreset: player.saveAttrPreset,
  applyAttrPreset: player.applyAttrPreset,
  applyAttrPresetByRatio: player.applyAttrPresetByRatio,
  deleteAttrPreset: player.deleteAttrPreset,
  deleteAttrPresetBySlot: player.deleteAttrPresetBySlot,
  recalcMaxStats: realRecalcMaxStats,
  chooseJob: progression.chooseJob,

  // 装备/词条/商店/附魔
  equipAffix: items.equipAffix,
  unequipAffix: items.unequipAffix,
  equipItem: items.equipItem,
  unequipItem: items.unequipItem,
  useConsumable: items.useConsumable,
  buyItem: items.buyItem,
  sellMaterial: items.sellMaterial,
  sellEquip: items.sellEquip,
  sellEquipsByLevel: items.sellEquipsByLevel,
  // v1.02：背包排序持久化
  sortInventory: items.sortInventory,
  addEquipToSortedPosition: items.addEquipToSortedPosition,
  getEquipSortKey: items.getEquipSortKey,
  enchantItem: items.enchantItem,
  upgradeEquipment: items.upgradeEquipment,
  mergeEquipment: items.mergeEquipment,
  reforgeEquipment: items.reforgeEquipment,

  // 词条/职业/任务/引导
  findAffix: daily.findAffix,
  getJobStage: daily.getJobStage,
  getPassiveSlots: daily.getPassiveSlots,
  getAvailableAffixLevels: daily.getAvailableAffixLevels,
  normalizeTutorialStep: daily.normalizeTutorialStep,
  updateTutorialStep: daily.updateTutorialStep,
  claimDaily: daily.claimDaily,
  claimChest: daily.claimChest,
  claimAchievement: daily.claimAchievement,
  refreshDailyIfNeeded: daily.refreshDailyIfNeeded,
  updateDailyProgress: daily.updateDailyProgress,
  createDailyQuests: daily.createDailyQuests,
  getTodayKey: daily.getTodayKey,
  getMonthKey: daily.getMonthKey,
  getDailyKey: daily.getDailyKey,
  getWeeklyKey: daily.getWeeklyKey,
  getMonthlyKey: daily.getMonthlyKey,
  getCurrentWeekKey: daily.getCurrentWeekKey,
  ensureQuestStats: daily.ensureQuestStats,
  checkAchievements: daily.checkAchievements,
  maybeResetWeeklyBossKills: daily.maybeResetWeeklyBossKills,

  // 进化/法则/登神/转生
  evolveRace: items.evolveRace,
  learnLaw: items.learnLaw,
  attemptAscension: progression.attemptAscension,
  doReincarnate: progression.doReincarnate,
  autoReincarnate: progression.autoReincarnate, // 内测：一键转生
  getReincarnationInfo: progression.getReincarnationInfo,
  getReincShop: progression.getReincShop,
  buyReincShopItem: progression.buyReincShopItem,

  // 战斗/挂机
  calcDamage: combat.calcDamage,
  getActionCount: combat.getActionCount,
  simulateBattle: combat.simulateBattle,
  simulateBossBattle: combat.simulateBossBattle,
  calculateIdle: idle.calculateIdle,

  // 属性
  getStageFull: stats.getStageFull,
  getRaceBonus: stats.getRaceBonus,
  getReincarnationBonus: stats.getReincarnationBonus,
  getLawBonus: stats.getLawBonus,
  getGodhoodBonus: stats.getGodhoodBonus,
  getEquipBonus: stats.getEquipBonus,
  getJobGrowth: stats.getJobGrowth,
  getJobTalents: stats.getJobTalents,
  getJobMechanics: stats.getJobMechanics,
  getAffixBonus: stats.getAffixBonus,
  getTotalStats: stats.getTotalStats,
  getCombatStats: stats.getCombatStats,
  pickMonsterSkill: stats.pickMonsterSkill,
  getPowerScore: view.getPowerScore,

  // 视图
  getPlayerView: view.getPlayerView,
  getMapView: view.getMapView,

  // 离线收益
  getOfflineSummary: progression.getOfflineSummary,
  updateOfflineSnapshot: progression.updateOfflineSnapshot,

  // PvP 竞技场
  calcPvpRating: pvp.calcPvpRating,
  calcPvpRewards: pvp.calcPvpRewards,
  pickPvPSkill: pvp.pickPvPSkill,
  simulatePvP: pvp.simulatePvP,
  getSeasonKey: pvp.getSeasonKey,
  getSeasonIndex: pvp.getSeasonIndex,
  getSeasonDaysLeft: pvp.getSeasonDaysLeft,
  getRankTier: pvp.getRankTier,
  createBot: pvp.createBot,
  generateArenaBots: pvp.generateArenaBots,
  settleArenaRewards: pvp.settleArenaRewards,
  settleDuePeriods: pvp.settleDuePeriods,
  maybeResetSeason: pvp.maybeResetSeason,
  applySeasonResetToPlayers: pvp.applySeasonResetToPlayers,
  buyArenaItem: pvp.buyArenaItem,

  // 世界 BOSS
  spawnWorldBoss: worldboss.spawnWorldBoss,
  getActiveBoss: worldboss.getActiveBoss,
  getBossExpiresAt: worldboss.getBossExpiresAt,
  attackWorldBoss: worldboss.attackWorldBoss,
  grantWorldBossParticipation: worldboss.grantWorldBossParticipation,
  settleWorldBossRewards: worldboss.settleWorldBossRewards,
  getBossRanking: worldboss.getBossRanking,
  getBossDayKey: worldboss.getBossDayKey,
  getTodayMidnight: worldboss.getTodayMidnight,
  // v3.0：保留 getStrongestPlayer 兼容旧调用方（实际已不再使用）
  getStrongestPlayer: worldboss.getStrongestPlayer,
  // v3.0：暴露新函数供测试 / 调试
  getTopHalfByLevel: worldboss.getTopHalfByLevel,
  getMedianPlayerByLevel: worldboss.getMedianPlayerByLevel,
  estimateTopHalfTotalDamage: worldboss.estimateTopHalfTotalDamage,
  buildBossStats: worldboss.buildBossStats,
  BOSS_BATTLE_ROUNDS: worldboss.BOSS_BATTLE_ROUNDS,

  // 授予（player 模块，外部偶尔需要）
  grantGold: player.grantGold,
  grantExpWithLevelUp: player.grantExpWithLevelUp,

  // 创世系统（二转解锁）
  isGenesisUnlocked: genesis.isUnlocked,
  listGenesis: genesis.listByPlayer,
  birthMonster: genesis.birthMonster,
  forgeEquip: genesis.forgeEquip,
  deleteGenesis: genesis.deleteCustom,
  rehydrateGenesis: genesis.rehydrateFromMeta,
  // v1.03 P1 1.9：每日世界最强装备衰减（按 dayKey 跳过；内部判定）
  maybeDecayGenesisEquips: function maybeDecayGenesisEquips(store) {
    const meta = store.getMeta();
    const today = state.getDayKey ? state.getDayKey() : (function () {
      const d = new Date();
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
    })();
    if (meta.lastDecayDayKey === today) return; // 今日已跑
    const genesisMod = require('./genesis');
    const dataMod = require('../data');
    const w = (meta.genesis && meta.genesis.equipsMax) || {};
    for (const areaId of Object.keys(w)) {
      for (const slot of Object.keys(w[areaId])) {
        // 取参考预算作为 floor（用 epic 品质基准）
        const baseBudget = (() => {
          try { return dataMod.getEquipBudget(areaId, slot, 'epic', w); } catch (_) { return null; }
        })();
        genesisMod.decayEquipsMax(meta.genesis, areaId, slot, baseBudget);
      }
    }
    meta.lastDecayDayKey = today;
    store.setMeta(meta);
  },

  // 灵鸡斗场（完全独立玩法）
  getCockfightStatus: cockfight.getCockfightStatus,
  enterCockArena: cockfight.enterCockArena,
  resolveCockRound: cockfight.resolveCockRound,
  exchangeCockfightTitle: cockfight.exchangeCockfightTitle,
  // 斗鸡纯函数（测试用）
  __simulateLineup: cockfight.__simulateLineup,
  __battleOnce: cockfight.__battleOnce,
  // 远征
  dispatchExpedition: expedition.dispatchExpedition,
  chooseExpeditionEvent: expedition.chooseEventOption,
  claimExpedition: expedition.claimExpedition,
  getExpeditionStatus: expedition.getExpeditionStatus,
  sanitizeExpedition: expedition.sanitizeExpedition,
  simulateExpeditionBossBattle: expedition.simulateExpeditionBossBattle,
  // 每日活跃
  getDailyActiveView: active.getDailyActiveView,
  addActivePoints: active.addActivePoints,
  claimDailyActive: active.claimActive,
  refreshDailyActive: active.refreshIfNeeded,
  // 公会
  createGuild: guild.createGuild,
  listGuilds: guild.listGuilds,
  getMyGuild: guild.getMyGuild,
  joinGuild: guild.joinGuild,
  leaveGuild: guild.leaveGuild,
  kickGuildMember: guild.kickMember,
  kickMember: guild.kickMember,
  updateGuildRole: guild.updateRole,
  updateRole: guild.updateRole,
  transferGuild: guild.transferGuild,
  updateGuildAnnouncement: guild.updateAnnouncement,
  updateAnnouncement: guild.updateAnnouncement,
  donateGuild: guild.donate,
  donate: guild.donate,
  disbandGuild: guild.disbandGuild,
  addGuildContribution: guild.addGuildContribution,
  ensureGuildConsistency: guild.ensureGuildConsistency,
  toGuildSummary: guild.toGuildSummary,
  toGuildDetail: guild.toGuildDetail,
  toGuildViewer: guild.toViewer,
  setStore,
  _getStoreMeta,
  _getRawData,
};