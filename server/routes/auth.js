// ====== 账号路由：注册 / 登录 / 创建角色 · v1.03 JWT ======
const {
  createCharacter, calculateIdle, getPlayerView,
  getOfflineSummary, updateOfflineSnapshot, maybeResetWeeklyBossKills, getNow
} = require('../engine');
const { ok, fail } = require('./_helpers');
const { signToken } = require('../middleware/auth');
const { hashPassword, verifyPassword, isLegacyPlaintext } = require('../middleware/password');
const rateLimit = require('../middleware/rate-limit');

const MIN_PASSWORD_LEN = 6; // 安全报告 P0 1.2 要求
const MAX_USERNAME_LEN = 32;
const MAX_PASSWORD_LEN = 128;

// v1.03：注册 / 登录 速率限制（防 1.3 注册无限刷号）
// 默认 5 次/分钟（IP 维度）；可通过 env 覆盖
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.AUTH_LIMIT_MAX || '5', 10),
});
// 登录限流稍宽（防误伤正常重试），10 次/分钟
const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.LOGIN_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.LOGIN_LIMIT_MAX || '10', 10),
});

function isValidUsername(u) {
  if (typeof u !== 'string') return false;
  if (u.length < 3 || u.length > MAX_USERNAME_LEN) return false;
  // 仅允许字母/数字/下划线/中文（防止特殊字符 XSS/路径穿越）
  return /^[\w\u4e00-\u9fa5-]+$/.test(u);
}

function registerAuthRoutes(app, store) {
  // 注册（带 IP 速率限制）
  app.post('/api/register', authLimiter, async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || typeof username !== 'string') return fail(res, '请输入账号', 400);
    if (!isValidUsername(username)) return fail(res, `账号需 3-${MAX_USERNAME_LEN} 字符，仅允许字母数字下划线中文-`, 400);
    if (!password || typeof password !== 'string') return fail(res, '请输入密码', 400);
    if (password.length < MIN_PASSWORD_LEN) return fail(res, `密码至少 ${MIN_PASSWORD_LEN} 字符`, 400);
    if (password.length > MAX_PASSWORD_LEN) return fail(res, `密码最多 ${MAX_PASSWORD_LEN} 字符`, 400);
    if (store.accountExists(username)) return fail(res, '账号已存在', 409);

    let passwordHash;
    try {
      passwordHash = await hashPassword(password);
    } catch (e) {
      return fail(res, '密码哈希失败: ' + e.message, 500);
    }

    const result = store.withTransaction((data) => {
      if (data.accounts[username]) return { status: 409, message: '账号已存在' };
      data.accounts[username] = { username, password: passwordHash, hasCharacter: false, createdAt: getNow() };
      return { status: 200 };
    });
    if (result.status !== 200) return fail(res, result.message, result.status);
    console.log(`新账号注册: ${username}`);
    ok(res, null, { message: '注册成功' });
  });

  // 登录（带 IP 速率限制）
  app.post('/api/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return fail(res, '请输入账号和密码', 400);
    const account = store.getAccount(username);
    if (!account) return fail(res, '账号不存在', 404);
    let passwordOk = false;
    try {
      passwordOk = await verifyPassword(password, account.password);
    } catch (e) {
      return fail(res, '密码校验失败', 500);
    }
    if (!passwordOk) return fail(res, '密码错误', 400);

    // 老明文账号 → 登录成功后自动升级为哈希（一次性迁移）
    if (isLegacyPlaintext(account.password)) {
      try {
        const newHash = await hashPassword(password);
        store.setAccount(username, Object.assign({}, account, { password: newHash }));
      } catch (e) {
        console.warn(`[auth] 升级旧密码失败 ${username}:`, e.message);
      }
    }

    // 签发 JWT（默认 7 天）
    const token = signToken({ username });

    // v1.05：登录成功即标记在线（会话统计用，不用 lastTick）
    try { require('../monitor').markActive(username); } catch (_) {}

    // 已有角色角色
    if (account.hasCharacter) {
      const rawPlayer = store.getPlayer(username);
      if (rawPlayer) {
        const result = store.withTransaction((data) => {
          const player = data.players[username];
          if (!player) return { status: 404, message: '角色不存在' };
          maybeResetWeeklyBossKills(store);
          calculateIdle(player);
          const offlineSummary = getOfflineSummary(player);
          updateOfflineSnapshot(player);
          return { status: 200, data: { playerView: getPlayerView(player), offlineSummary } };
        });
        if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message || '保存失败请重试' });
        return res.json({
          success: true,
          hasCharacter: true,
          token,
          username,
          data: result.data.playerView,
          offlineSummary: result.data.offlineSummary,
        });
      }
    }
    res.json({ success: true, hasCharacter: false, token, username });
  });

  // 创建角色
  app.post('/api/player/:username/create-character', (req, res) => {
    const { charName } = req.body || {};
    const username = req.params.username;
    const account = store.getAccount(username);
    if (!account) return fail(res, '账号不存在', 404);
    if (account.hasCharacter) return fail(res, '已有角色', 409);
    if (!charName || typeof charName !== 'string' || charName.trim().length < 1) return fail(res, '请输入角色名', 400);
    if (charName.trim().length > MAX_USERNAME_LEN) return fail(res, `角色名最多 ${MAX_USERNAME_LEN} 字符`, 400);
    const result = store.withTransaction((data) => {
      const acc = data.accounts[username];
      if (!acc) return { status: 404, message: '账号不存在' };
      if (acc.hasCharacter) return { status: 409, message: '已有角色' };
      const player = createCharacter(username, charName.trim());
      data.players[username] = player;
      acc.hasCharacter = true;
      return { status: 200, data: getPlayerView(player) };
    });
    if (result.status !== 200) return fail(res, result.message, result.status);
    console.log(`新角色创建: ${charName} (${username})`);
    // v1.05：建号即进入游戏，标记在线
    try { require('../monitor').markActive(username); } catch (_) {}
    ok(res, result.data);
  });

  // 全服玩家名册
  app.get('/api/players/names', (req, res) => {
    const all = store.getAllPlayers();
    const list = all
      .filter(p => p && p.username)
      .map(p => ({ username: p.username, name: p.name || p.username }));
    const out = {};
    for (const r of list) out[r.username] = r;
    ok(res, out);
  });
}

module.exports = { registerAuthRoutes, isValidUsername, MIN_PASSWORD_LEN, MAX_USERNAME_LEN };