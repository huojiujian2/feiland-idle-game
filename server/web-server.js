// ====== 生产模式前端服务器 ======
// 端口约定：本进程固定监听 3000（浏览器打开的地址）。
// 职责：
//   1. 托管 client/dist 里的前端静态文件
//   2. 把 /api 开头的请求原样转发给后端（默认 http://127.0.0.1:3001）
// 后端 API 由 server/index.js 提供（PORT 环境变量，默认 3001）。
// 零第三方依赖，仅用 Node 内置模块。

const http = require('http');
const fs = require('fs');
const path = require('path');

const WEB_PORT = process.env.WEB_PORT || 3000;          // 前端固定 3000
const WEB_HOST = process.env.HOST || '0.0.0.0';
const API_PORT = process.env.PORT || 3001;              // 后端固定 3001
const API_ORIGIN = `http://127.0.0.1:${API_PORT}`;
const DIST_DIR = path.join(__dirname, '..', 'client', 'dist');

// 常见静态文件的 Content-Type 映射
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.map':  'application/json'
};

function sendText(res, status, text, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(text);
}

// 把 URL pathname 安全地解析为 dist 内的绝对路径；越界（目录穿越）返回 null
function resolveDistPath(pathname) {
  const filePath = path.normalize(path.join(DIST_DIR, pathname));
  if (!filePath.startsWith(DIST_DIR)) return null;
  return filePath;
}

// 把请求原样转发给后端：请求体直接管道传过去，响应体再管道传回来
function proxyApi(req, res) {
  const target = new URL(req.url, API_ORIGIN);
  const apiReq = http.request(target, {
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${API_PORT}` }
  }, (apiRes) => {
    res.writeHead(apiRes.statusCode, apiRes.headers);
    apiRes.pipe(res);
  });
  apiReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    }
    res.end(JSON.stringify({
      success: false,
      message: `无法连接后端(${API_PORT})：${err.message}。请确认后端已启动。`
    }));
  });
  req.pipe(apiReq);
}

// 在 dist 目录里找文件并返回；找不到返回 false（由调用方决定下一步）
function tryServeFile(res, filePath) {
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

// 静态文件入口：精确匹配 -> 回退 index.html（支持前端路由刷新）
function serveStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendText(res, 405, 'Method Not Allowed');
  }
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch (_) {
    return sendText(res, 400, 'Bad Request');
  }
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = resolveDistPath(urlPath);
  if (filePath === null) return sendText(res, 403, 'Forbidden');

  if (tryServeFile(res, filePath)) return;

  // 无扩展名的路径视为前端路由，回退到 index.html
  if (!path.extname(urlPath)) {
    const indexFile = path.join(DIST_DIR, 'index.html');
    if (tryServeFile(res, indexFile)) return;
  }
  sendText(res, 404, '404 Not Found');
}

if (require.main === module) {
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    console.error(`[web] 未找到前端构建产物: ${DIST_DIR}`);
    console.error('[web] 请先在项目根目录执行: npm run build');
    process.exit(1);
  }

  const server = http.createServer((req, res) => {
    const isApi = req.url === '/api' || req.url.startsWith('/api/');
    const isIcons = req.url.startsWith('/icons/');
    if (isApi) return proxyApi(req, res);

    let handled = false;
    if (isIcons) {
      // vite build 会把 client/public 拷进 dist，图标优先走本地；没有再转发后端
      try {
        const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        handled = tryServeFile(res, resolveDistPath(p));
      } catch (_) { handled = false; }
      if (!handled) proxyApi(req, res);
      return;
    }
    serveStatic(req, res);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[web] 端口 ${WEB_PORT} 已被占用（可能开发模式的 Vite 正在运行）。前端服务器退出。`);
    } else {
      console.error('[web] 前端服务器出错:', err.message);
    }
    process.exit(1);
  });

  server.listen(WEB_PORT, WEB_HOST, () => {
    console.log(`\n========================================`);
    console.log(`  费兰德世界 - 前端已启动`);
    console.log(`  游戏页面: http://localhost:${WEB_PORT}`);
    console.log(`  API 转发 -> ${API_ORIGIN}`);
    console.log(`========================================\n`);
  });
}

module.exports = { proxyApi, serveStatic };
