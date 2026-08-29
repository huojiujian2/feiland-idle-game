// ====== 任务/委托/引导路由 ======
const { claimDaily, claimChest, claimAchievement, updateTutorialStep, getPlayerView } = require('../engine');
const { ok, fail } = require('./_helpers');

function registerQuestRoutes(app, store) {
  app.post('/api/player/:username/quest/daily/:id/claim', (req, res) => {
    const username = req.params.username;
    const id = req.params.id;
    if (!username) return fail(res, '缺少参数', 400);
    if (!id) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const out = claimDaily(player, id);
      if (!out.success) return { status: out.status || 400, message: out.message };
      if (out.already) return { status: 200, data: getPlayerView(player), already: true };
      return { status: 200, data: getPlayerView(player) };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    if (result.already) return res.json({ success: true, data: result.data, already: true });
    return ok(res, result.data);
  });

  app.post('/api/player/:username/quest/chest/claim', (req, res) => {
    const username = req.params.username;
    if (!username) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const out = claimChest(player);
      if (!out.success) return { status: out.status || 400, message: out.message };
      if (out.already) return { status: 200, data: getPlayerView(player), already: true };
      return { status: 200, data: getPlayerView(player) };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    if (result.already) return res.json({ success: true, data: result.data, already: true });
    return ok(res, result.data);
  });

  app.post('/api/player/:username/quest/achievement/:id/claim', (req, res) => {
    const username = req.params.username;
    const id = req.params.id;
    if (!username) return fail(res, '缺少参数', 400);
    if (!id) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const out = claimAchievement(player, id);
      if (!out.success) return { status: out.status || 400, message: out.message };
      if (out.already) return { status: 200, data: getPlayerView(player), already: true };
      return { status: 200, data: getPlayerView(player) };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    if (result.already) return res.json({ success: true, data: result.data, already: true });
    return ok(res, result.data);
  });

  app.post('/api/player/:username/tutorial', (req, res) => {
    const username = req.params.username;
    if (!username) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return res.status(404).json({ success: false, message: '角色不存在' });
    const step = req.body && req.body.step;
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const out = updateTutorialStep(player, step);
      if (!out.success) return { status: out.status || 400, message: out.message };
      return { status: 200, data: out.data };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return res.json({ success: true, data: result.data });
  });
}

module.exports = { registerQuestRoutes };
