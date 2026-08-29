// ====== 世界 BOSS 路由（v2.9） ======
const { getActiveBoss, attackWorldBoss, spawnWorldBoss, getBossRanking, getPlayerView, getBossExpiresAt, getBossDayKey } = require('../engine');
const { ok, fail, loadPlayer, savePlayer } = require('./_helpers');

function registerWorldBossRoutes(app, store) {
  // 获取当前活跃 BOSS + 排行榜 + 过期时间 + 当前玩家今日是否已挑战
  app.get('/api/worldboss/active', (req, res) => {
    const boss = getActiveBoss(store);
    const ranking = getBossRanking(store, 10);
    const username = req.query.username || '';
    const player = username ? store.getPlayer(username) : null;
    // v3.4：北京日判定（与引擎 attackWorldBoss 同源，修复 UTC 日期导致的按钮状态错乱）
    const todayKey = getBossDayKey();
    const challengedToday = !!(player && player.lastBossAttackDay === todayKey);
    res.json({
      success: true,
      data: {
        boss,
        ranking,
        expiresAt: getBossExpiresAt(store),
        challengedToday,
        remainingMs: boss ? Math.max(0, (boss.expiresAt || 0) - Date.now()) : 0,
      }
    });
  });

  // 玩家挑战 BOSS：一次挑战 = 一次 5 回合战斗；每日 1 次
  app.post('/api/player/:username/worldboss/attack', (req, res) => {
    const username = req.params.username;
    const r = loadPlayer(store, username);
    if (r.error) return fail(res, r.error);
    const result = attackWorldBoss(store, username);
    if (!result.success) return fail(res, result.message);
    const updated = store.getPlayer(username);
    res.json({
      success: true,
      // 战斗报告
      battle: result.battle,
      bossHp: result.bossHp, bossMaxHp: result.bossMaxHp,
      myDamage: result.myDamage,
      killed: result.killed, finalHit: result.finalHit,
      rewards: result.rewards,
      expiresAt: result.expiresAt,
      remainingMs: result.remainingMs,
      player: updated ? getPlayerView(updated) : null,
    });
  });

  // 调试：强制刷新（不变更日期，但会清掉当前 boss 重新按最新玩家生成）
  app.post('/api/worldboss/spawn', (req, res) => {
    const meta = store.getMeta();
    meta.worldBoss = null;
    store.setMeta(meta);
    const boss = spawnWorldBoss(store);
    store.save();
    res.json({ success: true, data: boss });
  });
}

module.exports = { registerWorldBossRoutes };