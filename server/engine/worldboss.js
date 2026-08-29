// ====== 世界 BOSS（v3.0：按「模板 70% + 玩家中位 30%」攻防 + 8 回合 + 血量按前 50% 玩家总伤害 × 1.05） ======
const { getNow, getRand } = require('./state');
const { WORLD_BOSS_TEMPLATES, WORLD_BOSS_SPAWN_INTERVAL_MS } = require('../data');
const { getTotalStats } = require('./stats');
const { simulateBossBattle } = require('./combat');
const { assertSettlementReward } = require('./settlement');

// v3.0：BOSS 战斗回合数（从 5 提到 8，让玩家有更多输出时间）
const BOSS_BATTLE_ROUNDS = 8;

// v3.4：北京日期 key（UTC+8，不依赖运行机器时区）
// 修复：此前用 new Date().toISOString().slice(0,10)（UTC 日）判定"每日一次"和"跨日重生"，
//   与 BOSS 重生时刻（北京 0 点）相差 8 小时，导致 UTC 翻日（北京 8 点）时：
//   ① 玩家当日可再打一次；② BOSS 被额外重生一次。统一走北京日 + getNow() 时间 seam。
function getBossDayKey(ts = getNow()) {
  return new Date(ts + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

// v3.4：北京当日 0 点的绝对时间戳（UTC+8，不依赖运行机器时区；走 getNow() seam 可测试）
function getTodayMidnight(ts = getNow()) {
  const bj = new Date(ts + 8 * 3600 * 1000);
  const dayStartBj = Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate());
  return dayStartBj - 8 * 3600 * 1000;
}

// v3.0：取全服按等级排序的前 50% 玩家（ceil 取整）
// 说明：用等级排序而不是伤害分，避免超模玩家带飞；50% 是 ceil，玩家数为 1 时取 1 个
function getTopHalfByLevel(store) {
  const all = store.getAllPlayers ? store.getAllPlayers() : [];
  const valid = all.filter(p => p && p.username);
  if (valid.length === 0) return [];
  // 按等级降序，等级相同时按用户名保证稳定排序
  const sorted = [...valid].sort((a, b) => (b.level || 0) - (a.level || 0) || a.username.localeCompare(b.username));
  const topN = Math.max(1, Math.ceil(sorted.length / 2));
  return sorted.slice(0, topN);
}

// v3.0：取全服"按等级中位"的玩家（用于攻防的 30% 玩家侧参考）
// 说明：奇数取中间，偶数取较大索引；返回单个玩家对象或 null
function getMedianPlayerByLevel(store) {
  const all = store.getAllPlayers ? store.getAllPlayers() : [];
  const valid = all.filter(p => p && p.username);
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => (a.level || 0) - (b.level || 0) || a.username.localeCompare(b.username));
  return sorted[Math.floor(sorted.length / 2)];
}

// v3.0：估算"前 50% 玩家各打 1 次"对 BOSS 的累计伤害
// 用真实战斗模拟（每次独立模拟，不累积血量），把每人的 totalDamage 累加
function estimateTopHalfTotalDamage(store, boss, rounds = BOSS_BATTLE_ROUNDS) {
  const topHalf = getTopHalfByLevel(store);
  if (topHalf.length === 0) return 0;
  let total = 0;
  for (const p of topHalf) {
    const r = simulateBossBattle(p, boss, rounds);
    total += Math.max(0, r.totalDamage || 0);
  }
  return total;
}

// v3.0：BOSS 攻防 = 模板 70% + 玩家中位 30%
// 没有玩家数据时退化为 100% 模板
function buildBossStats(store, tpl) {
  const median = getMedianPlayerByLevel(store);
  if (!median) {
    return {
      atk: tpl.baseAtk,
      def: tpl.baseDef,
      agi: tpl.baseAgi,
      hasMedian: false,
    };
  }
  const s = getTotalStats(median);
  return {
    atk: Math.floor(tpl.baseAtk * 0.7 + (s.atk || 0) * 0.3),
    def: Math.floor(tpl.baseDef * 0.7 + (s.def || 0) * 0.3),
    agi: Math.floor(tpl.baseAgi * 0.7 + (s.agi || 0) * 0.3),
    hasMedian: true,
  };
}

