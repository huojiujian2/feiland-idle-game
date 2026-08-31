// ====== 服务器入口 v0.4 - 模块化路由 ======
// 路由已拆分到 server/routes/，游戏逻辑拆分到 server/engine/
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const store = require('./store');
const engine = require('./engine');
const { registerRoutes } = require('./routes');

const app = express();
// 端口约定：后端 API 固定 3001；前端固定 3000（开发时由 Vite 提供，生产时由 server/web-server.js 提供）
const PORT = process.env.PORT || 3001;

// v1.03 P1 2.2：CORS 白名单（防任意网站跨域调用）
//   默认允许 localhost:3000 / 127.0.0.1:3000（开发/反代同机）
//   生产通过 CORS_ORIGIN 环境变量设置（逗号分隔），如：
//     CORS_ORIGIN="https://game.example.com,https://www.example.com"
const _corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    // 同源（curl / 服务端内部调用）允许
    if (!origin) return cb(null, true);
    if (_corsOrigins.includes('*')) return cb(null, true); // 显式通配
    if (_corsOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} 不在白名单`));
  },
  credentials: true, // 允许带 cookie / Authorization
}));
// v1.03 P1 1.8：express.json body 大小限制（防超大 body 占内存）
//   默认 100KB（足够任何业务接口）；大文件上传应走专门 /upload 路由
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '100kb' }));

// load() 可能是异步（SQLite 后端）也可能是同步（JSON 后端）
// 用 IIFE 把 store 初始化与后续启动逻辑串起来
(async () => {
  try {
    await store.load();
  } catch (e) {
    console.error('[store.load] 初始化失败:', e.message);
    process.exit(1);
  }
  engine.maybeResetWeeklyBossKills(store);
  engine.setStore(store);   // 把 store.getMeta 注入 idle/genesis（创世系统需要）
  // v1.03 P1 1.9：启动期跑一次创世装备衰减（首次启动若 lastDecayDayKey 缺失会全量衰减，后续每日 0 点衰减）
  try { engine.maybeDecayGenesisEquips(store); } catch (e) { console.error('[genesis decay] 启动失败:', e.message); }
  // 启动补偿：按周期各自包裹 withTransaction，失败不推进游标（见 engine.settleDuePeriods）
  try { engine.settleDuePeriods(store); } catch (e) { console.error('启动补偿失败:', e.message); }
  console.log(`已加载 ${store.getAllPlayers().length} 个角色`);

  // 注册所有路由（必须在 load() 之后，否则 setStore 注入会晚于路由访问）
  registerRoutes(app, store);

  // 未匹配的 /api 路径返回 JSON 404（必须在 registerRoutes 之后，否则会拦截路由）
  app.use('/api', (req, res) => {
    res.status(404).json({ success: false, message: `接口不存在: ${req.method} ${req.path}` });
  });

  // ====== 定时任务（仅主进程，避免测试挂起） ======
  if (require.main === module) {
    // v1.03 P1 5.1：5s 挂机循环改 setTimeout 自递归（避免 setInterval 在繁忙时堆积）
    //   原 setInterval(5000) 若任务耗时 > 5s 会导致回调堆积，且 timer 永远追不上时间
    //   自递归模式：任务完成后才安排下一个 5s
    let idleRunning = false;
    function runIdleLoop() {
      if (idleRunning) return; // 重入保护（理论上不会发生）
      idleRunning = true;
      try {
        // 周重置 + 挂机结算（在同一个循环里即可，不用单独 setInterval——P1 5.2 修复）
        engine.maybeResetWeeklyBossKills(store);
        const players = store.getAllPlayers();
        for (const player of players) engine.calculateIdle(player);
        if (players.length > 0) store.safeSave();
      } catch (e) {
        console.error('[idle loop] 异常:', e.message);
      } finally {
        idleRunning = false;
        setTimeout(runIdleLoop, 5000); // 自递归：完成后 5s 再排下一个
      }
    }
    setTimeout(runIdleLoop, 5000);

    // v1.03 P1 1.9：每日创世装备衰减检查（每 1 小时一次，但内部 dayKey 跳过，幂等）
    setInterval(() => {
      try { engine.maybeDecayGenesisEquips(store); } catch (e) { console.error('[genesis decay] 异常:', e.message); }
    }, 60 * 60 * 1000);

    // 每 30 秒持久化 — safeSave
    setInterval(() => store.safeSave(), 30000);

    // v1.03 内存监控：每分钟检查一次 heap 使用率
    //   阈值可通过 HEAP_WARN_PCT 环境变量调整（默认 80%）
    //   超阈值时打印告警 + 触发 major GC（如果可用）
    const HEAP_WARN_PCT = Number(process.env.HEAP_WARN_PCT) || 80;
    setInterval(() => {
      const mem = process.memoryUsage();
      const pct = (mem.heapUsed / mem.heapTotal * 100).toFixed(1);
      const msg = `[内存监控] heapUsed=${(mem.heapUsed/1024/1024).toFixed(1)}MB / heapTotal=${(mem.heapTotal/1024/1024).toFixed(1)}MB (${pct}%) rss=${(mem.rss/1024/1024).toFixed(1)}MB`;
      if (parseFloat(pct) >= HEAP_WARN_PCT) {
        console.warn(`⚠️ ${msg} 超阈值 ${HEAP_WARN_PCT}%`);
        // 触发 major GC（如可用，需启动时 --expose-gc 或 V8 自动）
        if (global.gc) {
          try { global.gc(); console.warn('[内存监控] 已触发 major GC'); } catch (_) {}
        }
      } else if (mem.heapUsed > 200 * 1024 * 1024) {
        // 静默日志（>200MB 时每分钟都打）
        console.log(msg);
      }
    }, 60 * 1000);

    // ====== 竞技场周期结算（每分钟检查一次日/周/月边界 + 赛季） ======
    function tryAutoSettle() {
      // v1.03 P1 5.2：周重置兜底（原本有单独的 60s setInterval，已并入 idle loop；
      //   但 tryAutoSettle 每分钟跑一次，这里也加一次冗余兜底，防 idle loop 异常时卡死）
      engine.maybeResetWeeklyBossKills(store);
      // 赛季重置 — 事务化
      const seasonResult = store.withTransaction((data) => {
        const meta = data.meta;
        const curSeason = engine.getSeasonKey();
        if (!meta.currentSeason) meta.currentSeason = curSeason;
        const resetInfo = engine.maybeResetSeason(meta);
        if (resetInfo.reset) {
          engine.applySeasonResetToPlayers(store);
          console.log(`[赛季重置] ${resetInfo.from} → ${resetInfo.to}`);
        }
        return { status: 200 };
      });
      if (seasonResult.status !== 200) {
        console.error('赛季重置保存失败:', seasonResult.message);
        return;
      }
      // 竞技场日/周/月 — 委托 engine.settleDuePeriods（内部按周期各自 withTransaction，失败不推进）
      try {
        engine.settleDuePeriods(store);
      } catch (e) {
        console.error('竞技场结算失败:', e.message);
      }
    }
    setInterval(tryAutoSettle, 60 * 1000);

    // ====== 静态资源托管 ======
    const distPath = path.join(__dirname, '..', 'client', 'dist');
    const publicIconsPath = path.join(__dirname, '..', 'client', 'public', 'icons');
    if (fs.existsSync(publicIconsPath)) {
      app.use('/icons', express.static(publicIconsPath));
    }
    if (fs.existsSync(distPath)) {
      // v1.03 P2 3.4：静态资源加 ETag + Cache-Control（强缓存 + 协商缓存）
app.use(express.static(distPath, {
  etag: true,
  lastModified: true,
  maxAge: '1h',         // 浏览器强缓存 1 小时
  setHeaders: (res, filePath) => {
    if (/\.(html)$/i.test(filePath)) {
      // HTML 不缓存（确保登录态等刷新即时生效）
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else if (/\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf)$/i.test(filePath)) {
      // 静态资源（含 hash 的 Vite 产物）可长期缓存
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));
      app.get('*', (req, res) => {
        // /api 已由上方兜底返回 404，这里只负责前端路由回退
        res.sendFile(path.join(distPath, 'index.html'));
      });
      console.log(`  静态文件: ${distPath}`);
    }

    const HOST = process.env.HOST || '0.0.0.0';
    app.listen(PORT, HOST, () => {
      console.log(`\n========================================`);
      console.log(`  费兰德世界 - 后端 API 已启动 v0.4`);
      console.log(`  API 地址: http://localhost:${PORT}`);
      console.log(`  游戏页面: http://localhost:3000 (前端)`);
      console.log(`  监听: ${HOST}:${PORT}`);
      console.log(`========================================\n`);
    });
  }
})();

module.exports = app;