// ====== PvP 竞技场路由 ======
const {
  generateArenaBots, simulatePvP, calcPvpRating, calcPvpRewards,
  getReadonlyPlayer, getPowerScore,
  getSeasonKey, getSeasonIndex, getSeasonDaysLeft,
  getRankTier, getDailyKey, getWeeklyKey, getMonthlyKey,
  settleArenaRewards, settleDuePeriods, maybeResetSeason, applySeasonResetToPlayers,
  buyArenaItem, getPlayerView, getNow,
} = require('../engine');
const { PVP_CD_MS, PVP_LEVEL_RANGE, PVP_CURRENCY_KEY, ARENA_EQUIPMENT, ARENA_TITLES } = require('../data');
const { ok, fail } = require('./_helpers');
const { isTestMode } = require('../engine/state');

function nextDailyKey(key) {
  const d = new Date(key + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}
function nextWeeklyKey(key) {
  const d = new Date(key + 'T00:00:00');
  d.setDate(d.getDate() + 7);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}
function nextMonthlyKey(key) {
  const [y,m] = key.split('-').map(Number);
  const d = new Date(y, m-1, 1);
  d.setMonth(d.getMonth()+1);
  const ny = d.getFullYear();
  const nm = String(d.getMonth()+1).padStart(2,'0');
  return `${ny}-${nm}`;
}
function getNextPeriodKey(key, period) {
  if (period === 'daily') return nextDailyKey(key);
  if (period === 'weekly') return nextWeeklyKey(key);
  if (period === 'monthly') return nextMonthlyKey(key);
  return key;
}
function getCurKeyForPeriod(period) {
  if (period === 'daily') return getDailyKey();
  if (period === 'weekly') return getWeeklyKey();
  if (period === 'monthly') return getMonthlyKey();
  return '';
}

function registerPvpRoutes(app, store) {
  // 获取对手列表
  app.get('/api/arena/opponents/:username', (req, res) => {
    const player = store.getPlayer(req.params.username);
    if (!player) return fail(res, '角色不存在', 404);
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
    const { username, targetUsername, isBot, requestId } = req.body || {};
    if (!username || !targetUsername) return fail(res, '缺少参数', 400);
    if (!requestId) return fail(res, '缺少参数', 400);
    if (username === targetUsername) return fail(res, '不能挑战自己', 409);
    const ledgerId = `pvp:challenge:${requestId}`;
    // quick existence check for replay before heavy logic (also checked inside transaction for atomicity)
    const playerPre = store.getPlayer(username);
    if (!playerPre) return fail(res, '角色不存在', 404);

    const result = store.withTransaction((data) => {
      const meta = data.meta;
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      // 1) 重放检查：先查 ledger
      if (Array.isArray(player.settlementLedger)) {
        const found = player.settlementLedger.find(e => e.id === ledgerId);
        if (found) {
          // 绑定校验
          const ctx = found.requestContext || {};
          if (ctx.username !== username || ctx.targetUsername !== targetUsername || !!ctx.isBot !== !!isBot) {
            return { status: 409, message: 'requestId 冲突' };
          }
          if (!found.fullResult) {
            return { status: 500, message: '数据损坏' };
          }
          return { status: 200, data: found.fullResult, already: true };
        }
      }
      // 1b) 查 pvpRecords
      if (meta.pvpRecords && Array.isArray(meta.pvpRecords)) {
        const rec = meta.pvpRecords.find(r => r.id === ledgerId);
        if (rec) {
          const ctx = rec.requestContext || {};
          if (ctx.username !== username || ctx.targetUsername !== targetUsername || !!ctx.isBot !== !!isBot) {
            return { status: 409, message: 'requestId 冲突' };
          }
          if (!rec.fullResult) {
            return { status: 500, message: '数据损坏' };
          }
          return { status: 200, data: rec.fullResult, already: true };
        }
      }
      // 2) 自挑战已在外层校验，但内部也需再校验（防止并发）
      if (username === targetUsername) return { status: 409, message: '不能挑战自己' };
      const lastPvp = (player.pvpStats && player.pvpStats.lastPvpAt) || 0;
      const cdRemaining = lastPvp ? Math.max(0, PVP_CD_MS - (getNow() - lastPvp)) : 0;
      if (cdRemaining > 0) return { status: 409, message: `冷却中，还需 ${Math.ceil(cdRemaining / 1000)} 秒` };

      let target;
      if (isBot) {
        const cached = meta.arenaBots && meta.arenaBots[username];
        const cacheValid = cached && Array.isArray(cached.bots) && (getNow() - cached.time) < 10 * 60 * 1000;
        target = cacheValid ? cached.bots.find(b => b.username === targetUsername) || null : null;
        if (!target) {
          const myLevel = player.level || 1;
          const myRating = (player.pvpStats && player.pvpStats.rating) || 1000;
          const rating = myRating + Math.floor(Math.random() * 200) - 50;
          const freshBots = generateArenaBots(myLevel, Math.max(800, rating));
          target = freshBots.find(b => b.username === targetUsername) || null;
          if (!target) return { status: 409, message: '对手已刷新，请重新打开竞技场获取对手列表' };
        }
      } else {
        target = data.players[targetUsername];
        if (!target) return { status: 404, message: '对手不存在' };
      }

      const levelDiff = Math.abs((player.level || 1) - (target.level || 1));
      if (levelDiff > PVP_LEVEL_RANGE) return { status: 409, message: `等级差超过 ${PVP_LEVEL_RANGE} 级无法挑战` };

      const battle = simulatePvP(player, target);
      const isWin = battle.result === 'win';
      const isDraw = battle.result === 'draw';
      const myRating = (player.pvpStats && player.pvpStats.rating) || 1000;
      const enemyRating = (target.pvpStats && target.pvpStats.rating) || 1000;
      const pvpScore = isWin ? 1 : (isDraw ? 0.5 : 0);
      const expected = 1 / (1 + Math.pow(10, (enemyRating - myRating) / 400));
      const K = 32;
      const ratingChange = Math.round(K * (pvpScore - expected));

      if (!player.pvpStats) player.pvpStats = {};
      player.pvpStats.rating = myRating + ratingChange;
      player.pvpStats.lastPvpAt = getNow();
      if (isWin) {
        player.pvpStats.wins = (player.pvpStats.wins || 0) + 1;
        player.pvpStats.streak = (player.pvpStats.streak || 0) + 1;
        if (player.pvpStats.streak > (player.pvpStats.bestStreak || 0)) {
          player.pvpStats.bestStreak = player.pvpStats.streak;
        }
      } else if (isDraw) {
        player.pvpStats.draws = (player.pvpStats.draws || 0) + 1;
      } else {
        player.pvpStats.losses = (player.pvpStats.losses || 0) + 1;
        player.pvpStats.streak = 0;
      }

      const baseRewards = calcPvpRewards(player.level || 1, isWin, player.pvpStats.streak || 0);
      let gold, exp, coinsEarned;
      if (isDraw) {
        gold = Math.max(8, Math.floor((player.level || 1) * 2));
        exp = 5 + Math.floor((player.level || 1) * 1);
        coinsEarned = 4;
      } else {
        gold = baseRewards.gold;
        exp = baseRewards.exp;
        coinsEarned = isWin ? 10 + (player.level || 1) + Math.min(player.pvpStats.streak || 0, 5) * 5 : 2;
      }
      player.gold = (player.gold || 0) + gold;
      player.exp = (player.exp || 0) + exp;
      player[PVP_CURRENCY_KEY] = (player[PVP_CURRENCY_KEY] || 0) + coinsEarned;

      if (!Array.isArray(meta.pvpRecords)) meta.pvpRecords = [];

      const fullResult = {
        battle,
        isWin,
        isDraw,
        rewards: { gold, exp, coins: coinsEarned },
        ratingChange,
        newRating: player.pvpStats.rating,
        arenaCoins: player[PVP_CURRENCY_KEY] || 0,
        targetName: target.name || target.username,
        targetLevel: target.level,
        targetJob: target.job || '无',
        player: getPlayerView(player),
      };

      // settlement ledger
      if (!Array.isArray(player.settlementLedger)) player.settlementLedger = [];
      const reward = { gold, exp, coins: coinsEarned };
      // assert already validated via calc, but we push
      player.settlementLedger.push({
        id: ledgerId,
        at: getNow(),
        type: 'pvp_challenge',
        reward,
        source: `pvp:challenge:${requestId}`,
        fullResult,
        requestContext: { username, targetUsername, isBot: !!isBot },
      });
      if (player.settlementLedger.length > 100) player.settlementLedger.splice(0, player.settlementLedger.length - 100);

      meta.pvpRecords.unshift({
        id: ledgerId,
        time: getNow(),
        attacker: username, defender: targetUsername,
        attackerName: player.name, defenderName: target.name || target.username,
        result: battle.result,
        ratingChange,
        rewards: { gold, exp, coins: coinsEarned },
        isBot: !!isBot,
        fullResult,
        requestContext: { username, targetUsername, isBot: !!isBot },
      });
      if (meta.pvpRecords.length > 200) meta.pvpRecords = meta.pvpRecords.slice(0, 200);

      player.logs = player.logs || [];
      player.logs.push({
        time: getNow(),
        type: 'pvp',
        text: isWin ? `竞技场胜利！击败了 ${target.name || target.username}，+${gold}金币 +${exp}经验 +${coinsEarned}竞技币` : isDraw ? `竞技场平局，与 ${target.name || target.username} 战至力竭，+${gold}金币 +${exp}经验 +${coinsEarned}竞技币` : `竞技场失败...被 ${target.name || target.username} 击败，+${coinsEarned}竞技币`,
      });
      // meta and player already mutated in data, no need setPlayer/setMeta separately because data is reference
      // But call setMeta/setPlayer to trigger markDirty? Not needed inside transaction because save will be done.
      // However for consistency, ensure data.players and data.meta are updated (they already are)

      return { status: 200, data: fullResult };
    });

    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    if (result.already) return res.json({ success: true, data: result.data, already: true });
    return res.json({ success: true, data: result.data });
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
    const username = req.query.username || '';
    const player = username ? store.getPlayer(username) : null;
    const ownedKeys = player ? Object.keys(player.titles || {}) : [];
    const titles = ARENA_TITLES.map(t => ({ ...t, owned: ownedKeys.includes(t.titleKey) }));
    res.json({ success: true, data: { items: ARENA_EQUIPMENT, grouped, titles } });
  });
  app.post('/api/arena/buy', (req, res) => {
    const { username, itemId } = req.body || {};
    if (!username || !itemId) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = buyArenaItem(player, itemId);
      if (!r.success) return { status: 400, message: r.message };
      return { status: 200, data: { item: r.item, arenaCoins: player[PVP_CURRENCY_KEY] || 0, player: getPlayerView(player) } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    // Handle both {success:false} and message cases from buyArenaItem legacy (it returns {success:false,message})
    // Our transaction already handles, but for compatibility, if result is 200 we return success
    return res.json({ success: true, data: result.data });
  });

  // 赛季信息 — 事务化
  app.get('/api/arena/season', (req, res) => {
    const result = store.withTransaction((data) => {
      const meta = data.meta;
      const currentSeason = getSeasonKey();
      if (!meta.currentSeason) meta.currentSeason = currentSeason;
      const reset = maybeResetSeason(meta);
      if (reset.reset) {
        applySeasonResetToPlayers(store);
      }
      return {
        status: 200,
        data: {
          currentSeason,
          seasonIdx: getSeasonIndex(),
          daysLeft: getSeasonDaysLeft(),
          monthsPerSeason: 3,
          arenaCoins: (data.players[req.query.username || ''] && data.players[req.query.username][PVP_CURRENCY_KEY]) || 0,
          lastResetFrom: meta.lastResetFrom || null,
          lastResetAt: meta.lastResetAt || null,
        }
      };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message || '保存失败请重试' });
    return res.json({ success: true, data: result.data });
  });

  // 赛季奖励快照 — 支持 periodKey 查询
  app.get('/api/arena/rewards/:period', (req, res) => {
    const period = req.params.period;
    if (!['daily', 'weekly', 'monthly'].includes(period)) return fail(res, '无效的奖励周期', 400);
    const periodKeyQuery = req.query.periodKey || req.query.period_key || '';
    const usernameQ = req.query.username || '';
    const meta = store.getMeta();
    const curKey = getCurKeyForPeriod(period);
    let targetKey = periodKeyQuery ? String(periodKeyQuery) : curKey;
    // 格式校验 if periodKey provided
    if (periodKeyQuery) {
      if (period === 'daily' && !/^\d{4}-\d{2}-\d{2}$/.test(targetKey)) return fail(res, 'periodKey 格式非法', 400);
      if (period === 'weekly' && !/^\d{4}-\d{2}-\d{2}$/.test(targetKey)) return fail(res, 'periodKey 格式非法', 400);
      if (period === 'monthly' && !/^\d{4}-\d{2}$/.test(targetKey)) return fail(res, 'periodKey 格式非法', 400);
      if (period === 'weekly') {
        const d = new Date(targetKey + 'T00:00:00');
        if (d.getDay() !== 1) return fail(res, 'periodKey 必须为周一', 400);
      }
    }
    // 保留窗口校验
    const limits = { daily: 30, weekly: 12, monthly: 12 };
    // For simplicity, if targetKey not in arenaRewards and not in arenaSkipped and is too old, return 400/404
    // Compute age by comparing sorted keys count? We'll approximate by checking if targetKey < oldest retained key when over limit
    // But we can just check existence in ledger/skipped if beyond 30 etc.
    // If targetKey is far past and not found, we return 404超出保留窗口
    // Determine if beyond retention by checking if number of stored keys exceeds limit and targetKey is older than smallest stored
    const storedMap = (meta.arenaRewards && meta.arenaRewards[period]) || {};
    const skippedMap = (meta.arenaSkipped && meta.arenaSkipped[period]) || {};
    const has = storedMap[targetKey] !== undefined || skippedMap[targetKey] !== undefined;
    // Also check ledger for any player that has this periodKey settled (fallback)
    let inLedger = false;
    if (!has && usernameQ) {
      const p = store.getPlayer(usernameQ);
      if (p && Array.isArray(p.settlementLedger)) {
        const ledgerIdPrefix = `arena:${period}:${targetKey}:`;
        inLedger = p.settlementLedger.some(e => e.id && e.id.startsWith(ledgerIdPrefix));
      }
    } else if (!has) {
      // check any player's ledger? Could be expensive, but for retention we may check all players quickly
      // If not has and targetKey is older than curKey minus limit*period, we treat as out of window
    }
    // Simple out-of-window heuristic: if targetKey < curKey and distance exceeds limit, and not found, return 404
    if (!has && !inLedger && targetKey !== curKey) {
      // estimate oldest allowed
      let oldestAllowed = curKey;
      // For daily, subtract limit days
      try {
        if (period === 'daily') {
          const d = new Date(curKey + 'T00:00:00');
          d.setDate(d.getDate() - limits.daily);
          const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const da = String(d.getDate()).padStart(2,'0');
          oldestAllowed = `${y}-${m}-${da}`;
        } else if (period === 'weekly') {
          const d = new Date(curKey + 'T00:00:00');
          d.setDate(d.getDate() - limits.weekly*7);
          const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const da = String(d.getDate()).padStart(2,'0');
          // adjust to Monday
          const day = d.getDay(); const diff = day===0?-6:1-day; d.setDate(d.getDate()+diff);
          const yy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0');
          oldestAllowed = `${yy}-${mm}-${dd}`;
        } else if (period === 'monthly') {
          const [y,m] = curKey.split('-').map(Number);
          const d = new Date(y, m-1, 1);
          d.setMonth(d.getMonth() - limits.monthly);
          oldestAllowed = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        }
        if (targetKey < oldestAllowed) {
          return res.status(404).json({ success: false, message: '超出保留窗口' });
        }
      } catch(_) {}
    }

    // Build ranking for display (current ranking)
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
    const settled = (meta.arenaRewards && meta.arenaRewards[period] && meta.arenaRewards[period][targetKey]) || null;
    const skipped = (meta.arenaSkipped && meta.arenaSkipped[period] && meta.arenaSkipped[period][targetKey]) || null;
    return res.json({
      success: true,
      data: {
        period, periodKey: targetKey,
        ranking: top100,
        myReward: usernameQ ? rewardMap[usernameQ] : null,
        rewardMap, settled: !!settled, settledRewards: settled, skipped: !!skipped,
        rules: {
          S: '1 名 · 1/2-3/4-10/11-20/21-50/51-100',
          tiers: { S: '1', A: '2-3', B: '4-10', C: '11-20', D: '21-50', E: '51-100' },
        },
      }
    });
  });

  // 手动结算 — 鉴权 + periodKey 校验 + 事务
  app.post('/api/arena/settle', (req, res) => {
    const adminToken = req.headers['x-admin-token'];
    const isTest = isTestMode();
    const expected = process.env.ADMIN_TOKEN;
    if (!(isTest || (expected && adminToken === expected))) return fail(res, '无权限', 403);
    const { period, periodKey } = req.body || {};
    if (!['daily', 'weekly', 'monthly'].includes(period)) return fail(res, '无效的奖励周期', 400);
    const curKey = getCurKeyForPeriod(period);
    let targetKey = periodKey ? String(periodKey) : null;
    if (targetKey) {
      if (period === 'daily' && !/^\d{4}-\d{2}-\d{2}$/.test(targetKey)) return fail(res, 'periodKey 格式非法', 400);
      if (period === 'weekly' && !/^\d{4}-\d{2}-\d{2}$/.test(targetKey)) return fail(res, 'periodKey 格式非法', 400);
      if (period === 'monthly' && !/^\d{4}-\d{2}$/.test(targetKey)) return fail(res, 'periodKey 格式非法', 400);
      if (period === 'weekly') {
        const d = new Date(targetKey + 'T00:00:00');
        if (d.getDay() !== 1) return fail(res, 'periodKey 必须为周一', 400);
      }
      if (!(targetKey < curKey)) return fail(res, 'periodKey 必须为已结束周期', 400);
    } else {
      // 若不传，取 nextKey
      const metaPre = store.getMeta();
      // Ensure cursors initialized — replicate ensureArenaCursors logic via engine
      // We will compute nextKey inside transaction, but for validation we need meta
      if (!metaPre.arenaCursors || !metaPre.arenaCursors[period]) {
        // initialize via engine's ensure (will be done in settleDuePeriods, but for manual we compute fallback)
        targetKey = null; // delegate
      } else {
        targetKey = getNextPeriodKey(metaPre.arenaCursors[period], period);
        if (!(targetKey < curKey)) return fail(res, '暂无可结算周期', 400);
      }
    }

    // If targetKey still null (no cursor), we need to handle via settleDuePeriods inside transaction
    if (!targetKey) {
      const result = store.withTransaction((data) => {
        // delegate to settleDuePeriods which handles cursor init and multiple periods
        // But settleDuePeriods expects to settle all due periods for all three periods, not just one.
        // For manual path without periodKey, we can call settleArenaRewards for the computed nextKey after ensuring cursors.
        // Instead, we can call settleDuePeriods and then return.
        try {
          settleDuePeriods(store);
          return { status: 200, already: false };
        } catch (e) {
          return { status: 500, message: e.message };
        }
      });
      if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
      return res.json({ success: true, data: result });
    }

    const rankingList = store.getAllPlayers()
      .filter(p => p.level)
      .map(p => {
        const rp = getReadonlyPlayer(p);
        return { username: rp.username, rating: (rp.pvpStats && rp.pvpStats.rating) || 1000 };
      })
      .sort((a, b) => b.rating - a.rating);

    const result = store.withTransaction((data) => {
      const meta = data.meta;
      if (!meta.arenaRewards) meta.arenaRewards = { daily:{}, weekly:{}, monthly:{} };
      if (!meta.arenaSkipped) meta.arenaSkipped = { daily:{}, weekly:{}, monthly:{} };
      for (const pp of ['daily','weekly','monthly']) {
        if (!meta.arenaRewards[pp]) meta.arenaRewards[pp] = {};
        if (!meta.arenaSkipped[pp]) meta.arenaSkipped[pp] = {};
      }
      if (meta.arenaSkipped[period][targetKey] || meta.arenaRewards[period][targetKey]) {
        return { status: 200, already: true, key: targetKey };
      }
      // Ensure cursors exists
      if (!meta.arenaCursors || !meta.arenaCursors[period]) {
        // initialize to two periods ago logic (engine will handle via settleDuePeriods, but we need fallback)
        // For manual, we set cursor to previous key so nextKey = targetKey
        // We'll compute cursor as previous of targetKey
        // Simplify: set cursor to previous key of targetKey
        let prev;
        if (period === 'daily') {
          const d = new Date(targetKey + 'T00:00:00');
          d.setDate(d.getDate() - 1);
          const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const da = String(d.getDate()).padStart(2,'0');
          prev = `${y}-${m}-${da}`;
        } else if (period === 'weekly') {
          const d = new Date(targetKey + 'T00:00:00');
          d.setDate(d.getDate() - 7);
          const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const da = String(d.getDate()).padStart(2,'0');
          prev = `${y}-${m}-${da}`;
        } else {
          const [y,m] = targetKey.split('-').map(Number);
          const d = new Date(y, m-1, 1);
          d.setMonth(d.getMonth()-1);
          prev = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        }
        meta.arenaCursors[period] = prev;
      }
      const curCursor = meta.arenaCursors[period];
      const expectedNext = getNextPeriodKey(curCursor, period);
      try {
        const r = settleArenaRewards(store, period, rankingList, targetKey);
        // 仅当 targetKey === expectedNext 才推进 cursor
        if (targetKey === expectedNext) {
          meta.arenaCursors[period] = targetKey;
        }
        // Return credited count
        let credited = Object.keys(r.rewards || {}).length;
        return { status: 200, key: targetKey, rewarded: r.rewarded, rewards: r.rewards, creditedCount: credited };
      } catch (e) {
        return { status: 500, message: e.message };
      }
    });

    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    if (result.already) return res.json({ success: true, data: { already: true, key: result.key } });
    return res.json({ success: true, data: result });
  });
}

module.exports = { registerPvpRoutes };
