// ====== 密码哈希 · v1.03 · 2026-08-31 ======
// 优先使用 bcrypt（生产推荐）；bcrypt 不可用时回退到 Node 内置 crypto.pbkdf2。
//
// 格式：
//   bcrypt:    "$2a$10$..." （60 字符）
//   pbkdf2:    "pbkdf2$<iter>$<saltHex>$<hashHex>"
//
// 登录时自动识别两种格式校验。注册时统一用 bcrypt（新用户）；
// 老账号仍可登录（保留向后兼容）。

const crypto = require('crypto');

let _bcrypt = null;
let _bcryptTried = false;
function _tryLoadBcrypt() {
  if (_bcryptTried) return _bcrypt;
  _bcryptTried = true;
  try {
    _bcrypt = require('bcrypt');
  } catch (_) {
    _bcrypt = null;
  }
  return _bcrypt;
}

const PBKDF2_ITER = 100_000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_DIGEST = 'sha256';
const BCRYPT_ROUNDS = 10;

/**
 * 异步哈希密码
 * @param {string} password
 * @returns {Promise<string>} 哈希串
 */
async function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('password 必须为非空字符串');
  }
  const bc = _tryLoadBcrypt();
  if (bc) {
    return await bc.hash(password, BCRYPT_ROUNDS);
  }
  // 回退到 pbkdf2
  const salt = crypto.randomBytes(PBKDF2_SALT_BYTES).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITER, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  return `pbkdf2$${PBKDF2_ITER}$${salt}$${hash}`;
}

/**
 * 同步哈希密码（pbkdf2 实现，bcrypt 必须异步所以不支持同步）
 *   注意：当前所有密码哈希都在 register 内异步完成，没有同步场景需要
 */
function hashPasswordSync(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('password 必须为非空字符串');
  }
  if (_tryLoadBcrypt()) {
    throw new Error('bcrypt 已加载，请使用异步 hashPassword()');
  }
  const salt = crypto.randomBytes(PBKDF2_SALT_BYTES).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITER, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  return `pbkdf2$${PBKDF2_ITER}$${salt}$${hash}`;
}

/**
 * 校验密码（自动识别 bcrypt / pbkdf2 / 旧明文格式）
 * @param {string} password
 * @param {string} stored
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, stored) {
  if (!password || !stored) return false;
  if (typeof stored !== 'string') return false;
  // bcrypt: 60 字符、以 $2 开头
  if (/^\$2[aby]\$\d{2}\$/.test(stored)) {
    const bc = _tryLoadBcrypt();
    if (!bc) {
      console.warn('[password] 存储是 bcrypt 但未安装 bcrypt 模块，无法校验。请 npm i bcrypt');
      return false;
    }
    try { return await bc.compare(password, stored); } catch (_) { return false; }
  }
  // pbkdf2
  if (stored.startsWith('pbkdf2$')) {
    const parts = stored.split('$');
    if (parts.length !== 4) return false;
    const iter = parseInt(parts[1], 10);
    const salt = parts[2];
    const hash = parts[3];
    if (!iter || !salt || !hash) return false;
    let actual;
    try {
      actual = crypto.pbkdf2Sync(password, salt, iter, hash.length / 2, PBKDF2_DIGEST).toString('hex');
    } catch (_) { return false; }
    return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(hash, 'hex'));
  }
  // 旧明文（兼容）：直接相等
  return stored === password;
}

/**
 * 是否需要升级旧明文密码（升级后写入哈希）
 */
function isLegacyPlaintext(stored) {
  return typeof stored === 'string'
    && !stored.startsWith('pbkdf2$')
    && !/^\$2[aby]\$\d{2}\$/.test(stored);
}

module.exports = {
  hashPassword,
  hashPasswordSync,
  verifyPassword,
  isLegacyPlaintext,
  __isBcryptAvailable: () => !!_tryLoadBcrypt(),
};