// ====== db.json → db.sqlite 一次性迁移脚本 ======
// 用法：node server/migrate-json-to-sqlite.js [--src db.json] [--dst db.sqlite]
// 幂等：若目标 SQLite 已存在 snapshot 行，则跳过迁移（除非加 --force）

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { src: null, dst: null, force: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--src') out.src = args[++i];
    else if (args[i] === '--dst') out.dst = args[++i];
    else if (args[i] === '--force') out.force = true;
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('用法: node server/migrate-json-to-sqlite.js [--src db.json] [--dst db.sqlite] [--force]');
      process.exit(0);
    }
  }
  return out;
}

async function main() {
  const { src, dst, force } = parseArgs();
  const SRC = src || path.join(__dirname, 'db.json');
  const DST = dst || path.join(__dirname, 'db.sqlite');

  if (!fs.existsSync(SRC)) {
    console.error(`[migrate] 源文件不存在: ${SRC}`);
    console.error('没有 db.json 时无需迁移，直接启动 server 即可。');
    process.exit(1);
  }

  let raw;
  try {
    raw = fs.readFileSync(SRC, 'utf-8');
  } catch (e) {
    console.error(`[migrate] 读取 ${SRC} 失败:`, e.message);
    process.exit(1);
  }

  let snapshot;
  try {
    snapshot = JSON.parse(raw);
  } catch (e) {
    console.error(`[migrate] ${SRC} JSON 解析失败:`, e.message);
    process.exit(1);
  }

  const isValid = snapshot
    && typeof snapshot === 'object'
    && !Array.isArray(snapshot)
    && typeof snapshot.accounts === 'object'
    && snapshot.accounts !== null
    && !Array.isArray(snapshot.accounts)
    && typeof snapshot.players === 'object'
    && snapshot.players !== null
    && !Array.isArray(snapshot.players)
    && typeof snapshot.meta === 'object'
    && snapshot.meta !== null
    && !Array.isArray(snapshot.meta);

  if (!isValid) {
    console.error('[migrate] 源数据不是有效的存档格式（缺 accounts/players/meta）。');
    process.exit(1);
  }

  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
  });

  let db;
  if (fs.existsSync(DST)) {
    const bytes = fs.readFileSync(DST);
    db = new SQL.Database(bytes);
    const stmt = db.prepare('SELECT v FROM kv_state WHERE k = ?');
    stmt.bind(['snapshot']);
    const hasExisting = stmt.step();
    stmt.free();
    if (hasExisting && !force) {
      console.log(`[migrate] 目标 ${DST} 已有 snapshot，跳过迁移（加 --force 覆盖）`);
      process.exit(0);
    }
  } else {
    db = new SQL.Database();
  }

  db.run(`PRAGMA journal_mode = WAL;`);
  db.run(`PRAGMA synchronous = NORMAL;`);
  db.run(`CREATE TABLE IF NOT EXISTS kv_state (
    k TEXT PRIMARY KEY,
    v TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );`);

  const insert = db.prepare(`
    INSERT INTO kv_state (k, v, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at
  `);
  insert.run(['snapshot', JSON.stringify(snapshot), Date.now()]);
  insert.free();

  const bytes = Buffer.from(db.export());
  const tmp = DST + '.tmp';
  fs.writeFileSync(tmp, bytes);
  fs.renameSync(tmp, DST);

  const accounts = Object.keys(snapshot.accounts || {}).length;
  const players = Object.keys(snapshot.players || {}).length;
  console.log(`[migrate] ✅ 迁移完成: ${accounts} 账号, ${players} 角色 → ${DST}`);

  const bak = SRC + '.migrated.bak';
  if (!fs.existsSync(bak)) {
    fs.copyFileSync(SRC, bak);
    console.log(`[migrate] 原文件已备份到 ${bak}`);
  }
  console.log('[migrate] 提示：验证数据正确后可手动删除 ' + + '');
}

main().catch((e) => {
  console.error('[migrate] 异常:', e);
  process.exit(1);
});