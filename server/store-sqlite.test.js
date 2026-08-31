// ====== SQLite 后端兼容性测试 · v1.03 · 2026-08-31 ======
// 用 Node 内置 node:test 验证 store-sqlite.js 与 store.js 完全兼容。
//   覆盖：账号/玩家读写、withTransaction、回滚、save+load 往返、并发 safeSave。
//
// 跑法：node --test server/store-sqlite.test.js
// 或：DB_ENGINE=sqlite node --test server/store-sqlite.test.js （任意路径）

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 用临时目录隔离每个测试
function tmpRoot() {
  return path.join(os.tmpdir(), `feiland-store-sqlite-${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
}

// 切换 store 后端 + 注入路径的辅助：每次返回 store 实例（避免 require 缓存）
function loadStoreWithRoot(root) {
  process.env.DB_ENGINE = 'sqlite';
  process.env.DB_PATH = root;
  const resolvedPath = require.resolve('./store-sqlite');
  delete require.cache[resolvedPath];
  const resolvedStore = require.resolve('./store');
  delete require.cache[resolvedStore];
  return require('./store');
}

// 在文件加载阶段就启用（防止 require 缓存）
process.env.DB_ENGINE = 'sqlite';

// 测试套结束后清理（防止污染同进程其他 require('./store') 的测试）
test.after(() => {
  delete process.env.DB_ENGINE;
  delete process.env.DB_PATH;
  try { delete require.cache[require.resolve('./store')]; } catch (_) {}
  try { delete require.cache[require.resolve('./store-sqlite')]; } catch (_) {}
});

function rmrf(p) { try { fs.unlinkSync(p); } catch(_) {} }

test('load() 空目录创建空 store', async () => {
  const root = tmpRoot();
  const store = loadStoreWithRoot(root);
  await store.load();
  assert.deepStrictEqual(store.__getRawData().accounts, {});
  assert.deepStrictEqual(store.__getRawData().players, {});
  assert.deepStrictEqual(store.__getRawData().meta.arenaRewards, { daily:{}, weekly:{}, monthly:{} });
  rmrf(`${root}.sqlite`);
});

test('账号 + 玩家 CRUD + safeSave 持久化', async () => {
  const root = tmpRoot();
  let store = loadStoreWithRoot(root);
  await store.load();

  store.setAccount('alice', { username: 'alice', password: 'pw', hasCharacter: false, createdAt: 1000 });
  store.setPlayer('alice', { username: 'alice', name: 'Alice', gold: 100, level: 1 });
  assert.strictEqual(store.accountExists('alice'), true);
  assert.strictEqual(store.getAccount('alice').password, 'pw');
  assert.strictEqual(store.getPlayer('alice').gold, 100);

  store.safeSave();
  await new Promise((r) => setTimeout(r, 200));

  store = loadStoreWithRoot(root);
  await store.load();
  assert.strictEqual(store.accountExists('alice'), true);
  assert.strictEqual(store.getPlayer('alice').gold, 100);
  rmrf(`${root}.sqlite`);
});

test('withTransaction 成功提交', async () => {
  const root = tmpRoot();
  const store = loadStoreWithRoot(root);
  await store.load();

  store.setPlayer('bob', { username: 'bob', gold: 10 });
  let r = store.withTransaction((d) => {
    d.players['bob'].gold += 50;
    return { status: 200 };
  });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(store.getPlayer('bob').gold, 60);
  rmrf(`${root}.sqlite`);
});

test('withTransaction 失败回滚', async () => {
  const root = tmpRoot();
  const store = loadStoreWithRoot(root);
  await store.load();

  store.setPlayer('carol', { username: 'carol', gold: 200 });
  let r = store.withTransaction((d) => {
    d.players['carol'].gold = 9999;
    return { status: 400, message: '故意失败' };
  });
  assert.strictEqual(r.status, 400);
  assert.strictEqual(store.getPlayer('carol').gold, 200);
  rmrf(`${root}.sqlite`);
});

test('withTransaction 异常捕获回滚', async () => {
  const root = tmpRoot();
  const store = loadStoreWithRoot(root);
  await store.load();

  store.setPlayer('dave', { username: 'dave', gold: 5 });
  let r;
  try {
    r = store.withTransaction((d) => {
      d.players['dave'].gold = 99999;
      throw new Error('boom');
    });
  } catch (_) { /* 应被内部捕获 */ }
  assert.strictEqual(r.status, 500);
  assert.strictEqual(store.getPlayer('dave').gold, 5);
  rmrf(`${root}.sqlite`);
});

test('getMeta / setMeta / meta 修改持久化', async () => {
  const root = tmpRoot();
  let store = loadStoreWithRoot(root);
  await store.load();

  const meta = store.getMeta();
  meta.genesis = { monsters: [{ id: 'm1', name: '测试怪' }] };
  store.setMeta(meta);
  store.safeSave();
  await new Promise((r) => setTimeout(r, 200));

  store = loadStoreWithRoot(root);
  await store.load();
  assert.strictEqual(store.getMeta().genesis.monsters[0].name, '测试怪');
  rmrf(`${root}.sqlite`);
});

test('snapshot / restore 兼容旧 API', async () => {
  const root = tmpRoot();
  const store = loadStoreWithRoot(root);
  await store.load();

  store.setPlayer('eve', { username: 'eve', gold: 1 });
  const snap = store.snapshot();
  assert.ok(snap.length > 0);
  store.getPlayer('eve').gold = 9999;
  store.restore(snap);
  assert.strictEqual(store.getPlayer('eve').gold, 1);
  rmrf(`${root}.sqlite`);
});

test('并发 safeSave 不丢更新', async () => {
  const root = tmpRoot();
  let store = loadStoreWithRoot(root);
  await store.load();

  store.setPlayer('frank', { username: 'frank', gold: 0 });
  for (let i = 0; i < 50; i++) {
    store.getPlayer('frank').gold += 1;
    store.safeSave();
  }
  await new Promise((r) => setTimeout(r, 500));
  store = loadStoreWithRoot(root);
  await store.load();
  assert.ok(store.getPlayer('frank').gold >= 50, `expected >=50, got ${store.getPlayer('frank').gold}`);
  rmrf(`${root}.sqlite`);
});