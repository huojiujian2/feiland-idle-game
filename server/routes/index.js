// ====== 路由统一挂载 ======
const { registerAuthRoutes } = require('./auth');
const { registerPlayerRoutes } = require('./player');
const { registerCombatRoutes } = require('./combat');
const { registerProgressionRoutes } = require('./progression');
const { registerCodexRoutes } = require('./codex');
const { registerLeaderboardRoutes } = require('./leaderboard');
const { registerPvpRoutes } = require('./pvp');
const { registerWorldBossRoutes } = require('./worldboss');
const { registerStrategyRoute } = require('./strategy');
const { registerQuestRoutes } = require('./quest');

function registerRoutes(app, store) {
  registerAuthRoutes(app, store);
  registerPlayerRoutes(app, store);
  registerCombatRoutes(app, store);
  registerProgressionRoutes(app, store);
  registerCodexRoutes(app, store);
  registerLeaderboardRoutes(app, store);
  registerPvpRoutes(app, store);
  registerWorldBossRoutes(app, store);
  registerStrategyRoute(app, store);
  registerQuestRoutes(app, store);
}

module.exports = { registerRoutes };
