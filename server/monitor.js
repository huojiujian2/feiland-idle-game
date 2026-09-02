// ====== 轻量运行时监控 · v1.05 · 2026-09-02 ======
// 纯内存计数器，供后台监控页（/admin）使用，零依赖：
//   - idle 挂机循环耗时（环形缓冲，最近 N 个样本）
//   - /api 请求量 + 4xx/5xx 错误率（进程启动至今累计 + 最近样本）
//   - 在线人数（按 lastTick 近 5 分钟判定）
//   - 进程内存 / 存档体积（实时读取）
//
// 注意：数据只在内存中，重启清零（历史趋势由前端自行累积展示）。

const fs = require('fs');
const os = require('os');
const SAMPLE_MAX = 60;        // 环形缓冲最多保留 60 个样本
const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 分钟内有动作 = 在线

const _idleSamples = [];      // [{ ts, ms }]
const _req = {
  total: 0,
  ok: 0,       // 2xx
  bad4xx: 0,
  bad5xx: 0,
  samples: [], // [{ ts, total, ok, bad4xx, bad5xx }]（每 10s 采样）
};
const _startedAt = Date.now();
let _lastReqSample = Date.now();

// ====== 在线会话（v1.05 修复：不能拿 lastTick 判在线） ======
// 背景：挂机循环每 5s 给"所有角色"更新 lastTick，用它判在线会把全服都算成在线。
// 正确口径：玩家登录后，其发起的每个受保护请求都会刷新 lastSeen（markActive）；
//   超过 ONLINE_WINDOW_MS 无活动即视为离线。前端挂着游戏页面（10s 轮询）会持续在线，
//   关闭页面 5 分钟后自动掉线。
const _active = new Map(); // username -> lastSeenMs

function markActive(username) {
  if (!username || typeof username !== 'string') return;
  _active.set(username, Date.now());
}

function clearActive(username) {
  if (username) _active.delete(username);
}

// 取当前在线（5 分钟内有活动）的账号列表，供挂机循环只结算在线玩家
function getActiveUsernames() {
  _pruneActive();
  return [..._active.keys()];
}

// 单用户是否在线（供 GM 玩家检索显示状态）
function isActive(username) {
  _pruneActive();
  return _active.has(username);
}

function _pruneActive() {
  const now = Date.now();
  for (const [u, t] of _active) {
    if (now - t > ONLINE_WINDOW_MS) _active.delete(u);
  }
}

// ====== idle 循环耗时 ======
function recordIdleLoop(ms) {
  const s = { ts: Date.now(), ms: Math.round(ms) };
  _idleSamples.push(s);
  if (_idleSamples.length > SAMPLE_MAX) _idleSamples.shift();
  return s;
}

// ====== 请求统计 ======
function recordRequest(status, durationMs) {
  _req.total += 1;
  if (status >= 500) _req.bad5xx += 1;
  else if (status >= 400) _req.bad4xx += 1;
  else _req.ok += 1;

  // 每 10 秒落一个采样点
  const now = Date.now();
  if (now - _lastReqSample >= 10000) {
    _req.samples.push({ ts: now, total: _req.total, ok: _req.ok, bad4xx: _req.bad4xx, bad5xx: _req.bad5xx });
    if (_req.samples.length > SAMPLE_MAX) _req.samples.shift();
    _lastReqSample = now;
  }
}

// ====== 读取统计（供 routes/admin.js 汇总） ======
function _idleStats() {
  if (_idleSamples.length === 0) {
    return { lastMs: 0, avgMs: 0, maxMs: 0, samples: [] };
  }
  let sum = 0, max = 0;
  for (const s of _idleSamples) {
    sum += s.ms;
    if (s.ms > max) max = s.ms;
  }
  const recent = _idleSamples.slice(-20).map((s) => ({ ts: s.ts, ms: s.ms }));
  return { lastMs: _idleSamples[_idleSamples.length - 1].ms, avgMs: Math.round(sum / _idleSamples.length), maxMs: max, samples: recent };
}

