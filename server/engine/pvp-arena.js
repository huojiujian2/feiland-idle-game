// ====== PVP 竞技场结算与赛季（从 pvp.js 拆分，满足 >800 拆分规范） ======
// @file server/engine/pvp-arena.js
// @module pvp-arena
// @description 竞技场赛季、日/周/月结算、游标与排行榜奖励（原 pvp.js L189-L730）
//
// 本文件结构：
// 1. 赛季 key 与天数 (L10-L40)
// 2. 排名 tier 判定 (L42-L55)
// 3. 赛季结算 settleArenaRewards (L57-L180) - 含 arenaCoins 增加与 ledger
// 4. 游标与定时器 settleDuePeriods (L182-L350)
// 5. 赛季重置 maybeResetSeason / applySeasonResetToPlayers (L352-L380)

const { getNow } = require('./state');
const { getDailyKey, getWeeklyKey, getMonthlyKey } = require('./daily');
const { ARENA_RANK_REWARDS, PVP_CURRENCY_KEY, SEASON_MONTHS } = require('../data');
const { assertSettlementReward } = require('./settlement');

function getSeasonKey() {
  const d = new Date(getNow());
  const y = d.getFullYear();
  const monthIdx = d.getMonth();
  const seasonIdx = Math.floor(monthIdx / SEASON_MONTHS);
  return `${y}-S${seasonIdx + 1}`;
}
function getSeasonIndex() {
  const d = new Date(getNow());
  return Math.floor(d.getMonth() / SEASON_MONTHS);
}
function getSeasonDaysLeft() {
  const d = new Date(getNow());
  const seasonIdx = getSeasonIndex();
  const nextStartMonth = (seasonIdx + 1) * SEASON_MONTHS;
  const nextStart = new Date(d.getFullYear(), nextStartMonth, 1);
  const ms = nextStart.getTime() - d.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function getRankTier(period, rankNum) {
  if (!rankNum || rankNum < 1 || rankNum > 100) return null;
  for (const r of ARENA_RANK_REWARDS[period]) {
    if (rankNum >= r.minRank && rankNum <= r.maxRank) return r;
  }
  return null;
}

// 赛季结算 - 新签名 store, period, rankingList, periodKey (periodKey 必传)
function settleArenaRewards(storeOrMeta, period, rankingList, periodKey) {
  if (!periodKey || typeof periodKey !== 'string') {
    throw new Error('periodKey 必传且为字符串');
  }
  if (!['daily','weekly','monthly'].includes(period)) {
    throw new Error('无效 period');
  }
  let store = null;
  let meta = null;
  if (storeOrMeta && typeof storeOrMeta.getMeta === 'function') {
    store = storeOrMeta;
    meta = store.getMeta();
  } else {
    meta = storeOrMeta;
    store = storeOrMeta && storeOrMeta._storeRef ? storeOrMeta._storeRef : null;
  }
  if (!meta) {
    if (store && store.getMeta) meta = store.getMeta();
    else meta = storeOrMeta;
  }
  if (!meta.arenaRewards) meta.arenaRewards = {};
  if (!meta.arenaRewards[period]) meta.arenaRewards[period] = {};
  if (!meta.arenaSkipped) meta.arenaSkipped = { daily:{}, weekly:{}, monthly:{} };
  if (!meta.arenaSkipped[period]) meta.arenaSkipped[period] = {};
  if (meta.arenaSkipped[period][periodKey]) return { rewarded: 0, already: true, key: periodKey };
  if (meta.arenaRewards[period][periodKey]) return { rewarded: 0, already: true, key: periodKey };
  const rewards = {};
  let rewardedCount = 0;
  const list = Array.isArray(rankingList) ? rankingList : [];
  for (let i = 0; i < list.length && i < 100; i++) {
    const p = list[i];
    if (!p || !p.username) continue;
    const rank = i + 1;
    const tier = getRankTier(period, rank);
    if (!tier) continue;
    rewards[p.username] = { tier: tier.tier, rank, coins: tier.coins };
    rewardedCount++;
  }
  meta.arenaRewards[period][periodKey] = rewards;
  if (store && typeof store.getPlayer === 'function') {
    const typeMap = { daily:'arena_daily', weekly:'arena_weekly', monthly:'arena_monthly' };
    const ledgerType = typeMap[period];
    for (let i = 0; i < list.length && i < 100; i++) {
      const entry = list[i];
      if (!entry || !entry.username) continue;
      const rank = i + 1;
      const tier = getRankTier(period, rank);
      if (!tier) continue;
      const player = store.getPlayer(entry.username);
      if (!player) continue;
      const reward = { coins: tier.coins };
      const v = assertSettlementReward(ledgerType, reward);
      if (!v.valid) continue;
      if (!Array.isArray(player.settlementLedger)) player.settlementLedger = [];
      const ledgerId = `arena:${period}:${periodKey}:${entry.username}`;
      if (player.settlementLedger.some(e => e.id === ledgerId)) continue;
      player.settlementLedger.push({
        id: ledgerId,
        at: getNow(),
        type: ledgerType,
        reward,
        source: `arena:${period}:${periodKey}`,
      });
      if (player.settlementLedger.length > 100) player.settlementLedger.splice(0, player.settlementLedger.length - 100);
      // 关键修复：增加竞技币（原实现遗漏，仅写 ledger 导致奖励丢失）
      player[PVP_CURRENCY_KEY] = (player[PVP_CURRENCY_KEY] || 0) + tier.coins;
      store.setPlayer(entry.username, player);
    }
  }
  if (store && typeof store.setMeta === 'function') store.setMeta(meta);
  return { rewarded: rewardedCount, key: periodKey, rewards };
}

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

function ensureArenaCursors(meta) {
  if (!meta.arenaCursors || typeof meta.arenaCursors !== 'object' || Array.isArray(meta.arenaCursors)) {
    const now = getNow();
    const twoDaysAgo = new Date(now - 2*86400000);
    twoDaysAgo.setHours(0,0,0,0);
    const dailyKey = `${twoDaysAgo.getFullYear()}-${String(twoDaysAgo.getMonth()+1).padStart(2,'0')}-${String(twoDaysAgo.getDate()).padStart(2,'0')}`;
    const twoWeeksAgo = new Date(now - 14*86400000);
    twoWeeksAgo.setHours(0,0,0,0);
    const day = twoWeeksAgo.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(twoWeeksAgo);
    monday.setDate(twoWeeksAgo.getDate() + diffToMonday);
    const weeklyKey = `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;
    const twoMonthsAgo = new Date(now);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const monthlyKey = `${twoMonthsAgo.getFullYear()}-${String(twoMonthsAgo.getMonth()+1).padStart(2,'0')}`;
    meta.arenaCursors = { daily: dailyKey, weekly: weeklyKey, monthly: monthlyKey };
  } else {
    if (!meta.arenaCursors.daily) {
      const twoDaysAgo = new Date(getNow() - 2*86400000);
      twoDaysAgo.setHours(0,0,0,0);
      meta.arenaCursors.daily = `${twoDaysAgo.getFullYear()}-${String(twoDaysAgo.getMonth()+1).padStart(2,'0')}-${String(twoDaysAgo.getDate()).padStart(2,'0')}`;
    }
    if (!meta.arenaCursors.weekly) {
      const twoWeeksAgo = new Date(getNow() - 14*86400000);
      twoWeeksAgo.setHours(0,0,0,0);
      const day = twoWeeksAgo.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(twoWeeksAgo);
      monday.setDate(twoWeeksAgo.getDate() + diffToMonday);
      meta.arenaCursors.weekly = `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;
    }
    if (!meta.arenaCursors.monthly) {
      const twoMonthsAgo = new Date(getNow());
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      meta.arenaCursors.monthly = `${twoMonthsAgo.getFullYear()}-${String(twoMonthsAgo.getMonth()+1).padStart(2,'0')}`;
    }
  }
  if (!meta.arenaSkipped || typeof meta.arenaSkipped !== 'object') meta.arenaSkipped = { daily:{}, weekly:{}, monthly:{} };
  for (const p of ['daily','weekly','monthly']) {
    if (!meta.arenaSkipped[p] || typeof meta.arenaSkipped[p] !== 'object' || Array.isArray(meta.arenaSkipped[p])) meta.arenaSkipped[p] = {};
  }
  if (!meta.arenaRewards || typeof meta.arenaRewards !== 'object') meta.arenaRewards = { daily:{}, weekly:{}, monthly:{} };
  for (const p of ['daily','weekly','monthly']) {
    if (!meta.arenaRewards[p] || typeof meta.arenaRewards[p] !== 'object' || Array.isArray(meta.arenaRewards[p])) meta.arenaRewards[p] = {};
  }
}

