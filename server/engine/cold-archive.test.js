// ====== v1.03 冷数据归档测试 ======
// 覆盖：日志裁剪 + 磁盘归档 / fullResult 24h 剥离 / 重放分支 410 / pvpRecords 清理
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cold-'));
process.env.DB_ENGINE = 'json';
process.env.DB_PATH = path.join(TMP, 'db.json');

// 清 require 缓存，确保测试用独立 store 实例
['../store', '../store-json', '../store-sqlite'].forEach(p => { try { delete require.cache[require.resolve(p)]; } catch (_) {} });

const cold = require('../engine/cold-archive');

// 测试用归档目录（避免污染真实 logs-archive/）
const TEST_ARCHIVE_DIR = path.join(TMP, 'logs-archive');
cold.__setArchiveDir(TEST_ARCHIVE_DIR);

function makePlayer(over = {}) {
  return {
    username: 'tester', name: 'Tester', logs: [], settlementLedger: [],
    ...over,
  };
}

describe('cold-archive.trimPlayerLogs 日志裁剪 + 磁盘归档', () => {
  it('超过 10 条 → 裁到 10 条，被裁的写入磁盘归档', () => {
    const logs = Array.from({ length: 25 }, (_, i) => ({ time: i, type: 'battle', text: `log-${i}` }));
    const p = makePlayer({ logs });
    const removed = cold.trimPlayerLogs(p, 10);
    assert.equal(removed, 15);
    assert.equal(p.logs.length, 10);
    assert.equal(p.logs[0].text, 'log-15', '保留最近的 10 条');
    assert.equal(p.logs[9].text, 'log-24');
    // 归档文件写入测试目录（15 行），真实 logs-archive/ 不被污染
    const archivedFile = path.join(TEST_ARCHIVE_DIR, 'tester.jsonl');
    assert.ok(fs.existsSync(archivedFile), '磁盘归档文件已生成');
    const lines = fs.readFileSync(archivedFile, 'utf8').trim().split('\n');
    assert.equal(lines.length, 15, '被裁的 15 条全部落盘');
    assert.equal(JSON.parse(lines[0]).text, 'log-0', '最旧的在最前');
  });

  it('不足 10 条 → 不动', () => {
    const p = makePlayer({ logs: [{ time: 1, type: 'x', text: 'a' }] });
    assert.equal(cold.trimPlayerLogs(p, 10), 0);
    assert.equal(p.logs.length, 1);
  });

  it('无 logs 字段（老存档）→ 安全跳过', () => {
    const p = { username: 'old', settlementLedger: [] };
    assert.equal(cold.trimPlayerLogs(p, 10), 0);
  });

  it('不传 keep → 默认 PLAYER_LOG_KEEP=10', () => {
    const logs = Array.from({ length: 12 }, (_, i) => ({ time: i, type: 'battle', text: `L${i}` }));
    const p = makePlayer({ logs });
    assert.equal(cold.trimPlayerLogs(p), 2); // 12 - 10 = 2
    assert.equal(p.logs.length, 10);
  });
});

describe('cold-archive.stripLedgerFullResults 明细剥离', () => {
  const NOW = 1_000_000_000_000;
  const TTL = cold.FULLRESULT_TTL_MS; // 24h

  it('超 24h 的 fullResult → 置 null + archived 标记，凭据字段保留', () => {
    const p = makePlayer({
      settlementLedger: [
        { id: 'old1', at: NOW - TTL - 1000, type: 'pvp_challenge', reward: { gold: 1 }, source: 's', fullResult: { battle: {} }, requestContext: { username: 'tester' } },
        { id: 'new1', at: NOW - 1000, type: 'pvp_challenge', reward: { gold: 2 }, source: 's', fullResult: { battle: {} } },
      ],
    });
    const n = cold.stripLedgerFullResults(p, NOW);
    assert.equal(n, 1);
    assert.equal(p.settlementLedger[0].fullResult, null, '旧的明细剥离');
    assert.equal(p.settlementLedger[0].archived, true, '归档标记');
    assert.equal(p.settlementLedger[0].id, 'old1', '防重放凭据保留');
    assert.equal(p.settlementLedger[0].reward.gold, 1, '奖励字段保留');
    assert.ok(p.settlementLedger[1].fullResult, '24h 内的明细保留');
  });

  it('无 fullResult / 无 at 字段 → 安全跳过', () => {
    const p = makePlayer({
      settlementLedger: [
        { id: 'x1', at: NOW - TTL - 5000, type: 'boss_participation', reward: {}, source: 's' }, // 本来就没明细
        { id: 'x2', type: 't', fullResult: {} }, // 缺 at
      ],
    });
    assert.equal(cold.stripLedgerFullResults(p, NOW), 0);
    assert.ok(p.settlementLedger[1].fullResult, '缺 at 不动');
  });

  it('空 ledger / 非 ledger → 返回 0 不抛错', () => {
    assert.equal(cold.stripLedgerFullResults(makePlayer(), NOW), 0);
    assert.equal(cold.stripLedgerFullResults(null, NOW), 0);
    assert.equal(cold.stripLedgerFullResults({ settlementLedger: 'oops' }, NOW), 0);
  });
});

