// ====== 灵鸡斗场引擎 ======
// 完全独立：不读写金币/经验/竞技币/转生点，数据全部存在 player.cockfight
// 流程：enterCockArena（出 6 只鸡）→ resolveCockRound（押注+干预+擂台赛+结算）
const { getRand, getNow } = require('./state');
const { getTodayKey } = require('./daily');
const { CHICKENS, COCKFIGHT_RULES, COCKFIGHT_TITLES } = require('../data/cockfight');
const { assertSettlementReward } = require('./settlement');

const R = COCKFIGHT_RULES;

// ---------- 玩家状态 ----------

function ensureState(player) {
  if (!player.cockfight || typeof player.cockfight !== 'object') {
    player.cockfight = {
      points: 0, wins: 0, streak: 0, played: 0, loseStreak: 0,
      dayKey: '', usedToday: 0, banNext: null, current: null, history: [],
    };
  }
  const s = player.cockfight;
  if (!Array.isArray(s.history)) s.history = [];
  // 跨天重置（北京时间 0:00 = 服务器本地日界，与日常任务一致）
  const today = getTodayKey();
  if (s.dayKey !== today) {
    s.dayKey = today;
    s.usedToday = 0;
  }
  return s;
}

function getCockfightStatus(player) {
  const s = ensureState(player);
  const owned = player.titles || {};
  const shop = Object.values(COCKFIGHT_TITLES).map(t => ({
    key: t.key,
    name: t.name,
    desc: t.desc,
    cost: t.cost || null,
    hidden: !!t.hidden,
    achievement: !!t.achievement,
    owned: !!owned[t.key],
  }));
  return {
    points: s.points,
    wins: s.wins,
    streak: s.streak,
    played: s.played,
    loseStreak: s.loseStreak,
    todayUsed: s.usedToday,
    todayLeft: Math.max(0, R.DAILY_LIMIT - s.usedToday),
    dailyLimit: R.DAILY_LIMIT,
    target: R.MANIAC_GAMES,
    shop,
    history: s.history.slice(-20),
    inArena: !!s.current,
  };
}

// ---------- 战斗模拟 ----------

// 随机整数 [min, max]
function ri(min, max) {
  const rand = getRand();
  return Math.floor(rand() * (max - min + 1)) + min;
}

// 单场 1v1：5 回合，先手由速度决定（内部拷贝，血量通过返回值同步回守擂者）
function battleOnce(A, B) {
  const lines = [];
  const a = { ...A, maxHp: A.maxHp || A.hp };
  const b = { ...B, maxHp: B.maxHp || B.hp };
  let round = 1;
  for (; round <= R.ROUNDS_PER_DUEL; round++) {
    const order = a.spd >= b.spd ? [a, b] : [b, a];
    for (let i = 0; i < 2; i++) {
      const atk = order[i];
      const def = order[i] === a ? b : a;
      if (atk.hp <= 0 || def.hp <= 0) break;
      const raw = atk.atk * R.BASE_DAMAGE + ri(-3, 3);
      const crit = getRand()() < (atk.crit || 0);
      const dmg = (crit ? raw * R.CRIT_MULT : raw) / (def.def || 1);
      def.hp = Math.max(0, def.hp - dmg);
      lines.push(
        `⚔️ 第${round}回合：${atk.name} ${crit ? '进入狂暴状态（暴击！）' : '先手猛啄'}！造成 ${Math.round(dmg)} 点伤害！${def.name} 体力 ${Math.round(def.hp)}/${Math.round(def.maxHp)}`
      );
      if (def.hp <= 0) {
        lines.push(`💥 ${def.name} 体力归零，倒地不起！`);
        return { winner: atk, loser: def, lines, rounds: round };
      }
    }
  }
  // 5 回合后体力高者胜；同体力比速度
  const winner = a.hp > b.hp ? a : (b.hp > a.hp ? b : (a.spd >= b.spd ? a : b));
  lines.push(`⏱️ 五回合战罢，${winner.name} 体力更胜一筹！`);
  return { winner, loser: winner === a ? b : a, lines, rounds: R.ROUNDS_PER_DUEL };
}

