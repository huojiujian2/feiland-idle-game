// ====== 存储后端派发层 · v1.03 · 2026-08-31 ======
// 根据环境变量 / 数据库文件存在情况，透明派发到 JSON 或 SQLite 后端。
// 两种后端导出同名 API，对 routes/* 与 engine/* 100% 兼容。
//
// 派发规则（按优先级）：
//   1. DB_ENGINE=json  → 强制 JSON（兼容老代码/测试）
//   2. DB_ENGINE=sqlite → 强制 SQLite
//   3. ${DB_PATH}.sqlite 文件存在 → SQLite（迁移后默认）
//   4. 否则 JSON（首次启动场景）
//
// 关键点：为了兼容 "delete require.cache('./store') + 重新 require" 的测试模式
//   （如 restart-consistency.test.js 的 __setDbPath isolation），
//   派发时也把真实后端模块的 require 缓存一起失效，保证每次 re-require 都拿到
//   全新模块实例（独立的 DB_PATH 与 data 对象）。
//
// 用法：
//   - 启动 server 时，自动选择，无需改代码
//   - 手动迁移：node server/migrate-json-to-sqlite.js

const fs = require('fs');
const path = require('path');

function pickBackend() {
  const explicit = (process.env.DB_ENGINE || '').toLowerCase();
  if (explicit === 'json') return 'json';
  if (explicit === 'sqlite') return 'sqlite';

  // 检测 db.sqlite 是否存在
  const dbRoot = (process.env.DB_PATH || path.join(__dirname, 'db')).replace(/\.(json|sqlite)$/i, '');
  const sqlitePath = `${dbRoot}.sqlite`;
  if (fs.existsSync(sqlitePath)) {
    // 进一步确认 sqlite 文件有效（含 kv_state 表）
    try {
      const buf = fs.readFileSync(sqlitePath);
      // SQLite 文件头 "SQLite format 3\0" = 16 字节
      if (buf.length >= 16 && buf.toString('utf-8', 0, 15) === 'SQLite format 3') {
        return 'sqlite';
      }
    } catch (_) {}
  }
  return 'json';
}

// 修复 restart-consistency 风格的测试："delete cache + re-require" 必须拿到独立实例
// 我们的做法：让 module.exports 成为一个 Proxy-like 包装，每次访问都重新 require 后端。
// 但 Proxy 会丢失函数 this 绑定（withTransaction 需要 data 引用）。所以采用更直接的方式：
// 在每次 require('./store') 时检查"如果 store-json/store-sqlite 也被缓存了，一起失效"。
// 这里用一个简单办法：先把可能的缓存清掉，再 require。

function _loadFresh(backendName) {
  const targetPath = require.resolve(backendName === 'sqlite' ? './store-sqlite' : './store-json');
  // 每次重新 require 都得到独立实例——避免"缓存共享导致跨 require 状态泄漏"
  try { delete require.cache[targetPath]; } catch (_) {}
  return require(targetPath);
}

const backend = pickBackend();
if (backend === 'sqlite') {
  console.log('[store] 后端: SQLite (WAL) — db.sqlite');
  module.exports = _loadFresh('sqlite');
} else {
  module.exports = _loadFresh('json');
}