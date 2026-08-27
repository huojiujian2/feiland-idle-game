// ====== 账号路由：注册 / 登录 / 创建角色 ======
const { createCharacter, calculateIdle, getPlayerView, getOfflineSummary, updateOfflineSnapshot, maybeResetWeeklyBossKills, getNow } = require('../engine');
const { ok, fail } = require('./_helpers');

function registerAuthRoutes(app, store) {
  // 注册
  app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || username.trim().length < 1) return fail(res, '请输入账号');
    if (!password || password.length < 1) return fail(res, '请输入密码');
    if (store.accountExists(username)) return fail(res, '账号已存在');
    store.setAccount(username, { username, password, hasCharacter: false, createdAt: getNow() });
    console.log(`新账号注册: ${username}`);
    ok(res, null, { message: '注册成功' });
  });

  // 登录
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return fail(res, '请输入账号和密码');
    const account = store.getAccount(username);
    if (!account) return fail(res, '账号不存在');
    if (account.password !== password) return fail(res, '密码错误');
    if (account.hasCharacter) {
      const player = store.getPlayer(username);
      if (player) {
        maybeResetWeeklyBossKills(store);
        calculateIdle(player);
        const offlineSummary = getOfflineSummary(player);
        updateOfflineSnapshot(player);
        store.setPlayer(username, player);
        return res.json({ success: true, hasCharacter: true, data: getPlayerView(player), offlineSummary });
      }
    }
    res.json({ success: true, hasCharacter: false });
  });

  // 创建角色
  app.post('/api/player/:username/create-character', (req, res) => {
    const { charName } = req.body;
    const username = req.params.username;
    const account = store.getAccount(username);
    if (!account) return fail(res, '账号不存在');
    if (account.hasCharacter) return fail(res, '已有角色');
    if (!charName || charName.trim().length < 1) return fail(res, '请输入角色名');
    const player = createCharacter(username, charName.trim());
    store.setPlayer(username, player);
    account.hasCharacter = true;
    store.setAccount(username, account);
    console.log(`新角色创建: ${charName} (${username})`);
    ok(res, getPlayerView(player));
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
