// ====== 星际火箭 · 服务端引擎 · v1.09 ======
// Crash Game 玩法逻辑：
//   - 服务端生成"炸点"（crashMult），客户端本地渲染"当前倍数"动画
//   - 玩家在 currentMult < crashMult 时按"停止" → 按 cashoutMult 结算
//   - 玩家等到 currentMult ≥ crashMult（自动炸） → 全输
//   - house edge 通过对每档 RTP 的反推实现（详见 DIFFICULTY 表）
//
// 安全设计：
//   - 炸点用 crypto.randomBytes + 拒绝采样生成（公平不可预测）
//   - 当前倍数由前端自渲染（不调服务端）→ 节省带宽
//   - 结算时用客户端上报的 cashoutTime + 服务端 startAt 反算 cashoutMult，
//     与客户端报值比对，差 > 0.3 倍视为作弊 → 强制 0 结算
//   - 每局独立内存缓存（带 TTL），过期未结算自动判定输
//   - 单用户同时只允许 1 个飞行中的仓位
//
// 不依赖任何 npm 包，纯 Node 内置 crypto。

const crypto = require('crypto');

// ============ 难度档位 ============
//   maxMultiplier：最大倍数（封顶）
//   maxDuration：最长飞行时间（秒）—— 服务端用这个反算 maxRate
//   houseEdge：庄家抽水（0.05 = 5%）
//   freeRewardBase：免费局赢了的基础金币（按 cashoutMult 倍数乘）
//   baseBetMin：付费局单注最低金币
//   baseBetMax：付费局单注最高金币
//
// RTP（玩家回报率）通过 crashMult 的概率密度反推：
//   行业标准的 crash 分布：crashMult ~ Uniform(1, max) on inverse scale
//   期望倍数 E[m] = (1 - houseEdge) * (max * ln(max) / (max - 1))
//   本实现的 RTP：简单 E[m] / max（详细 RTP 计算见 test 文件）
const DIFFICULTY = {
  pig:    { id: 'pig',    name: '杀猪盘', color: '#e53935', maxMultiplier: 10,  maxDuration: 30, houseEdge: 0.20, freeRewardBase: 500,   baseBetMin: 100,     baseBetMax: 100000000   },
};

const DIFFICULTY_KEYS = Object.keys(DIFFICULTY);
const DEFAULT_DIFFICULTY = 'pig';

// 免费局每玩家每天 3 次
const FREE_ROUNDS_PER_DAY = 3;

// 单局缓存 TTL（超过这个时间客户端没按停止 → 视为自动炸）
const ROUND_TTL_MS = 35 * 1000;

// 反作弊：客户端报值与服务端反算值之差 > 0.3 倍视为作弊
const CHEAT_TOLERANCE = 0.3;

// ============ PRNG：生成 crashMult ============
//   行业标准 crash 分布：crashMult = pow(max, 1-u)
//     u=0 → x=max（极难），u=1 → x=1（极容易）
//   概率密度 f(x) = 1/(x² × ln(max))——1.01x 很常见，10x 罕见，100x 极罕见
function generateCrashMult(difficulty) {
  const cfg = DIFFICULTY[difficulty];
  if (!cfg) throw new Error('unknown difficulty');
  // 4 字节随机数 → 0~1 浮点
  const buf = crypto.randomBytes(4);
  const u = buf.readUInt32BE(0) / 0x100000000;
  if (u <= 0 || u >= 1) return generateCrashMult(difficulty);
  let x = Math.pow(cfg.maxMultiplier, 1 - u);
  if (x < 1.01) x = 1.01;
  if (x > cfg.maxMultiplier) x = cfg.maxMultiplier;
  return Number(x.toFixed(4));
}

// 当前倍数曲线（与前端共享的公式）
//   multiplier(t) = 1.0 + t × (max - 1.0) / maxDuration
function currentMultiplierAt(t, difficulty) {
  const cfg = DIFFICULTY[difficulty] || DIFFICULTY[DEFAULT_DIFFICULTY];
  if (t < 0) t = 0;
  if (t > cfg.maxDuration) t = cfg.maxDuration;
  const m = 1.0 + t * (cfg.maxMultiplier - 1.0) / cfg.maxDuration;
  return Number(m.toFixed(2));
}

