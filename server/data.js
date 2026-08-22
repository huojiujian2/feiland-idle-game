// ====== 静态数据重定向 ======
// 原 data.js 已拆分到 server/data/ 下多个模块
// 本文件保留为 require('./data') 的兼容入口
module.exports = require('./data/index');
