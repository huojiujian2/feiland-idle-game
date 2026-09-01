// ====== JSON 后端 · v1.03 · 2026-08-31 ======
// 原 store.js 实现整体迁移至此，由 store.js 派发层在 DB_ENGINE=json 或
// 首次启动时加载。后续若 SQLite 稳定可删除此文件。
// 数据存储层 - 账号+角色数据
const fs = require('fs');
const path = require('path');
let _getNow = () => Date.now();
try { _getNow = require('./engine/state').getNow; } catch (_) {}

let DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db.json');
let data = { accounts: {}, players: {}, meta: {} };

// v1.03 内存优化：arenaBots 缓存从 store meta 搬到进程内存
//   修复前：meta.arenaBots 随每次 save 整体序列化进 JSON 文件（500KB-2MB 永久驻留）
//   修复后：纯进程内存 Map，TTL 过期删除，硬上限 200 LRU 淘汰
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

let saveTimer = null;
let _disableSave = false;
let _lastSaveError = null;
function __setDisableSave(v){ _disableSave = v; if(v && saveTimer){ clearTimeout(saveTimer); saveTimer=null; } }
function __setDbPath(p){ DB_PATH = p; }
function __resetStore(){
  data = { accounts: {}, players: {}, meta: {} };
  _lastSaveError = null;
  if(saveTimer){ clearTimeout(saveTimer); saveTimer=null; }
  // v1.03：清内存 arenaBots 缓存（测试隔离）
  _arenaBotsCache.clear();
  _arenaBotsCacheState.hits = 0;
  _arenaBotsCacheState.misses = 0;
  _arenaBotsCacheState.evictions = 0;
}
function isPlainObject(o){ return o !== null && typeof o === 'object' && !Array.isArray(o); }
function snapshot(){ return JSON.stringify(data); }
function restore(s){ try { data = JSON.parse(s); } catch(e){ data = { accounts:{}, players:{}, meta:{} }; } }
function getLastSaveError(){ return _lastSaveError; }
function clearLastSaveError(){ _lastSaveError = null; }
function cancelSaveTimer(){ if(saveTimer){ clearTimeout(saveTimer); saveTimer=null; } }

function isValidRoot(d){
  if (!isPlainObject(d)) return false;
  if (!isPlainObject(d.accounts)) return false;
  if (!isPlainObject(d.players)) return false;
  if (!isPlainObject(d.meta)) return false;
  return true;
}
function load() {
  let loaded = false;
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!isValidRoot(parsed)) throw new Error('逻辑损坏: 根对象非法');
      data = parsed;
      loaded = true;
    }
  } catch (e) {
    console.error('主存档损坏:', e.message);
    const bakPath = DB_PATH + '.bak';
    if (fs.existsSync(bakPath)) {
      try {
        const rawBak = fs.readFileSync(bakPath, 'utf-8');
        const parsedBak = JSON.parse(rawBak);
        if (!isValidRoot(parsedBak)) throw new Error('备份逻辑损坏');
        data = parsedBak;
        console.error('已从备份恢复:', bakPath);
        loaded = true;
      } catch (e2) {
        console.error('备份也损坏，使用空数据启动:', e2.message);
        data = { accounts:{}, players:{}, meta:{} };
      }
    } else {
      console.error('无可用备份，使用空数据启动');
      data = { accounts:{}, players:{}, meta:{} };
    }
  }
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
  // 重建 guildNameIndex
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
  // 修剪 arenaRewards 保留上限 30/12/12（防止无限增长）
  try { trimArenaRewards(); } catch(_){}
  // v1.03 内存优化：把老存档的 meta.arenaBots 搬到进程内存缓存（兼容旧存档）
  if (data.meta && data.meta.arenaBots) {
    const old = data.meta.arenaBots;
    for (const [u, v] of Object.entries(old)) {
      if (v && typeof v.time === 'number') _arenaBotsCache.set(u, v);
    }
    delete data.meta.arenaBots;
    console.log(`已把 ${Object.keys(old).length} 个旧 arenaBots 搬到进程内存缓存`);
  }
  console.log(`已加载 ${Object.keys(data.accounts).length} 个账号, ${Object.keys(data.players).length} 个角色`);
  return Promise.resolve();
}
function trimGuilds(){
  const gs = data.meta && data.meta.guilds;
  if (!isPlainObject(gs)) return;
  const ga = data.meta.guildArchive;
  if (isPlainObject(ga)){
    const keys = Object.keys(ga);
    if (keys.length > 50){
      keys.sort((a,b)=> (ga[a].disbandedAt||0)-(ga[b].disbandedAt||0));
      for(let i=0;i<keys.length-50;i++) delete ga[keys[i]];
    }
  }
  for(const g of Object.values(gs)){
    if (!g || !Array.isArray(g.logs)) continue;
    if (g.logs.length > 30) g.logs.splice(0, g.logs.length-30);
    if (g.members && g.members.length > 40) g.members.splice(40);
  }
}
function trimArenaRewards(){
  const ar = data.meta && data.meta.arenaRewards;
  if (!isPlainObject(ar)) return;
  const limits = { daily:30, weekly:12, monthly:12 };
  for (const period of ['daily','weekly','monthly']){
    const map = ar[period];
    if (!isPlainObject(map)) continue;
    const keys = Object.keys(map).sort();
    const limit = limits[period];
    if (keys.length > limit){
      for(let i=0;i<keys.length-limit;i++) delete map[keys[i]];
    }
  }
  const sk = data.meta.arenaSkipped;
  if (isPlainObject(sk)){
    for(const period of ['daily','weekly','monthly']){
      const m = sk[period];
      if (!isPlainObject(m)) continue;
      const keys = Object.keys(m).sort();
      const limit = limits[period];
      if (keys.length > limit){
        for(let i=0;i<keys.length-limit;i++) delete m[keys[i]];
      }
    }
  }
}
// v1.03 内存优化：trimArenaBots 改为清理进程内存缓存（不再动 meta）
function trimArenaBots() {
  const now = Date.now();
  for (const [k, v] of _arenaBotsCache) {
    if (!v || typeof v.time !== 'number' || (now - v.time) > _arenaBotsCache_TTL_MS) {
      _arenaBotsCache.delete(k);
    }
  }
  while (_arenaBotsCache.size > _arenaBotsCache_MAX) {
    const firstKey = _arenaBotsCache.keys().next().value;
    if (firstKey === undefined) break;
    _arenaBotsCache.delete(firstKey);
    _arenaBotsCacheState.evictions++;
  }
}

