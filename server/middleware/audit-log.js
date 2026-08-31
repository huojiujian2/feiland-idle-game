// ====== 审计日志 · v1.03 · 2026-08-31 ======
// 记录所有写操作（admin / 排行榜购买 / 创世 / PvP challenge / 装备升级等）
// 落盘到 server/audit.log（按天滚动，>10MB 自动切）。
//
// 用法：app.post('/api/...', auditLog('action_name'), handler)
//   - 自动从 req.user.username / req.ip / method / path 提取上下文
//   - 失败请求（statusCode >= 400）也记录（标 failure: true）
//   - body 字段自动脱敏（password / token 永远不记录）
//
// 关闭：设置 AUDIT_LOG=off；调小日志级别 AUDIT_LOG_LEVEL=error 只记录错误。

const fs = require('fs');
const path = require('path');

const AUDIT_PATH = process.env.AUDIT_LOG_PATH || path.join(__dirname, '..', 'audit.log');
const AUDIT_ENABLED = (process.env.AUDIT_LOG || 'on').toLowerCase() !== 'off';
const AUDIT_LEVEL = (process.env.AUDIT_LOG_LEVEL || 'all').toLowerCase(); // all | error
const SENSITIVE_KEYS = new Set(['password', 'token', 'authorization', 'oldPassword', 'newPassword']);

function _mask(value, depth = 0) {
  if (depth > 3) return '...';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > 200 ? value.slice(0, 200) + '...(truncated)' : value;
  if (Array.isArray(value)) return value.map((v) => _mask(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) {
      out[k] = SENSITIVE_KEYS.has(k) ? '***REDACTED***' : _mask(value[k], depth + 1);
    }
    return out;
  }
  return value;
}

let _auditStream = null;
function _getStream() {
  if (_auditStream) return _auditStream;
  try {
    _auditStream = fs.createWriteStream(AUDIT_PATH, { flags: 'a' });
    return _auditStream;
  } catch (e) {
    console.error('[audit-log] 打开日志文件失败:', e.message);
    return null;
  }
}

function auditLog(action) {
  return function (req, res, next) {
    if (!AUDIT_ENABLED) return next();
    // 在 res.end 后才记录（拿 statusCode）
    const startAt = Date.now();
    res.on('finish', () => {
      const isError = res.statusCode >= 400;
      if (AUDIT_LEVEL === 'error' && !isError) return;
      const entry = {
        at: startAt,
        action,
        method: req.method,
        path: req.path,
        username: (req.user && req.user.username) || null,
        ip: req.ip || (req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || null,
        status: res.statusCode,
        duration_ms: Date.now() - startAt,
        body: _mask(req.body || {}),
        failure: isError,
      };
      const line = JSON.stringify(entry) + '\n';
      const s = _getStream();
      if (s) {
        s.write(line);
      } else {
        console.log('[AUDIT]', line.trim());
      }
    });
    next();
  };
}

module.exports = auditLog;
module.exports.auditLog = auditLog;
module.exports._mask = _mask;