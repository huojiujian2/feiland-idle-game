// ====== 每日活跃路由 ======
// @file server/routes/active.js
// @module routes-active
// @description 每日活跃领取接口（T-104 v2），返回完整 getPlayerView
//
// 本文件结构（已模块化拆分后主文件 ~45 行）：
// 1. 注册 POST /daily-active/claim (L13-L38)
// 2. 导出 registerActiveRoutes (L40-L45)
//
// 本文件结构：
// 1. 注册 POST /daily-active/claim (L9-L38)
// 2. 导出 registerActiveRoutes (L40)
const { claimDailyActive, getDailyActiveView } = require('../engine');
const { getPlayerView } = require('../engine');
const { ok, fail } = require('./_helpers');

function registerActiveRoutes(app, store) {
  app.post('/api/player/:username/daily-active/claim', (req, res) => {
    const username = req.params.username;
    const { tier } = req.body || {};
    if (!username) return fail(res, '缺少参数', 400);
    if (!tier) return fail(res, '缺少 tier', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = claimDailyActive(player, Number(tier));
      if (!r.success) {
        const status = r.status || 400;
        if (r.already) {
          // 重放：返回完整 view + 原奖励，保持前端契约
          const view = getPlayerView(player);
          return { status: 200, data: view, already: true, reward: r.reward, dailyActive: getDailyActiveView(player) };
        }
        return { status, message: r.message };
      }
      const view = getPlayerView(player);
      return { status: 200, data: view, reward: r.reward, dailyActive: getDailyActiveView(player), already: !!r.already };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    if (result.already) {
      return res.json({ success: true, data: result.data, reward: result.reward, dailyActive: result.dailyActive, already: true });
    }
    return res.json({ success: true, data: result.data, reward: result.reward, dailyActive: result.dailyActive });
  });
}

module.exports = { registerActiveRoutes };
