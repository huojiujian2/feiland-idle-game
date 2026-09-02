// ====== 服务器全局设置（v1.07）======
// 后台「服务器设置」页读写的配置：经验/金币倍率 + 全服数值上限。
// 存储：meta.serverConfig（store-sqlite 顶层 meta 下，事务读写，随存档落盘）。
//
// 设计说明：
//  - 引擎各产出点（idle/player/pvp/worldboss/items）直接 require 本模块读取系数，
//    无 store 引用时（单测等）一律返回默认值（倍率 1、无上限），不影响原逻辑。
//  - 写路径唯一：admin 接口 PUT /api/admin/server-config → store.withTransaction。
//  - 数值合法性由 admin 路由校验，本模块只做读取与兜底。
let _store = null;

/** 启动时由 server/index.js 在 store 就绪后调用 */
function init(store) {
  _store = store;
}

function _num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function getConfig() {
  if (!_store) return null;
  try {
    const meta = _store.getMeta();
    if (!meta || typeof meta.serverConfig !== 'object' || !meta.serverConfig) return null;
    return meta.serverConfig;
  } catch (_) {
    return null;
  }
}

/** 服务器经验倍率（默认 1），产出点乘算用 */
function expMult() {
  const c = getConfig();
  return Math.max(0.1, _num(c && c.expMultiplier, 1));
}

/** 服务器金币倍率（默认 1），产出点乘算用 */
function goldMult() {
  const c = getConfig();
  return Math.max(0.1, _num(c && c.goldMultiplier, 1));
}

/** 全服等级上限（默认 0 = 不限）。达到上限后溢出经验清零 */
function maxLevel() {
  const c = getConfig();
  const n = Math.floor(_num(c && c.maxLevel, 0));
  return n > 0 ? n : 0;
}

/** 全服金币持有上限（默认 0 = 不限） */
function maxGold() {
  const c = getConfig();
  const n = Math.floor(_num(c && c.maxGold, 0));
  return n > 0 ? n : 0;
}

/** 把玩家金币钳到持有上限之下（产出发放后调用） */
function applyGoldCap(player) {
  if (!player) return;
  const cap = maxGold();
  if (cap > 0 && (player.gold || 0) > cap) player.gold = cap;
}

/** 后台 GET 用：返回配置 + 全服数值现状统计（辅助"智能调节"决策） */
function getOverview(store) {
  const players = (store && store.getAllPlayers ? store.getAllPlayers() : []) || [];
  let maxLv = 0, sumLv = 0, totalGold = 0, overGold = 0, overLv = 0;
  for (const p of players) {
    const lv = Number(p.level) || 0;
    const g = Number(p.gold) || 0;
    if (lv > maxLv) maxLv = lv;
    sumLv += lv;
    totalGold += g;
    const c = _store ? getConfig() : null;
    const mLv = _num(c && c.maxLevel, 0);
    const mG = _num(c && c.maxGold, 0);
    if (mLv > 0 && lv >= mLv) overLv++;
    if (mG > 0 && g > mG) overGold++;
  }
  return {
    playerCount: players.length,
    maxLevel: maxLv,
    avgLevel: players.length ? Math.round(sumLv / players.length) : 0,
    totalGold,
    overLevelCap: overLv,
    overGoldCap: overGold,
  };
}

module.exports = { init, expMult, goldMult, maxLevel, maxGold, applyGoldCap, getOverview, getConfig };
