// ====== SQLite (WAL) 存储后端 · v1.03 · 2026-08-31 ======
// 与 store.js 同名 API（load/save/safeSave/withTransaction/snapshot/restore/
//   getLastSaveError/clearLastSaveError/cancelSaveTimer/getAccount/setAccount/
//   accountExists/getPlayer/setPlayer/getAllPlayers/getMeta/setMeta/
//   __setDisableSave/__setDbPath/__resetStore/__getRawData）
// 关键设计：
//   1. 内存镜像：data = {accounts,players,meta} 仍存内存（路由直接读写）
//   2. 启动时 load() 从 SQLite 把单表 snapshot 反序列化进内存
//   3. save() 把内存整体 JSON.stringify 写入 SQLite 单行（PRAGMA journal_mode=WAL）
//   4. fs.writeFile 改为异步（不阻塞 Node 主线程）+ 写完后立即 checkpoint 清理 WAL
//   5. snapshot()/restore() 用深拷贝（避免事务回滚时对象引用污染）
//   6. __getRawData() 返回 data 本身（与旧 store.js 行为一致，guild.test 等依赖它）
//   7. withTransaction() 语义：进入时深拷贝快照，回调可修改 data；返回非 200
//      或抛异常时回滚（恢复快照），否则 markDirty 等下一次 save() 自动落盘
//
// 使用 sql.js（纯 WASM，无原生编译）+ 自行管理 *.db-wal/*.db-shm 影子文件
//
// 环境变量：
//   DB_ENGINE=sqlite   强制使用 SQLite（store.js 默认会自动检测 db.sqlite 文件）
//   DB_PATH            存档根路径（不带后缀），最终落盘为 `${DB_PATH}.sqlite`

const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const initSqlJs = require('sql.js');

let _getNow = () => Date.now();
try { _getNow = require('./engine/state').getNow; } catch (_) {}

let DB_ROOT = (process.env.DB_PATH || path.join(__dirname, 'db')).replace(/\.(json|sqlite)$/i, '');
let DB_PATH = `${DB_ROOT}.sqlite`;
let BAK_PATH = `${DB_ROOT}.sqlite.bak`;

let data = { accounts: {}, players: {}, meta: {} };

// v1.03 内存优化：arenaBots 缓存从 store meta 搬到进程内存
//   修复前：meta.arenaBots 随每次 safeSave 整体序列化进 SQLite（500KB-2MB 永久驻留）
//   修复后：纯进程内存 Map，TTL 过期删除，硬上限 200 LRU 淘汰
//           不参与序列化（safeSave 跳过），不参与 SQLite 落盘
// v1.04 性能修复：事务成功后的去抖落盘窗口（ms）
//   旧逻辑每个写事务都立即全量落盘（~1.3s 同步阻塞）；新逻辑 2s 窗口内合并。
const TX_SAVE_DEBOUNCE_MS = 2000;
const _arenaBotsCache = new Map(); // username -> { time, bots }
// v1.03 杠杆 4：view 缓存（按 player.lastTick 失效）
//   写 player 时 invalidate；GET /view-light 时命中缓存则跳过 withTransaction + getPlayerView
const { invalidatePlayerView, invalidateAllViews, getViewCacheStats } = require('./middleware/view-cache');
const _arenaBotsCacheState = { hits: 0, misses: 0, evictions: 0 };
const _arenaBotsCache_TTL_MS = 10 * 60 * 1000;
const _arenaBotsCache_MAX = 200;
function arenaBotsCacheGet(username) {
  const v = _arenaBotsCache.get(username);
  if (!v) { _arenaBotsCacheState.misses++; return null; }
  if ((Date.now() - v.time) > _arenaBotsCache_TTL_MS) {
    _arenaBotsCache.delete(username);
    _arenaBotsCacheState.misses++;
    return null;
  }
  _arenaBotsCacheState.hits++;
  return v;
}
function arenaBotsCacheSet(username, entry) {
  _arenaBotsCache.set(username, entry);
  // 硬上限 LRU 淘汰
  while (_arenaBotsCache.size > _arenaBotsCache_MAX) {
    const firstKey = _arenaBotsCache.keys().next().value;
    if (firstKey === undefined) break;
    _arenaBotsCache.delete(firstKey);
    _arenaBotsCacheState.evictions++;
  }
}
function arenaBotsCacheDelete(username) { _arenaBotsCache.delete(username); }
function arenaBotsCacheClear() { _arenaBotsCache.clear(); }
function arenaBotsCacheStats() {
  return {
    size: _arenaBotsCache.size,
    max: _arenaBotsCache_MAX,
    hits: _arenaBotsCacheState.hits,
    misses: _arenaBotsCacheState.misses,
    evictions: _arenaBotsCacheState.evictions,
  };
}
let _SQL = null;
let _db = null;
let _lastSaveError = null;
let _saveInFlight = false;
let _pendingSave = false;
let _disableSave = false;
let _dirty = false;
let _epoch = 0;
// v1.04 性能修复：事务成功后的去抖落盘定时器（2s 合并突发写，替代事务内立即全量落盘）
let _txSaveTimer = null;
// v1.04 worker 落盘：持久化 worker + 请求表（把 SQLite export/写文件移出主线程）
let _persistWorker = null;
let _persistReqId = 0;
const _persistPending = new Map(); // reqId -> { resolve, reject }

