// ====== 灵鸡斗场路由（完全独立玩法） ======
// GET  /api/player/:username/cockfight                          → 状态视图（积分/胜场/连胜/参与进度/商店/记录）
// POST /api/player/:username/cockfight/enter                     → 进入斗场，生成 6 只灵鸡
// POST /api/player/:username/cockfight/resolve { bet, intervention } → 押注+干预+擂台赛+结算
// POST /api/player/:username/cockfight/exchange { titleKey }     → 积分兑换称号
const { ok, fail, loadPlayer, savePlayer } = require('./_helpers');
const engine = require('../engine');

function registerCockfightRoutes(app, store) {
  // 状态视图
  app.get('/api/player/:username/cockfight', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    return ok(res, engine.getCockfightStatus(r.player));
  });

  // 进入斗场
  app.post('/api/player/:username/cockfight/enter', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const out = engine.enterCockArena(r.player);
    if (!out.success) return fail(res, out.message);
    savePlayer(store, r.player);
    return ok(res, out);
  });

  // 结算一局（押注 + 干预 + 擂台赛 + 积分）
  app.post('/api/player/:username/cockfight/resolve', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const { bet, intervention } = req.body || {};
    const out = engine.resolveCockRound(r.player, bet, intervention || null);
    if (!out.success) return fail(res, out.message);
    savePlayer(store, r.player);
    return ok(res, out);
  });

  // 积分兑换称号
  app.post('/api/player/:username/cockfight/exchange', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const { titleKey } = req.body || {};
    if (!titleKey) return fail(res, '请选择称号');
    const out = engine.exchangeCockfightTitle(r.player, titleKey);
    if (!out.success) return fail(res, out.message);
    savePlayer(store, r.player);
    return ok(res, out);
  });
}

module.exports = { registerCockfightRoutes };