function _reqStats() {
  const now = Date.now();
  const uptimeMin = Math.max(1, (now - _startedAt) / 60000);
  const err4 = _req.total > 0 ? +((_req.bad4xx / _req.total) * 100).toFixed(2) : 0;
  const err5 = _req.total > 0 ? +((_req.bad5xx / _req.total) * 100).toFixed(2) : 0;
  const recent = _req.samples.slice(-20).map((s, i, arr) => {
    const prev = arr[i - 1];
    const delta = prev ? s.total - prev.total : s.total;
    return { ts: s.ts, perMinute: Math.round((delta / 10) * 60), ok: s.ok, bad4xx: s.bad4xx, bad5xx: s.bad5xx };
  });
  return {
    total: _req.total,
    ok: _req.ok,
    bad4xx: _req.bad4xx,
    bad5xx: _req.bad5xx,
    error4xxPct: err4,
    error5xxPct: err5,
    perMinute: Math.round((_req.total / uptimeMin)),
    samples: recent,
  };
}

function onlineCount() {
  _pruneActive();
  return _active.size;
}

function dbSizeBytes(store) {
  try {
    const dbPath = typeof store.__dbPath === 'function' ? store.__dbPath() : null;
    if (dbPath && fs.existsSync(dbPath)) return fs.statSync(dbPath).size;
  } catch (_) {}
  return 0;
}

function getOverview(store) {
  const mem = process.memoryUsage();
  const heapTotalMB = +(mem.heapTotal / 1024 / 1024).toFixed(2);
  const heapUsedMB = +(mem.heapUsed / 1024 / 1024).toFixed(2);
  // 真实上限：V8 的 heap_size_limit（64 位 Node 通常 ~2GB）。占用率用它当分母，
  //   而不是 heapTotal（heapTotal 是 V8 动态扩容的"当前已分配块"，用它算会虚高）。
  const heapLimitMB = Math.round(require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024);
  const heapPct = heapLimitMB > 0 ? +((mem.heapUsed / (heapLimitMB * 1024 * 1024)) * 100).toFixed(2) : 0;
  // 系统内存：RSS 相对整机物理内存的占比（进程真实占用的"软上限"参考）
  const sysTotalMB = Math.round(os.totalmem() / 1024 / 1024);
  const sysFreeMB = Math.round(os.freemem() / 1024 / 1024);
  const rssMB = +(mem.rss / 1024 / 1024).toFixed(2);
  const rssPct = sysTotalMB > 0 ? +((rssMB / sysTotalMB) * 100).toFixed(1) : 0;

  let playerCount = 0;
  let viewCache = null;
  let arenaBotsCache = null;
  try { playerCount = store.getAllPlayers().length; } catch (_) {}
  try { if (typeof store.viewCacheStats === 'function') viewCache = store.viewCacheStats(); } catch (_) {}
  try { if (typeof store.arenaBotsCacheStats === 'function') arenaBotsCache = store.arenaBotsCacheStats(); } catch (_) {}

  return {
    server: {
      startedAt: _startedAt,
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      pid: process.pid,
    },
    memory: { heapUsedMB, heapTotalMB, rssMB, heapPct, heapLimitMB, sysTotalMB, sysFreeMB, rssPct },
    players: {
      total: playerCount,
      online: onlineCount(),
      onlineWindowMs: ONLINE_WINDOW_MS,
    },
    store: {
      dbSizeMB: +(dbSizeBytes(store) / 1024 / 1024).toFixed(2),
      viewCache,
      arenaBotsCache,
    },
    idle: _idleStats(),
    requests: _reqStats(),
    ts: Date.now(),
  };
}

module.exports = {
  recordIdleLoop,
  recordRequest,
  getOverview,
  onlineCount,
  markActive,
  clearActive,
  getActiveUsernames,
  isActive,
  _startedAt,
};
