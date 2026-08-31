// ====== 内存速率限制中间件 · v1.03 · 2026-08-31 ======
// 零依赖的 token bucket 实现（窗口计数器）：固定窗口内最多 max 次请求。
//
// 用法：
//   app.post('/api/register', rateLimit({ windowMs: 60_000, max: 5 }), handler)
//
// 维度（keyFn）：返回字符串作为桶 key；默认用 `req.ip`（带 IPv6 兼容）。
//   生产部署在反向代理后时需配置 app.set('trust proxy', ...) 才能取到真实 IP。
//
// 响应：超限时返回 429 JSON { success:false, message:'请求过于频繁，X 秒后重试' }
// 并设置 Retry-After header。
//
// 内存管理：
//   - 每 60s 清理一次过期桶（防普通累积）
//   - v1.03 P0 修复：加硬上限 MAX_BUCKETS（默认 10000）
//     防止攻击者伪造 X-Forwarded-For 填入几万 IP 撑爆内存
//     超限时按 LRU（最近写入优先）淘汰最久未访问的桶

const MAX_BUCKETS_DEFAULT = 10000;

function createBucket(opts) {
  const { windowMs, max, keyFn } = opts;
  const maxBuckets = Number.isInteger(opts.maxBuckets) ? opts.maxBuckets : MAX_BUCKETS_DEFAULT;
  const buckets = new Map(); // key -> { count, resetAt }
  let lastCleanup = Date.now();
  const CLEANUP_INTERVAL = 60_000;

  function _maybeCleanup(now) {
    if (now - lastCleanup > CLEANUP_INTERVAL) {
      lastCleanup = now;
      for (const [k, v] of buckets) {
        if (v.resetAt <= now) buckets.delete(k);
      }
    }
  }

  // v1.03 P0 修复：超限时按 LRU 淘汰（删除最久未访问的桶）
  //   Map 保留插入顺序，遍历到 resetAt <= now 的就删除
  function _evictIfFull(now) {
    if (buckets.size <= maxBuckets) return;
    // 优先淘汰已过期的
    for (const [k, v] of buckets) {
      if (buckets.size <= maxBuckets) break;
      if (v.resetAt <= now) buckets.delete(k);
    }
    // 仍超限则淘汰最早的（Map 头部 = 最久未更新）
    while (buckets.size > maxBuckets) {
      const firstKey = buckets.keys().next().value;
      if (firstKey === undefined) break;
      buckets.delete(firstKey);
    }
  }

  function middleware(req, res, next) {
    const now = Date.now();
    _maybeCleanup(now);
    const key = keyFn(req);
    if (!key) return next(); // 没 key 不限流（防误伤）
    let b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(key, b);
      _evictIfFull(now); // v1.03 P0：超过硬上限按 LRU 淘汰
    }
    if (b.count >= max) {
      const retryAfter = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
      try { res.setHeader('Retry-After', String(retryAfter)); } catch (_) {}
      res.status(429).json({ success: false, message: `请求过于频繁，${retryAfter} 秒后重试` });
      return;
    }
    b.count++;
    next();
  }

  middleware._reset = () => buckets.clear();
  middleware._stats = () => ({ bucketCount: buckets.size });
  return middleware;
}

function defaultKey(req) {
  // 兼容 Express 默认：req.ip（启用 trust proxy 后能拿到真实 IP）
  return req.ip || (req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || req.socket && req.socket.remoteAddress || 'unknown';
}

function rateLimit(opts) {
  const cfg = {
    windowMs: opts.windowMs || 60_000,
    max: opts.max || 5,
    keyFn: opts.keyFn || defaultKey,
    maxBuckets: opts.maxBuckets, // v1.03 P0：硬上限（默认 10000），可通过 opts 覆盖
  };
  return createBucket(cfg);
}

module.exports = rateLimit;
module.exports.rateLimit = rateLimit;