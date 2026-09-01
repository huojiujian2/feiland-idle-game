// ====== HTTP 响应 gzip 压缩中间件 · v1.04 ======
// 零依赖，用 Node 内置 zlib 实现（compression 包因环境写权限装不上，退而内联）。
// 设计要点：
//   1. 只压「可压缩的文本类」响应（JSON / JS / 文本 / XML / SVG / urlencoded）
//   2. 小响应(<1KB)不压：gzip 头部开销大于收益，省 CPU
//   3. 超大响应(>5MB)不压：避免缓冲占用过多内存，直接原样送出
//   4. 已设 Content-Encoding / Cache-Control: no-transform 的不压
//   5. zlib.gzip 在 libuv 线程池异步执行，不阻塞 Node 主线程（与落盘 worker 同一去阻塞目标）
//   6. 客户端不支持 gzip（Accept-Encoding 无 gzip 或 q=0）不压
//
// 注意：Content-Type 是在路由处理器里（res.json/res.send 时）才设置，
// 所以「是否可压缩」的判断必须放在响应阶段（res.end 拦截里），不能在中间件入口判定。
const zlib = require('zlib');

// text/*、application/json、application/javascript、application/xml、
// application/x-www-form-urlencoded、image/svg+xml 等
const COMPRESSIBLE = /^text\/|\bjson\b|\bjavascript\b|\bxml\b|x-www-form-urlencoded|svg\+xml/i;
const MIN_SIZE = 1024;
const MAX_SIZE = 5 * 1024 * 1024;

function acceptsGzip(req) {
  const header = String(req.headers['accept-encoding'] || '');
  if (!header) return false;
  let q = null;
  for (const part of header.split(',')) {
    const coding = (part.trim().split(';')[0] || '').trim().toLowerCase();
    const qm = /(?:^|;)\s*q=([0-9.]+)/i.exec(part);
    const qv = qm ? parseFloat(qm[1]) : 1;
    if (coding === 'gzip') { q = qv; break; }
    if (coding === '*' && q === null) q = qv;
  }
  return q !== null && q > 0;
}

function gzipMiddleware(req, res, next) {
  // 这些「不会在响应阶段改变」的条件在入口判定即可
  if (res.getHeader('Content-Encoding')) return next();
  const cacheControl = res.getHeader('Cache-Control');
  if (cacheControl && /no-transform/i.test(String(cacheControl))) return next();
  if (!acceptsGzip(req)) return next();

  const chunks = [];
  let buffered = 0;
  let aborted = false;

  const origWrite = res.write;
  const origEnd = res.end;

  function flushRawBuffered() {
    for (const c of chunks) origWrite.call(res, c);
    chunks.length = 0;
  }

  res.write = function (chunk, encoding, cb) {
    if (typeof encoding === 'function') { cb = encoding; encoding = null; }
    if (typeof chunk === 'string') chunk = Buffer.from(chunk, encoding || 'utf8');
    if (aborted) return origWrite.call(res, chunk, encoding, cb);
    buffered += chunk.length;
    chunks.push(chunk);
    if (buffered > MAX_SIZE) {
      aborted = true;
      flushRawBuffered();
    }
    if (typeof cb === 'function') cb();
    return true;
  };

  res.end = function (chunk, encoding, cb) {
    if (typeof chunk === 'function') { cb = chunk; chunk = null; encoding = null; }
    if (chunk != null && !aborted) {
      if (typeof chunk === 'string') chunk = Buffer.from(chunk, encoding || 'utf8');
      buffered += chunk.length;
      if (buffered <= MAX_SIZE) chunks.push(chunk);
      else { aborted = true; flushRawBuffered(); }
    }
    // 恢复原始方法，避免二次包装
    res.write = origWrite;
    res.end = origEnd;

    if (aborted) return origEnd.call(res, chunk, encoding, cb);

    const body = Buffer.concat(chunks);
    const type = res.getHeader('Content-Type');
    const compressible = !type || COMPRESSIBLE.test(String(type));
    if (!compressible || body.length < MIN_SIZE) {
      // 原样送出（Content-Length 由 Express 正确设置，无需改动）
      return origEnd.call(res, body, cb);
    }

    zlib.gzip(body, { level: 6 }, (err, gz) => {
      if (err) return origEnd.call(res, body, cb);
      res.setHeader('Content-Encoding', 'gzip');
      const vary = res.getHeader('Vary');
      if (!vary || !/Accept-Encoding/i.test(String(vary))) {
        res.setHeader('Vary', vary ? `${vary}, Accept-Encoding` : 'Accept-Encoding');
      }
      res.setHeader('Content-Length', gz.length);
      origEnd.call(res, gz, cb);
    });
  };

  next();
}

module.exports = gzipMiddleware;