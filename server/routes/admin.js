// ====== 后台管理路由 · v1.05 · 2026-09-02 ======
// 后台监控页（/admin）的后端接口，零依赖实现：
//   - POST /api/admin/login        用 ADMIN_TOKEN 换 admin JWT（8 小时有效期）
//   - GET  /api/admin/monitor/overview   监控总览（内存/在线/存档/请求/idle 耗时）
//   - （预留）GM 写操作接口统一挂 auditLog('gm.xxx')，见 audit-log.js
//
// 鉴权：requireAdminAuth —— Bearer admin JWT 或 X-Admin-Token 二选一
// 说明：登录接口本身公开（否则无法登录），其余接口全部 requireAdminAuth 保护。

const { signToken } = require('../middleware/auth');
const { ok, fail } = require('./_helpers');
const rateLimit = require('../middleware/rate-limit');
const monitor = require('../monitor');
const auditLog = require('../middleware/audit-log');
const announcements = require('../announcements');
const engine = require('../engine');
const viewCache = require('../middleware/view-cache');
const { AREAS, JOB_TREE } = require('../data');
// v1.07：服务器全局设置读写
const serverSettings = require('../server-settings');
// v1.08：后台多账号体系（默认 admin/admin，首登强制改密）
const adminAccounts = require('../admin-accounts');

const ADMIN_TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // admin JWT 8 小时

// 登录限流：10 次/分钟（IP 维度），防暴力猜 ADMIN_TOKEN
const adminLoginLimiter = rateLimit({
  windowMs: 60000,
  max: parseInt(process.env.ADMIN_LOGIN_LIMIT_MAX || '10', 10),
});