// v3.0：生成 BOSS
// 流程：先按「模板 70% + 玩家中位 30%」算攻防 → 用这组攻防模拟"前 50% 玩家"的累计伤害 → boss.hp = topHalf × 1.05
// 说明：1.05 是 5% 余量，防止极小概率下玩家全暴击失败刚好打不到 100%
function spawnWorldBoss(store) {
  const meta = store.getMeta();
  const tpl = WORLD_BOSS_TEMPLATES[Math.floor(getRand()() * WORLD_BOSS_TEMPLATES.length)];

  // 1. 算攻防
  const bossStats = buildBossStats(store, tpl);
  const tempBoss = {
    // 估算阶段只测伤害，不需要真实血量；使用足够大的占位血量让每位玩家跑满 8 回合。
    hp: Number.MAX_SAFE_INTEGER,
    maxHp: Number.MAX_SAFE_INTEGER,
    atk: bossStats.atk,
    def: bossStats.def,
    agi: bossStats.agi,
    skillChance: tpl.skillChance,
  };

  // 2. 模拟前 50% 玩家累计伤害
  const topHalfTotal = estimateTopHalfTotalDamage(store, tempBoss, BOSS_BATTLE_ROUNDS);

  // 3. boss.hp = 前 50% 玩家总伤害 × 1.05（5% 余量），最低 1 万（防止全服空数据时为 0）
  const targetHp = Math.max(10000, Math.floor(topHalfTotal * 1.05));

  const todayKey = getBossDayKey();
  meta.worldBoss = {
    id: tpl.id,
    name: tpl.name,
    icon: tpl.icon,
    desc: tpl.desc,
    hp: targetHp,
    maxHp: targetHp,
    atk: bossStats.atk,
    def: bossStats.def,
    agi: bossStats.agi,
    skillChance: tpl.skillChance,
    spawnedAt: getNow(),
    spawnDayKey: todayKey,
    expiresAt: getTodayMidnight() + 24 * 60 * 60 * 1000, // 次日 0 点
    rewards: tpl.rewards,
    finalHitRewards: tpl.finalHitRewards,
    damageLog: {},
    finalHitBy: null,
    dead: false,
    settled: false,
    settlementIds: [],
    // v3.0：保留中位玩家参考信息（调试 + 前端展示用）
    buildMode: 'tpl70_median30',
    rounds: BOSS_BATTLE_ROUNDS,
  };
  store.setMeta(meta);
  return meta.worldBoss;
}

// 检查现有 BOSS 是否过期（过了 expiresAt 或跨日），过期则自动结算并生成新的
function ensureBossFresh(store) {
  const meta = store.getMeta();
  const boss = meta.worldBoss;
  const now = getNow();
  const todayMidnight = getTodayMidnight();
  const todayKey = getBossDayKey();

  // 跨日或已超过 expiresAt：强制结算当前 boss（无论是否死亡）然后重生
  if (boss && (boss.spawnDayKey !== todayKey || now >= (boss.expiresAt || 0))) {
    if (!boss.settled) {
      boss.dead = true;
      boss.expired = boss.hp > 0; // 标记是过期而非击杀
      settleWorldBossRewards(store, boss);
    }
    meta.worldBoss = null;
    store.setMeta(meta);
    return spawnWorldBoss(store);
  }
  if (!boss) return spawnWorldBoss(store);
  return boss;
}

// 取活跃 BOSS（顺手处理过期）
function getActiveBoss(store) {
  return ensureBossFresh(store);
}

// 获取下一次过期时间戳（前端倒计时用）
function getBossExpiresAt(store) {
  const meta = store.getMeta();
  if (meta.worldBoss && !meta.worldBoss.dead) {
    return meta.worldBoss.expiresAt || 0;
  }
  return 0;
}

