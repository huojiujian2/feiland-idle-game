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

app.use(cors());
app.use(express.json());

store.load();
engine.maybeResetWeeklyBossKills(store);
engine.setStore(store);   // 把 store.getMeta 注入 idle/genesis（创世系统需要）
console.log(`已加载 ${store.getAllPlayers().length} 个角色`);

// 注册所有路由
registerRoutes(app, store);

// 未匹配的 /api 路径返回 JSON 404（否则请求会被下面的前端兜底路由吞掉而永久挂起）
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `接口不存在: ${req.method} ${req.path}` });
});

// ====== 定时任务（仅主进程，避免测试挂起） ======
if (require.main === module) {
  // 每 5 秒为所有玩家结算挂机收益
  setInterval(() => {
    engine.maybeResetWeeklyBossKills(store);
    const players = store.getAllPlayers();
    for (const player of players) engine.calculateIdle(player);
    if (players.length > 0) store.save();
  }, 5000);

  // 周重置兜底
  setInterval(() => engine.maybeResetWeeklyBossKills(store), 60 * 1000);

  // 每 30 秒持久化
  setInterval(() => store.save(), 30000);

  // ====== 竞技场周期结算（每分钟检查一次日/周/月边界） ======
  let lastDailyKey = engine.getDailyKey();
  let lastWeeklyKey = engine.getWeeklyKey();
  let lastMonthlyKey = engine.getMonthlyKey();
  let lastSeasonKey = engine.getSeasonKey();

  function tryAutoSettle() {
    const meta = store.getMeta();
    const curSeason = engine.getSeasonKey();
    if (curSeason !== lastSeasonKey) {
      const resetInfo = engine.maybeResetSeason(meta);
      if (resetInfo.reset) {
        engine.applySeasonResetToPlayers(store);
        console.log(`[赛季重置] ${resetInfo.from} → ${resetInfo.to}`);
      }
      lastSeasonKey = curSeason;
      store.setMeta(meta);
      store.save();
    }

    const settlePeriod = (period, label, keyFn, lastKey) => {
      const cur = keyFn();
      if (cur === lastKey) return lastKey;
      const ranking = store.getAllPlayers()
        .filter(p => p.level)
        .map(p => ({ username: p.username, rating: (p.pvpStats && p.pvpStats.rating) || 1000 }))
        .sort((a, b) => b.rating - a.rating);
      const r = engine.settleArenaRewards(meta, period, ranking);
      if (r.rewarded > 0) {
        for (const [uname, info] of Object.entries(r.rewards)) {
          const p = store.getPlayer(uname);
          if (!p) continue;
          p[engine.PVP_CURRENCY_KEY || 'arenaCoins'] = (p[engine.PVP_CURRENCY_KEY || 'arenaCoins'] || 0) + info.coins;
          p.logs = p.logs || [];
          p.logs.push({ time: engine.getNow(), type: 'arena-reward', text: `【${label}】${info.tier}级 (第 ${info.rank} 名) +${info.coins} 竞技币` });
          store.setPlayer(uname, p);
        }
        console.log(`[竞技场${label}] ${r.rewarded} 人获奖金 (${cur})`);
      }
      store.setMeta(meta);
      store.save();
      return cur;
    };

    lastDailyKey = settlePeriod('daily', '日结', engine.getDailyKey, lastDailyKey);
    lastWeeklyKey = settlePeriod('weekly', '周结', engine.getWeeklyKey, lastWeeklyKey);
    lastMonthlyKey = settlePeriod('monthly', '月结', engine.getMonthlyKey, lastMonthlyKey);
  }
  setInterval(tryAutoSettle, 60 * 1000);

  // ====== 静态资源托管 ======
  const distPath = path.join(__dirname, '..', 'client', 'dist');
  const publicIconsPath = path.join(__dirname, '..', 'client', 'public', 'icons');
  if (fs.existsSync(publicIconsPath)) {
    app.use('/icons', express.static(publicIconsPath));
  }
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
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
module.exports = app;
