// ====== 任务/委托/引导路由 ======
const { claimDaily, claimChest, claimAchievement, updateTutorialStep, getPlayerView } = require('../engine');
const { ok, fail, loadPlayer, savePlayer } = require('./_helpers');

function registerQuestRoutes(app, store) {
  app.post('/api/player/:username/quest/daily/:id/claim', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = claimDaily(r.player, req.params.id);
    if (!result.success) return res.status(result.status).json({ success: false, message: result.message });
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });

  app.post('/api/player/:username/quest/chest/claim', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = claimChest(r.player);
    if (!result.success) return res.status(result.status).json({ success: false, message: result.message });
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });

  app.post('/api/player/:username/quest/achievement/:id/claim', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = claimAchievement(r.player, req.params.id);
    if (!result.success) return res.status(result.status).json({ success: false, message: result.message });
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });

  app.post('/api/player/:username/tutorial', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return res.status(404).json({ success: false, message: r.error });
    const step = req.body && req.body.step;
    const result = updateTutorialStep(r.player, step);
    if (!result.success) return res.status(result.status).json({ success: false, message: result.message });
    savePlayer(store, r.player);
    res.json({ success: true, data: result.data });
  });
}

module.exports = { registerQuestRoutes };
