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
  const baseHp = 100 + (p.level - 1) * 20 + base.hp * 10 + eq.hp + (raceBonus.con || 0) * 5 + (godBonus.hp || 0) * 5 + reincBonus.baseHp;
  p.maxHp = Math.floor(baseHp * (1 + affix.hp) * godMult);
  p.maxMp = (50 + (p.level - 1) * 10 + eq.mp) * godMult;
  if (p.hp > p.maxHp) p.hp = p.maxHp;
  if (p.mp > p.maxMp) p.mp = p.maxMp;
};
player.setRecalcMaxStatsHandler(realRecalcMaxStats);
items.setRecalcMaxStatsHandler(realRecalcMaxStats);
progression.setRecalcMaxStatsHandler(realRecalcMaxStats);
worldboss.setRecalcMaxStatsHandler(realRecalcMaxStats);
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

// ====== 统一导出（与原 engine.js 保持兼容） ======
module.exports = {
  // 测试 seam
  getNow: state.getNow,
  __setNow: state.__setNow,
  __setRandom: state.__setRandom,
  __setDropRandom: state.__setDropRandom,
  __resetSeams: state.__resetSeams,

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
  deleteAttrPreset: player.deleteAttrPreset,
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
  getReincarnationInfo: progression.getReincarnationInfo,
  getReincShop: progression.getReincShop,
  buyReincShopItem: progression.buyReincShopItem,

  // 战斗/挂机
  calcDamage: combat.calcDamage,
  getActionCount: combat.getActionCount,
  simulateBattle: combat.simulateBattle,
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
  maybeResetSeason: pvp.maybeResetSeason,
  applySeasonResetToPlayers: pvp.applySeasonResetToPlayers,
  buyArenaItem: pvp.buyArenaItem,

  // 世界 BOSS
  spawnWorldBoss: worldboss.spawnWorldBoss,
  getActiveBoss: worldboss.getActiveBoss,
  attackWorldBoss: worldboss.attackWorldBoss,
  grantWorldBossParticipation: worldboss.grantWorldBossParticipation,
  settleWorldBossRewards: worldboss.settleWorldBossRewards,
  getBossRanking: worldboss.getBossRanking,

  // 授予（player 模块，外部偶尔需要）
  grantGold: player.grantGold,
  grantExpWithLevelUp: player.grantExpWithLevelUp,
};
