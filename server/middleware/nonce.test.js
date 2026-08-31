// ====== Nonce 测试 · v1.03 · 2026-08-31 ======
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const nonce = require('./nonce');

nonce.__setSecret('test-' + crypto.randomBytes(16).toString('hex'));

test('buildServerRequestId: 同样输入同样输出', () => {
  const a = nonce.buildServerRequestId({ username: 'alice', targetUsername: 'bob', isBot: false, clientNonce: 'n1', dayKey: '2026-08-31' });
  const b = nonce.buildServerRequestId({ username: 'alice', targetUsername: 'bob', isBot: false, clientNonce: 'n1', dayKey: '2026-08-31' });
  assert.strictEqual(a, b);
});

test('buildServerRequestId: 换 target 则不同', () => {
  const a = nonce.buildServerRequestId({ username: 'alice', targetUsername: 'bob', isBot: false, clientNonce: 'n1', dayKey: '2026-08-31' });
  const b = nonce.buildServerRequestId({ username: 'alice', targetUsername: 'carol', isBot: false, clientNonce: 'n1', dayKey: '2026-08-31' });
  assert.notStrictEqual(a, b);
});

test('buildServerRequestId: 换 username 则不同', () => {
  const a = nonce.buildServerRequestId({ username: 'alice', targetUsername: 'bob', isBot: false, clientNonce: 'n1', dayKey: '2026-08-31' });
  const b = nonce.buildServerRequestId({ username: 'mallory', targetUsername: 'bob', isBot: false, clientNonce: 'n1', dayKey: '2026-08-31' });
  assert.notStrictEqual(a, b);
});

test('buildServerRequestId: 换 nonce 则不同', () => {
  const a = nonce.buildServerRequestId({ username: 'alice', targetUsername: 'bob', isBot: false, clientNonce: 'n1', dayKey: '2026-08-31' });
  const b = nonce.buildServerRequestId({ username: 'alice', targetUsername: 'bob', isBot: false, clientNonce: 'n2', dayKey: '2026-08-31' });
  assert.notStrictEqual(a, b);
});

test('buildServerRequestId: 换 day 则不同', () => {
  const a = nonce.buildServerRequestId({ username: 'alice', targetUsername: 'bob', isBot: false, clientNonce: 'n1', dayKey: '2026-08-31' });
  const b = nonce.buildServerRequestId({ username: 'alice', targetUsername: 'bob', isBot: false, clientNonce: 'n1', dayKey: '2026-09-01' });
  assert.notStrictEqual(a, b);
});

test('buildServerRequestId: 不传 nonce 也能生成（自动生成）', () => {
  const a = nonce.buildServerRequestId({ username: 'alice', targetUsername: 'bob', isBot: true });
  assert.ok(a.startsWith('srv_'));
  assert.ok(a.length > 10);
});

test('buildServerRequestId: 输出不可猜测（HMAC）', () => {
  const a = nonce.buildServerRequestId({ username: 'alice', targetUsername: 'bob', isBot: false, clientNonce: 'n1', dayKey: '2026-08-31' });
  // 输出不应包含用户名/nonce 等可读字段
  assert.ok(!a.includes('alice'));
  assert.ok(!a.includes('n1'));
});

test('getDayKey: 格式正确', () => {
  const dk = nonce.getDayKey();
  assert.match(dk, /^\d{4}-\d{2}-\d{2}$/);
});