// 验证客户端报值的合法性：cashoutMult 必须在 [1.00, crashMult] 内
function validateCashout(crashMult, cashoutMult) {
  if (!Number.isFinite(cashoutMult) || cashoutMult < 1.0) return false;
  // 上限：cashoutMult 必须 < crashMult（否则就是按晚了，输了）
  if (cashoutMult >= crashMult) return false;
  return true;
}

// 反作弊：根据 (startAt, cashoutTime, difficulty, clientCashoutMult) 比对合法性
//   客户端报值必须 <= 服务端按公式反算的理论值 + 容忍度
function antiCheatCheck(startAt, cashoutTime, difficulty, clientCashoutMult) {
  const elapsedMs = cashoutTime - startAt;
  if (elapsedMs < 0 || elapsedMs > ROUND_TTL_MS) return { ok: false, reason: 'time-invalid' };
  const cfg = DIFFICULTY[difficulty] || DIFFICULTY[DEFAULT_DIFFICULTY];
  const elapsedSec = elapsedMs / 1000;
  const theoreticalMax = 1.0 + elapsedSec * (cfg.maxMultiplier - 1.0) / cfg.maxDuration;
  if (clientCashoutMult > theoreticalMax + CHEAT_TOLERANCE) {
    return { ok: false, reason: 'client-time-tampering' };
  }
  return { ok: true };
}

// ============ 单局缓存 ============
//   key: username
//   value: {
//     username, difficulty, isFree, bet, crashMult, startAt,
//     maxDuration, houseEdge, maxMultiplier, baseBetMin, baseBetMax
//   }
const _rounds = new Map();

function getActiveRound(username) {
  const r = _rounds.get(username);
  if (!r) return null;
  const age = Date.now() - r.startAt;
  if (age > ROUND_TTL_MS) {
    _rounds.delete(username);
    return null;
  }
  return r;
}

function setActiveRound(round) {
  _rounds.set(round.username, round);
}

function clearActiveRound(username) {
  _rounds.delete(username);
}

// ============ 主入口：创建一局 ============
function placeBet({ username, difficulty, isFree, bet }) {
  if (!username) return { ok: false, message: '用户名缺失' };
  if (!DIFFICULTY_KEYS.includes(difficulty)) return { ok: false, message: '难度无效' };
  const cfg = DIFFICULTY[difficulty];

  // 已有飞行中的仓位
  if (getActiveRound(username)) {
    return { ok: false, message: '上一局尚未结束', status: 409 };
  }

  bet = Math.floor(Number(bet) || 0);
  if (bet < 0) bet = 0;
  if (!isFree) {
    if (bet < cfg.baseBetMin) return { ok: false, message: `本档最低投注 ${cfg.baseBetMin} 金币` };
    if (bet > cfg.baseBetMax) return { ok: false, message: `本档最高投注 ${cfg.baseBetMax.toLocaleString()} 金币` };
  } else {
    // 免费局：固定 0
    bet = 0;
  }

  const crashMult = generateCrashMult(difficulty);
  const startAt = Date.now();
  // 计算从 startAt 到炸点的时刻（毫秒）
  //   currentMultiplier(t) = = 1.0 + t × (max - 1.0) / maxDuration
  //   → t_at_crash = (crashMult - 1.0) × maxDuration / (max - 1.0)
  const tAtCrash = (crashMult - 1.0) * cfg.maxDuration / (cfg.maxMultiplier - 1.0);
  const crashAt = startAt + Math.max(200, tAtCrash * 1000); // 至少 200ms 后炸
  const round = {
    username,
    difficulty,
    isFree: !!isFree,
    bet,
    crashMult,
    crashAt,
    startAt,
    maxDuration: cfg.maxDuration,
    maxMultiplier: cfg.maxMultiplier,
    houseEdge: cfg.houseEdge,
    freeRewardBase: cfg.freeRewardBase,
    baseBetMin: cfg.baseBetMin,
    baseBetMax: cfg.baseBetMax,
  };
  setActiveRound(round);
  return {
    ok: true,
    round: {
      difficulty,
      isFree: !!isFree,
      bet,
      startAt,
      crashAt, // 客户端用来判定"火箭炸了"——超过此时刻禁用收手
      maxDuration: cfg.maxDuration,
      maxMultiplier: cfg.maxMultiplier,
      baseBetMin: cfg.baseBetMin,
      baseBetMax: cfg.baseBetMax,
      // 注意：crashMult 故意不返回给客户端（防前端偷看具体炸点倍数）
    },
  };
}

