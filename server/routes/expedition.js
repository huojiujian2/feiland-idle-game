// ====== 远征路由 ======
const {
  dispatchExpedition, chooseExpeditionEvent, claimExpedition, getExpeditionStatus, sanitizeExpedition,
} = require('../engine');
const { EXPEDITION_AREAS, EXPEDITION_DURATIONS, EXPEDITION_EVENTS } = require('../data/expedition');
const { ok, fail } = require('./_helpers');

function registerExpeditionRoutes(app, store) {
  // 公开配置
  app.get('/api/expedition/config', (req, res) => {
    return ok(res, { areas: EXPEDITION_AREAS, durations: EXPEDITION_DURATIONS, events: EXPEDITION_EVENTS });
  });

  // 玩家远征状态
  app.get('/api/player/:username/expedition', (req, res) => {
    const username = req.params.username;
    if (!username) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    // 事务内推导 status 是否需保存（若 choose 改了 endAt 已在事务内保存，此处仅读）
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const st = getExpeditionStatus(player);
      // 若已就绪但仍 ongoing，状态推导为 ready 不强制写盘（GET 不改 endAt，claim 时才补算默认a）
      return { status: 200, data: { expedition: sanitizeExpedition(player.expedition) || null, history: player.expeditionHistory || [], codex: player.expeditionCodex || {}, reports: player.expeditionReports || {}, remainingMs: st.remainingMs, status: st.status } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });

  // 派遣
  app.post('/api/player/:username/expedition/dispatch', (req, res) => {
    const username = req.params.username;
    const { areaId, durationKey } = req.body || {};
    if (!username) return fail(res, '缺少参数', 400);
    if (!areaId || !durationKey) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = dispatchExpedition(player, areaId, durationKey);
      if (!r.success) return { status: r.code || 400, message: r.message };
      return { status: 200, data: { expedition: sanitizeExpedition(r.expedition) } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });

  // 事件选择
  app.post('/api/player/:username/expedition/event/choose', (req, res) => {
    const username = req.params.username;
    const { eventId, choiceId } = req.body || {};
    if (!username) return fail(res, '缺少参数', 400);
    if (!eventId || !choiceId) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = chooseExpeditionEvent(player, eventId, choiceId);
      if (!r.success) return { status: r.code || 400, message: r.message };
      return { status: 200, data: { expedition: sanitizeExpedition(r.expedition) } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });

  // 结算（必填 expeditionId）
  app.post('/api/player/:username/expedition/claim', (req, res) => {
    const username = req.params.username;
    const { expeditionId } = req.body || {};
    if (!username) return fail(res, '缺少参数', 400);
    if (!expeditionId) return fail(res, '缺少 expeditionId', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = claimExpedition(player, expeditionId);
      if (!r.success) return { status: r.code || 400, message: r.message, already: r.already };
      if (r.already) return { status: 200, data: { already: true, report: r.report, settlementId: r.settlementId } };
      return { status: 200, data: { report: r.report, settlementId: r.settlementId } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    if (result.data && result.data.already) return ok(res, { report: result.data.report }, { already: true });
    return ok(res, result.data);
  });
}

module.exports = { registerExpeditionRoutes };
