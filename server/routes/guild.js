// ====== 公会路由 ======
// @file routes/guild
// @module routes-guild
// @description T-103 v2.2 公会基础路由（11 接口，GuildCtx 统一）

const {
  createGuild,
  listGuilds,
  getMyGuild,
  joinGuild,
  leaveGuild,
  kickMember,
  updateRole,
  transferGuild,
  updateAnnouncement,
  donate,
  disbandGuild,
} = require('../engine/guild');
const { ok, fail } = require('./_helpers');

function registerGuildRoutes(app, store) {
  // 列表（分页摘要，不含 members/logs/store）
  app.get('/api/guilds', (req, res) => {
    const q = req.query.q || '';
    const page = req.query.page;
    const pageSize = req.query.pageSize;
    const ctx = { meta: store.getMeta(), players: store.__getRawData().players };
    const r = listGuilds(ctx, { q, page, pageSize });
    if (!r.success) return res.status(r.status || 500).json({ success: false, message: r.message });
    return ok(res, r.data);
  });

  // 我的公会详情（事务读取并持久化自愈）
  app.get('/api/player/:username/guild', (req, res) => {
    const username = req.params.username;
    if (!username) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = getMyGuild(player, data);
      if (!r.success) return { status: r.status || 500, message: r.message };
      return { status: 200, data: r.data };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });

  // 创建
  app.post('/api/player/:username/guild/create', (req, res) => {
    const username = req.params.username;
    const { name } = req.body || {};
    if (!username) return fail(res, '缺少参数', 400);
    if (!name) return fail(res, '缺少 name', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = createGuild(player, name, data);
      if (!r.success) return { status: r.status || 400, message: r.message };
      return { status: 200, data: { guild: r.guild, viewer: r.viewer } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });

  // 加入
  app.post('/api/player/:username/guild/join', (req, res) => {
    const username = req.params.username;
    const { guildId } = req.body || {};
    if (!username) return fail(res, '缺少参数', 400);
    if (!guildId) return fail(res, '缺少 guildId', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = joinGuild(player, guildId, data);
      if (!r.success) return { status: r.status || 400, message: r.message };
      return { status: 200, data: { guild: r.guild, viewer: r.viewer } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });

  // 离开
  app.post('/api/player/:username/guild/leave', (req, res) => {
    const username = req.params.username;
    if (!username) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = leaveGuild(player, data);
      if (!r.success) return { status: r.status || 400, message: r.message };
      return { status: 200, data: { success: true } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });

  // 踢出
  app.post('/api/player/:username/guild/kick', (req, res) => {
    const username = req.params.username;
    const { targetUsername } = req.body || {};
    if (!username) return fail(res, '缺少参数', 400);
    if (!targetUsername) return fail(res, '缺少 targetUsername', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = kickMember(player, targetUsername, data);
      if (!r.success) return { status: r.status || 400, message: r.message };
      return { status: 200, data: { guild: r.guild } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });

  // 职位
  app.post('/api/player/:username/guild/role', (req, res) => {
    const username = req.params.username;
    const { targetUsername, role } = req.body || {};
    if (!username) return fail(res, '缺少参数', 400);
    if (!targetUsername || !role) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = updateRole(player, targetUsername, role, data);
      if (!r.success) return { status: r.status || 400, message: r.message };
      return { status: 200, data: { guild: r.guild } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });

  // 转让
  app.post('/api/player/:username/guild/transfer', (req, res) => {
    const username = req.params.username;
    const { targetUsername } = req.body || {};
    if (!username) return fail(res, '缺少参数', 400);
    if (!targetUsername) return fail(res, '缺少 targetUsername', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = transferGuild(player, targetUsername, data);
      if (!r.success) return { status: r.status || 400, message: r.message };
      return { status: 200, data: { guild: r.guild } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });

  // 公告
  app.post('/api/player/:username/guild/announcement', (req, res) => {
    const username = req.params.username;
    const { text } = req.body || {};
    if (!username) return fail(res, '缺少参数', 400);
    if (typeof text !== 'string') return fail(res, '缺少 text', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = updateAnnouncement(player, text, data);
      if (!r.success) return { status: r.status || 400, message: r.message };
      return { status: 200, data: { guild: r.guild } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });

  // 捐献
  app.post('/api/player/:username/guild/donate', (req, res) => {
    const username = req.params.username;
    const { donateId } = req.body || {};
    if (!username) return fail(res, '缺少参数', 400);
    if (!donateId) return fail(res, '缺少 donateId', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = donate(player, donateId, data);
      if (!r.success) return { status: r.status || 400, message: r.message };
      return { status: 200, data: { guild: r.guild, viewer: r.viewer, reward: r.reward } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });

  // 解散
  app.post('/api/player/:username/guild/disband', (req, res) => {
    const username = req.params.username;
    if (!username) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = disbandGuild(player, data);
      if (!r.success) return { status: r.status || 400, message: r.message };
      return { status: 200, data: { success: true } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });
}

module.exports = { registerGuildRoutes };
