// ====== 诊断路由（公开 + 内存监控）v1.03 ======
// 仅暴露进程级 + store 缓存级别监控信息
// 不返回任何用户/账号数据（无 PII 泄露风险）
//
// 用法：
//   GET /api/diag/memory       进程内存 + arenaBots 缓存 + GC 状态
//   GET /api/diag/health       健康检查（用于 docker healthcheck / k8s liveness probe）

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { __getSecret } = require('../middleware/auth');

function registerDiagRoutes(app, store) {
  // 健康检查（极轻量，无 process.memoryUsage 调用）
  app.get('/api/diag/health', (req, res) => {
    res.json({ success: true, data: { ok: true, ts: Date.now() } });
  });

  // v1.03 诊断：分析 401 错误来源（生产环境排查）
  //   GET /api/diag/auth-debug?token=<=<token>>>
  //   返回 JWT_SECRET 指纹 + token 验证结果（不返回 secret 本身）
  //   用于排查"服务器重启后 SECRET 改了导致所有 token 失效"等问题
  app.get('/api/diag/auth-debug', (req, res) => {
    try {
      const token = req.query.token || (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      const secret = __getSecret();
      // 算 SECRET 指纹（不暴露原值，只暴露 SHA256 前 8 位）
      const secretHash = crypto.createHash('sha256').update(secret).digest('hex').slice(0, 12);
      const result = {
        secretFingerprint: secretHash,
        secretLength: secret.length,
        isDevSecret: secret === 'feiland-dev-secret-DO-NOT-USE-IN-PROD',
        tokenProvided: !!token,
        tokenLength: token ? token.length : 0,
        tokenValid: false,
        tokenError: null,
        tokenClaims: null,
        nodeEnv: process.env.NODE_ENV || 'development',
        authMode: process.env.AUTH_MODE || 'enforce',
        jwtSecretEnvSet: !!process.env.JWT_SECRET,
        uptimeSeconds: Math.floor(process.uptime()),
        ts: Date.now(),
      };
      if (token) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const [h, b, s] = parts;
            const expectedSig = crypto.createHmac('sha256', secret).update(`${h}.${b}`).digest();
            const actualSig = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
            const sigMatch = expectedSig.length === actualSig.length && crypto.timingSafeEqual(expectedSig, actualSig);
            const claims = JSON.parse(Buffer.from(b.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'));
            result.tokenClaims = { username: claims.username, iat: claims.iat, exp: claims.exp };
            result.tokenExpired = claims.exp < Date.now();
            result.tokenValid = sigMatch && !result.tokenExpired;
            if (!sigMatch) result.tokenError = 'signature_mismatch（SECRET 改了！）';
            else if (result.tokenExpired) result.tokenError = 'token_expired（7 天 TTL 已过）';
          } else {
            result.tokenError = 'malformed（不是合法 JWT 格式）';
          }
        } catch (e) {
          result.tokenError = 'parse_error: ' + e.message;
        }
      }
      res.json({ success: true, data: result });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
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

      // v1.03 杠杆 4：view 缓存统计
      let viewCacheStats = null;
      try {
        if (typeof store.viewCacheStats === 'function') {
          viewCacheStats = store.viewCacheStats();
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
            viewCache: viewCacheStats,
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