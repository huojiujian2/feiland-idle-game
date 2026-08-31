// ====== 排行榜路由 =====
const { getReadonlyPlayer, getPowerScore, getTotalStats, getStageFull } = require('../engine');
const { ok, fail } = require('./_helpers');
const { ARENA_SHOP_TITLES, COCKFIGHT_DISPLAY_TITLES } = require('../data');

const LEADERBOARD_CONFIG = {
  level: { sort: (a, b) => b.level - a.level || b.exp - a.exp || b.gold - a.gold },
  power: { sort: (a, b) => b.power - a.power },
  gold: { sort: (a, b) => b.gold - a.gold },
  kills: { sort: (a, b) => b.killCount - a.killCount || b.level - a.level },
  reincarnation: { sort: (a, b) => b.reincarnation - b.reincarnation || b.level - a.level },
  boss: { sort: (a, b) => b.bossKills - b.killCount || b.level - a.level }
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
// 竞技场商店永久称号兜底字典（同上，避免显示 key 字符串）
const ARENA_TITLE_NAMES = Object.fromEntries(
  Object.entries(ARENA_SHOP_TITLES).map(([k, v]) => [k, v.name])
);
const ARENA_TITLE_COLORS = Object.fromEntries(
  Object.entries(ARENA_SHOP_TITLES).map(([k, v]) => [k, v.color])
);
// 灵鸡斗场称号兜底字典（同上，避免显示 key 字符串）
const COCK_TITLE_NAMES = Object.fromEntries(
  Object.entries(COCKFIGHT_DISPLAY_TITLES).map(([k, v]) => [k, v.name])
);
const COCK_TITLE_COLORS = Object.fromEntries(
  Object.entries(COCKFIGHT_DISPLAY_TITLES).map(([k, v]) => [k, v.color])
);

function registerLeaderboardRoutes(app, store) {
  app.get('/api/leaderboard', (req, res) => {
    const type = req.query.type || 'level';
    if (!LEADERBOARD_CONFIG[type]) return fail(res, '无效的排行类型');
    // v1.03 P2 2.10：分页（page + pageSize），默认前 100 条
    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize || '100', 10) || 100));
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
        } else if (ARENA_TITLE_NAMES[ct]) {
          // 竞技场商店永久称号
          titleName = ARENA_TITLE_NAMES[ct];
          titleColor = ARENA_TITLE_COLORS[ct];
        } else if (COCK_TITLE_NAMES[ct]) {
          // 灵鸡斗场称号
          titleName = COCK_TITLE_NAMES[ct];
          titleColor = COCK_TITLE_COLORS[ct];
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
    // v1.03 P2 2.10：分页切片（保留 myRank 在全榜中查找）
    const startIdx = (page - 1) * pageSize;
    const ranked = rankedFull.slice(startIdx, startIdx + pageSize);
    let myRank = null;
    if (req.query.username) myRank = rankedFull.find(p => p.username === req.query.username) || null;
    res.json({
      success: true,
      data: {
        type,
        total: players.length,
        page,
        pageSize,
        list: ranked,
        myRank,
      },
    });
  });
}

module.exports = { registerLeaderboardRoutes };
