// ====== 审计日志测试 · v1.03 · 2026-08-31 ======
const test = require('node:test');
const assert = require('node:assert');
const audit = require('./audit-log');

test('audit-log: 脱敏密码/token', () => {
  const masked = audit._mask({ username: 'alice', password: 'secret123', token: 'eyJ...', normal: 'ok' });
  assert.strictEqual(masked.username, 'alice');
  assert.strictEqual(masked.password, '***REDACTED***');
  assert.strictEqual(masked.token, '***REDACTED***');
  assert.strictEqual(masked.normal, 'ok');
});

test('audit-log: 嵌套对象脱敏', () => {
  const masked = audit._mask({ user: { username: 'alice', password: 'p' }, list: [{ password: 'q' }] });
  assert.strictEqual(masked.user.username, 'alice');
  assert.strictEqual(masked.user.password, '***REDACTED***');
  assert.strictEqual(masked.list[0].password, '***REDACTED***');
});

test('audit-log: 中间件记录 finish 事件', (t, done) => {
  // 强制 AUDIT_LOG=off 再 on，确保 _getStream 不缓存旧状态
  process.env.AUDIT_LOG = 'on';
  process.env.AUDIT_LOG_PATH = require('path').join(require('os').tmpdir(), `audit-test-${Date.now()}.log`);
  // 重新 require 让 _AUDIT_ENABLED 重读
  delete require.cache[require.resolve('./audit-log')];
  const audit2 = require('./audit-log');
  const express = require('express');
  const fs = require('fs');
  const app = express();
  app.use(express.json());
  app.post('/api/test', audit2.auditLog('test_action'), (req, res) => res.json({ ok: true }));
  const srv = app.listen(0, async () => {
    const port = srv.address().port;
    try {
      const r = await fetch(`http://localhost:${port}/api/test`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'secret', action_field: 'visible' }),
      });
      await r.text();
      // 等 res.on('finish') 完成 + 写入磁盘
      await new Promise((res2) => setTimeout(res2, 200));
      srv.close(() => {
        // 读取 audit.log
        let content = '';
        try { content = fs.readFileSync(process.env.AUDIT_LOG_PATH, 'utf8'); } catch (_) {}
        assert.ok(content.includes('test_action'), '应记录 audit 日志');
        assert.ok(content.includes('REDACTED'), 'password 应脱敏');
        try { fs.unlinkSync(process.env.AUDIT_LOG_PATH) } catch (_) {}
        done();
      });
    } catch (e) {
      srv.close(() => done(e));
    }
  });
});