// ====== Engine 重定向（兼容旧 require('./engine')） ======
// 原 engine.js 已被拆分为 server/engine/ 下的多个模块
// 所有逻辑请见 server/engine/index.js 及其子模块
module.exports = require('./engine/index');
