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
const _arenaBotsCache = new Map(); // username -> { time, bots }
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
  console.log(`[store-sqlite] 已加载 ${Object.keys(data.accounts).length} 个账号, ${Object.keys(data.players).length} 个角色`);
}

let _lastBakAt = 0;

function _persistNowAsync(epochAt) {
  return new Promise((resolve, reject) => {
    if (!_db) return reject(new Error('db not opened'));
    if (typeof epochAt === 'number' && epochAt !== _epoch) return resolve();
    const dbRef = _db;
    const pathOut = DB_PATH;
    const bakOut = BAK_PATH;
    let snapshotStr;
    try {
      try { trimArenaRewards(); } catch(_){}
      try { trimGuilds(); } catch(_){}
      try { trimArenaBots(); } catch(_){}  // v1.03 P0：清理过期 arenaBots 缓存
      snapshotStr = JSON.stringify(data);
    } catch (e) { return reject(e); }
    try {
      _rowPut(dbRef, 'snapshot', snapshotStr);
      const bytes = Buffer.from(dbRef.export());
      const tmpPath = pathOut + '.tmp';
      fs.writeFile(tmpPath, bytes, (err) => {
        if (err) return reject(err);
        if (typeof epochAt === 'number' && epochAt !== _epoch) {
          try { fs.unlinkSync(tmpPath); } catch(_) {}
          return resolve();
        }
        const nowMs = _getNow();
        const shouldBak = !fs.existsSync(bakOut) || (nowMs - _lastBakAt > 60 * 60 * 1000);
        const doRename = () => {
          fs.rename(tmpPath, pathOut, (rErr) => {
            if (rErr) return reject(rErr);
            _lastSaveError = null;
            resolve();
          });
        };
        if (shouldBak && fs.existsSync(pathOut)) {
          fs.copyFile(pathOut, bakOut, (cErr) => {
            if (cErr) {
              console.error('[store-sqlite] .bak 备份失败（继续）:', cErr.message);
              return doRename();
            }
            _lastBakAt = nowMs;
            doRename();
          });
        } else {
          doRename();
        }
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

function withTransaction(fn) {
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
    _persistNowAsync(epochAt).then(() => {
      _lastSaveError = null;
    }).catch((e) => {
      if (epochAt !== _epoch) return;
      restore(snap);
      _lastSaveError = { at: _getNow(), message: e.message, path: DB_PATH };
      console.error('[store-sqlite] 事务落盘失败，已回滚:', e.message);
    });
    return ret;
  } else {
    restore(snap);
    return ret;
  }
}

function getAccount(username) { return data.accounts[username]; }
function setAccount(username, account) { data.accounts[username] = account; markDirty(); }
function accountExists(username) { return !!data.accounts[username]; }

function getPlayer(username) { return data.players[username]; }
function setPlayer(username, player) { data.players[username] = player; markDirty(); }
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
};