function __setDisableSave(v) {
  _disableSave = !!v;
}
function __setDbPath(p) {
  const root = String(p || '').replace(/\.(json|sqlite)$/i, '');
  if (root !== DB_ROOT) {
    DB_ROOT = root;
    DB_PATH = `${DB_ROOT}.sqlite`;
    BAK_PATH = `${DB_ROOT}.sqlite.bak`;
    if (_db) { try { _db.close(); } catch (_) {} _db = null; }
    _epoch++; // 让 in-flight 写盘作废
  }
}
function __resetStore() {
  data = { accounts: {}, players: {}, meta: {} };
  _lastSaveError = null;
  _saveInFlight = false;
  _pendingSave = false;
  _disableSave = false;
  _dirty = false;
  _epoch++; // 让任何 in-flight 写盘作废
  if (_txSaveTimer) { clearTimeout(_txSaveTimer); _txSaveTimer = null; } // v1.04：清去抖定时器
  // v1.03：清内存 arenaBots 缓存（测试隔离）
  _arenaBotsCache.clear();
  _arenaBotsCacheState.hits = 0;
  _arenaBotsCacheState.misses = 0;
  _arenaBotsCacheState.evictions = 0;
}
function isPlainObject(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }
function snapshot() { return JSON.stringify(data); }
function restore(s) {
  try {
    const obj = JSON.parse(s);
    if (isPlainObject(obj) && isPlainObject(obj.accounts) && isPlainObject(obj.players) && isPlainObject(obj.meta)) {
      data = obj;
    } else {
      data = { accounts: {}, players: {}, meta: {} };
    }
  } catch (_) {
    data = { accounts: {}, players: {}, meta: {} };
  }
}
function getLastSaveError() { return _lastSaveError; }
function clearLastSaveError() { _lastSaveError = null; }
function cancelSaveTimer() { /* 异步落盘没有 timer */ }

