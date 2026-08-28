// ====== 世界 BOSS（v2.9：每日 0 点强制结算、按全服最强玩家 10 倍数值生成） ======
const { getNow, getRand } = require('./state');
const { WORLD_BOSS_TEMPLATES, WORLD_BOSS_SPAWN_INTERVAL_MS } = require('../data');
const { getTotalStats } = require('./stats');
const { simulateBossBattle } = require('./combat');

// 每日 0 点的本地时区时间戳（用于判定 boss 是否过期）
function getTodayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// 取全服当前最强的玩家（按 totalStats.score 综合分）
// score = hp/10 + atk + def*2 + agi + level*5
function getStrongestPlayer(store) {
  const all = store.getAllPlayers ? store.getAllPlayers() : [];
  let best = null;
  let bestScore = -1;
  for (const p of all) {
    if (!p || !p.username) continue;
    const s = getTotalStats(p);
    // 排除极弱（LV1无装备）的账号，把阈值设为最低统计分
    const score = (s.hp || 0) / 10 + (s.atk || 0) + (s.def || 0) * 2 + (s.agi || 0) + (p.level || 0) * 5;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

// 按全服最强玩家 × 10 倍生成 BOSS 属性（生命5:攻击3:防御1:敏捷1）
// 分配逻辑：hp = 锚点 hp * 10 * (5/10)，atk = 锚点 atk * 10 * (3/10)，
//          def = 锚点 def * 10 * (1/10)，agi = 锚点 agi * 10 * (1/10)
// 简化为：hp×5，atk×3，def×1，agi×1（10 倍拆分给 5+3+1+1=10）
function buildBossFromStrongest(store, tpl) {
  const sp = getStrongestPlayer(store);
  if (!sp) return null; // 全服无玩家数据时返回 null（应回落到模板）
  const s = getTotalStats(sp);
  const mult = 10;
  return {
    hp: Math.floor((s.hp || 100) * 5),
    maxHp: Math.floor((s.hp || 100) * 5),
    atk: Math.floor((s.atk || 5) * 3),
    def: Math.floor((s.def || 0) * 1),
    agi: Math.floor((s.agi || 8) * 1),
  };
}

// 生成 BOSS（优先按全服最强 10 倍；找不到玩家时退回模板）
function spawnWorldBoss(store) {
  const meta = store.getMeta();
  const tpl = WORLD_BOSS_TEMPLATES[Math.floor(getRand()() * WORLD_BOSS_TEMPLATES.length)];
  const fromStrongest = buildBossFromStrongest(store, tpl);
  const stats = fromStrongest || {
    hp: tpl.baseHp,
    maxHp: tpl.baseHp,
    atk: tpl.baseAtk,
    def: tpl.baseDef,
    agi: tpl.baseAgi,
  };
  const todayKey = new Date().toISOString().slice(0, 10);
  meta.worldBoss = {
    id: tpl.id,
    name: tpl.name,
    icon: tpl.icon,
    desc: tpl.desc,
    hp: stats.hp,
    maxHp: stats.maxHp,
    atk: stats.atk,
    def: stats.def,
    agi: stats.agi,
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
    fromStrongest: !!fromStrongest,
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
  const todayKey = new Date().toISOString().slice(0, 10);

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

  // 每日 1 次：按 spawnDayKey 判定（同一天内只能打 1 次）
  const todayKey = new Date().toISOString().slice(0, 10);
  if (player.lastBossAttackDay === todayKey) {
    return { success: false, message: '今日挑战次数已用完，请等待次日 BOSS 重生' };
  }

  // 模拟 5 回合战斗
  const battle = simulateBossBattle(player, boss, 5);
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
    boss.settled = true;
    killed = true;
    rewards = settleWorldBossRewards(store, boss);
  } else {
    // 即使没击杀，也给参与奖励
    grantWorldBossParticipation(player, boss);
  }

  store.setMeta(meta);
  store.setPlayer(username, player);
  store.save();

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
function grantWorldBossParticipation(player, boss) {
  const myDmg = boss.damageLog[player.username] || 0;
  const totalDmg = Object.values(boss.damageLog).reduce((a, b) => a + b, 0);
  const ratio = totalDmg > 0 ? myDmg / totalDmg : 0;
  const baseGold = boss.rewards?.gold || 0;
  const baseExp = boss.rewards?.exp || 0;
  const goldGain = Math.floor(baseGold * ratio);
  const expGain = Math.floor(baseExp * ratio);
  player.gold = (player.gold || 0) + goldGain;
  player.exp = (player.exp || 0) + expGain;
  if (boss.rewards?.materials) {
    for (const m of boss.rewards.materials) {
      const inv = player.inventory.find(i => i.name === m.name);
      const cnt = Math.max(1, Math.floor(m.count * Math.max(0.3, ratio)));
      if (inv) inv.count += cnt;
      else player.inventory.push({ name: m.name, count: cnt, type: 'material' });
    }
  }
}

// 结算 BOSS 奖励：参与奖 + 最后一击奖 + 伤害前三称号（24h 限时）
function settleWorldBossRewards(store, boss) {
  const ranked = Object.entries(boss.damageLog || {})
    .map(([username, dmg]) => ({ username, dmg }))
    .sort((a, b) => b.dmg - a.dmg);

  const result = { participants: ranked.length, top: [], titleWinners: [] };
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const titleKeys = ['boss_killer_1', 'boss_killer_2', 'boss_killer_3'];

  for (let i = 0; i < ranked.length; i++) {
    const r = ranked[i];
    const p = store.getPlayer(r.username);
    if (!p) continue;

    if (r.username === boss.finalHitBy && boss.finalHitRewards) {
      p.gold = (p.gold || 0) + (boss.finalHitRewards.gold || 0);
      p.exp = (p.exp || 0) + (boss.finalHitRewards.exp || 0);
      if (boss.finalHitRewards.materials) {
        for (const m of boss.finalHitRewards.materials) {
          const inv = p.inventory.find(i => i.name === m.name);
          if (inv) inv.count += m.count;
          else p.inventory.push({ name: m.name, count: m.count, type: 'material' });
        }
      }
    }

    // 前三名发限时称号（仅当实际挑战过该 BOSS，且 boss 是真死亡或结算触发）
    if (i < 3 && titleKeys[i]) {
      const tk = titleKeys[i];
      p.titles = p.titles || {};
      p.titleExpiry = p.titleExpiry || {};
      p.titles[tk] = true;
      p.titleExpiry[tk] = expiresAt;
      result.titleWinners.push({ rank: i + 1, username: r.username, titleKey: tk });
    }

    p.logs = p.logs || [];
    const expireNote = boss.expired ? '今日已过，强制结算' : '已被击杀';
    p.logs.push({
      time: getNow(),
      type: 'world-boss',
      text: r.username === boss.finalHitBy
        ? `【世界 BOSS】你击杀了 ${boss.name}！获得额外击杀奖励`
        : `【世界 BOSS】${boss.name} ${expireNote}，你参与了战斗`,
    });
    store.setPlayer(r.username, p);
  }
  result.top = ranked.slice(0, 5);
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

module.exports = {
  spawnWorldBoss, getActiveBoss, getBossExpiresAt,
  attackWorldBoss,
  grantWorldBossParticipation, settleWorldBossRewards, getBossRanking,
  getStrongestPlayer,
};