// 构造带干预修正的战斗数值
function buildStats(id, mods) {
  const base = CHICKENS.find(c => c.id === id);
  if (!base) return null;
  const s = { ...base };
  if (mods) {
    if (mods.atkMult && mods.atkMult[id]) s.atk = s.atk * mods.atkMult[id];
    if (mods.spdMult && mods.spdMult[id]) s.spd = s.spd * mods.spdMult[id];
    if (mods.critAdd && mods.critAdd[id]) s.crit = (s.crit || 0) + mods.critAdd[id];
  }
  return s;
}

// 擂台赛：6 只鸡按出场序逐场 1v1，守擂者保留血量，最后站着的为冠军
function simulateLineup(lineupIds, mods) {
  const stats = lineupIds.map(id => buildStats(id, mods)).filter(Boolean);
  const lines = [];
  let champ = stats[0];
  for (let i = 1; i < stats.length; i++) {
    lines.push(`【第${i}场】${champ.name} vs ${stats[i].name}`);
    const duel = battleOnce(champ, stats[i]);
    lines.push(...duel.lines);
    // 守擂者血量同步（battleOnce 内部拷贝）
    const next = duel.winner.id === champ.id ? champ : stats[i];
    next.hp = duel.winner.hp;
    champ = next;
    lines.push(`🏆 ${champ.name} 获胜，继续守擂！`);
  }
  lines.push(`👑 本局冠军：${champ.name}`);
  return { championId: champ.id, championName: champ.name, lines };
}

// ---------- 流程 ----------

