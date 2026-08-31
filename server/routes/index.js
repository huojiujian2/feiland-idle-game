// ====== 路由统一挂载 · v1.03 JWT 鉴权 ======
// 中间件注入策略：
//   1. /api/register、/api/login、/api/account-exists → 公开
//   2. /api/player/:u/*  → requireAuth + requirePlayerSelf（70+ 路由）
//   3. /api/arena/challenge + /api/arena/buy → requireAuth + requireSelfFromBody
//   4. /api/arena/settle + /api/worldboss/spawn → requireAdmin（已有 X-Admin-Token）
//   5. 其余（/api/areas, /api/codex, /api/players/names, /api/arena/ranking 等）→ 公开
//
// AUTH_MODE=off 时中间件全部放行（开发模式 / 灰度切换）

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
const { registerGuildRoutes } = require('./guild');
const { registerDiagRoutes } = require('./diag');  // v1.03：内存/健康监控
const { requireAuth, requirePlayerSelf, requireSelfFromBody, requireAdmin } = require('../middleware/auth');

function registerRoutes(app, store) {
  // 1. 公开路由（先注册，避免被后续的鉴权中间件挡住）
  registerAuthRoutes(app, store);        // /api/register, /api/login, /api/player/:u/create-character, /api/players/names
  registerAccountExistsRoute(app, store); // /api/account-exists
  registerDiagRoutes(app, store);         // /api/diag/health, /api/diag/memory（公开，便于 docker healthcheck）

  // 2. 公共数据路由（公开 GET）
  registerCodexRoutes(app, store);       // /api/areas, /api/codex, /api/data/*
  registerLeaderboardRoutes(app, store); // /api/leaderboard

  // 3. PvP 路由：内部混合公开与受保护接口
  //    /api/arena/opponents/:username（公开只读）、/api/arena/ranking、/api/arena/records/:u、/api/arena/shop、/api/arena/season、/api/arena/rewards/* —— 公开
  //    /api/arena/challenge、/api/arena/buy —— 受保护（self from body）
  //    /api/arena/settle —— 受保护（admin token）
  registerPvpRoutes(app, store, { auth: { requireAuth, requireSelfFromBody, requireAdmin } });

  // 4. 世界 BOSS：/api/worldboss/active（公开）、/api/worldboss/spawn（admin）
  registerWorldBossRoutes(app, store, { auth: { requireAdmin } });

  // 5. 受保护路由组 —— /api/player/:username/*
  //    registerXxxRoutes 内部不再重复应用中间件，统一在这里加
  //    注意：strategy、cockfight、expedition、active、guild、genesis 等都走这里
  app.use('/api/player/:username', requireAuth, requirePlayerSelf);
  registerPlayerRoutes(app, store);
  registerCombatRoutes(app, store);
  registerProgressionRoutes(app, store);
  registerStrategyRoute(app, store);
  registerQuestRoutes(app, store);
  registerGenesisRoutes(app, store);
  registerTitleRoutes(app, store);
  registerCockfightRoutes(app, store);
  registerExpeditionRoutes(app, store);
  registerActiveRoutes(app, store);
  registerGuildRoutes(app, store);
}

module.exports = { registerRoutes };