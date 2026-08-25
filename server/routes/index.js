// ====== 路由统一挂载 ======
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
}

module.exports = { registerRoutes };
