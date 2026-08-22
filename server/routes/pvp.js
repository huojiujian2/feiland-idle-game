// ====== PvP 竞技场路由 ======
const {
  generateArenaBots, simulatePvP, calcPvpRating, calcPvpRewards,
  getReadonlyPlayer, getPowerScore,
  getSeasonKey, getSeasonIndex, getSeasonDaysLeft,
  getRankTier, getDailyKey, getWeeklyKey, getMonthlyKey,
  settleArenaRewards, maybeResetSeason, applySeasonResetToPlayers,
  buyArenaItem, getPlayerView, getNow,
} = require('../engine');
const { PVP_CD_MS, PVP_LEVEL_RANGE, PVP_CURRENCY_KEY, ARENA_EQUIPMENT } = require('../data');
const { ok, fail, loadPlayer, savePlayer } = require('./_helpers');

function registerPvpRoutes(app, store) {
  // 获取对手列表
  app.get('/api/arena/opponents/:username', (req, res) => {
    const player = store.getPlayer(req.params.username);
    if (!player) return fail(res, '角色不存在');
    const myLevel = player.level || 1;
    const myRating = (player.pvpStats && player.pvpStats.rating) || 1000;
    const bots = generateArenaBots(myLevel, myRating);
    // 缓存本次生成的机器人，保证玩家看到的对手与实际挑战到的是同一个
    const metaForCache = store.getMeta();
    if (!metaForCache.arenaBots || typeof metaForCache.arenaBots !== 'object') metaForCache.arenaBots = {};
    metaForCache.arenaBots[player.username] = { time: getNow(), bots };
    store.setMeta(metaForCache);
    const realOpponents = store.getAllPlayers()
      .filter(p => p.username !== player.username && p.level)
      .filter(p => Math.abs((p.level || 1) - myLevel) <= PVP_LEVEL_RANGE)
      .map(p => {
        const rp = getReadonlyPlayer(p);
        return {
          username: rp.username, name: rp.name, level: rp.level, race: rp.race,
          job: rp.job || '无', godhood: rp.godhood || null,
          power: getPowerScore(rp),
          pvpRating: (rp.pvpStats && rp.pvpStats.rating) || 1000,
          pvpWins: (rp.pvpStats && rp.pvpStats.wins) || 0,
          pvpLosses: (rp.pvpStats && rp.pvpStats.losses) || 0,
          isBot: false,
        };
      });
    const botOpponents = bots.map(b => ({
      username: b.username, name: b.name, level: b.level, race: b.race,
      job: b.job || '无', godhood: b.godhood || null,
      power: getPowerScore(b),
      pvpRating: b.pvpStats.rating, pvpWins: 0, pvpLosses: 0,
      isBot: true,
      activeAffix: b.affixes?.active || null,
      passiveCount: (b.affixes?.passive || []).length,
    }));
    const opponents = [...botOpponents, ...realOpponents]
      .sort((a, b) => Math.abs(a.level - myLevel) - Math.abs(b.level - myLevel))
      .slice(0, 10);
    const cdRemaining = player.pvpStats && player.pvpStats.lastPvpAt
      ? Math.max(0, PVP_CD_MS - (getNow() - player.pvpStats.lastPvpAt)) : 0;
    res.json({
      success: true,
      data: {
        opponents, bots: botOpponents,
        myRating, myWins: (player.pvpStats && player.pvpStats.wins) || 0,
        myLosses: (player.pvpStats && player.pvpStats.losses) || 0,
        myStreak: (player.pvpStats && player.pvpStats.streak) || 0,
        myBestStreak: (player.pvpStats && player.pvpStats.bestStreak) || 0,
        arenaCoins: player[PVP_CURRENCY_KEY] || 0,
        cdRemaining,
      }
    });
  });

  // 挑战
  app.post('/api/arena/challenge', (req, res) => {
    const { username, targetUsername, isBot } = req.body;
    if (!username || !targetUsername) return fail(res, '缺少参数');
    if (username === targetUsername) return fail(res, '不能挑战自己');

    const player = store.getPlayer(username);
    if (!player) return fail(res, '角色不存在');
    const lastPvp = (player.pvpStats && player.pvpStats.lastPvpAt) || 0;
    const cdRemaining = lastPvp ? Math.max(0, PVP_CD_MS - (getNow() - lastPvp)) : 0;
    if (cdRemaining > 0) return fail(res, `冷却中，还需 ${Math.ceil(cdRemaining / 1000)} 秒`);

    let target;
    if (isBot) {
      // 优先从对手列表缓存中找玩家实际选中的机器人（缓存 10 分钟内有效）
      const metaForCache = store.getMeta();
      const cached = metaForCache.arenaBots && metaForCache.arenaBots[username];
      const cacheValid = cached && Array.isArray(cached.bots)
        && (getNow() - cached.time) < 10 * 60 * 1000;
      target = cacheValid
        ? cached.bots.find(b => b.username === targetUsername) || null
        : null;
      if (!target) {
        // 缓存过期或未命中：重新生成一次尝试匹配；仍找不到则要求刷新列表，绝不静默换成别的对手
        const myLevel = player.level || 1;
        const myRating = (player.pvpStats && player.pvpStats.rating) || 1000;
        const rating = myRating + Math.floor(Math.random() * 200) - 50;
        const freshBots = generateArenaBots(myLevel, Math.max(800, rating));
        target = freshBots.find(b => b.username === targetUsername) || null;
        if (!target) return fail(res, '对手已刷新，请重新打开竞技场获取对手列表');
      }
    } else {
      target = store.getPlayer(targetUsername);
      if (!target) return fail(res, '对手不存在');
    }

    const levelDiff = Math.abs((player.level || 1) - (target.level || 1));
    if (levelDiff > PVP_LEVEL_RANGE) return fail(res, `等级差超过 ${PVP_LEVEL_RANGE} 级无法挑战`);

    const battle = simulatePvP(player, target);
    const isWin = battle.result === 'win';
    const myRating = (player.pvpStats && player.pvpStats.rating) || 1000;
    const enemyRating = (target.pvpStats && target.pvpStats.rating) || 1000;
    const ratingResult = calcPvpRating(myRating, enemyRating, isWin);

    if (!player.pvpStats) player.pvpStats = {};
    player.pvpStats.rating = ratingResult.newRating;
    player.pvpStats.lastPvpAt = getNow();
    if (isWin) {
      player.pvpStats.wins = (player.pvpStats.wins || 0) + 1;
      player.pvpStats.streak = (player.pvpStats.streak || 0) + 1;
      if (player.pvpStats.streak > (player.pvpStats.bestStreak || 0)) {
        player.pvpStats.bestStreak = player.pvpStats.streak;
      }
    } else {
      player.pvpStats.losses = (player.pvpStats.losses || 0) + 1;
      player.pvpStats.streak = 0;
    }

    const baseRewards = calcPvpRewards(player.level || 1, isWin, player.pvpStats.streak || 0);
    player.gold = (player.gold || 0) + baseRewards.gold;
    player.exp = (player.exp || 0) + baseRewards.exp;

    let coinsEarned = 0;
    if (isWin) {
      const streakBonus = Math.min(player.pvpStats.streak || 0, 5);
      coinsEarned = 10 + (player.level || 1) + streakBonus * 5;
      player[PVP_CURRENCY_KEY] = (player[PVP_CURRENCY_KEY] || 0) + coinsEarned;
    } else {
      coinsEarned = 2;
      player[PVP_CURRENCY_KEY] = (player[PVP_CURRENCY_KEY] || 0) + coinsEarned;
    }

    const meta = store.getMeta();
    if (!Array.isArray(meta.pvpRecords)) meta.pvpRecords = [];
    meta.pvpRecords.unshift({
      time: getNow(),
      attacker: username, defender: targetUsername,
      attackerName: player.name, defenderName: target.name || target.username,
      result: isWin ? 'win' : 'lose',
      ratingChange: ratingResult.change,
      rewards: { ...baseRewards, coins: coinsEarned },
      isBot: !!isBot,
    });
    if (meta.pvpRecords.length > 200) meta.pvpRecords = meta.pvpRecords.slice(0, 200);
    store.setMeta(meta);

    player.logs = player.logs || [];
    player.logs.push({
      time: getNow(),
      type: 'pvp',
      text: isWin
        ? `竞技场胜利！击败了 ${target.name || target.username}，+${baseRewards.gold}金币 +${baseRewards.exp}经验 +${coinsEarned}竞技币`
        : `竞技场失败...被 ${target.name || target.username} 击败，+${coinsEarned}竞技币`,
    });

    store.setPlayer(player.username, player);
    store.save();
    res.json({
      success: true,
      data: {
        battle, isWin,
        rewards: { ...baseRewards, coins: coinsEarned },
        ratingChange: ratingResult.change,
        newRating: player.pvpStats.rating,
        arenaCoins: player[PVP_CURRENCY_KEY] || 0,
        targetName: target.name || target.username,
        targetLevel: target.level,
        player: getPlayerView(player),
      }
    });
  });

  // 排行榜
  app.get('/api/arena/ranking', (req, res) => {
    const list = store.getAllPlayers()
      .filter(p => p.level)
      .map(p => {
        const rp = getReadonlyPlayer(p);
        const stats = rp.pvpStats || {};
        const total = (stats.wins || 0) + (stats.losses || 0);
        return {
          username: rp.username, name: rp.name, level: rp.level, race: rp.race,
          job: rp.job || '无', godhood: rp.godhood || null,
          rating: stats.rating || 1000,
          wins: stats.wins || 0, losses: stats.losses || 0,
          bestStreak: stats.bestStreak || 0,
          winRate: total > 0 ? Math.round((stats.wins || 0) / total * 100) : 0,
        };
      })
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 50)
      .map((p, i) => ({ rank: i + 1, ...p }));
    res.json({ success: true, data: { list } });
  });

  // 战斗记录
  app.get('/api/arena/records/:username', (req, res) => {
    const meta = store.getMeta();
    const records = (meta.pvpRecords || [])
      .filter(r => r.attacker === req.params.username || r.defender === req.params.username)
      .slice(0, 20);
    res.json({ success: true, data: { records } });
  });

  // 竞技场商店
  app.get('/api/arena/shop', (req, res) => {
    const grouped = {};
    for (const item of ARENA_EQUIPMENT) {
      if (!grouped[item.reqLevel]) grouped[item.reqLevel] = [];
      grouped[item.reqLevel].push(item);
    }
    res.json({ success: true, data: { items: ARENA_EQUIPMENT, grouped } });
  });
  app.post('/api/arena/buy', (req, res) => {
    const { username, itemId } = req.body;
    if (!username || !itemId) return fail(res, '缺少参数');
    const player = store.getPlayer(username);
    if (!player) return fail(res, '角色不存在');
    const result = buyArenaItem(player, itemId);
    if (!result.success) return res.json(result);
    store.setPlayer(username, player);
    store.save();
    res.json({ success: true, data: { item: result.item, arenaCoins: player[PVP_CURRENCY_KEY] || 0, player: getPlayerView(player) } });
  });

  // 赛季信息
  app.get('/api/arena/season', (req, res) => {
    const meta = store.getMeta();
    const currentSeason = getSeasonKey();
    if (!meta.currentSeason) meta.currentSeason = currentSeason;
    const reset = maybeResetSeason(meta);
    if (reset.reset) {
      applySeasonResetToPlayers(store);
      store.save();
    }
    res.json({
      success: true,
      data: {
        currentSeason,
        seasonIdx: getSeasonIndex(),
        daysLeft: getSeasonDaysLeft(),
        monthsPerSeason: 3,
        arenaCoins: store.getPlayer(req.query.username || '')?.[PVP_CURRENCY_KEY] || 0,
        lastResetFrom: meta.lastResetFrom || null,
        lastResetAt: meta.lastResetAt || null,
      }
    });
  });

  // 赛季奖励快照
  app.get('/api/arena/rewards/:period', (req, res) => {
    const period = req.params.period;
    if (!['daily', 'weekly', 'monthly'].includes(period)) return fail(res, '无效的奖励周期');
    const meta = store.getMeta();
    const rankingList = store.getAllPlayers()
      .filter(p => p.level)
      .map(p => {
        const rp = getReadonlyPlayer(p);
        return { username: rp.username, rating: (rp.pvpStats && rp.pvpStats.rating) || 1000 };
      })
      .sort((a, b) => b.rating - a.rating);
    const top100 = rankingList.slice(0, 100);
    const rewardMap = {};
    for (let i = 0; i < top100.length; i++) {
      const rank = i + 1;
      const tier = getRankTier(period, rank);
      if (tier) rewardMap[top100[i].username] = { rank, tier: tier.tier, coins: tier.coins };
    }
    const periodKey = period === 'daily' ? getDailyKey()
      : period === 'weekly' ? getWeeklyKey()
      : getMonthlyKey();
    const settled = (meta.arenaRewards && meta.arenaRewards[period] && meta.arenaRewards[period][periodKey]) || null;
    res.json({
      success: true,
      data: {
        period, periodKey,
        ranking: top100,
        myReward: req.query.username ? rewardMap[req.query.username] : null,
        rewardMap, settled: !!settled, settledRewards: settled,
        rules: {
          S: '1 名 · 1/2-3/4-10/11-20/21-50/51-100',
          tiers: { S: '1', A: '2-3', B: '4-10', C: '11-20', D: '21-50', E: '51-100' },
        },
      }
    });
  });

  // 手动结算
  app.post('/api/arena/settle', (req, res) => {
    const { period } = req.body;
    if (!['daily', 'weekly', 'monthly'].includes(period)) return fail(res, '无效的奖励周期');
    const meta = store.getMeta();
    const rankingList = store.getAllPlayers()
      .filter(p => p.level)
      .map(p => {
        const rp = getReadonlyPlayer(p);
        return { username: rp.username, rating: (rp.pvpStats && rp.pvpStats.rating) || 1000 };
      })
      .sort((a, b) => b.rating - a.rating);
    const result = settleArenaRewards(meta, period, rankingList);
    if (result.already) return res.json({ success: true, data: { already: true, key: result.key } });
    let credited = 0;
    for (const [uname, info] of Object.entries(result.rewards)) {
      const p = store.getPlayer(uname);
      if (!p) continue;
      p[PVP_CURRENCY_KEY] = (p[PVP_CURRENCY_KEY] || 0) + info.coins;
      p.logs = p.logs || [];
      p.logs.push({
        time: getNow(),
        type: 'arena-reward',
        text: `【${period === 'daily' ? '日结' : period === 'weekly' ? '周结' : '月结'}奖励】${info.tier} 级 (第 ${info.rank} 名) +${info.coins} 竞技币`,
      });
      store.setPlayer(uname, p);
      credited++;
    }
    store.setMeta(meta);
    store.save();
    res.json({ success: true, data: { ...result, creditedCount: credited } });
  });
}

module.exports = { registerPvpRoutes };
