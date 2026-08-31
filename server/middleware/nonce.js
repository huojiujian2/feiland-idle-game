// ====== 服务端 requestId 签名工具 · v1.03 · 2026-08-31 ======
// 客户端传 clientNonce（可选字符串，UUID / 时间戳），服务端用 HMAC-SHA256
// 签名 `{username, targetUsername, isBot, clientNonce, dayKey}` → 确定性 serverRequestId。
//
// 作用：
//   1. 重放：用同 nonce 拿同结果（去重）
//   2. 防串改：换 targetUsername → 不同 requestId（无法借重放攻击不同人）
//   3. 不可伪造：必须有合法 token 才能调（middleware/auth 已保证）
//   4. 跨日失效：dayKey 包含在内，隔天同 nonce 也不同（防长窗口重放）
//
// 兼容：未传 clientNonce 时使用 `now()` + 8字节随机（与原"完全客户端生成"行为不同）

const crypto = require('crypto');
let _secret = process.env.PVP_NONCE_SECRET || process.env.JWT_SECRET || 'feiland-dev-secret-DO-NOT-USE-IN-PROD';

function __setSecret(s) { _secret = String(s || ''); }
function __getSecret() { return _secret; }

function getDayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

function signRequestId(payload) {
  const data = JSON.stringify(payload);
  return crypto.createHmac('sha256', _secret).update(data).digest('hex');
}

function buildServerRequestId({ username, targetUsername, isBot, clientNonce, dayKey }) {
  // 兼容：未传 clientNonce 用 now+random（与旧 requestId 行为类似，但服务端生成）
  const nonce = clientNonce || `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const payload = {
    u: String(username || ''),
    t: String(targetUsername || ''),
    b: !!isBot,
    n: String(nonce),
    d: String(dayKey || getDayKey()),
  };
  return `srv_${signRequestId(payload).slice(0, 32)}`;
}

module.exports = {
  signRequestId,
  buildServerRequestId,
  getDayKey,
  __setSecret,
  __getSecret,
};