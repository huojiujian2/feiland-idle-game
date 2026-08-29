// ====== 战斗策略路由（带 A/B 副作用校验） ======
const {
  migratePlayer, calculateIdle, getPlayerView, getNow,
  maybeResetWeeklyBossKills,
} = require('../engine');
const { STRATEGIES, STRATEGY_CD_MS } = require('../data');
const { fail } = require('./_helpers');

function registerStrategyRoute(app, store) {
  app.post('/api/player/:username/strategy', (req, res) => {
    const player = store.getPlayer(req.params.username);
    if (!player) return fail(res, '角色不存在', 404);
    const { strategy } = req.body || {};

    // A — 无副作用校验
    if (typeof strategy !== 'string' || !Object.hasOwn(STRATEGIES, strategy)) {
      return fail(res, '策略不存在', 400);
    }
    const effStrategy = (typeof player.strategy === 'string' && Object.hasOwn(STRATEGIES, player.strategy)) ? player.strategy : 'balanced';
    const effChangedAt = Number.isFinite(player.strategyChangedAt) ? player.strategyChangedAt : 0;
    if (strategy === effStrategy) {
      const beforeS = player.strategy, beforeC = player.strategyChangedAt;
      migratePlayer(player);
      const migrated = (beforeS !== player.strategy) || (beforeC !== player.strategyChangedAt);
      if (migrated) { store.setPlayer(player.username, player); store.safeSave(); }
      return res.json({ success: true, data: getPlayerView(player) });
    }
    if (effChangedAt !== 0 && getNow() - effChangedAt < STRATEGY_CD_MS) {
      const remain = Math.ceil((STRATEGY_CD_MS - (getNow() - effChangedAt)) / 1000);
      return fail(res, `策略切换冷却中，剩余${remain}s`, 409);
    }
    migratePlayer(player);

    // B — 旧策略结算
    maybeResetWeeklyBossKills(store);
    const result = calculateIdle(player);
    // C — 等级复核
    if (player.level < STRATEGIES[strategy].reqLevel) {
      store.setPlayer(player.username, player);
      if (result === null) {
        player.lastTick = getNow();
        store.setPlayer(player.username, player);
      }
      store.safeSave();
      return res.json({ success: false, message: `需要 Lv.${STRATEGIES[strategy].reqLevel} 才能使用该策略`, data: getPlayerView(player) });
    }

    // C2 — 写入新策略
    const old = player.strategy;
    player.strategy = strategy;
    player.strategyChangedAt = getNow();
    if (result === null) player.lastTick = getNow();
    player.logs.push({
      time: getNow(),
      type: 'strategy',
      from: old, to: strategy, strategy,
      text: `策略切换：${STRATEGIES[old].name}→${STRATEGIES[strategy].name}`,
    });
    if (player.logs.length > 30) player.logs = player.logs.slice(-30);
    store.setPlayer(player.username, player);
    store.safeSave();
    res.json({ success: true, data: getPlayerView(player) });
  });
}

module.exports = { registerStrategyRoute };