describe('cold-archive.stripPvpRecordsFullResults', () => {
  const NOW = 1_000_000_000_000;
  const TTL = cold.FULLRESULT_TTL_MS;

  it('超 24h 的记录明细剥离，轻字段保留（战报列表仍可用）', () => {
    const meta = {
      pvpRecords: [
        { id: 'r1', time: NOW - TTL - 1, attacker: 'a', defender: 'b', result: 'win', ratingChange: 12, rewards: { coins: 10 }, fullResult: { battle: { rounds: new Array(5000) } } },
        { id: 'r2', time: NOW - 100, attacker: 'a', defender: 'b', result: 'lose', ratingChange: -8, fullResult: { battle: {} } },
      ],
    };
    const n = cold.stripPvpRecordsFullResults(meta, NOW);
    assert.equal(n, 1);
    assert.equal(meta.pvpRecords[0].fullResult, null);
    assert.equal(meta.pvpRecords[0].attacker, 'a', '战报列表字段保留');
    assert.equal(meta.pvpRecords[0].ratingChange, 12);
    assert.ok(meta.pvpRecords[1].fullResult);
  });

  it('meta 无 pvpRecords → 0', () => {
    assert.equal(cold.stripPvpRecordsFullResults({}, NOW), 0);
    assert.equal(cold.stripPvpRecordsFullResults(null, NOW), 0);
  });
});

describe('cold-archive.runColdDataSweep 集成', () => {
  it('完整清扫：日志 + ledger + pvpRecords，且幂等（第二次跑返回 0）', () => {
    const NOW = Date.now();
    const store = require('../store');
    store.__setDisableSave(true);
    store.__resetStore();
    const data = store.__getRawData();
    data.players = {
      p1: makePlayer({
        logs: Array.from({ length: 20 }, (_, i) => ({ time: i, type: 'battle', text: `p1-log-${i}` })),
        settlementLedger: [
          { id: 'old', at: NOW - 25 * 3600 * 1000, type: 'expedition', reward: {}, source: 's', fullResult: { big: 'x'.repeat(1000) } },
          { id: 'new', at: NOW - 1000, type: 'expedition', reward: {}, source: 's', fullResult: { ok: 1 } },
        ],
      }),
    };
    data.meta = {
      pvpRecords: [{ id: 'r1', time: NOW - 48 * 3600 * 1000, attacker: 'a', defender: 'b', result: 'win', ratingChange: 5, rewards: {}, fullResult: { big: 'y'.repeat(1000) } }],
    };

    const r1 = cold.runColdDataSweep(store);
    assert.equal(r1.trimmedLogs, 10, 'p1 裁掉 10 条日志');
    assert.equal(r1.strippedLedger, 1);
    assert.equal(r1.strippedRecords, 1);
    assert.equal(data.players.p1.logs.length, 10);
    assert.equal(data.players.p1.settlementLedger[0].fullResult, null);
    assert.ok(data.players.p1.settlementLedger[1].fullResult, '24h 内保留');

    // 幂等
    const r2 = cold.runColdDataSweep(store);
    assert.equal(r2.trimmedLogs + r2.strippedLedger + r2.strippedRecords, 0, '第二次清扫无事可做');
    store.__setDisableSave(false);
  });
});

describe('归档后重放分支（410）', () => {
  it('expedition claimExpedition：已归档 → code 410', () => {
    // 直接验证模块逻辑：fullResult=null 时 claimExpedition 返回 410
    const exp = require('../engine/expedition');
    const p = makePlayer({
      expedition: { id: 'e1', events: [], startAt: 0, baseEndAt: 0, appliedTimeDelta: 0 },
      settlementLedger: [
        { id: 'expedition:e1', at: 1, type: 'expedition', reward: {}, source: 's', fullResult: null, archived: true },
      ],
    });
    const r = exp.claimExpedition(p, 'e1');
    assert.equal(r.success, false);
    assert.equal(r.code, 410, '已归档应返回 410 而非 500');
  });
});

// 清理测试归档目录
after(() => {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
  delete process.env.DB_ENGINE;
  delete process.env.DB_PATH;
});
