// ====== 世界 BOSS 路由 ======
const { getActiveBoss, attackWorldBoss, spawnWorldBoss, getBossRanking, getPlayerView, getNow } = require('../engine');
const { ok, fail, loadPlayer, savePlayer } = require('./_helpers');

function registerWorldBossRoutes(app, store) {
  app.get('/api/worldboss/active', (req, res) => {
    const boss = getActiveBoss(store);
    const ranking = getBossRanking(store, 10);
    res.json({ success: true, data: { boss, ranking } });
  });

  app.post('/api/player/:username/worldboss/attack', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const player = r.player;
    player.lastBossAttackAt = player.lastBossAttackAt || 0;
    if (getNow() - player.lastBossAttackAt < 5000) return fail(res, '攻击冷却中，请稍候');
    player.lastBossAttackAt = getNow();
    const result = attackWorldBoss(store, req.params.username);
    if (!result.success) return fail(res, result.message);
    const updated = store.getPlayer(req.params.username);
    res.json({
      success: true,
      damage: result.damage, isCrit: result.isCrit,
      bossHp: result.bossHp, bossMaxHp: result.bossMaxHp,
      myDamage: result.myDamage,
      killed: result.killed, finalHit: result.finalHit,
      player: updated ? getPlayerView(updated) : null,
    });
  });

  app.post('/api/worldboss/spawn', (req, res) => {
    const boss = spawnWorldBoss(store);
    store.save();
    res.json({ success: true, data: boss });
  });
}

module.exports = { registerWorldBossRoutes };