function registerAdminRoutes(app, store, opts) {
  const requireAdminAuth = opts.auth.requireAdminAuth;
  // v1.08：初始化后台账号体系（首次启动写入默认 admin/admin 账号）
  adminAccounts.init(store);

  // ====== 登录：username + password → admin JWT（v1.08 多账号版） ======
  app.post('/api/admin/login', adminLoginLimiter, (req, res) => {
    const body = req.body || {};
    const username = String(body.username || '').trim();
    const password = body.password;
    if (!username) return fail(res, '请输入账号', 400);
    if (!password || typeof password !== 'string') return fail(res, '请输入密码', 400);
    const r = adminAccounts.authenticate(username, password);
    if (!r.ok) return fail(res, r.reason || '登录失败', 403);
    const token = signToken({ username: r.record.username, role: 'admin' }, ADMIN_TOKEN_TTL_MS);
    return ok(res, {
      token,
      expiresInMs: ADMIN_TOKEN_TTL_MS,
      username: r.record.username,
      mustChangePassword: !!r.record.mustChangePassword,
    });
  });

  // ====== v1.08：当前登录账号信息（前端展示 + 首登警告判断） ======
  app.get('/api/admin/me', requireAdminAuth, (req, res) => {
    const u = (req.admin && req.admin.username) || '';
    const r = adminAccounts.findAccount(u);
    if (!r) return fail(res, '账号不存在', 404);
    return ok(res, adminAccounts.publicInfo(r));
  });

  // ====== v1.08：修改密码（自己改自己） ======
  app.post('/api/admin/me/password', requireAdminAuth, auditLog('admin.password.change'), (req, res) => {
    const username = (req.admin && req.admin.username) || '';
    const body = req.body || {};
    const oldPwd = body.oldPassword;
    const newPwd = body.newPassword;
    if (!oldPwd || !newPwd) return fail(res, '请输入旧密码和新密码', 400);
    const r = adminAccounts.changePassword(username, oldPwd, newPwd);
    if (!r.ok) return fail(res, r.message, r.status || 400);
    return ok(res, adminAccounts.publicInfo(r.record));
  });

  // ====== 监控总览（只读，无副作用） ======
  app.get('/api/admin/monitor/overview', requireAdminAuth, (req, res) => {
    try {
      return ok(res, monitor.getOverview(store));
    } catch (e) {
      return fail(res, e.message, 500);
    }
  });

  // ====== GM 功能 ======
  // 全服公告：广播一条消息（游戏前端轮询 /api/announce 对比 latestId 弹提示）
  app.post('/api/admin/announce', requireAdminAuth, auditLog('gm.announce'), (req, res) => {
    try {
      const content = req.body && req.body.content;
      if (!content || typeof content !== 'string') return fail(res, '请输入公告内容', 400);
      const text = content.trim();
      if (!text) return fail(res, '公告内容不能为空', 400);
      if (text.length > 500) return fail(res, '公告内容过长（最多 500 字）', 400);
      const item = announcements.add(text);
      console.log(`[GM] 全服公告 #${item.id}: ${text.slice(0, 40)}`);
      return ok(res, { list: announcements.all(), latestId: announcements.latestId() });
    } catch (e) {
      return fail(res, e.message, 500);
    }
  });

  // 公告历史（GM 面板展示用）
  app.get('/api/admin/announce/list', requireAdminAuth, (req, res) => {
    return ok(res, { list: announcements.all(), latestId: announcements.latestId() });
  });

  // 玩家检索：按用户名/角色名模糊搜索（精简列表，只读）
  // 注意：必须注册在 /api/admin/players/:username 之前，否则 "search" 会被当作用户名
  app.get('/api/admin/players/search', requireAdminAuth, (req, res) => {
    try {
      const keyword = (req.query.keyword || '').trim();
      if (!keyword) return ok(res, { list: [], total: 0 });
      const kw = keyword.toLowerCase();
      const matched = [];
      const players = store.getAllPlayers();
      for (const p of players) {
        const u = (p.username || '').toLowerCase();
        const n = (p.name || '').toLowerCase();
        if (u.includes(kw) || n.includes(kw)) {
          matched.push({
            username: p.username,
            name: p.name,
            level: p.level,
            currentArea: p.currentArea,
            areaName: (p.currentArea && AREAS[p.currentArea] && AREAS[p.currentArea].name) || p.currentArea || '-',
            jobName: (p.jobPath && JOB_TREE[p.jobPath] && JOB_TREE[p.jobPath].name) || p.job || '无',
            lastTick: p.lastTick,
            online: monitor.isActive(p.username),
          });
          if (matched.length >= 20) break;
        }
      }
      return ok(res, { list: matched, total: matched.length });
    } catch (e) {
      return fail(res, e.message, 500);
    }
  });

  // 玩家档案（只读，走 getPlayerView 不带事务/离线结算）
  app.get('/api/admin/players/:username', requireAdminAuth, auditLog('gm.player.view'), (req, res) => {
    try {
      const username = req.params.username;
      const player = store.getPlayer(username);
      if (!player) return fail(res, '角色不存在', 404);
      const view = engine.getPlayerView(player);
      return ok(res, {
        username: player.username,
        name: player.name,
        level: player.level,
        currentArea: player.currentArea,
        areaName: (player.currentArea && AREAS[player.currentArea] && AREAS[player.currentArea].name) || player.currentArea || '-',
        jobName: (player.jobPath && JOB_TREE[player.jobPath] && JOB_TREE[player.jobPath].name) || player.job || '无',
        lastTick: player.lastTick,
        online: monitor.isActive(username),
        view,
      });
    } catch (e) {
      return fail(res, e.message, 500);
    }
  });

  // ====== GM 资源发放（写操作：事务 + 审计 + 缓存失效） ======
  // 发金币：amount 1 ~ 1e13（10 万亿）
  app.post('/api/admin/players/:username/gm/gold', requireAdminAuth, auditLog('gm.gold'), (req, res) => {
    try {
      const username = req.params.username;
      const amount = Math.floor(Number(req.body && req.body.amount));
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1e13) return fail(res, '金额需为 1 ~ 100000亿 之间的整数', 400);
      const result = store.withTransaction((data) => {
        const player = data.players[username];
        if (!player) return { status: 404, message: '角色不存在' };
        player.gold = Math.min(player.gold + amount, 1e15);
        return { status: 200, data: { username, gold: player.gold } };
      });
      if (result.status !== 200) return fail(res, result.message, result.status);
      viewCache.invalidatePlayerView(username);
      console.log(`[GM] 发金币 ${username} +${amount}`);
      return ok(res, result.data);
    } catch (e) {
      return fail(res, e.message, 500);
    }
  });

  // 发经验：exp 1 ~ 1e7（1000 万），走完整升级逻辑（含职业进阶/日志）
  app.post('/api/admin/players/:username/gm/exp', requireAdminAuth, auditLog('gm.exp'), (req, res) => {
    try {
      const username = req.params.username;
      const exp = Math.floor(Number(req.body && req.body.exp));
      if (!Number.isFinite(exp) || exp <= 0 || exp > 1e7) return fail(res, '经验需为 1 ~ 1000万 之间的整数', 400);
      const result = store.withTransaction((data) => {
        const player = data.players[username];
        if (!player) return { status: 404, message: '角色不存在' };
        const before = player.level || 1;
        engine.grantExpWithLevelUp(player, exp);
        return { status: 200, data: { username, level: player.level, leveledUp: (player.level || 1) - before } };
      });
      if (result.status !== 200) return fail(res, result.message, result.status);
      viewCache.invalidatePlayerView(username);
      console.log(`[GM] 发经验 ${username} +${exp}`);
      return ok(res, result.data);
    } catch (e) {
      return fail(res, e.message, 500);
    }
  });

  // 召唤世界 BOSS：JWT 版包装（等价 /api/worldboss/spawn 的 X-Admin-Token 版本）
  app.post('/api/admin/worldboss/spawn', requireAdminAuth, auditLog('gm.worldboss'), (req, res) => {
    try {
      const result = store.withTransaction((data) => {
        data.meta.worldBoss = null;
        const boss = engine.spawnWorldBoss(store);
        return { status: 200, data: boss };
      });
      if (result.status !== 200) return fail(res, result.message, result.status);
      console.log(`[GM] 重新召唤世界 BOSS: ${result.data && result.data.name}`);
      return ok(res, result.data);
    } catch (e) {
      return fail(res, e.message, 500);
    }
  });

  // ====== v1.07：服务器全局设置 ======
  // GET：拉取配置 + 全服数值现状（用于"智能调节"决策展示）
  app.get('/api/admin/server-config', requireAdminAuth, (req, res) => {
    try {
      const cfg = serverSettings.getConfig() || { expMultiplier: 1, goldMultiplier: 1, maxLevel: 0, maxGold: 0 };
      const overview = serverSettings.getOverview(store);
      return ok(res, { config: cfg, overview });
    } catch (e) {
      return fail(res, e.message, 500);
    }
  });

  // PUT：写入服务器设置（事务 + 审计）
  app.put('/api/admin/server-config', requireAdminAuth, auditLog('gm.server.config'), (req, res) => {
    try {
      const body = req.body || {};
      const expM = Number(body.expMultiplier);
      const goldM = Number(body.goldMultiplier);
      const lv = Number(body.maxLevel);
      const gld = Number(body.maxGold);
      if (!Number.isFinite(expM) || expM < 0.1 || expM > 1000) return fail(res, 'expMultiplier 须在 0.1 ~ 1000', 400);
      if (!Number.isFinite(goldM) || goldM < 0.1 || goldM > 1000) return fail(res, 'goldMultiplier 须在 0.1 ~ 1000', 400);
      if (!Number.isFinite(lv) || lv < 0 || lv > 100000) return fail(res, 'maxLevel 须在 0 ~ 100000（0=不限）', 400);
      if (!Number.isFinite(gld) || gld < 0 || gld > 1e18) return fail(res, 'maxGold 须在 0 ~ 1e18（0=不限）', 400);
      const updatedBy = (req.user && req.user.username) || 'admin';
      const result = store.withTransaction((data) => {
        data.meta.serverConfig = {
          expMultiplier: expM,
          goldMultiplier: goldM,
          maxLevel: Math.floor(lv),
          maxGold: Math.floor(gld),
          updatedAt: Date.now(),
          updatedBy,
        };
        return { status: 200, data: data.meta.serverConfig };
      });
      if (result.status !== 200) return fail(res, result.message, result.status);
      console.log(`[GM] 更新服务器设置: exp×${expM} gold×${goldM} Lv≤${lv || '∞'} Gold≤${gld || '∞'}`);
      // 清缓存：倍率/上限变化后，所有玩家视图都需刷新
      try { viewCache.invalidateAll && viewCache.invalidateAll(); } catch (_) {}
      const overview = serverSettings.getOverview(store);
      return ok(res, { config: result.data, overview });
    } catch (e) {
      return fail(res, e.message, 500);
    }
  });
}

module.exports = { registerAdminRoutes };