// 玩家挑战 BOSS：一次挑战 = 一次 5 回合战斗；每玩家每日 1 次
function attackWorldBoss(store, username) {
  const meta = store.getMeta();
  const boss = ensureBossFresh(store);
  if (!boss || boss.dead) return { success: false, message: '当前没有可攻击的世界 BOSS' };
  const player = store.getPlayer(username);
  if (!player) return { success: false, message: '玩家不存在' };

  // 每日 1 次：按北京日判定（同一天内只能打 1 次）
  const todayKey = getBossDayKey();
  if (player.lastBossAttackDay === todayKey) {
    return { success: false, message: '今日挑战次数已用完，请等待次日 BOSS 重生' };
  }

  // 模拟 BOSS_BATTLE_ROUNDS 回合战斗（v3.0: 5 → 8）
  const battle = simulateBossBattle(player, boss, boss.rounds || BOSS_BATTLE_ROUNDS);
  boss.hp = Math.max(0, boss.hp - battle.totalDamage);
  boss.damageLog = boss.damageLog || {};
  boss.damageLog[username] = (boss.damageLog[username] || 0) + battle.totalDamage;

  // 标记挑战记录
  player.lastBossAttackAt = getNow();
  player.lastBossAttackDay = todayKey;

  let killed = false;
  let rewards = null;
  if (boss.hp <= 0) {
    boss.dead = true;
    boss.killedAt = getNow();
    boss.finalHitBy = username;
    killed = true;
    rewards = settleWorldBossRewards(store, boss);
  } else {
    // 即使没击杀，也给参与奖励（事务内，仅内存变更，由外层 withTransaction 统一提交）
    grantWorldBossParticipation(player, boss);
  }

  // 移除引擎层直接持久化，交由路由层 withTransaction 统一提交（避免内外层保存不一致）
  return {
    success: true,
    battle,           // { rounds, totalDamage, result }
    bossHp: boss.hp, bossMaxHp: boss.maxHp,
    myDamage: boss.damageLog[username],
    killed, rewards,
    finalHit: username === boss.finalHitBy,
    expiresAt: boss.expiresAt,
    remainingMs: Math.max(0, boss.expiresAt - getNow()),
  };
}

// 给玩家参与奖励（按伤害占比）
//   v3.1：去掉材料奖励，只发金币/经验
//   v3.2：参与奖翻倍（基础 gold/exp × 伤害占比 × 2）让所有参与玩家都有"拿得动"的回报
function grantWorldBossParticipation(player, boss) {
  const myDmg = boss.damageLog[player.username] || 0;
  const totalDmg = Object.values(boss.damageLog).reduce((a, b) => a + b, 0);
  const ratio = totalDmg > 0 ? myDmg / totalDmg : 0;
  const baseGold = boss.rewards?.gold || 0;
  const baseExp = boss.rewards?.exp || 0;
  // v3.2 参与奖翻倍
  const goldGain = Math.floor(baseGold * ratio * 2);
  const expGain = Math.floor(baseExp * ratio * 2);
  if (goldGain <=0 && expGain <=0) return;
  const dayKey = getBossDayKey();
  const pid = `boss:participation:${dayKey}:${boss.id}:${player.username}`;
  // 幂等：同一北京日内同一 Boss 已发过参与奖则不重发
  if (Array.isArray(player.settlementLedger) && player.settlementLedger.some(e => e.id === pid)) return;
  player.gold = (player.gold || 0) + goldGain;
  player.exp = (player.exp || 0) + expGain;
  const reward = { gold: goldGain, exp: expGain };
  const v = assertSettlementReward('boss_participation', reward);
  if (!v.valid) return;
  if (!Array.isArray(player.settlementLedger)) player.settlementLedger = [];
  player.settlementLedger.push({
    id: pid,
    at: getNow(),
    type: 'boss_participation',
    reward,
    source: `boss:participation:${dayKey}:${boss.id}`,
  });
  if (player.settlementLedger.length > 100) player.settlementLedger.splice(0, player.settlementLedger.length - 100);
}

