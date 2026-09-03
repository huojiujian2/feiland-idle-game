// ====== 星际火箭 · 玩家路由 · v1.09 ======
// 路由一览（全部走 /api/player/:username/gamble/*，需鉴权 + 自操作）：
//   GET    /api/player/:u/gamble/config            难度档位 + 免费次数 + 玩家当前状态
//   POST   /api/player/:u/gamble/bet               开局（扣金币 + 生成炸点）
//   POST   /api/player/:u/gamble/cashout           停止（结算）
//   POST   /api/player/:u/gamble/cancel            放弃当前局（不计费，仅清理缓存，免费局也算）
//   GET    /api/player/:u/gamble/status            查询当前是否有飞行中的仓位
//   GET    /api/player/:u/gamble/history           本人历史（meta.gambleHistory[username]）
//
// 设计原则：
//   - 所有金币变动走 withTransaction（含 v1.07 maxGold 上限）
//   - 全部挂审计日志 gamble.*
//   - 净亏上限保护：日净亏 = totalBetPaid - totalPayout；超阈值 409 拒绝投注

const { ok, fail } = require('./_helpers');
const auditLog = require('../middleware/audit-log');
const gamble = require('../engine/gamble');
const engine = require('../engine');

const { getNow } = require('../engine/state');

const { getTodayKey } = require('../engine/daily');
const { grantGold } = require('../engine/player');

// 净亏上限：基础 + 等级递增
function getNetLossLimit(player) {
  const base = 5000;
  const levelBonus = (player.level || 1) * 100;
  return base + levelBonus;
}

function ensureFreeRounds(player) {
  const today = getTodayKey();
  if (!player.gamble || typeof player.gamble !== 'object') {
    player.gamble = { freeDayKey: '', freeUsed: 0, history: [], stats: { played: 0, won: 0, lost: 0, biggestMult: 0, totalWon: 0, totalLost: 0 } };
  }
  if (!Array.isArray(player.gamble.history)) player.gamble.history = [];
  if (player.gamble.history.length > 50) player.gamble.history.splice(0, player.gamble.history.length - 50);
  if (!player.gamble.stats || typeof player.gamble.stats !== 'object') {
    player.gamble.stats = { played: 0, won: 0, lost: 0, biggestMult: 0, totalWon: 0, totalLost: 0 };
  }
  if (player.gamble.freeDayKey !== today) {
    player.gamble.freeDayKey = today;
    player.gamble.freeUsed = 0;
  }
  return player.gamble;
}

