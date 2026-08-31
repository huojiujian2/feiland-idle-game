// ====== 世界 BOSS 路由（v2.9） ======
const { getActiveBoss, attackWorldBoss, spawnWorldBoss, getBossRanking, getPlayerView, getBossExpiresAt, getBossDayKey } = require('../engine');
const { getNow } = require('../engine/state');
const { ok, fail } = require('./_helpers');

function registerWorldBossRoutes(app, store, deps = {}) {
  const auth = deps.auth || {};
  const requireAdmin = auth.requireAdmin || ((req, res, next) => next());
  // 获取当前活跃 BOSS + 排行榜 + 过期时间 + 当前玩家今日是否已挑战 — 事务化
  app.get('/api/worldboss/active', (req, res) => {
    const username = req.query.username || '';
    const result = store.withTransaction((data) => {
      const boss = getActiveBoss(store);
      const ranking = getBossRanking(store, 10);
      const player = username ? data.players[username] : null;
      const todayKey = getBossDayKey();
      const challengedToday = !!(player && player.lastBossAttackDay === todayKey);
      const remainingMs = boss ? Math.max(0, (boss.expiresAt || 0) - getNow()) : 0;
      return {
        status: 200,
        data: {
          boss,
          ranking,
          expiresAt: getBossExpiresAt(store),
          challengedToday,
          remainingMs,
        }
      };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message || '保存失败请重试' });
    return res.json({ success: true, data: result.data });
  });

  // 玩家挑战 BOSS：一次挑战 = 一次 8 回合战斗；每日 1 次 — 事务化
  app.post('/api/player/:username/worldboss/attack', (req, res) => {
    const username = req.params.username;
    if (!username) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const out = attackWorldBoss(store, username);
      if (!out.success) {
        const msg = out.message || '失败';
        let status = 400;
        if (msg.includes('今日挑战次数已用完') || msg.includes('今日已挑战')) status = 409;
        else if (msg.includes('玩家不存在') || msg.includes('角色不存在')) status = 404;
        else if (msg.includes('没有可攻击')) status = 404;
        else if (msg.includes('今日')) status = 409;
        return { status, message: msg };
      }
      // 每日活跃：首次成功攻击 +15（重放为 409，不会进入此分支）
      try { require('../engine/active').addActivePoints(data.players[username], 'boss', 1); } catch (e) { console.error('active boss', e.message); }
      const updated = data.players[username];
      const playerView = updated ? getPlayerView(updated) : null;
      const payload = {
        battle: out.battle,
        bossHp: out.bossHp,
        bossMaxHp: out.bossMaxHp,
        myDamage: out.myDamage,
        killed: out.killed,
        finalHit: out.finalHit,
        rewards: out.rewards,
        expiresAt: out.expiresAt,
        remainingMs: out.remainingMs,
        player: playerView,
      };
      return { status: 200, data: payload };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    const d = result.data;
    // 统一返回 {success, data:{battle,...}} 且保留顶层兼容
    return res.json({
      success: true,
      data: d,
      battle: d.battle,
      bossHp: d.bossHp,
      bossMaxHp: d.bossMaxHp,
      myDamage: d.myDamage,
      killed: d.killed,
      finalHit: d.finalHit,
      rewards: d.rewards,
      expiresAt: d.expiresAt,
      remainingMs: d.remainingMs,
      player: d.player,
    });
  });

  // 调试：强制刷新（admin only — 防玩家调此接口操纵 BOSS 数值）
  app.post('/api/worldboss/spawn', requireAdmin, (req, res) => {
    const result = store.withTransaction((data) => {
      const meta = data.meta;
      meta.worldBoss = null;
      const boss = spawnWorldBoss(store);
      return { status: 200, data: boss };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message || '保存失败请重试' });
    return res.json({ success: true, data: result.data });
  });
}

module.exports = { registerWorldBossRoutes };
