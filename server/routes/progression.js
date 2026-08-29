// ====== 进阶系统路由：职业 / 种族进化 / 附魔 / 法则 / 登神 / 转生 / 转生点商店 ======
const {
  chooseJob, evolveRace, enchantItem, learnLaw,
  attemptAscension, doReincarnate, autoReincarnate, getReincarnationInfo,
  getReincShop, buyReincShopItem,
  getPlayerView,
} = require('../engine');
const { JOB_TREE, RACE_EVOLUTION } = require('../data');
const { ok, fail, loadPlayer, savePlayer } = require('./_helpers');

function registerProgressionRoutes(app, store) {
  // 职业
  app.post('/api/player/:username/job', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = chooseJob(r.player, req.body.jobPath);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });
  app.get('/api/data/jobs', (req, res) => res.json({ success: true, data: JOB_TREE }));

  // 种族进化
  app.post('/api/player/:username/evolve', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = evolveRace(r.player);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });
  app.get('/api/data/races', (req, res) => res.json({ success: true, data: RACE_EVOLUTION }));

  // 附魔
  app.post('/api/player/:username/enchant', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = enchantItem(r.player, req.body.itemUid, req.body.recipeId);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });

  // 法则
  app.post('/api/player/:username/learn-law', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = learnLaw(r.player, req.body.lawId);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });

  // 登神
  app.post('/api/player/:username/ascend', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = attemptAscension(r.player);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });

  // 转生
  app.post('/api/player/:username/reincarnate', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = doReincarnate(r.player);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    res.json({ success: true, data: getPlayerView(r.player), earnedPoints: result.earnedPoints, reincarnation: result.reincarnation });
  });

  // 内测：一键转生（金币按高级经验卷轴购买力速升等级后连续转生，后续随经验卷轴一起删除）
  app.post('/api/player/:username/auto-reincarnate', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const { times, targetLevel } = req.body || {};
    const result = autoReincarnate(r.player, times, targetLevel);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    res.json({
      success: true,
      data: getPlayerView(r.player),
      completed: result.completed,
      message: result.message,
    });
  });

  // v0.9：标记"满百级转生提醒"已弹出（避免每次启动都弹）
  app.post('/api/player/:username/reincarn-hint-shown', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    r.player.reincarnHintShown = true;
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });
  app.get('/api/player/:username/reincarnation', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    res.json({ success: true, data: getReincarnationInfo(r.player) });
  });

  // 转生点商店
  // v7：getReincShop 需要 player 才能返回动态价格（已买次数 + 1）
  app.get('/api/reinc-shop', (req, res) => {
    const username = req.query.username;
    if (username) {
      const r = loadPlayer(store, username);
      if (r.error) return fail(res, r.error);
      return res.json({ success: true, data: getReincShop(r.player) });
    }
    res.json({ success: true, data: getReincShop() });
  });
  app.post('/api/reinc-shop/buy', (req, res) => {
    const { username, itemId, option } = req.body;
    const r = loadPlayer(store, username);
    if (r.error) return fail(res, r.error);
    const result = buyReincShopItem(r.player, itemId, option);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    res.json({
      success: true,
      data: getPlayerView(r.player),
      message: result.message,
      reincPoints: result.reincPoints,
      cost: result.cost,                  // v7：返回本次实际扣的点数
      boughtCount: result.boughtCount,    // v7：返回买完后的次数
    });
  });
}

module.exports = { registerProgressionRoutes };
