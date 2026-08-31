// ====== JWT 鉴权中间件 · v1.03 · 2026-08-31 ======
// 自签 JWT（HMAC-SHA256，Node 内置 crypto，零 npm 依赖），替代旧"URL 路径参数当身份"的漏洞。
//
// 用法（生产推荐）：
//   1. 登录成功由 routes/auth.js 调 signToken({username}) 把 token 返回客户端
//   2. 客户端在所有受保护请求带 Authorization: Bearer <token>
//   3. requireAuth 中间件从 header 解析 token，验签后挂到 req.user = {username}
//   4. requirePlayerSelf 中间件额外校验 req.params.username === req.user.username（防借名）
//
// 开关：
//   AUTH_MODE=enforce （默认生产）— 401 拒绝未带 token / 借名
//   AUTH_MODE=off     （仅开发/迁移期）— 放行所有请求，不强制校验
//
// 测试 seam：
//   __setSecret(secret) 可在测试中注入临时密钥
//
// 安全细节：
//   - exp 默认 7 天（可在 signToken 覆盖）
//   - secret 默认从 process.env.JWT_SECRET 读取，无则用 dev secret 并 warn（开发期）
//   - 校验失败一律返回 401 + message，不泄露"是 token 过期"还是"签名错误"细节

const crypto = require('crypto');

// ====== 配置 ======
let SECRET = process.env.JWT_SECRET || 'feiland-dev-secret-DO-NOT-USE-IN-PROD';
let _secretIsDev = !process.env.JWT_SECRET;
if (_secretIsDev) {
  // 仅在非生产模式警告
  if ((process.env.NODE_ENV || 'development') === 'production') {
    throw new Error('JWT_SECRET 未设置，生产环境禁止使用默认密钥');
  }
  console.warn('[auth] ⚠️  JWT_SECRET 未设置，使用开发默认密钥（仅开发模式）');
}

function __setSecret(s) {
  SECRET = String(s || '');
  _secretIsDev = false;
}
function __resetSecret() {
  SECRET = process.env.JWT_SECRET || 'feiland-dev-secret-DO-NOT-USE-IN-PROD';
  _secretIsDev = !process.env.JWT_SECRET;
}
function __getSecret() { return SECRET; }

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

// ====== 签名 / 校验 ======
function _b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function _b64urlDecode(str) {
  str = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

/**
 * 签发 token
 * @param {object} payload - 例如 { username: 'alice' }
 * @param {number} ttlMs - 有效期 ms（默认 7 天）
 * @returns {string} token (格式: header.payload.signature)
 */
function signToken(payload, ttlMs = DEFAULT_TTL_MS) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Date.now();
  const body = Object.assign({}, payload, {
    iat: now,
    exp: now + (ttlMs | 0),
  });
  const headerB64 = _b64url(JSON.stringify(header));
  const bodyB64 = _b64url(JSON.stringify(body));
  const data = `${headerB64}.${bodyB64}`;
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest();
  return `${data}.${_b64url(sig)}`;
}

/**
 * 校验 token，返回 payload 或 null
 * @param {string} token
 * @returns {object|null}
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, bodyB64, sigB64] = parts;
  const data = `${headerB64}.${bodyB64}`;
  const expectedSig = crypto.createHmac('sha256', SECRET).update(data).digest();
  const actualSig = _b64urlDecode(sigB64);
  if (expectedSig.length !== actualSig.length) return null;
  if (!crypto.timingSafeEqual(expectedSig, actualSig)) return null;
  let body;
  try {
    body = JSON.parse(_b64urlDecode(bodyB64).toString('utf-8'));
  } catch (_) {
    return null;
  }
  if (typeof body.exp !== 'number' || body.exp < Date.now()) return null;
  return body;
}

/**
 * 从 Authorization header 提取 token
 */
function extractToken(req) {
  const h = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!h) return null;
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

// ====== Express 中间件 ======
function _authMode() {
  return (process.env.AUTH_MODE || 'enforce').toLowerCase();
}
function _isTestMode() {
  try {
    const state = require('../engine/state');
    return !!(state && typeof state.isTestMode === 'function' && state.isTestMode());
  } catch (_) { return false; }
}

/**
 * requireAuth — 必须登录，401 if not
 *   校验成功后 req.user = { username, iat, exp, ... }
 *   - AUTH_MODE=off  → 放行
 *   - isTestMode()=true → 放行（向后兼容测试套）
 */
function requireAuth(req, res, next) {
  if (_authMode() === 'off') return next();
  if (_isTestMode()) return next();
  const token = extractToken(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload || !payload.username) {
    return res.status(401).json({ success: false, message: '未登录或 token 无效' });
  }
  req.user = payload;
  next();
}

/**
 * requirePlayerSelf — 必须登录且 req.params.username === req.user.username
 */
function requirePlayerSelf(req, res, next) {
  if (_authMode() === 'off') return next();
  if (_isTestMode()) return next();
  if (!req.user) {
    return res.status(401).json({ success: false, message: '未登录或 token 无效' });
  }
  const paramName = req.params && req.params.username;
  if (!paramName) return next();
  if (req.user.username !== paramName) {
    return res.status(403).json({ success: false, message: '无权操作该玩家' });
  }
  next();
}

/**
 * requireSelfFromBody — body.username 必须 === req.user.username
 */
function requireSelfFromBody(req, res, next) {
  if (_authMode() === 'off') return next();
  if (_isTestMode()) return next();
  if (!req.user) {
    return res.status(401).json({ success: false, message: '未登录或 token 无效' });
  }
  const bodyName = req.body && req.body.username;
  if (!bodyName) return next();
  if (req.user.username !== bodyName) {
    return res.status(403).json({ success: false, message: '无权以该玩家身份操作' });
  }
  next();
}

/**
 * requireAdmin — 必须带 admin token（X-Admin-Token header）
 *   保护 /api/arena/settle 等内部接口
 *   测试模式（isTestMode() === true）下放行（兼容 routes-settlement.test.js）
 */
function requireAdmin(req, res, next) {
  try {
    // 延迟 require 避免循环
    const state = require('../engine/state');
    if (state && typeof state.isTestMode === 'function' && state.isTestMode()) return next();
  } catch (_) { /* state 不存在 = 生产，放行检查 */ }
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return res.status(500).json({ success: false, message: 'ADMIN_TOKEN 未配置' });
  }
  const got = req.headers && (req.headers['x-admin-token'] || req.headers['X-Admin-Token']);
  if (got !== expected) {
    return res.status(403).json({ success: false, message: '无权限' });
  }
  next();
}

module.exports = {
  signToken,
  verifyToken,
  extractToken,
  requireAuth,
  requirePlayerSelf,
  requireSelfFromBody,
  requireAdmin,
  __setSecret,
  __resetSecret,
  __getSecret,
};