function registerGambleRoutes(app, store) {
  // 配置（公开：难度列表；私密：本玩家今日剩余免费次数 + 当前可投注额）
  app.get('/api/player/:username/gamble/config', (req, res) => {
    const username = req.params.username;
    if (!username) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const g = ensureFreeRounds(player);
      const freeLeft = Math.max(0, gamble.FREE_ROUNDS_PER_DAY - g.freeUsed);
      const active = gamble.getActiveRound(username);
      const diffList = gamble.getDifficultyList().map(d => {
        const cfg = gamble.getDifficulty(d.id);
        return {
          ...d,
          // 按玩家金币计算该档可投注范围（不能超过当前金币）
          baseBetMin: cfg.baseBetMin,
          baseBetMax: Math.min(cfg.baseBetMax, Math.floor(player.gold || 0)),
        };
      });
      return {
        status: 200,
        data: {
          difficulties: diffList,
          freeRoundsPerDay: gamble.FREE_ROUNDS_PER_DAY,
          freeRoundsLeft: freeLeft,
          currentGold: Math.floor(player.gold || 0),
          netLossLimit: getNetLossLimit(player),
          netLossToday: computeNetLoss(player),
          activeRound: active ? { difficulty: active.difficulty, isFree: active.isFree, bet: active.bet, startAt: active.startAt, maxDuration: active.maxDuration, maxMultiplier: active.maxMultiplier } : null,
        },
      };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });

  // 开局（投注）
  app.post('/api/player/:username/gamble/bet', auditLog('gamble.bet'), (req, res) => {
    const username = req.params.username;
    const { difficulty, isFree, bet } = req.body || {};
    if (!username) return fail(res, '缺少参数', 400);
    if (!difficulty) return fail(res, '请选择难度', 400);
    const wantFree = !!isFree;
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const g = ensureFreeRounds(player);
      const netLoss = computeNetLoss(player);
      const netLossLimit = getNetLossLimit(player);
      if (netLoss >= netLossLimit) {
        return { status: 409, message: `今日净亏已达上限（${netLossLimit.toLocaleString()} 金币），去挂会儿机再来吧！` };
      }
      let wantBet = Math.floor(Number(bet) || 0);
      if (wantFree) {
        if (g.freeUsed >= gamble.FREE_ROUNDS_PER_DAY) {
          return { status: 409, message: `今日免费机会已用完（每日 ${gamble.FREE_ROUNDS_PER_DAY} 次）` };
        }
        wantBet = 0;
      } else {
        if (wantBet <= 0) return { status: 400, message: '请输入投注金额' };
        if (wantBet > (player.gold || 0)) return { status: 400, message: '金币不足' };
      }

      const cfg = gamble.getDifficulty(difficulty);
      if (!cfg) return { status: 400, message: '难度无效' };
      if (!wantFree) {
        if (wantBet < cfg.baseBetMin) return { status: 400, message: `本档最低投注 ${cfg.baseBetMin} 金币` };
        if (wantBet > cfg.baseBetMax) return { status: 400, message: `本档最高投注 ${cfg.baseBetMax.toLocaleString()} 金币` };
      }

      // 已有飞行中仓位 → 拒绝
      if (gamble.getActiveRound(username)) return { status: 409, message: '上一局尚未结束' };

      // 扣金币（仅付费局）
      if (!wantFree) {
        player.gold -= wantBet;
        ensureQuestStatsInc(player, 'gamble_spend_total', wantBet);
        // 玩家投注额作为净亏统计起点
        ensureNetLossTracker(player);
        player.gamble.netLossTracker.totalBetPaid = (player.gamble.netLossTracker.totalBetPaid || 0) + wantBet;
        player.gamble.netLossTracker.dayKey = getTodayKey();
      } else {
        g.freeUsed = (g.freeUsed || 0) + 1;
      }

      // 开局（生成炸点 + 缓存）
      const betResult = gamble.placeBet({ username, difficulty, isFree: wantFree, bet: wantBet });
      if (!betResult.ok) return { status: betResult.status || 400, message: betResult.message };

      return {
        status: 200,
        data: {
          ...betResult.round,
          // 反作弊标识：本局 ID（前端用做 cashout 时上报）
          roundId: `${username}:${betResult.round.startAt}`,
        },
      };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });

  // 停止（结算）
  app.post('/api/player/:username/gamble/cashout', auditLog('gamble.cashout'), (req, res) => {
    const username = req.params.username;
    const { clientMult } = req.body || {};
    if (!username) return fail(res, '缺少参数', 400);
    if (!Number.isFinite(clientMult) || clientMult < 1.0) return fail(res, '倍数无效', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const cashoutTime = Date.now();
      const settleResult = gamble.settleCashout({ username, cashoutTime, clientCashoutMult: Number(clientMult) });
      if (!settleResult.ok) return { status: settleResult.status || 400, message: settleResult.message };

      const g = ensureFreeRounds(player);
      g.stats = g.stats || { played: 0, won: 0, lost: 0, biggestMult: 0, totalWon: 0, totalLost: 0 };
      g.stats.played += 1;

      // 历史记录
      const historyEntry = {
        at: cashoutTime,
        difficulty: gamble.getActiveRound.__lastDifficulty || null,
        isFree: settleResult.isFree,
        bet: settleResult.bet,
        result: settleResult.result,
        mult: settleResult.mult,
        payout: settleResult.payout,
      };
      // 用真实缓存查找难度（activeRound 已被 clearActiveRound 清掉，所以从 historyEntry.difficulty 不能取）
      // 修正——把 difficulty 一并传入：placeBet 时记录，settle 时读
      // 这里改用更可靠的方法：从 settleCashout 返回值里携带
      historyEntry.difficulty = settleResult.difficulty || (gamble._lastDifficultyByUser && gamble._lastDifficultyByUser.get(username)) || null;

      if (settleResult.result === 'win') {
        g.stats.won += 1;
        g.stats.totalWon = (g.stats.totalWon || 0) + settleResult.payout;
        if (settleResult.mult > (g.stats.biggestMult || 0)) g.stats.biggestMult = settleResult.mult;
        if (settleResult.payout > 0) grantGold(player, settleResult.payout);
        ensureQuestStatsInc(player, 'gamble_win_total', 1);
      } else {
        g.stats.lost += 1;
        g.stats.totalLost = (g.stats.totalLost || 0) + (settleResult.isFree ? 0 : settleResult.bet);
        ensureQuestStatsInc(player, 'gamble_play_total', 1);
      }

      // 净亏统计
      ensureNetLossTracker(player);
      if (!settleResult.isFree && settleResult.result === 'win') {
        // 付费局赢了：净亏 = 投注 - 派彩（负值即净赚）
        const profit = settleResult.payout - settleResult.bet;
        player.gamble.netLossTracker.totalPayout = (player.gamble.netLossTracker.totalPayout || 0) + settleResult.payout;
        if (profit < 0) {
          // 净赚 → 净亏不变
        } else {
          // 净亏继续累加
        }
      } else if (!settleResult.isFree && settleResult.result === 'lose') {
        // 付费局输了：派彩 = 0，净亏 = 投注
      }

      g.history.push(historyEntry);
      if (g.history.length > 50) g.history.splice(0, g.history.length - 50);

      return {
        status: 200,
        data: {
          result: settleResult.result,
          mult: settleResult.mult,
          crashMult: settleResult.crashMult,
          payout: settleResult.payout,
          bet: settleResult.bet,
          isFree: settleResult.isFree,
          currentGold: Math.floor(player.gold || 0),
          stats: g.stats,
        },
      };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });

  // 放弃当前局（不计费；用于客户端异常退出）
  app.post('/api/player/:username/gamble/cancel', auditLog('gamble.cancel'), (req, res) => {
    const username = req.params.username;
    if (!username) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const round = gamble.getActiveRound(username);
      if (!round) return { status: 200, data: { cancelled: false } };
      // 付费局取消 → 退还金币（不算输赢）
      if (!round.isFree && round.bet > 0) {
        grantGold(player, round.bet);
      }
      gamble.clearActiveRound(username);
      return { status: 200, data: { cancelled: true, refunded: round.isFree ? 0 : round.bet } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });

  // 查询当前局（前端切回 tab 时用来同步状态）
  app.get('/api/player/:username/gamble/status', (req, res) => {
    const username = req.params.username;
    if (!username) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const round = gamble.getActiveRound(username);
      if (!round) return { status: 200, data: { active: false, currentGold: Math.floor(player.gold || 0) } };
      const elapsedMs = Date.now() - round.startAt;
      const currentMult = gamble.currentMultiplierAt(elapsedMs / 1000, round.difficulty);
      return {
        status: 200,
        data: {
          active: true,
          difficulty: round.difficulty,
          isFree: round.isFree,
          bet: round.bet,
          startAt: round.startAt,
          elapsedMs,
          currentMult,
          maxDuration: round.maxDuration,
          maxMultiplier: round.maxMultiplier,
          currentGold: Math.floor(player.gold || 0),
        },
      };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });

  // 本人历史
  app.get('/api/player/:username/gamble/history', (req, res) => {
    const username = req.params.username;
    if (!username) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const g = ensureFreeRounds(player);
      return { status: 200, data: { history: g.history || [], stats: g.stats || {} } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });
}

function ensureQuestStats(player) {
  if (!player.questStats || typeof player.questStats !== 'object') {
    player.questStats = { totalGoldEarned: 0, affixSeen: [], seenEquipTemplates: [], gambleSpendTotal: 0, gambleWinTotal: 0, gamblePlayTotal: 0 };
  }
  if (typeof player.questStats.gambleSpendTotal !== 'number') player.questStats.gambleSpendTotal = 0;
  if (typeof player.questStats.gambleWinTotal !== 'number') player.questStats.gambleWinTotal = 0;
  if (typeof player.questStats.gamblePlayTotal !== 'number') player.questStats.gamblePlayTotal = 0;
}
function ensureQuestStatsInc(player, key, inc) {
  ensureQuestStats(player);
  player.questStats[key] = (player.questStats[key] || 0) + inc;
}
function ensureNetLossTracker(player) {
  ensureFreeRounds(player);
  if (!player.gamble.netLossTracker || typeof player.gamble.netLossTracker !== 'object') {
    player.gamble.netLossTracker = { dayKey: getTodayKey(), totalBetPaid: 0, totalPayout: 0 };
  }
  if (player.gamble.netLossTracker.dayKey !== getTodayKey()) {
    player.gamble.netLossTracker = { dayKey: getTodayKey(), totalBetPaid: 0, totalPayout: 0 };
  }
}
function computeNetLoss(player) {
  ensureNetLossTracker(player);
  const t = player.gamble.netLossTracker;
  return Math.max(0, (t.totalBetPaid || 0) - (t.totalPayout || 0));
}

module.exports = { registerGambleRoutes };