// ====== 排行榜路由 =====
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

// v1.02：本地兜底的世界 BOSS 限时称号字典，避免前端未拉缓存时显示 key 字符串
const TIME_TITLE_NAMES = {
  boss_killer_1: '天命弑神者',
  boss_killer_2: '深渊征服者',
  boss_killer_3: '暗影屠戮者',
};
const TIME_TITLE_COLORS = {
  boss_killer_1: '#ffd700',
  boss_killer_2: '#c0c0c0',
  boss_killer_3: '#cd7f32',
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
      // v1.02：把当前佩戴的称号带回来给前端展示
      const ct = rp.currentTitle || null;
      let titleName = null;
      let titleColor = '#9d8cf0';
      if (ct) {
        if (TIME_TITLE_NAMES[ct]) {
          titleName = TIME_TITLE_NAMES[ct];
          titleColor = TIME_TITLE_COLORS[ct];
        } else if (rp.jobInfo?.stages) {
          const found = rp.jobInfo.stages.find(s => `${rp.jobPath}:${s.name}` === ct);
          if (found) titleName = found.name;
        } else if (typeof ct === 'string' && ct.indexOf(':') > 0) {
          // jobId:stageName 兜底裁剪
          const colonIdx = ct.indexOf(':');
          titleName = ct.slice(colonIdx + 1);
        }
      }
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
        currentTitle: ct,
        titleName,
        titleColor,
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
