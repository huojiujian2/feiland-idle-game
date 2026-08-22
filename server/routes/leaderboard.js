// ====== 排行榜路由 ======
const { getReadonlyPlayer, getPowerScore, getTotalStats, getStageFull } = require('../engine');
const { ok, fail } = require('./_helpers');

const LEADERBOARD_CONFIG = {
  level: { sort: (a, b) => b.level - a.level || b.exp - a.exp || b.gold - a.gold },
  power: { sort: (a, b) => b.power - a.power },
  gold: { sort: (a, b) => b.gold - a.gold },
  kills: { sort: (a, b) => b.killCount - a.killCount || b.level - a.level },
  reincarnation: { sort: (a, b) => b.reincarnation - a.reincarnation || b.level - a.level },
  boss: { sort: (a, b) => b.bossKills - a.bossKills || b.level - a.level }
};

function registerLeaderboardRoutes(app, store) {
  app.get('/api/leaderboard', (req, res) => {
    const type = req.query.type || 'level';
    if (!LEADERBOARD_CONFIG[type]) return fail(res, '无效的排行类型');
    const players = store.getAllPlayers().map(p => {
      const rp = getReadonlyPlayer(p);
      const power = getPowerScore(rp);
      const total = getTotalStats(rp);
      const stageInfo = getStageFull(rp.level, rp.godhood);
      return {
        username: rp.username,
        name: rp.name,
        race: rp.race,
        level: rp.level, exp: rp.exp, gold: rp.gold,
        killCount: rp.killCount || 0,
        reincarnation: rp.reincarnation || 0,
        bossKills: rp.bossKills || 0,
        job: rp.job, jobPath: rp.jobPath, godhood: rp.godhood || null,
        stage: stageInfo.name, stageColor: stageInfo.color,
        power,
        atk: total.atk, def: total.def, hp: total.hp, agi: total.agi,
      };
    });
    const sorted = [...players].sort(LEADERBOARD_CONFIG[type].sort);
    const rankedFull = sorted.map((p, idx) => ({ rank: idx + 1, ...p }));
    const ranked = rankedFull.slice(0, 100);
    let myRank = null;
    if (req.query.username) myRank = rankedFull.find(p => p.username === req.query.username) || null;
    res.json({ success: true, data: { type, total: players.length, list: ranked, myRank } });
  });
}

module.exports = { registerLeaderboardRoutes };
