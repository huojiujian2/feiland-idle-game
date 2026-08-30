// ====== 路由统一挂载 =====
const { registerAuthRoutes } = require('./auth');
const { registerAccountExistsRoute } = require('./account-exists');
const { registerPlayerRoutes } = require('./player');
const { registerCombatRoutes } = require('./combat');
const { registerProgressionRoutes } = require('./progression');
const { registerCodexRoutes } = require('./codex');
const { registerLeaderboardRoutes } = require('./leaderboard');
const { registerPvpRoutes } = require('./pvp');
const { registerWorldBossRoutes } = require('./worldboss');
const { registerStrategyRoute } = require('./strategy');
const { registerQuestRoutes } = require('./quest');
const { registerGenesisRoutes } = require('./genesis');
const { registerTitleRoutes } = require('./titles');
const { registerCockfightRoutes } = require('./cockfight');
const { registerExpeditionRoutes } = require('./expedition');
const { registerActiveRoutes } = require('./active');

function registerRoutes(app, store) {
  registerAuthRoutes(app, store);
  registerAccountExistsRoute(app, store); // 必须在 /api 通配 404 之前注册
  registerPlayerRoutes(app, store);
  registerCombatRoutes(app, store);
  registerProgressionRoutes(app, store);
  registerCodexRoutes(app, store);
  registerLeaderboardRoutes(app, store);
  registerPvpRoutes(app, store);
  registerWorldBossRoutes(app, store);
  registerStrategyRoute(app, store);
  registerQuestRoutes(app, store);
  registerGenesisRoutes(app, store);
  registerTitleRoutes(app, store);
  registerCockfightRoutes(app, store);
  registerExpeditionRoutes(app, store);
  registerActiveRoutes(app, store);
}

module.exports = { registerRoutes };