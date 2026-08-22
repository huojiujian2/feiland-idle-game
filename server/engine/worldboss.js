// ====== 世界 BOSS ======
const { getNow, getRand } = require('./state');
const { WORLD_BOSS_TEMPLATES, WORLD_BOSS_SPAWN_INTERVAL_MS } = require('../data');
const { getTotalStats } = require('./stats');

// recalcMaxStats 注入
let _recalcMaxStats = () => {};
function setRecalcMaxStatsHandler(fn) { if (typeof fn === 'function') _recalcMaxStats = fn; }

function spawnWorldBoss(store) {
  const meta = store.getMeta();
  const tpl = WORLD_BOSS_TEMPLATES[Math.floor(getRand()() * WORLD_BOSS_TEMPLATES.length)];
  meta.worldBoss = {
    id: tpl.id,
    name: tpl.name,
    icon: tpl.icon,
    desc: tpl.desc,
    hp: tpl.baseHp,
    maxHp: tpl.baseHp,
    atk: tpl.baseAtk,
    def: tpl.baseDef,
    agi: tpl.baseAgi,
    skillChance: tpl.skillChance,
    spawnedAt: getNow(),
    rewards: tpl.rewards,
    finalHitRewards: tpl.finalHitRewards,
    damageLog: {},
    finalHitBy: null,
    dead: false,
  };
  store.setMeta(meta);
  return meta.worldBoss;
}

function getActiveBoss(store) {
  const meta = store.getMeta();
  if (!meta.worldBoss || meta.worldBoss.dead) {
    const lastSpawn = meta.worldBoss ? meta.worldBoss.spawnedAt : 0;
    if (!meta.worldBoss || getNow() - lastSpawn >= WORLD_BOSS_SPAWN_INTERVAL_MS) {
      return spawnWorldBoss(store);
    }
    return null;
  }
  return meta.worldBoss;
}

function attackWorldBoss(store, username) {
  const meta = store.getMeta();
  const boss = meta.worldBoss;
  if (!boss || boss.dead) return { success: false, message: '当前没有可攻击的世界 BOSS' };
  const player = store.getPlayer(username);
  if (!player) return { success: false, message: '玩家不存在' };

  const stats = getTotalStats(player);
  let damage = Math.max(1, stats.atk - boss.def);
  const isCrit = getRand()() < (stats.crit || 0);
  if (isCrit) damage = Math.floor(damage * 1.5);
  damage = Math.floor(damage * (0.9 + getRand()() * 0.2));

  boss.hp = Math.max(0, boss.hp - damage);
  boss.damageLog = boss.damageLog || {};
  boss.damageLog[username] = (boss.damageLog[username] || 0) + damage;

  let killed = false;
  let rewards = null;
  if (boss.hp <= 0) {
    boss.dead = true;
    boss.killedAt = getNow();
    boss.finalHitBy = username;
    killed = true;
    rewards = settleWorldBossRewards(store, boss);
  }

  store.setMeta(meta);
  store.save();

  if (!killed) {
    grantWorldBossParticipation(player, boss);
    store.setPlayer(username, player);
    store.save();
  }

  return {
    success: true,
    damage, isCrit,
    bossHp: boss.hp, bossMaxHp: boss.maxHp,
    myDamage: boss.damageLog[username],
    killed, rewards,
    finalHit: username === boss.finalHitBy,
  };
}

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

function settleWorldBossRewards(store, boss) {
  const ranked = Object.entries(boss.damageLog || {})
    .map(([username, dmg]) => ({ username, dmg }))
    .sort((a, b) => b.dmg - a.dmg);

  const result = { participants: ranked.length, top: [] };
  for (const r of ranked) {
    const p = store.getPlayer(r.username);
    if (!p) continue;
    if (r.username === boss.finalHitBy) {
      if (boss.finalHitRewards) {
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
      p.logs = p.logs || [];
      p.logs.push({ time: getNow(), type: 'world-boss', text: `【世界 BOSS】你击杀了 ${boss.name}！获得额外击杀奖励` });
    } else {
      p.logs = p.logs || [];
      p.logs.push({ time: getNow(), type: 'world-boss', text: `【世界 BOSS】${boss.name} 已被击杀，你参与了战斗` });
    }
    store.setPlayer(r.username, p);
  }
  result.top = ranked.slice(0, 5);
  return result;
}

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
  spawnWorldBoss, getActiveBoss, attackWorldBoss,
  grantWorldBossParticipation, settleWorldBossRewards, getBossRanking,
  setRecalcMaxStatsHandler,
};
