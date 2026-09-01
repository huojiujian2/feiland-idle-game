// ====== view 缓存测试 · v1.03 杠杆 4 ======
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const viewCache = require('./view-cache');

describe('view 缓存（按 lastTick 失效）', () => {
  beforeEach(() => viewCache.__resetViewCache());

  it('缓存 miss + set + get：命中', () => {
    assert.equal(viewCache.getCached('alice', 100), null);
    viewCache.setCached('alice', { level: 1 }, { offlineSeconds: 0 }, 100);
    const c = viewCache.getCached('alice', 100);
    assert.ok(c, '应当命中');
    assert.equal(c.view.level, 1);
    assert.equal(c.lastTick, 100);
  });

  it('lastTick 变化 → 缓存 miss', () => {
    viewCache.setCached('alice', { level: 1 }, {}, 100);
    // player 写了，lastTick 变 200
    assert.equal(viewCache.getCached('alice', 200), null);
  });

  it('invalidatePlayerView → 删除缓存', () => {
    viewCache.setCached('alice', { level: 1 }, {}, 100);
    viewCache.invalidatePlayerView('alice');
    assert.equal(viewCache.getCached('alice', 100), null);
  });

  it('stats: hits / misses / invalidations 累加', () => {
    viewCache.setCached('alice', {}, {}, 100);
    viewCache.getCached('alice', 100); // hit
    viewCache.getCached('alice', 100); // hit
    viewCache.getCached('alice', 999); // miss（lastTick 变了）
    viewCache.setCached('bob', {}, {}, 100);
    viewCache.invalidatePlayerView('bob');
    const s = viewCache.getViewCacheStats();
    assert.equal(s.hits, 2);
    assert.equal(s.misses, 1);
    assert.equal(s.invalidations, 1);
    assert.equal(s.size, 1); // alice 还剩
    assert.equal(s.hitRate, 66.7);
  });

  it('invalidateAllViews 清空所有', () => {
    viewCache.setCached('a', {}, {}, 1);
    viewCache.setCached('b', {}, {}, 1);
    viewCache.setCached('c', {}, {}, 1);
    viewCache.invalidateAllViews();
    assert.equal(viewCache.getViewCacheStats().size, 0);
  });

  it('缓存命中的本质：lastTick 完全相等才命中（字符串/数字一致）', () => {
    viewCache.setCached('alice', {}, {}, 123);
    assert.ok(viewCache.getCached('alice', 123));
    assert.equal(viewCache.getCached('alice', 124), null);
    assert.equal(viewCache.getCached('alice', '123'), null); // 字符串不命中（类型严格）
  });
});