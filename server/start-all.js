// ====== 一键启动编排器（生产/直接启动模式） ======
// 同时拉起两个进程：
//   后端 API: node server/index.js   -> 固定 3001
//   前端页面: node server/web-server.js -> 固定 3000
// 任何一个进程退出，另一个也会被终止（避免留下半死状态）。
// 零第三方依赖，Docker 的 --prod 安装也能直接用。
//
// v1.03 内存优化：传递 NODE_OPTIONS 给后端，限制 V8 堆上限 + 按需启用 --expose-gc
//   - 默认 NODE_MAX_OLD_SPACE_SIZE=512 MB（可通过环境变量调整）
//   - 如果传了 ENABLE_EXPOSE_GC=1，会加 --expose-gc（让内存监控可以主动触发 major GC）

const { spawn } = require('child_process');
const path = require('path');

const children = [];

// v1.03：默认带 --max-old-space-size=512（生产推荐 512-1024，根据服务器规格）
//   可通过 NODE_MAX_OLD_SPACE_SIZE 环境变量覆盖
const MAX_OLD_SPACE = process.env.NODE_MAX_OLD_SPACE_SIZE || '512';
const EXPOSE_GC = process.env.ENABLE_EXPOSE_GC === '1';
const nodeOptions = [
  `--max-old-space-size=${MAX_OLD_SPACE}`,
  ...(EXPOSE_GC ? ['--expose-gc'] : []),
].join(' ');
if (!process.env.NODE_OPTIONS || !process.env.NODE_OPTIONS.includes('--max-old-space-size')) {
  process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS ? process.env.NODE_OPTIONS + ' ' : '') + nodeOptions;
  console.log(`[start-all] 已设置 Node 启动参数: ${nodeOptions}`);
}

function start(name, script) {
  const child = spawn(process.execPath, [path.join(__dirname, script)], {
    stdio: 'inherit',
    env: process.env
  });
  children.push(child);
  console.log(`[start-all] 已启动 ${name} (pid=${child.pid})`);
  child.on('exit', (code) => {
    if (shuttingDown) return;
    console.error(`[start-all] ${name} 已退出(code=${code})，正在停止全部进程...`);
    shutdown(code === null ? 1 : code);
  });
}

let shuttingDown = false;
function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    try { c.kill(); } catch (_) {}
  }
  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown(0));   // Ctrl+C
process.on('SIGTERM', () => shutdown(0));
process.on('exit', () => {
  for (const c of children) { try { c.kill(); } catch (_) {} }
});

console.log('==========================================');
console.log('  费兰德世界 - 启动中（前端 3000 / 后端 3001）');
console.log('  游戏地址: http://localhost:3000');
console.log('==========================================');

start('后端 API', 'index.js');
start('前端页面', 'web-server.js');