function _ensureDefaults() {
  if (!isPlainObject(data.accounts)) data.accounts = {};
  if (!isPlainObject(data.players)) data.players = {};
  if (!isPlainObject(data.meta)) data.meta = {};
  if (!data.meta.bossWeek) data.meta.bossWeek = null;
  if (!data.meta.arenaRewards) data.meta.arenaRewards = { daily:{}, weekly:{}, monthly:{} };
  if (!data.meta.arenaCursors) data.meta.arenaCursors = null;
  if (!data.meta.arenaSkipped) data.meta.arenaSkipped = { daily:{}, weekly:{}, monthly:{} };
  if (!isPlainObject(data.meta.guilds)) data.meta.guilds = {};
  if (!isPlainObject(data.meta.guildNameIndex)) data.meta.guildNameIndex = {};
  if (!isPlainObject(data.meta.guildArchive)) data.meta.guildArchive = {};
  // v1.07：服务器全局设置（后台「服务器设置」页读写；expMultiplier/goldMultiplier 倍率，maxLevel/maxGold 全服数值上限，0 = 不限）
  if (!isPlainObject(data.meta.serverConfig)) data.meta.serverConfig = { expMultiplier: 1, goldMultiplier: 1, maxLevel: 0, maxGold: 0, updatedAt: 0, updatedBy: '' };
  try {
    data.meta.guildNameIndex = {};
    for (const [gid, g] of Object.entries(data.meta.guilds)) {
      if (g && typeof g.name === 'string') data.meta.guildNameIndex[g.name.trim().toLowerCase()] = gid;
    }
  } catch (_) {}
  try { trimGuilds(); } catch (_) {}
  const playerKeys = Object.keys(data.players);
  if (playerKeys.length > 0 && Object.keys(data.accounts).length === 0) {
    for (const key of playerKeys) {
      data.accounts[key] = { username: key, password: '', hasCharacter: true, createdAt: _getNow() };
    }
  }
  try { trimArenaRewards(); } catch (_) {}
}

function trimGuilds() {
  const gs = data.meta && data.meta.guilds;
  if (!isPlainObject(gs)) return;
  const ga = data.meta.guildArchive;
  if (isPlainObject(ga)) {
    const keys = Object.keys(ga);
    if (keys.length > 50) {
      keys.sort((a,b)=> (ga[a].disbandedAt||0)-(ga[b].disbandedAt||0));
      for (let i=0;i<keys.length-50;i++) delete ga[keys[i]];
    }
  }
  for (const g of Object.values(gs)) {
    if (!g || !Array.isArray(g.logs)) continue;
    if (g.logs.length > 30) g.logs.splice(0, g.logs.length-30);
    if (g.members && g.members.length > 40) g.members.splice(40);
  }
}
function trimArenaRewards() {
  const ar = data.meta && data.meta.arenaRewards;
  if (!isPlainObject(ar)) return;
  const limits = { daily:30, weekly:12, monthly:12 };
  for (const period of ['daily','weekly','monthly']) {
    const map = ar[period];
    if (!isPlainObject(map)) continue;
    const keys = Object.keys(map).sort();
    const limit = limits[period];
    if (keys.length > limit) {
      for (let i=0;i<keys.length-limit;i++) delete map[keys[i]];
    }
  }
  const sk = data.meta.arenaSkipped;
  if (isPlainObject(sk)) {
    for (const period of ['daily','weekly','monthly']) {
      const m = sk[period];
      if (!isPlainObject(m)) continue;
      const keys = Object.keys(m).sort();
      const limit = limits[period];
      if (keys.length > limit) {
        for (let i=0;i<keys.length-limit;i++) delete m[keys[i]];
      }
    }
  }
}
// v1.03 内存优化：trimArenaBots 改为清理进程内存缓存（不再动 meta）
//   arenaBots 已搬到 _arenaBotsCache（纯进程内存）
//   每次 _persistNowAsync 落盘前 trim 过期 + LRU 淘汰（防冷用户条目永久驻留）
function trimArenaBots() {
  const now = Date.now();
  // 1) 删除过期 entries
  for (const [k, v] of _arenaBotsCache) {
    if (!v || typeof v.time !== 'number' || (now - v.time) > _arenaBotsCache_TTL_MS) {
      _arenaBotsCache.delete(k);
    }
  }
  // 2) 超过硬上限按插入顺序淘汰最老的（Map 头部）
  while (_arenaBotsCache.size > _arenaBotsCache_MAX) {
    const firstKey = _arenaBotsCache.keys().next().value;
    if (firstKey === undefined) break;
    _arenaBotsCache.delete(firstKey);
    _arenaBotsCacheState.evictions++;
  }
}