function getDayKeyForTs(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

// 进入斗场：检查次数，生成 6 只（激将法禁赛鸡不出现）
function enterCockArena(player) {
  const s = ensureState(player);
  if (s.usedToday >= R.DAILY_LIMIT) {
    return { success: false, message: `今日参赛次数已用完（${R.DAILY_LIMIT}/${R.DAILY_LIMIT}）` };
  }
  const now = getNow();
  if (s.current && typeof s.current.createdAt === 'number' && now - s.current.createdAt < 30 * 60 * 1000) {
    const chickens = s.current.lineup.map((id, i) => {
      const c = CHICKENS.find(x => x.id === id);
      return { no: i + 1, id: c.id, name: c.name, clues: [...c.clues] };
    });
    return { success: true, chickens, createdAt: s.current.createdAt, todayLeft: Math.max(0, R.DAILY_LIMIT - s.usedToday) };
  }
  const pool = CHICKENS.filter(c => c.id !== s.banNext);
  s.banNext = null;   // 替换标记一次性
  // 随机选 6 只（不重复）
  const rand = getRand();
  const picked = [];
  const rest = pool.slice();
  while (picked.length < 6 && rest.length > 0) {
    const idx = Math.floor(rand() * rest.length);
    picked.push(rest[idx].id);
    rest.splice(idx, 1);
  }
  s.current = { lineup: picked, createdAt: getNow() };
  const chickens = picked.map((id, i) => {
    const c = CHICKENS.find(x => x.id === id);
    return { no: i + 1, id: c.id, name: c.name, clues: [...c.clues] };
  });
  return { success: true, chickens, createdAt: s.current.createdAt, todayLeft: Math.max(0, R.DAILY_LIMIT - s.usedToday) };
}

// 结算一局：押注 + 干预 + 擂台赛 + 积分
function resolveCockRound(player, bet, intervention, createdAt) {
  const s = ensureState(player);
  // 统一 createdAt 处理：若传了 createdAt 则走幂等逻辑
  let effectiveCreatedAt = createdAt;
  if (effectiveCreatedAt !== undefined && effectiveCreatedAt !== null) {
    effectiveCreatedAt = Number(effectiveCreatedAt);
    if (!Number.isFinite(effectiveCreatedAt)) {
      return { success: false, message: 'createdAt 非法' };
    }
    const dayKeyForCreated = getDayKeyForTs(effectiveCreatedAt);
    const ledgerId = `cock:round:${dayKeyForCreated}:${effectiveCreatedAt}`;
    const altLedgerId = `cock:round:${getTodayKey()}:${effectiveCreatedAt}`;
    // 优先查 ledger
    if (Array.isArray(player.settlementLedger)) {
      let found = player.settlementLedger.find(e => e.id === ledgerId || e.id === altLedgerId);
      if (!found) {
        found = player.settlementLedger.find(e => e.type === 'cock_round' && e.fullResult && e.fullResult.createdAt === effectiveCreatedAt);
      }
      if (!found) {
        // also check any id ending with :${effectiveCreatedAt}
        found = player.settlementLedger.find(e => typeof e.id === 'string' && e.id.endsWith(`:${effectiveCreatedAt}`) && e.type === 'cock_round');
      }
      if (found) {
        if (!found.fullResult) {
          return { success: false, status: 500, message: '数据损坏' };
        }
        return { success: true, already: true, ...found.fullResult };
      }
    }
    // 查 history
    if (Array.isArray(s.history)) {
      const hFound = s.history.find(h => h.createdAt === effectiveCreatedAt || (h.fullResult && h.fullResult.createdAt === effectiveCreatedAt));
      if (hFound) {
        if (!hFound.fullResult) {
          return { success: false, status: 500, message: '数据损坏' };
        }
        return { success: true, already: true, ...hFound.fullResult };
      }
    }
    // 未命中幂等，走正常校验
    if (!s.current) return { success: false, message: '请先进入斗场' };
    if (s.current.createdAt !== effectiveCreatedAt) {
      return { success: false, message: '对局已过期或 createdAt 不匹配' };
    }
    if (s.usedToday >= R.DAILY_LIMIT) return { success: false, message: '今日参赛次数已用完' };
  } else {
    if (!s.current) return { success: false, message: '请先进入斗场' };
    if (s.usedToday >= R.DAILY_LIMIT) return { success: false, message: '今日参赛次数已用完' };
    effectiveCreatedAt = s.current.createdAt;
    // 对旧调用（无 createdAt）也做一次基于当前 createdAt 的幂等检查，防止重复调用（虽然旧测试不依赖）
    // 检查 history 中是否已有相同 createdAt 的记录（说明已结算过但 current 已被清空前的重复调用不会走到这里，因为 current 已 null，上面的 already 检查已通过）
    // 对于旧路径，幂等已在上面 s.current 为 null 时返回失败，所以这里不需额外处理
  }

  const betNo = Math.floor(Number(bet));
  if (!(betNo >= 1 && betNo <= 6)) return { success: false, message: '押注编号必须为 1~6' };
  if (intervention && !['feed', 'caltrops', 'provoke'].includes(intervention)) {
    return { success: false, message: '未知干预方式' };
  }

  const lineup = s.current.lineup;
  const myId = lineup[betNo - 1];
  const applied = [];
  const mods = {};

  // 临场干预
  let discovered = false;
  if (intervention === 'feed') {
    const base = CHICKENS.find(c => c.id === myId);
    mods.atkMult = { [myId]: 1.3 };
    applied.push({ chicken: myId, stat: '攻击', from: base.atk, to: base.atk * 1.3 });
  } else if (intervention === 'caltrops') {
    const others = lineup.filter(id => id !== myId);
    const victim = others[Math.floor(getRand()() * others.length)];
    const victimBase = CHICKENS.find(c => c.id === victim);
    mods.spdMult = { [victim]: 0.6 };
    applied.push({ chicken: victim, stat: '速度', from: victimBase.spd, to: victimBase.spd * 0.6 });
    if (getRand()() < 0.3) {
      discovered = true;
      const myBase = CHICKENS.find(c => c.id === myId);
      mods.spdMult[myId] = 0.6;
      applied.push({ chicken: myId, stat: '速度', from: myBase.spd, to: myBase.spd * 0.6 });
    }
  } else if (intervention === 'provoke') {
    mods.critAdd = { [myId]: 0.5 };
  }

  // 擂台赛
  const sim = simulateLineup(lineup, mods);
  const win = sim.championId === myId;

  // 结算
  s.usedToday += 1;
  s.played += 1;
  let pointsDelta = 0;
  let luckMessage = null;
  let newTitle = null;

  if (win) {
    s.wins += 1;
    s.streak += 1;
    pointsDelta = 1;
    if (s.streak % R.BONUS_EVERY === 0) pointsDelta += 1;   // 连胜第 3/6/9…局额外 +1
    s.points += pointsDelta;
    s.loseStreak = 0;
  } else {
    s.streak = 0;
    s.loseStreak += 1;
    if (intervention === 'provoke') s.banNext = myId;   // 激将法输了 → 下局换掉这只鸡
    if (s.loseStreak >= R.LOSE_STREAK_MSG) {
      luckMessage = '今天手气不好，要不去挂会儿机？';
      s.loseStreak = 0;
    }
  }

  // 累计 250 局 → 斗鸡狂魔（不消耗积分）
  if (s.played >= R.MANIAC_GAMES) {
    player.titles = player.titles || {};
    if (!player.titles.cock_maniac) {
      player.titles.cock_maniac = true;
      newTitle = '斗鸡狂魔';
    }
  }

  const currentCreatedAt = effectiveCreatedAt;
  const fullResult = {
    win,
    champion: sim.championName,
    championId: sim.championId,
    report: sim.lines,
    pointsDelta,
    points: s.points,
    streak: s.streak,
    played: s.played,
    todayLeft: Math.max(0, R.DAILY_LIMIT - s.usedToday),
    interventionApplied: applied,
    interventionDiscovered: discovered,
    luckMessage,
    newTitle,
    createdAt: currentCreatedAt,
  };

  // 记录（保留最近 20 条）含 fullResult
  s.history.push({
    time: getNow(),
    bet: betNo,
    betName: CHICKENS.find(c => c.id === myId).name,
    champion: sim.championName,
    championId: sim.championId,
    win,
    pointsDelta,
    played: s.played,
    createdAt: currentCreatedAt,
    fullResult,
  });
  if (s.history.length > 20) s.history.splice(0, s.history.length - 20);

  // settlement ledger
  const dayKeyForLedger = getDayKeyForTs(currentCreatedAt);
  const ledgerId = `cock:round:${dayKeyForLedger}:${currentCreatedAt}`;
  const reward = { pointsDelta, points: s.points };
  if (newTitle) reward.title = newTitle;
  const v = assertSettlementReward('cock_round', reward);
  if (v.valid) {
    if (!Array.isArray(player.settlementLedger)) player.settlementLedger = [];
    if (!player.settlementLedger.some(e => e.id === ledgerId)) {
      player.settlementLedger.push({
        id: ledgerId,
        at: getNow(),
        type: 'cock_round',
        reward,
        source: `cock:round:${dayKeyForLedger}:${currentCreatedAt}`,
        fullResult,
      });
      if (player.settlementLedger.length > 100) player.settlementLedger.splice(0, player.settlementLedger.length - 100);
    }
  }

  s.current = null;

  return {
    success: true,
    win,
    champion: sim.championName,
    championId: sim.championId,
    report: sim.lines,
    pointsDelta,
    points: s.points,
    streak: s.streak,
    played: s.played,
    todayLeft: Math.max(0, R.DAILY_LIMIT - s.usedToday),
    interventionApplied: applied,
    interventionDiscovered: discovered,
    luckMessage,
    newTitle,
    createdAt: currentCreatedAt,
  };
}

// 称号兑换（成就称号不可兑换）
function exchangeCockfightTitle(player, titleKey) {
  const s = ensureState(player);
  const t = COCKFIGHT_TITLES[titleKey];
  if (!t) return { success: false, message: '称号不存在' };
  if (t.achievement) return { success: false, message: '成就称号无法兑换' };
  player.titles = player.titles || {};
  if (player.titles[titleKey]) return { success: false, message: '已拥有该称号' };
  if (s.points < t.cost) return { success: false, message: `积分不足（需要 ${t.cost}，当前 ${s.points}）` };
  s.points -= t.cost;
  player.titles[titleKey] = true;
  // settlement ledger for exchange
  const reward = { title: t.name, cost: t.cost, points: s.points };
  const v = assertSettlementReward('cock_exchange', reward);
  if (v.valid) {
    if (!Array.isArray(player.settlementLedger)) player.settlementLedger = [];
    const ledgerId = `cock:exchange:${titleKey}`;
    if (!player.settlementLedger.some(e => e.id === ledgerId)) {
      player.settlementLedger.push({
        id: ledgerId,
        at: getNow(),
        type: 'cock_exchange',
        reward,
        source: `cock:exchange:${titleKey}`,
      });
      if (player.settlementLedger.length > 100) player.settlementLedger.splice(0, player.settlementLedger.length - 100);
    }
  }
  return { success: true, title: t.name, points: s.points };
}

module.exports = {
  getCockfightStatus,
  enterCockArena,
  resolveCockRound,
  exchangeCockfightTitle,
  // 测试用纯函数
  __simulateLineup: simulateLineup,
  __battleOnce: battleOnce,
};
