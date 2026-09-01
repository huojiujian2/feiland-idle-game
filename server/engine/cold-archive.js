// ====== v1.03 冷数据归档模块 ======
// 目标：把"防重放凭据"和"战斗明细"分离。
//   - ledger 条目：id/type/reward/source 必须长期保留（防重放凭据），fullResult（战斗明细）24h 后归档剥离
//   - pvpRecords：全局战报列表，客户端只读轻字段（attackerName/result/ratingChange/rewards），fullResult 24h 后剥离
//   - 玩家日志：内存保留最近 10 条，被裁剪的追加到磁盘 logs-archive/{username}.jsonl（按需可查，不占内存）
//
// 为什么 24h：防重放窗口。客户端在挑战/PVP 成功后立即拿到 fullResult 展示回放，
//   网络失败重试一般也在几分钟内。24h 足够覆盖"断线重连 + 当天补看"场景。
//
// 归档行为：
//   1. stripLedgerFullResults(player, cutoffMs)：把 at < cutoffMs 的 ledger.fullResult 置 null
//      → 保留 id/at/type/reward/source/requestContext（防重放校验 + 审计），只删大块明细
//   2. stripPvpRecordsFullResults(meta, cutoffMs)：同理处理 meta.pvpRecords
//   3. archivePlayerLogs(player, keep=10)：把 logs 前 (len-keep) 条追加到磁盘归档文件
//   4. runColdDataSweep(store)：定时器入口（每小时跑一次，幂等，可重复执行）
//
// 兼容性：
//   - assertPvpChallengeResult 校验 fullResult.player 需要 username/name/level/pvpStats —— 归档只影响"重放"
//     分支（found.fullResult 为 null 时返回 410 已归档，不再返回 500 数据损坏）
//   - expedition 重放分支同理处理

const fs = require('fs');
const path = require('path');

// 归档目录（默认 server/logs-archive/）。测试用 __setArchiveDir 切到临时目录，避免污染真实归档
let _archiveDir = path.join(__dirname, '..', 'logs-archive');

// v1.03 日志上限：内存只留最近 10 条（原 30 条），旧日志归档到磁盘
const PLAYER_LOG_KEEP = 10;
// v1.03 战斗明细保留窗口：24h 内的 fullResult 保留（重放窗口），更早的剥离
const FULLRESULT_TTL_MS = 24 * 60 * 60 * 1000;

function _ensureArchiveDir() {
  if (!fs.existsSync(_archiveDir)) {
    try { fs.mkdirSync(_archiveDir, { recursive: true }); } catch (_) {}
  }
}

// 追加一行 JSON 到磁盘归档文件（失败静默 —— 归档失败不影响游戏主流程）
function _appendArchiveLine(username, entry) {
  try {
    _ensureArchiveDir();
    const file = path.join(_archiveDir, `${encodeURIComponent(username)}.jsonl`);
    fs.appendFileSync(file, JSON.stringify(entry) + '\n');
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') console.warn('[cold-archive] 日志归档失败:', e.message);
  }
}

// 测试钩子：切换归档目录（仅测试用，生产不调用）
function __setArchiveDir(dir) {
  _archiveDir = dir;
}

// 内存中的玩家日志裁剪：保留最近 keep 条，被裁掉的写磁盘
function trimPlayerLogs(player, keep = PLAYER_LOG_KEEP) {
  if (!player || !Array.isArray(player.logs) || player.logs.length <= keep) return 0;
  const removed = player.logs.slice(0, player.logs.length - keep);
  player.logs = player.logs.slice(-keep);
  for (const e of removed) _appendArchiveLine(player.username, e);
  return removed.length;
}

// 剥离过期 fullResult（返回剥离条数）
function stripLedgerFullResults(player, nowMs, ttlMs = FULLRESULT_TTL_MS) {
  if (!player || !Array.isArray(player.settlementLedger)) return 0;
  let n = 0;
  for (const e of player.settlementLedger) {
    if (e && e.fullResult && typeof e.at === 'number' && (nowMs - e.at) > ttlMs) {
      e.fullResult = null;   // 保留 id/at/type/reward/source/requestContext —— 防重放凭据仍在
      e.archived = true;     // 标记：明细已归档剥离（重放接口见此标记返回 410）
      n++;
    }
  }
  return n;
}

// 剥离 meta.pvpRecords 里过期的 fullResult
function stripPvpRecordsFullResults(meta, nowMs, ttlMs = FULLRESULT_TTL_MS) {
  if (!meta || !Array.isArray(meta.pvpRecords)) return 0;
  let n = 0;
  for (const r of meta.pvpRecords) {
    if (r && r.fullResult && typeof r.time === 'number' && (nowMs - r.time) > ttlMs) {
      r.fullResult = null;
      r.archived = true;
      n++;
    }
  }
  return n;
}

// 定时清扫入口（每小时）：日志裁剪 + fullResult 剥离。
// 直接改 data（挂到下一次 safeSave 自然落盘），不单独触发事务。
function runColdDataSweep(store) {
  const nowMs = Date.now();
  let trimmedLogs = 0, strippedLedger = 0, strippedRecords = 0;
  try {
    const data = store.__getRawData();
    if (!data) return { skipped: true };
    for (const player of Object.values(data.players || {})) {
      trimmedLogs += trimPlayerLogs(player);
      strippedLedger += stripLedgerFullResults(player, nowMs);
    }
    if (data.meta) strippedRecords = stripPvpRecordsFullResults(data.meta, nowMs);
    if (trimmedLogs + strippedLedger + strippedRecords > 0) {
      store.markDirtyForSweep ? store.markDirtyForSweep() : store.safeSave();
    }
  } catch (e) {
    console.error('[cold-archive] sweep 异常:', e.message);
  }
  return { trimmedLogs, strippedLedger, strippedRecords };
}

module.exports = {
  PLAYER_LOG_KEEP,
  FULLRESULT_TTL_MS,
  getArchiveDir: () => _archiveDir, // 生产默认 server/logs-archive/，测试可切换
  __setArchiveDir,
  trimPlayerLogs,
  stripLedgerFullResults,
  stripPvpRecordsFullResults,
  runColdDataSweep,
};
