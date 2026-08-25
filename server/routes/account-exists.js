// ====== 登录/注册时实时校验账号是否已存在 ======
// 前端 debounce 调用：GET /api/account-exists?username=xxx
// 返回 { exists: boolean } —— 不泄露账号枚举之外的任何信息

function registerAccountExistsRoute(app, store) {
  app.get('/api/account-exists', (req, res) => {
    const raw = (req.query.username || '').toString().trim();
    if (!raw || raw.length < 2 || raw.length > 16) {
      return res.json({ exists: false });
    }
    res.json({ exists: store.accountExists(raw) });
  });
}

module.exports = { registerAccountExistsRoute };