function markDirty() {
  if (_disableSave) return;
  if (!saveTimer) {
    saveTimer = setTimeout(() => { safeSave(); }, 5000);
  }
}

let _lastBakAt = 0;
function save() {
  if (_disableSave) return;
  const tmpPath = DB_PATH + '.tmp';
  try {
    trimArenaRewards();
    try { trimGuilds(); } catch(_){}
    try { trimArenaBots(); } catch(_){}  // v1.03 P0：清理过期 arenaBots 缓存
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    const nowMs = _getNow();
    if (fs.existsSync(DB_PATH) && nowMs - _lastBakAt > 60 * 60 * 1000) {
      fs.copyFileSync(DB_PATH, DB_PATH + '.bak');
      _lastBakAt = nowMs;
    }
    fs.renameSync(tmpPath, DB_PATH);
    clearLastSaveError();
  } catch (e) {
    _lastSaveError = { at: _getNow(), message: e.message, path: DB_PATH };
    console.error('保存数据失败:', e.message);
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
    throw e;
  }
}
function safeSave(){
  try { save(); } catch(e){ /* lastSaveError 已记录 */ } finally { saveTimer = null; }
}
function withTransaction(fn){
  const snap = snapshot();
  let ret;
  try { ret = fn(data); } catch(e){ restore(snap); cancelSaveTimer(); return { status:500, message: e.message || '事务异常' }; }
  if (!ret || typeof ret.status !== 'number') ret = { status:500, message:'事务返回非法' };
  if (ret.status >=200 && ret.status <300){
    try { save(); } catch(e){ restore(snap); cancelSaveTimer(); return { status:500, message:'保存失败请重试' }; }
    clearLastSaveError();
    cancelSaveTimer();
    return ret;
  } else {
    restore(snap);
    cancelSaveTimer();
    return ret;
  }
}

// 账号操作
function getAccount(username) { return data.accounts[username]; }
function setAccount(username, account) { data.accounts[username] = account; markDirty(); }
function accountExists(username) { return !!data.accounts[username]; }

// 角色操作
function getPlayer(username) { return data.players[username]; }
// v1.03 杠杆 4：view 缓存（按 player.lastTick 失效）
const { invalidatePlayerView, invalidateAllViews, getViewCacheStats } = require('./middleware/view-cache');
function setPlayer(username, player) {
  data.players[username] = player;
  markDirty();
  invalidatePlayerView(username);
}
function getAllPlayers() { return Object.values(data.players); }

function getMeta() { return data.meta; }
function setMeta(meta) { data.meta = meta; markDirty(); }

// JSON 后端也支持 async load()（load 已返回 Promise.resolve，让 store.js 派发层统一 await）
module.exports = { load, save, safeSave, withTransaction, snapshot, restore, getLastSaveError, clearLastSaveError, cancelSaveTimer, getAccount, setAccount, accountExists, getPlayer, setPlayer, getAllPlayers, getMeta, setMeta, __setDisableSave, __setDbPath, __resetStore, __getRawData: () => data,
  // v1.03：arenaBots 进程内存缓存 API（从 meta 搬出）
  arenaBotsCacheGet, arenaBotsCacheSet, arenaBotsCacheDelete, arenaBotsCacheClear, arenaBotsCacheStats,
  // v1.03 杠杆 4：view 缓存 API
  viewCacheGet: (username, lastTick) => require('./middleware/view-cache').getCached(username, lastTick),
  viewCacheSet: (username, view, offlineSnapshot, lastTick) => require('./middleware/view-cache').setCached(username, view, offlineSnapshot, lastTick),
  viewCacheInvalidate: invalidatePlayerView,
  viewCacheInvalidateAll: invalidateAllViews,
  viewCacheStats: getViewCacheStats,
};