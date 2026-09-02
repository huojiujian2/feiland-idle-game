// ====== 后台管理员账号（v1.08）======
// 存储位置：meta.adminAccounts（与 server-settings 一致；事务写入，随存档落盘）
// 默认账号：admin / admin（首次登录强制改密）
// 哈希：Node 内置 crypto.scrypt（无 npm 依赖；抗暴力破解的行业标准 KDF）
//
// 数据结构：
//   meta.adminAccounts = [
//     {
//       username: 'admin',
//       algo: 'scrypt',
//       salt: '<hex>',
//       hash: '<hex>',
//       mustChangePassword: true,
//       createdAt, updatedAt, lastLoginAt,
//     },
//     ...
//   ]

const crypto = require('crypto');
let _store = null;

function init(store) {
  _store = store;
  _ensureDefault();
}

function _getMeta() {
  if (!_store) return null;
  try {
    const m = _store.getMeta();
    if (!m) return null;
    if (!Array.isArray(m.adminAccounts)) m.adminAccounts = [];
    return m;
  } catch (_) {
    return null;
  }
}

function _ensureDefault() {
  const m = _getMeta();
  if (!m) return;
  if (m.adminAccounts.length === 0) {
    // 首登账号：admin / admin（明文 + mustChangePassword=true，登录后强制改密）
    const rec = _hashPlain('admin');
    rec.username = 'admin';
    rec.mustChangePassword = true;
    rec.createdAt = Date.now();
    rec.updatedAt = Date.now();
    m.adminAccounts.push(rec);
    _persist();
  }
}

function _persist() {
  if (!_store || typeof _store.withTransaction !== 'function') return;
  try {
    _store.withTransaction((data) => {
      // 直接覆盖 meta 引用内的 adminAccounts（data 与 _store.getMeta() 同对象）
      data.meta.adminAccounts = _store.getMeta().adminAccounts;
      return { status: 200 };
    });
  } catch (_) {
    // 事务失败不抛：登录等热路径不应因落盘抖动影响响应
  }
}

function _hashPlain(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { algo: 'scrypt', salt, hash };
}

function verifyPassword(record, password) {
  if (!record || record.algo !== 'scrypt' || !record.salt || !record.hash) return false;
  try {
    const candidate = crypto.scryptSync(password, record.salt, 64).toString('hex');
    // 等长 hash 比较：使用 timingSafeEqual 防计时攻击
    const a = Buffer.from(record.hash, 'hex');
    const b = Buffer.from(candidate, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (_) {
    return false;
  }
}

function findAccount(username) {
  const m = _getMeta();
  if (!m) return null;
  const u = String(username || '').trim();
  if (!u) return null;
  return m.adminAccounts.find((a) => a.username === u) || null;
}

/** 返回脱敏后的公开信息（不含哈希/盐） */
function publicInfo(record) {
  if (!record) return null;
  return {
    username: record.username,
    mustChangePassword: !!record.mustChangePassword,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastLoginAt: record.lastLoginAt,
  };
}

function authenticate(username, password) {
  const r = findAccount(username);
  if (!r) return { ok: false, reason: '账号不存在' };
  if (!verifyPassword(r, password)) return { ok: false, reason: '账号或密码错误' };
  r.lastLoginAt = Date.now();
  _persist();
  return { ok: true, record: r };
}

/**
 * 修改密码
 *  - 校验旧密码
 *  - 强度校验（≥8 位 + 字母数字）
 *  - 不能与旧密码相同
 *  - 更新哈希 + mustChangePassword=false
 *  - 返回新公开信息
 */
function changePassword(username, oldPassword, newPassword) {
  const r = findAccount(username);
  if (!r) return { ok: false, status: 404, message: '账号不存在' };
  if (!verifyPassword(r, oldPassword)) return { ok: false, status: 403, message: '旧密码错误' };
  if (typeof newPassword !== 'string' || newPassword.length < 8) return { ok: false, status: 400, message: '新密码长度至少 8 位' };
  if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) return { ok: false, status: 400, message: '新密码需包含字母和数字' };
  if (verifyPassword(r, newPassword)) return { ok: false, status: 400, message: '新密码不能与旧密码相同' };

  const fresh = _hashPlain(newPassword);
  r.algo = fresh.algo;
  r.salt = fresh.salt;
  r.hash = fresh.hash;
  r.mustChangePassword = false;
  r.updatedAt = Date.now();
  _persist();
  return { ok: true, record: r };
}

module.exports = {
  init,
  findAccount,
  authenticate,
  changePassword,
  publicInfo,
  verifyPassword,
};