function buildRankingList(store) {
  if (!store || typeof store.getAllPlayers !== 'function') return [];
  const list = store.getAllPlayers()
    .filter(p => p && p.level)
    .map(p => ({ username: p.username, rating: (p.pvpStats && p.pvpStats.rating) || 1000 }))
    .sort((a,b) => b.rating - a.rating)
    .slice(0, 100);
  return list;
}

function settleDuePeriods(store) {
  if (!store || typeof store.getMeta !== 'function') throw new Error('store required');
  const meta = store.getMeta();
  ensureArenaCursors(meta);
  if (typeof store.setMeta === 'function') store.setMeta(meta);
  const limits = { daily: 7, weekly: 4, monthly: 2 };
  const getCurKey = (period) => {
    if (period === 'daily') return getDailyKey();
    if (period === 'weekly') return getWeeklyKey();
    if (period === 'monthly') return getMonthlyKey();
    return '';
  };
  for (const period of ['daily','weekly','monthly']) {
    let curKey = getCurKey(period);
    let cursor = meta.arenaCursors[period];
    let pending = [];
    let next = getNextPeriodKey(cursor, period);
    let guard = 0;
    while (next < curKey && guard < 100) {
      pending.push(next);
      next = getNextPeriodKey(next, period);
      guard++;
    }
    if (pending.length === 0) continue;
    // 超界部分写 skipped 空占位（按周期各自 withTransaction，失败立即返回不切片）
    if (pending.length > limits[period]) {
      const skipCount = pending.length - limits[period];
      let failed = false;
      for (let i=0; i<skipCount; i++) {
        const sk = pending[i];
        const result = (typeof store.withTransaction === 'function')
          ? store.withTransaction((data) => {
              const m = store.getMeta();
              if (!m.arenaRewards) m.arenaRewards = { daily:{}, weekly:{}, monthly:{} };
              if (!m.arenaSkipped) m.arenaSkipped = { daily:{}, weekly:{}, monthly:{} };
              for (const pp of ['daily','weekly','monthly']) {
                if (!m.arenaRewards[pp]) m.arenaRewards[pp] = {};
                if (!m.arenaSkipped[pp]) m.arenaSkipped[pp] = {};
              }
              if (m.arenaSkipped[period][sk] || m.arenaRewards[period][sk]) {
                m.arenaCursors[period] = sk;
                store.setMeta(m);
                return { status: 200, already: true, key: sk };
              }
              m.arenaRewards[period][sk] = {};
              m.arenaSkipped[period][sk] = { at: getNow(), source: 'skip:gap' };
              m.arenaCursors[period] = sk;
              store.setMeta(m);
              return { status: 200, key: sk, skipped: true };
            })
          : (() => {
              if (meta.arenaSkipped[period][sk] || meta.arenaRewards[period][sk]) {
                meta.arenaCursors[period] = sk;
                return { status: 200, already:true };
              }
              meta.arenaRewards[period][sk] = {};
              meta.arenaSkipped[period][sk] = { at: getNow(), source: 'skip:gap' };
              meta.arenaCursors[period] = sk;
              return { status:200 };
            })();
        if (result.status >= 400) { failed = true; break; }
      }
      if (failed) return;
      pending = pending.slice(skipCount);
    }
    // 剩余 pending 在事务内正常结算
    for (const pk of pending) {
      const rankingList = buildRankingList(store);
      const result = (typeof store.withTransaction === 'function')
        ? store.withTransaction((data) => {
            const m = store.getMeta();
            if ((m.arenaSkipped[period] && m.arenaSkipped[period][pk]) || (m.arenaRewards[period] && m.arenaRewards[period][pk])) {
              m.arenaCursors[period] = pk;
              store.setMeta(m);
              return { status: 200, already: true, key: pk };
            }
            try {
              const r = settleArenaRewards(store, period, rankingList, pk);
              const m2 = store.getMeta();
              m2.arenaCursors[period] = pk;
              store.setMeta(m2);
              return { status: 200, key: pk, rewarded: r.rewarded };
            } catch (e) {
              return { status: 500, message: e.message };
            }
          })
        : (() => {
            if ((meta.arenaSkipped[period] && meta.arenaSkipped[period][pk]) || (meta.arenaRewards[period] && meta.arenaRewards[period][pk])) {
              meta.arenaCursors[period] = pk;
              return { status: 200, already: true };
            }
            try {
              const r = settleArenaRewards(store, period, rankingList, pk);
              meta.arenaCursors[period] = pk;
              return { status: 200, rewarded: r.rewarded };
            } catch (e) {
              return { status: 500, message: e.message };
            }
          })();
      if (result.status >= 400) break;
    }
  }
}

function maybeResetSeason(meta) {
  const currentSeason = getSeasonKey();
  if (!meta.currentSeason) {
    meta.currentSeason = currentSeason;
    return { reset: false };
  }
  if (meta.currentSeason !== currentSeason) {
    const old = meta.currentSeason;
    meta.currentSeason = currentSeason;
    meta.lastResetFrom = old;
    meta.lastResetAt = getNow();
    return { reset: true, from: old, to: currentSeason };
  }
  return { reset: false };
}

function applySeasonResetToPlayers(store) {
  const players = store.getAllPlayers();
  for (const p of players) {
    if (!p.pvpStats) continue;
    p.pvpStats.rating = 1000;
    p.pvpStats.streak = 0;
    p.pvpStats.lastPvpAt = 0;
    if (PVP_CURRENCY_KEY in p) p[PVP_CURRENCY_KEY] = 0;
  }
}

module.exports = {
  getSeasonKey, getSeasonIndex, getSeasonDaysLeft,
  getRankTier,
  settleArenaRewards, settleDuePeriods, maybeResetSeason, applySeasonResetToPlayers,
};
