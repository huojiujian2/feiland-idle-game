// ====== 持久化 Worker 线程 · v1.04 ======
// 把「SQLite 写入 + export + 写文件」从主线程移到独立 worker 线程，
// 消除落盘时主线程的同步阻塞（原 ~500ms WASM export 是最大头）。
// 设计要点：
//   1. 主线程只做 JSON.stringify（快照字符串），通过 postMessage 传给 worker
//   2. worker 每次「重建空库 + INSERT 一条 snapshot → export」→ 文件更紧凑
//      （原主线程复用同一个库对象，ON CONFLICT UPDATE 会累积页碎片使文件膨胀到 75MB）
//   3. 写完回传 { type:'done' }，主线程据此 resolve 落盘 Promise
//   4. worker 串行处理消息（onMessage 单线程），天然保证写盘顺序
const { parentPort } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

let SQL = null;
let _sqlPromise = null;
let _lastBakAt = 0;

async function getSQL() {
  if (SQL) return SQL;
  if (!_sqlPromise) {
    _sqlPromise = initSqlJs({
      locateFile: (file) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
    }).then((s) => { SQL = s; return s; });
  }
  return _sqlPromise;
}

function writeSnapshot(msg) {
  const { snapshotStr, pathOut, bakOut, epochAt, reqId } = msg;
  const now = Date.now();

  // 1. 重建空库 + 写入 snapshot（每次新建，天然紧凑，避免历史页碎片膨胀）
  const db = new SQL.Database();
  db.run(`CREATE TABLE kv_state (k TEXT PRIMARY KEY, v TEXT NOT NULL, updated_at INTEGER NOT NULL);`);
  const stmt = db.prepare(`INSERT INTO kv_state (k, v, updated_at) VALUES (?, ?, ?)`);
  stmt.run(['snapshot', snapshotStr, now]);
  stmt.free();

  // 2. 导出（WASM 同步操作，在 worker 线程内不阻塞主线程）
  const bytes = Buffer.from(db.export());
  db.close();

  // 3. 写文件（异步 IO）
  const tmpPath = pathOut + '.tmp';
  fs.writeFile(tmpPath, bytes, (err) => {
    if (err) return parentPort.postMessage({ type: 'done', ok: false, reqId, epochAt, error: String((err && err.message) || err) });

    const doRename = () => {
      fs.rename(tmpPath, pathOut, (e2) => {
        if (e2) return parentPort.postMessage({ type: 'done', ok: false, reqId, epochAt, error: String((e2 && e2.message) || e2) });
        parentPort.postMessage({ type: 'done', ok: true, reqId, epochAt, size: bytes.length });
      });
    };

    // 4. 每小时备份（与原逻辑一致）
    const shouldBak = !fs.existsSync(bakOut) || (now - _lastBakAt > 60 * 60 * 1000);
    if (shouldBak && fs.existsSync(pathOut)) {
      fs.copyFile(pathOut, bakOut, (cErr) => {
        if (cErr) {
          console.error('[persist-worker] .bak 备份失败（继续）:', cErr.message);
          return doRename();
        }
        _lastBakAt = now;
        doRename();
      });
    } else {
      doRename();
    }
  });
}

parentPort.on('message', async (msg) => {
  if (!msg) return;
  if (msg.type === 'init') {
    // 预热：提前加载 sql.js WASM，避免第一次写盘延迟
    try { await getSQL(); parentPort.postMessage({ type: 'ready' }); }
    catch (e) { parentPort.postMessage({ type: 'ready', error: String((e && e.message) || e) }); }
    return;
  }
  if (msg.type === 'persist') {
    try {
      await getSQL();
      writeSnapshot(msg);
    } catch (e) {
      parentPort.postMessage({ type: 'done', ok: false, epochAt: msg.epochAt, error: String((e && e.message) || e) });
    }
  }
});