// 结算 BOSS 奖励：参与奖 + 最后一击奖 + 伤害前三称号（24h 限时）+ 前三名等级进度奖 + 4-20 名取参与奖上限
//   v3.1 重构：
//     - 去掉所有材料奖励（参与奖 / 最后一击奖都不再发材料）
//     - 前 3 名（已有称号）新增"等级进度奖"
//   v3.2 调高：
//     - levelBonus = floor(boss.hp × 0.01)（原来 × 0.001，× 10 调高）
//     - 第 4-20 名：取"参与奖上限"= BOSS 基础 gold/exp × 1.0（远高于 v3.1 的固定 200/100）
//     - 参与奖在 attackWorldBoss 里发的是基础奖 × 伤害占比 × 2
function settleWorldBossRewards(store, boss) {
  if (boss.settled) return { already: true };
  const ranked = Object.entries(boss.damageLog || {})
    .map(([username, dmg]) => ({ username, dmg }))
    .sort((a, b) => b.dmg - a.dmg);

  const result = { participants: ranked.length, top: [], titleWinners: [] };
  const expiresAt = getNow() + 24 * 60 * 60 * 1000;
  const titleKeys = ['boss_killer_1', 'boss_killer_2', 'boss_killer_3'];
  // v3.3 排名奖常量
  //   前 3 名进度奖 = BOSS 基础奖 × 3/2/1.5 倍（确保严格高于 4-20 名的 × 1.0）
  const TOP3_MULT = [3, 2, 1.5];  // 第 1/2/3 名进度奖是 BOSS 基础奖的多少倍
  const RANK_BONUS_MAX_RANK = 20;
  // v3.3 第 4-20 名：取参与奖上限 = BOSS 基础 gold/exp × 1.0
  const rank4_20Gold = boss.rewards?.gold || 0;
  const rank4_20Exp = boss.rewards?.exp || 0;
  // v3.3 等级进度奖：BOSS 基础奖 × TOP3_MULT（不再用 boss.hp 系数）
  const baseGold = boss.rewards?.gold || 0;
  const baseExp = boss.rewards?.exp || 0;

  const spawnDayKey = boss.spawnDayKey || getBossDayKey(boss.spawnedAt || getNow());
  const batchId = `boss:settle:${spawnDayKey}:${boss.id}`;
  const childIds = [];
  for (let i = 0; i < ranked.length; i++) {
    const r = ranked[i];
    const p = store.getPlayer(r.username);
    if (!p) continue;
    const rank = i + 1;  // 1-based
    let ledgerGold = 0;
    let ledgerExp = 0;
    const ledgerTitles = [];
    const childId = `boss:settle:${spawnDayKey}:${boss.id}:rank:${rank}`;

    // 1) 最后一击奖（v3.1：去掉材料，只剩金币/经验）
    if (r.username === boss.finalHitBy && boss.finalHitRewards) {
      const fg = (boss.finalHitRewards.gold || 0);
      const fe = (boss.finalHitRewards.exp || 0);
      p.gold = (p.gold || 0) + fg;
      p.exp = (p.exp || 0) + fe;
      ledgerGold += fg;
      ledgerExp += fe;
    }

    // 2) 前 3 名：称号 + 等级进度奖（按 50%/30%/20% 拆分）
    if (i < 3) {
      // 称号
      const tk = titleKeys[i];
      p.titles = p.titles || {};
      p.titleExpiry = p.titleExpiry || {};
      p.titles[tk] = true;
      p.titleExpiry[tk] = expiresAt;
      result.titleWinners.push({ rank, username: r.username, titleKey: tk });

      // 等级进度奖（v3.3：BOSS 基础奖 × 3/2/1.5 倍，严格高于 4-20 名的 × 1.0）
      const mult = TOP3_MULT[i];
      const bonusGold = Math.floor(baseGold * mult);
      const bonusExp = Math.floor(baseExp * mult);
      p.gold = (p.gold || 0) + bonusGold;
      p.exp = (p.exp || 0) + bonusExp;
      ledgerGold += bonusGold;
      ledgerExp += bonusExp;
      ledgerTitles.push(tk);
    }
    // 3) 第 4-20 名：取参与奖上限 = BOSS 基础 gold/exp × 1.0
    else if (rank >= 4 && rank <= RANK_BONUS_MAX_RANK) {
      p.gold = (p.gold || 0) + rank4_20Gold;
      p.exp = (p.exp || 0) + rank4_20Exp;
      ledgerGold += rank4_20Gold;
      ledgerExp += rank4_20Exp;
    }
    // 4) 20 名后：只拿参与奖（在 attackWorldBoss 里已即时发放，× 2 翻倍）

    p.logs = p.logs || [];
    const expireNote = boss.expired ? '今日已过，强制结算' : '已被击杀';
    let logText = '';
    if (r.username === boss.finalHitBy) {
      logText = `【世界 BOSS】你击杀了 ${boss.name}！获得额外击杀奖励`;
    } else if (rank <= 3) {
      logText = `【世界 BOSS】${boss.name} ${expireNote}，你以第 ${rank} 名身份参与了战斗（获得等级进度奖）`;
    } else if (rank <= 20) {
      logText = `【世界 BOSS】${boss.name} ${expireNote}，你以第 ${rank} 名身份参与了战斗（获得排名奖）`;
    } else {
      logText = `【世界 BOSS】${boss.name} ${expireNote}，你参与了战斗`;
    }
    p.logs.push({ time: getNow(), type: 'world-boss', text: logText });
    // settlement ledger (boss_settle) with validation
    if (ledgerGold > 0 || ledgerExp > 0 || ledgerTitles.length > 0) {
      const reward = { gold: ledgerGold, exp: ledgerExp };
      if (ledgerTitles.length > 0) reward.titles = [...ledgerTitles];
      const v = assertSettlementReward('boss_settle', reward);
      if (v.valid) {
        if (!Array.isArray(p.settlementLedger)) p.settlementLedger = [];
        const tier = rank === 1 ? 'S' : rank === 2 ? 'A' : rank === 3 ? 'B' : rank <= 10 ? 'C' : rank <= 20 ? 'D' : 'E';
        const fullResult = { gold: ledgerGold, exp: ledgerExp, rank, tier };
        if (ledgerTitles.length > 0) fullResult.titles = [...ledgerTitles];
        // dedup by id if already exists (guard idempotency) - push childId only when ledger will be written (one-to-one)
        if (!p.settlementLedger.some(e => e.id === childId)) {
          childIds.push(childId);
          p.settlementLedger.push({
            id: childId,
            at: getNow(),
            type: 'boss_settle',
            reward,
            source: batchId,
            fullResult,
          });
          if (p.settlementLedger.length > 100) p.settlementLedger.splice(0, p.settlementLedger.length - 100);
        }
      }
    }
    store.setPlayer(r.username, p);
  }
  boss.settled = true;
  boss.settlementIds = [batchId, ...childIds];
  result.top = ranked.slice(0, 5);
  result.settlementIds = boss.settlementIds;
  result.batchId = batchId;
  return result;
}

// 获取伤害排行榜
function getBossRanking(store, limit = 10) {
  const meta = store.getMeta();
  const boss = meta.worldBoss;
  if (!boss) return [];
  return Object.entries(boss.damageLog || {})
    .map(([username, dmg]) => ({ username, damage: dmg }))
    .sort((a, b) => b.damage - a.damage)
    .slice(0, limit);
}

function getStrongestPlayer(store) {
  const top = getTopHalfByLevel(store);
  return top[0] || null;
}
module.exports = {
  spawnWorldBoss, getActiveBoss, getBossExpiresAt,
  attackWorldBoss,
  grantWorldBossParticipation, settleWorldBossRewards, getBossRanking,
  // v3.0：暴露新函数供测试 / 调试使用
  getTopHalfByLevel, getMedianPlayerByLevel,
  estimateTopHalfTotalDamage, buildBossStats,
  // v3.4：北京日 key（路由层 challengedToday 判定用，与引擎同源）
  getBossDayKey, getTodayMidnight,
  getStrongestPlayer,
  BOSS_BATTLE_ROUNDS,
};