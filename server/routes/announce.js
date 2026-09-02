// ====== 全服公告 · 玩家侧接口 · v1.05 ======
// GET /api/announce（公开只读）：返回公告列表 + latestId。
// 游戏前端轮询对比 latestId，发现新公告即 toast 提示（无需登录，公告是广播消息）。

const announcements = require('../announcements');
const { ok } = require('./_helpers');

function registerAnnounceRoutes(app) {
  app.get('/api/announce', (req, res) => {
    return ok(res, { list: announcements.all(), latestId: announcements.latestId() });
  });
}

module.exports = { registerAnnounceRoutes };