async function _openDb() {
  if (_db) return _db;
  if (!_SQL) {
    _SQL = await initSqlJs({
      locateFile: (file) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
    });
  }
  let bytes = null;
  if (fs.existsSync(DB_PATH)) {
    try {
      bytes = fs.readFileSync(DB_PATH);
    } catch (e) {
      console.error('[store-sqlite] 读取主存档失败:', e.message);
    }
    if (!bytes && fs.existsSync(BAK_PATH)) {
      try {
        console.error('[store-sqlite] 从 .bak 恢复');
        bytes = fs.readFileSync(BAK_PATH);
      } catch (e2) {
        console.error('[store-sqlite] .bak 也损坏，使用空库启动:', e2.message);
      }
    }
  }
  if (bytes) {
    try {
      _db = new _SQL.Database(bytes);
    } catch (e) {
      console.error('[store-sqlite] Database 初始化失败，使用空库:', e.message);
      _db = new _SQL.Database();
    }
  } else {
    _db = new _SQL.Database();
  }
  _db.run(`PRAGMA journal_mode = WAL;`);
  _db.run(`PRAGMA synchronous = NORMAL;`);
  _db.run(`PRAGMA temp_store = MEMORY;`);
  _db.run(`
    CREATE TABLE IF NOT EXISTS kv_state (
      k TEXT PRIMARY KEY,
      v TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  return _db;
}

function _rowGet(db, key) {
  const stmt = db.prepare('SELECT v FROM kv_state WHERE k = ?');
  try {
    stmt.bind([key]);
    if (stmt.step()) return stmt.getAsObject().v;
    return null;
  } finally { stmt.free(); }
}

function _rowPut(db, key, value) {
  const stmt = db.prepare(`
    INSERT INTO kv_state (k, v, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at
  `);
  try {
    stmt.run([key, value, _getNow()]);
  } finally { stmt.free(); }
}

async function load() {
  if (!_db) await _openDb();
  const raw = _rowGet(_db, 'snapshot');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (isPlainObject(parsed) && isPlainObject(parsed.accounts) && isPlainObject(parsed.players) && isPlainObject(parsed.meta)) {
        data = parsed;
      }
    } catch (e) {
      console.error('[store-sqlite] snapshot 反序列化失败:', e.message);
    }
  }
  _ensureDefaults();
  // v1.03 内存优化：把老存档的 meta.arenaBots 搬到进程内存缓存（兼容旧存档）
  //   然后从 meta 中删除，下次 save() 起不再序列化
  if (data.meta && data.meta.arenaBots) {
    const old = data.meta.arenaBots;
    for (const [u, v] of Object.entries(old)) {
      if (v && typeof v.time === 'number') _arenaBotsCache.set(u, v);
    }
    delete data.meta.arenaBots;
    console.log(`[store-sqlite] 已把 ${Object.keys(old).length} 个旧 arenaBots 搬到进程内存缓存`);
  }
  // v1.04 性能修复：pvpRecords 不再存 fullResult（客户端 PvPRecords.vue 只读轻字段
  //   attackerName/defenderName/result/ratingChange/rewards/isBot；重放凭据在
  //   settlementLedger 里，防重放四态判别的 1b 分支对 fullResult=null 返回 410 已归档）。
  //   实测 200 条 × ~65KB = 13.16MB，占全量序列化的 40%。启动时一次性剥离存量。
  if (data.meta && Array.isArray(data.meta.pvpRecords)) {
    let stripped = 0;
    for (const r of data.meta.pvpRecords) {
      if (r && r.fullResult) { r.fullResult = null; r.archived = true; stripped++; }
    }
    if (stripped > 0) console.log(`[store-sqlite] 已剥离 ${stripped} 条 pvpRecords.fullResult（客户端不读，纯序列化浪费）`);
  }
  _ensurePersistWorker(); // v1.04：预热持久化 worker（load 阶段并行加载 sql.js，避免首次写盘延迟）
  console.log(`[store-sqlite] 已加载 ${Object.keys(data.accounts).length} 个账号, ${Object.keys(data.players).length} 个角色`);
}

// v1.04 worker 落盘：懒创建持久化 worker（首次落盘时创建）
//   把 SQLite 写入 + export + 写文件移出主线程，主线程只保留 JSON.stringify（约 168ms）。
function _ensurePersistWorker() {
  if (_persistWorker) return _persistWorker;
  const w = new Worker(path.join(__dirname, 'persist-worker.js'));
  w.on('message', (msg) => {
    if (msg && msg.type === 'done') {
      const entry = _persistPending.get(msg.reqId);
      if (!entry) return;
      _persistPending.delete(msg.reqId);
      if (msg.ok) {
        _lastSaveError = null;
        entry.resolve();
      } else {
        entry.reject(new Error(msg.error || '持久化 worker 写盘失败'));
      }
    }
  });
  w.on('error', (e) => {
    for (const [, entry] of _persistPending) entry.reject(e);
    _persistPending.clear();
    _persistWorker = null;
  });
  w.on('exit', () => {
    for (const [, entry] of _persistPending) entry.reject(new Error('持久化 worker 已退出'));
    _persistPending.clear();
    _persistWorker = null;
  });
  _persistWorker = w;
  w.unref(); // 让 worker 不阻止主进程退出（否则 test/无监听场景会挂起）
  w.postMessage({ type: 'init' });  // 预热 sql.js（load 阶段即可开始加载）
  return w;
}

function _persistNowAsync(epochAt) {
  return new Promise((resolve, reject) => {
    if (typeof epochAt === 'number' && epochAt !== _epoch) return resolve();
    // trim（改主线程 data，须在快照序列化之前）
    try { trimArenaRewards(); } catch(_){}
    try { trimGuilds(); } catch(_){}
    try { trimArenaBots(); } catch(_){}  // v1.03 P0：清理过期 arenaBots 缓存
    let snapshotStr;
    try {
      snapshotStr = JSON.stringify(data);  // 主线程仅剩的同步成本
    } catch (e) { return reject(e); }
    try {
      const w = _ensurePersistWorker();
      const reqId = ++_persistReqId;
      _persistPending.set(reqId, { resolve, reject });
      w.postMessage({
        type: 'persist',
        reqId,
        snapshotStr,
        pathOut: DB_PATH,
        bakOut: BAK_PATH,
        epochAt,
      });
    } catch (e) {
      reject(e);
    }
  });
}

function save() {
  if (_disableSave) return;
  _dirty = false;
  const epochAt = _epoch;
  _persistNowAsync(epochAt).catch((e) => {
    if (epochAt !== _epoch) return;
    _lastSaveError = { at: _getNow(), message: e.message, path: DB_PATH };
    console.error('[store-sqlite] 保存失败:', e.message);
  });
}

function safeSave() {
  if (_saveInFlight) {
    _pendingSave = true;
    return;
  }
  if (_disableSave) return;
  _dirty = false;
  _saveInFlight = true;
  const epochAt = _epoch;
  _persistNowAsync(epochAt).then(() => {
    if (epochAt !== _epoch) { _saveInFlight = false; return; }
    _saveInFlight = false;
    if (_pendingSave) {
      _pendingSave = false;
      _dirty = true;
      safeSave();
    }
  }).catch((e) => {
    _saveInFlight = false;
    if (epochAt !== _epoch) return;
    _lastSaveError = { at: _getNow(), message: e.message, path: DB_PATH };
    console.error('[store-sqlite] safeSave失败:', e.message);
  });
}

function markDirty() {
  _dirty = true;
}

// v1.03 冷数据归档：清扫器修改数据后标记脏 + 尽快落盘（复用 safeSave 防抖逻辑）
function markDirtyForSweep() {
  _dirty = true;
  safeSave();
}

function withTransaction(fn) {
  // v1.04 性能修复：快照仍用 JSON.stringify（回滚保险），但事务成功后不再立即
  //   全量落盘（旧逻辑：snapshot 序列化 320ms + _persistNowAsync 再序列化 320ms +
  //   WASM export ≈ 1.3s 同步阻塞，60 用户在线时事件循环长期被卡 → 页面卡顿）。
  //   新逻辑：成功只标脏 + 2s 去抖合并落盘（突发写合并为一次序列化），
  //   失败/异常仍同步回滚（restore 快照），语义与 store-json.js 一致。
  const snap = snapshot();
  const epochAt = _epoch;
  let ret;
  try {
    ret = fn(data);
  } catch (e) {
    restore(snap);
    return { status: 500, message: e.message || '事务异常' };
  }
  if (!ret || typeof ret.status !== 'number') ret = { status: 500, message: '事务返回非法' };
  if (ret.status >= 200 && ret.status < 300) {
    _dirty = true;
    scheduleTxSave();
    return ret;
  } else {
    restore(snap);
    return ret;
  }
}

// v1.04：事务成功的去抖落盘（2s 窗口合并突发写，最终一致）
//   期间崩溃最多丢 2s 数据（原实现每次事务都全量落盘也不保证崩溃零丢失——
//   _persistNowAsync 本身就是异步链）。部署/停止用 flushPendingWrites() 兜底。
function scheduleTxSave() {
  if (_disableSave) return;
  if (_txSaveTimer) return; // 已有定时器：本窗口内的写已覆盖（data 是同一引用，序列化时自然取最新）
  _txSaveTimer = setTimeout(() => {
    _txSaveTimer = null;
    safeSave();
  }, TX_SAVE_DEBOUNCE_MS);
}

// v1.04：立即落盘未保存的修改（优雅退出 / 部署前调用；返回 Promise）
function flushPendingWrites() {
  if (_txSaveTimer) {
    clearTimeout(_txSaveTimer);
    _txSaveTimer = null;
  }
  return new Promise((resolve) => {
    if (!_dirty && !_saveInFlight) return resolve();
    const epochAt = _epoch;
    _persistNowAsync(epochAt).then(() => resolve()).catch(() => resolve());
  });
}

function getAccount(username) { return data.accounts[username]; }
function setAccount(username, account) { data.accounts[username] = account; markDirty(); }
function accountExists(username) { return !!data.accounts[username]; }

function getPlayer(username) { return data.players[username]; }
function setPlayer(username, player) {
  data.players[username] = player;
  markDirty();
  // v1.03 杠杆 4：写入触发缓存失效
  invalidatePlayerView(username);
}
function getAllPlayers() { return Object.values(data.players); }

function getMeta() { return data.meta; }
function setMeta(meta) { data.meta = meta; markDirty(); }

function __getRawData() { return data; }

module.exports = {
  load,
  save,
  safeSave,
  withTransaction,
  snapshot,
  restore,
  getLastSaveError,
  clearLastSaveError,
  cancelSaveTimer,
  getAccount,
  setAccount,
  accountExists,
  getPlayer,
  setPlayer,
  getAllPlayers,
  getMeta,
  setMeta,
  markDirtyForSweep, // v1.03 冷数据归档清扫用
  flushPendingWrites, // v1.04：优雅退出/部署前落盘未保存修改
  __setDisableSave,
  __setDbPath,
  __resetStore,
  __getRawData,
  __isReady: () => !!_db,
  __dbPath: () => DB_PATH,
  // v1.03：arenaBots 进程内存缓存 API（从 meta 搬出）
  arenaBotsCacheGet,
  arenaBotsCacheSet,
  arenaBotsCacheDelete,
  arenaBotsCacheClear,
  arenaBotsCacheStats,
  // v1.03 杠杆 4：view 缓存 API（按 lastTick 失效）
  viewCacheGet: (username, lastTick) => require('./middleware/view-cache').getCached(username, lastTick),
  viewCacheSet: (username, view, offlineSnapshot, lastTick) => require('./middleware/view-cache').setCached(username, view, offlineSnapshot, lastTick),
  viewCacheInvalidate: invalidatePlayerView,
  viewCacheInvalidateAll: invalidateAllViews,
  viewCacheStats: getViewCacheStats,
};