// ====== 玩家 view 缓存中间件 · v1.03 ======
// 背景：前端每 5s 轮询 GET /api/player/:u，每次都走 withTransaction + getPlayerView + JSON.stringify(data) 120MB+。
// 优化：缓存 view 对象，按 player.lastTick 失效（lastTick 变化 → player 改了 → 失效）。
//
// 边界：
//   - viewCache 只缓存 GET /api/player/:u/view-light（轻量 endpoint）的结果
//   - 任何写操作（setPlayer / withTransaction 提交后）调 invalidatePlayerView(username)
//   - 测试 seam：__resetViewCache()

const viewCache = new Map(); // username -> { view, lastTick, offlineSnapshot, ts }
let _stats = { hits: 0, misses: 0, invalidations: 0 };

function getCached(username, lastTick) {
  const c = viewCache.get(username);
  if (!c) { _stats.misses++; return null; }
  // player 重新写入了 → lastTick 变了 → 失效（不删缓存，让下次 setCached 覆盖）
  if (c.lastTick !== lastTick) {
    _stats.misses++;
    return null;
  }
  _stats.hits++;
  return c;
}

function setCached(username, view, offlineSnapshot, lastTick) {
  viewCache.set(username, { view, offlineSnapshot, lastTick, ts: Date.now() });
}

function invalidatePlayerView(username) {
  if (!username) return;
  if (viewCache.delete(username)) {
    _stats.invalidations++;
  }
}

function invalidateAllViews() {
  const n = viewCache.size;
  viewCache.clear();
  _stats.invalidations += n;
}

function getViewCacheStats() {
  return {
    size: viewCache.size,
    hits: _stats.hits,
    misses: _stats.misses,
    invalidations: _stats.invalidations,
    hitRate: _stats.hits + _stats.misses > 0
      ? +((_stats.hits / (_stats.hits + _stats.misses)) * 100).toFixed(1)
      : 0,
  };
}

function __resetViewCache() {
  viewCache.clear();
  _stats = { hits: 0, misses: 0, invalidations: 0 };
}

module.exports = {
  getCached,
  setCached,
  invalidatePlayerView,
  invalidateAllViews,
  getViewCacheStats,
  __resetViewCache,
};