// ====== 路由层共享工具 ======
// 提供 loadPlayer / savePlayer 等通用样板

function loadPlayer(store, username) {
  const p = store.getPlayer(username);
  if (!p) return { error: '角色不存在' };
  return { player: p };
}

function savePlayer(store, player) {
  store.setPlayer(player.username, player);
}

function ok(res, data, extra = {}) {
  res.json({ success: true, data, ...extra });
}

function fail(res, message, status = 200) {
  res.status(status).json({ success: false, message });
}

module.exports = { loadPlayer, savePlayer, ok, fail };
