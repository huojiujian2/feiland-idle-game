// ====== 账号路由：注册 / 登录 / 创建角色 ======
const { createCharacter, calculateIdle, getPlayerView, getOfflineSummary, updateOfflineSnapshot, maybeResetWeeklyBossKills, getNow } = require('../engine');
const { ok, fail } = require('./_helpers');

function registerAuthRoutes(app, store) {
  // 注册
  app.post('/api/register', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || username.trim().length < 1) return fail(res, '请输入账号', 400);
    if (!password || password.length < 1) return fail(res, '请输入密码', 400);
    if (store.accountExists(username)) return fail(res, '账号已存在', 409);
    const result = store.withTransaction((data) => {
      if (data.accounts[username]) return { status: 409, message: '账号已存在' };
      data.accounts[username] = { username, password, hasCharacter: false, createdAt: getNow() };
      return { status: 200 };
    });
    if (result.status !== 200) return fail(res, result.message, result.status);
    console.log(`新账号注册: ${username}`);
    ok(res, null, { message: '注册成功' });
  });

  // 登录
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return fail(res, '请输入账号和密码', 400);
    const account = store.getAccount(username);
    if (!account) return fail(res, '账号不存在', 404);
    if (account.password !== password) return fail(res, '密码错误', 400);
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
        return res.json({ success: true, hasCharacter: true, data: result.data.playerView, offlineSummary: result.data.offlineSummary });
      }
    }
    res.json({ success: true, hasCharacter: false });
  });

  // 创建角色
  app.post('/api/player/:username/create-character', (req, res) => {
    const { charName } = req.body || {};
    const username = req.params.username;
    const account = store.getAccount(username);
    if (!account) return fail(res, '账号不存在', 404);
    if (account.hasCharacter) return fail(res, '已有角色', 409);
    if (!charName || charName.trim().length < 1) return fail(res, '请输入角色名', 400);
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
    ok(res, result.data);
  });

  // v2.2：全服玩家名册（用来解析别人造的造物 → 真名）
  //   支持 ?usernames=123,1234 增量查询；不传参则返回全部
  //   返回 { [username]: { username, name } }
  app.get('/api/players/names', (req, res) => {
    const all = store.getAllPlayers();
    const list = all
      .filter(p => p && p.username)   // 兜底：跳过异常数据
      .map(p => ({ username: p.username, name: p.name || p.username }));
    const out = {};
    for (const r of list) out[r.username] = r;
    ok(res, out);
  });
}

module.exports = { registerAuthRoutes };
