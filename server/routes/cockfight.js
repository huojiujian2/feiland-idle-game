// ====== 灵鸡斗场路由（完全独立玩法） ======
// GET  /api/player/:username/cockfight                          → 状态视图（积分/胜场/连胜/参与进度/商店/记录）
// POST /api/player/:username/cockfight/enter                     → 进入斗场，生成 6 只灵鸡
// POST /api/player/:username/cockfight/resolve { bet, intervention, createdAt } → 押注+干预+擂台赛+结算
// POST /api/player/:username/cockfight/exchange { titleKey }     → 积分兑换称号
const { ok, fail } = require('./_helpers');
const engine = require('../engine');
const { getNow } = require('../engine/state');

function registerCockfightRoutes(app, store) {
  // 状态视图 — 事务化（跨日重置）
  app.get('/api/player/:username/cockfight', (req, res) => {
    const username = req.params.username;
    if (!username) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const status = engine.getCockfightStatus(player);
      return { status: 200, data: status };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message || '保存失败请重试' });
    return ok(res, result.data);
  });

  // 进入斗场
  app.post('/api/player/:username/cockfight/enter', (req, res) => {
    const username = req.params.username;
    if (!username) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const out = engine.enterCockArena(player);
      if (!out.success) {
        const msg = out.message || '失败';
        let status = 400;
        if (msg.includes('已用完') || msg.includes('次数')) status = 409;
        return { status, message: msg };
      }
      return { status: 200, data: out };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });

  // 结算一局（押注 + 干预 + 擂台赛 + 积分）— createdAt 由服务端生成（v1.03 P1 1.6）
//   客户端不再传 createdAt（防止脚本"先知"伪造时间戳影响过期判定）
//   保留兼容：若客户端仍传 createdAt，服务端忽略并警告
  app.post('/api/player/:username/cockfight/resolve', (req, res) => {
    const username = req.params.username;
    if (!username) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const { bet, intervention, createdAt: clientCreatedAt } = req.body || {};
    if (bet === undefined || bet === null) return fail(res, '缺少参数', 400);
    // v1.03：createdAt 服务端生成（防伪造）
    const createdNum = getNow();
    if (clientCreatedAt !== undefined && clientCreatedAt !== null && process.env.NODE_ENV !== 'production') {
      console.warn(`[cockfight] 客户端传 createdAt=${clientCreatedAt} 已被忽略，使用服务端时间`);
    }
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const out = engine.resolveCockRound(player, bet, intervention || null, createdNum);
      if (!out.success) {
        const msg = out.message || '失败';
        let status = out.status || 400;
        if (out.status === 500) status = 500;
        else if (msg.includes('请先进入') || msg.includes('过期') || msg.includes('不匹配') || msg.includes('已用完') || msg.includes('次数')) status = 409;
        else if (msg.includes('createdAt 非法') || msg.includes('押注编号') || msg.includes('未知干预')) status = 400;
        else if (msg.includes('数据损坏')) status = 500;
        return { status, message: msg };
      }
      if (out.already) return { status: 200, data: out, already: true };
      return { status: 200, data: out };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    if (result.already) return res.json({ success: true, data: result.data, already: true });
    return ok(res, result.data);
  });

  // 积分兑换称号
  app.post('/api/player/:username/cockfight/exchange', (req, res) => {
    const username = req.params.username;
    if (!username) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const { titleKey } = req.body || {};
    if (!titleKey) return fail(res, '请选择称号', 400);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const out = engine.exchangeCockfightTitle(player, titleKey);
      if (!out.success) {
        const msg = out.message || '失败';
        let status = 400;
        if (msg.includes('不存在')) status = 404;
        else if (msg.includes('已拥有') || msg.includes('不足')) status = 409;
        else if (msg.includes('无法兑换')) status = 400;
        return { status, message: msg };
      }
      return { status: 200, data: out };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });
}

module.exports = { registerCockfightRoutes };
