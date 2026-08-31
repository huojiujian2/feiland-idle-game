// ====== 诊断路由（公开 + 内存监控）v1.03 ======
// 仅暴露进程级 + store 缓存级别监控信息
// 不返回任何用户/账号数据（无 PII 泄露风险）
//
// 用法：
//   GET /api/diag/memory       进程内存 + arenaBots 缓存 + GC 状态
//   GET /api/diag/health       健康检查（用于 docker healthcheck / k8s liveness probe）

const fs = require('fs');
const path = require('path');

function registerDiagRoutes(app, store) {
  // 健康检查（极轻量，无 process.memoryUsage 调用）
  app.get('/api/diag/health', (req, res) => {
    res.json({ success: true, data: { ok: true, ts: Date.now() } });
  });

  // 内存监控
  app.get('/api/diag/memory', (req, res) => {
    try {
      const mem = process.memoryUsage();
      const heapUsedMB = +(mem.heapUsed / 1024 / 1024).toFixed(2);
      const heapTotalMB = +(mem.heapTotal / 1024 / 1024).toFixed(2);
      const rssMB = +(mem.rss / 1024 / 1024).toFixed(2);
      const externalMB = +(mem.external / 1024 / 1024).toFixed(2);
      const heapPct = heapTotalMB > 0 ? +((mem.heapUsed / mem.heapTotal) * 100).toFixed(1) : 0;

      // arenaBots 缓存统计
      let arenaBotsStats = null;
      try {
        if (typeof store.arenaBotsCacheStats === 'function') {
          arenaBotsStats = store.arenaBotsCacheStats();
        }
      } catch (_) {}

      // 玩家数量 + 估算的 store 内存占用
      let playerCount = 0;
      try {
        playerCount = store.getAllPlayers().length;
      } catch (_) {}

      // 数据库文件大小
      let dbSizeBytes = 0;
      try {
        const dbPath = typeof store.__dbPath === 'function' ? store.__dbPath() : null;
        if (dbPath && fs.existsSync(dbPath)) {
          dbSizeBytes = fs.statSync(dbPath).size;
        }
      } catch (_) {}

      res.json({
        success: true,
        data: {
          memory: {
            heapUsedMB, heapTotalMB, rssMB, externalMB, heapPct,
            heapLimitMB: +(require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024).toFixed(2),
          },
          store: {
            playerCount,
            arenaBotsCache: arenaBotsStats,
            dbSizeMB: +(dbSizeBytes / 1024 / 1024).toFixed(2),
          },
          uptimeSeconds: Math.floor(process.uptime()),
          ts: Date.now(),
        },
      });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });
}

module.exports = { registerDiagRoutes };