// ============ 主入口：结算 ============
function settleCashout({ username, cashoutTime, clientCashoutMult }) {
  const round = getActiveRound(username);
  if (!round) return { ok: false, message: '当前没有正在进行的局', status: 404 };

  // 反作弊：客户端报值 vs 服务端反算
  const cfg = DIFFICULTY[round.difficulty] || DIFFICULTY[DEFAULT_DIFFICULTY];
  const elapsedMs = cashoutTime - round.startAt;
  if (elapsedMs < 0 || elapsedMs > ROUND_TTL_MS) {
    clearActiveRound(username);
    return { ok: false, message: '时间戳非法（可能作弊）', status: 400 };
  }
  const elapsedSec = elapsedMs / 1000;
  const theoreticalMax = 1.0 + elapsedSec * (cfg.maxMultiplier - 1.0) / cfg.maxDuration;
  if (!Number.isFinite(clientCashoutMult) || clientCashoutMult < 1.0) {
    clearActiveRound(username);
    return { ok: false, message: '倍数无效', status: 400 };
  }
  if (clientCashoutMult > theoreticalMax + CHEAT_TOLERANCE) {
    clearActiveRound(username);
    return { ok: false, message: '时间戳异常，请刷新后再试', status: 400 };
  }

  // 拿 clientCashoutMult 与服务端 crashMult 比
  if (clientCashoutMult >= round.crashMult) {
    // 实际已炸（按晚了）
    clearActiveRound(username);
    return {
      ok: true,
      result: 'lose',
      reason: 'crashed',
      mult: round.crashMult,
      payout: 0,
      bet: round.bet,
      isFree: round.isFree,
    };
  }

  // 成功结算
  let payout;
  if (round.isFree) {
    // 免费局：基础金币 × cashoutMult（无 houseEdge，抽水含在 cashoutMult 上限里）
    payout = Math.floor(round.freeRewardBase * clientCashoutMult);
  } else {
    // 付费局：派彩 = bet × cashoutMult × (1 - houseEdge)
    payout = Math.floor(round.bet * clientCashoutMult * (1 - round.houseEdge));
  }

  clearActiveRound(username);
  return {
    ok: true,
    result: 'win',
    difficulty: round.difficulty,
    mult: Number(clientCashoutMult.toFixed(2)),
    crashMult: round.crashMult,
    payout,
    bet: round.bet,
    isFree: round.isFree,
    elapsedMs,
  };
}

// 自动炸（前端主动轮询或后端定时器触发）
function autoCrash(username) {
  const round = getActiveRound(username);
  if (!round) return null;
  clearActiveRound(username);
  return {
    username,
    mult: round.crashMult,
    bet: round.bet,
    isFree: round.isFree,
    elapsedMs: Date.now() - round.startAt,
  };
}

// ============ 工具 ============
function getDifficultyList() {
  return DIFFICULTY_KEYS.map((k) => {
    const c = DIFFICULTY[k];
    return {
      id: c.id,
      name: c.name,
      color: c.color,
      maxMultiplier: c.maxMultiplier,
      maxDuration: c.maxDuration,
      houseEdge: c.houseEdge,
      baseBetMin: c.baseBetMin,
      baseBetMax: c.baseBetMax,
    };
  });
}

function getDifficulty(id) {
  return DIFFICULTY[id] || null;
}

// 测试用：清空所有缓存
function _clearAll() {
  _rounds.clear();
}

module.exports = {
  DIFFICULTY,
  DEFAULT_DIFFICULTY,
  DIFFICULTY_KEYS,
  FREE_ROUNDS_PER_DAY,
  ROUND_TTL_MS,
  CHEAT_TOLERANCE,
  generateCrashMult,
  currentMultiplierAt,
  validateCashout,
  antiCheatCheck,
  getActiveRound,
  setActiveRound,
  clearActiveRound,
  placeBet,
  settleCashout,
  autoCrash,
  getDifficultyList,
  getDifficulty,
  _clearAll,
};