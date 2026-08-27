// ====== 挂机收益：单次结算 + 离线批量结算 ======
const { getNow, getRand, isTestMode } = require('./state');
const { genUid, shouldDrop, buildBattleMonster } = require('./utils');
const { getTotalStats, getEquipBonus, getLawBonus, getRaceBonus, getReincarnationBonus, getJobTalents } = require('./stats');
const { simulateBattle } = require('./combat');
const { migratePlayer } = require('./player');
const { ensureQuestStats, updateDailyProgress, checkAchievements } = require('./daily');
const { AREAS, AREA_ORDER, STRATEGIES, JOB_TREE, expToNext, createEquipItem } = require('../data');

// grantGold 注入
let _grantGold = (player, amount) => { player.gold += amount; };
function setGrantGoldHandler(fn) { if (typeof fn === 'function') _grantGold = fn; }

// meta 注入（创世系统读取全服共享 meta）
let _getMeta = () => ({ genesis: { monsters: [], equips: [] } });
function setMetaGetter(fn) { if (typeof fn === 'function') _getMeta = fn; }

// 单次战斗
function _runSingleBattle(player, area) {
  const custom = _getMeta().genesis?.monsters?.filter(m => m.areaId === area.id) || [];
  const pool = [...area.monsters, ...custom];
  const monster = pool[Math.floor(getRand()() * pool.length)];
  const battleMonster = buildBattleMonster(monster, player.strategy);
  const battle = simulateBattle(player, battleMonster);
  return { monster, battle, battleMonster };
}

// 单次结算
function calculateIdle(player) {
  player = migratePlayer(player);
  const area = AREAS[player.currentArea];
  if (!area) return null;
  const now = getNow();
  const elapsed = now - player.lastTick;
  if (elapsed < 3000) return null;

  // 检测测试场景：_rand 被注入时回退到单场以保证测试稳定
  const testMode = isTestMode();
  // 离线 > 60s 且非测试场景走批量结算
  const BATCH_THRESHOLD = 60 * 1000;
  if (!testMode && elapsed >= BATCH_THRESHOLD) {
    return _calculateIdleBatch(player, area, elapsed);
  }

  recalcMaxStatsFromStats(player);
  const { monster, battle, battleMonster } = _runSingleBattle(player, area);
  // 战斗结算后满血满蓝（战斗内掉血只在单场模拟内部生效，不带入下一场）
  player.hp = player.maxHp;
  player.mp = player.maxMp;

  const total = getTotalStats(player);
  const lawBonus = getLawBonus(player);
  const raceBonus = getRaceBonus(player);
  const reincBonus = getReincarnationBonus(player);
  const talents = getJobTalents(player);

  let expGain = 0, goldGain = 0, drops = [];
  let expMult = 1 + total.expBonus + reincBonus.expBonus + lawBonus.exp + (raceBonus.exp || 0);
  let goldMult = 1 + total.goldBonus + reincBonus.goldBonus + lawBonus.gold;
  if (player.godhood === 'demigod') expMult *= 1.5;
  if (player.godhood === 'god') expMult *= 2;
  const stratEff = STRATEGIES[player.strategy]?.effects || {};
  if (stratEff.exp) expMult *= (1 + stratEff.exp);
  if (stratEff.gold) goldMult *= (1 + stratEff.gold);

  if (battle.result === 'win') {
    if (battle.skillGoldBonus) goldMult *= (1 + battle.skillGoldBonus);
    expGain = Math.floor(monster.exp * expMult);
    goldGain = Math.floor(monster.gold * goldMult);
    if (talents.killExp) {
      const bonusExp = talents.killExp === 'level*2' ? player.level * 2 : Math.floor(monster.exp * talents.killExp);
      expGain += bonusExp;
    }
    if (total.killExp) expGain += Math.floor(monster.exp * total.killExp);
    if (total.killGold) goldGain += Math.floor(monster.gold * total.killGold);
    if (total.flatExp) expGain += total.flatExp;
    if (total.doubleKill) { expGain *= 2; goldGain *= 2; }

    player.exp += expGain;
    if (goldGain > 0) _grantGold(player, goldGain);
    player.killCount = (player.killCount || 0) + 1;
    player.combatStats.todayKills = (player.combatStats.todayKills || 0) + 1;
    player.combatStats.monthKills = (player.combatStats.monthKills || 0) + 1;
    player.combatStats.totalWins = (player.combatStats.totalWins || 0) + 1;

    if (monster.isBoss) {
      player.bossKills = (player.bossKills || 0) + 1;
      const curAreaIdx = AREA_ORDER.indexOf(player.currentArea);
      const maxAreaIdx = AREA_ORDER.indexOf(player.stats.maxClearedArea);
      if (curAreaIdx > maxAreaIdx) {
        player.stats.maxClearedArea = player.currentArea;
        player.logs.push({
          time: now, type: 'milestone',
          text: `🎉 通关新区域「${AREAS[player.currentArea].name}」！`
        });
      }
    }

    if (player.godhood) player.faith += Math.floor(monster.exp * 0.1);

    // 地图基础掉落 + 该自创怪自身的掉落（如有）
    // v0.9：怪物的 drops 项支持 kind 区分（material/equip），自创装备作为掉落时按装备处理
    const dropList = [...area.drops];
    if (Array.isArray(monster.drops) && monster.drops.length > 0) {
      const customEquips = _getMeta().genesis?.equips || [];
      for (const d of monster.drops) {
        const kind = d.kind || 'material';  // 兼容旧数据（无 kind 视为 material）
        if (kind === 'equip') {
          // 自创装备掉落：转成 equip 类型入背包（d.name 是装备 templateId）
          dropList.push({ type: 'equip', template: d.name, rate: d.rate });
        } else {
          dropList.push({ type: 'material', name: d.name, rate: d.rate });
        }
      }
    }
    for (const drop of dropList) {
      if (shouldDrop(drop.rate, player.strategy)) {
        if (drop.type === 'material') {
          drops.push(drop.name);
          const existing = player.inventory.find(i => i.name === drop.name);
          if (existing) existing.count++;
          else player.inventory.push({ name: drop.name, count: 1, type: 'material' });
        } else if (drop.type === 'equip') {
          // v0.9：传入的可能是自创装备 templateId（custom_xxx），createEquipItem 走模板表查找
          const item = createEquipItem(drop.template, genUid());
          if (item) {
            player.equips.push(item);
            drops.push(`${item.name} [${item.quality}]`);
            ensureQuestStats(player);
            if (!player.questStats.seenEquipTemplates.includes(item.templateId)) player.questStats.seenEquipTemplates.push(item.templateId);
          }
        }
      }
    }
    updateDailyProgress(player, 'hunt50', 1);
    updateDailyProgress(player, 'battle20', 1);
    checkAchievements(player);
  } else if (battle.result === 'lose') {
    expGain = Math.floor(monster.exp * 0.1 * expMult);
    player.exp += expGain;
    player.hp = Math.max(1, Math.floor(player.maxHp * 0.1));
    player.combatStats.totalLosses = (player.combatStats.totalLosses || 0) + 1;
    updateDailyProgress(player, 'battle20', 1);
  } else {
    expGain = Math.floor(monster.exp * 0.3 * expMult);
    player.exp += expGain;
    player.combatStats.totalDraws = (player.combatStats.totalDraws || 0) + 1;
    updateDailyProgress(player, 'battle20', 1);
  }

  player.mp = Math.min(player.maxMp, player.mp + Math.ceil(player.maxMp * 0.05));
  if (total.regen > 0 && player.hp > 0) {
    player.hp = Math.min(player.maxHp, player.hp + Math.floor(player.maxHp * total.regen));
  }

  const logEntry = {
    time: now, type: 'battle',
    monster: { name: monster.name, hp: monster.hp, atk: battleMonster.atk, def: monster.def, agi: monster.agi },
    monsterBaseAtk: monster.atk,
    strategy: player.strategy,
    result: battle.result,
    rounds: battle.rounds.length,
    agiRatio: battle.agiRatio,
    exp: expGain, gold: goldGain, drops,
    detail: battle.rounds.slice(-6),
    finalPHp: battle.playerHp,
    finalMHP: battle.monsterHp,
    combatAtk: battle.combatStats.atk,
    combatDef: battle.combatStats.def,
    combatAgi: battle.combatStats.agi,
    combatCrit: battle.combatStats.crit,
    combatDodge: battle.combatStats.dodge
  };
  player.logs.push(logEntry);
  if (player.logs.length > 30) player.logs = player.logs.slice(-30);

  const levelUps = [];
  while (player.exp >= expToNext(player.level)) {
    player.exp -= expToNext(player.level);
    player.level++;
    player.attrPoints += 3;
    player.skillPoints += 1;
    player.maxHp += 20;
    player.maxMp += 10;
    player.hp = player.maxHp;
    player.mp = player.maxMp;
    levelUps.push(player.level);

    if (player.jobPath) {
      const tree = JOB_TREE[player.jobPath];
      for (const stage of tree.stages) {
        if (stage.level === player.level) {
          player.job = stage.name;
          player.logs.push({ time: now, type: 'job', text: `${stage.desc}，职业进阶为：${stage.name}！被动词条槽位+1` });
        }
      }
    }
  }
  if (levelUps.length > 0) {
    const top = levelUps[levelUps.length - 1];
    player.logs.push({ time: now, type: 'levelup', level: top, text: `等级提升！Lv.${top}，+${levelUps.length * 3}属性 +${levelUps.length}技能点` });
    checkAchievements(player);
  } else if (expGain > 0) {
    checkAchievements(player);
  }

  player.lastTick = now;
  return { logEntry, levelUps };
}

// 批量结算（离线 > 60s）
function _calculateIdleBatch(player, area, elapsed) {
  recalcMaxStatsFromStats(player);
  const total = getTotalStats(player);
  const lawBonus = getLawBonus(player);
  const raceBonus = getRaceBonus(player);
  const reincBonus = getReincarnationBonus(player);
  const talents = getJobTalents(player);

  let expMult = 1 + total.expBonus + reincBonus.expBonus + lawBonus.exp + (raceBonus.exp || 0);
  let goldMult = 1 + total.goldBonus + reincBonus.goldBonus + lawBonus.gold;
  if (player.godhood === 'demigod') expMult *= 1.5;
  if (player.godhood === 'god') expMult *= 2;
  const stratEff = STRATEGIES[player.strategy]?.effects || {};
  if (stratEff.exp) expMult *= (1 + stratEff.exp);
  if (stratEff.gold) goldMult *= (1 + stratEff.gold);

  const BATTLE_INTERVAL_MS = 4000;
  let battles = Math.floor(elapsed / BATTLE_INTERVAL_MS);
  if (battles > 600) battles = 600;

  const avgMonster = area.monsters.reduce((a, m) => {
    a.hp += m.hp; a.atk += m.atk; a.def += m.def; a.agi += m.agi; a.exp += m.exp; a.gold += m.gold;
    return a;
  }, { hp: 0, atk: 0, def: 0, agi: 0, exp: 0, gold: 0 });
  const cnt = area.monsters.length;
  avgMonster.hp /= cnt; avgMonster.atk /= cnt; avgMonster.def /= cnt;
  avgMonster.agi /= cnt; avgMonster.exp /= cnt; avgMonster.gold /= cnt;

  // 简单胜负判定：基于击杀所需回合数（更接近 simulateBattle）
  const playerAtk = total.atk || 10;
  const playerDef = total.def || 10;
  const dmgPerRound = Math.max(1, playerAtk * 0.5 - avgMonster.def * 0.25);
  const roundsToKill = Math.max(1, avgMonster.hp / dmgPerRound);
  const monsterDmgPerRound = Math.max(1, avgMonster.atk * 0.5 - playerDef * 0.25);
  const roundsToDie = Math.max(1, (total.hp || 100) / monsterDmgPerRound);
  // 胜率：能击杀比被击杀快的越多 → 胜率越高
  const ratio = roundsToDie / roundsToKill;
  // ratio >= 2 → 95%, 1.0 → 65%, 0.7 → 30%, <0.4 → 5%
  let winRate = 0;
  if (ratio >= 2.0) winRate = 0.95;
  else if (ratio >= 1.0) winRate = 0.55 + (ratio - 1.0) * 0.40; // 0.55 ~ 0.95
  else if (ratio >= 0.5) winRate = 0.20 + (ratio - 0.5) * 0.70; // 0.20 ~ 0.55
  else winRate = 0.05;

  // 决定总体结果：胜率 >= 0.5 时总体 win（保留 win/loss/draw 分布用于统计）
  let wins = 0, losses = 0, draws = 0;
  const lossRate = Math.min(0.15, (1 - winRate) * 0.5); // 失败概率 = 剩余空间的 50%（最多 15%）
  for (let i = 0; i < battles; i++) {
    const r = getRand()();
    if (r < winRate) wins++;
    else if (r < winRate + lossRate) losses++;
    else draws++;
  }

  const winExp = Math.floor(avgMonster.exp * expMult);
  const winGold = Math.floor(avgMonster.gold * goldMult);
  let totalExp = wins * winExp + draws * Math.floor(winExp * 0.3) + losses * Math.floor(winExp * 0.1);
  let totalGold = wins * winGold + draws * Math.floor(winGold * 0.3);

  if (talents.killExp) {
    const bonusExp = talents.killExp === 'level*2' ? player.level * 2 : Math.floor(avgMonster.exp * talents.killExp);
    totalExp += wins * bonusExp;
  }
  if (total.killExp) totalExp += wins * Math.floor(avgMonster.exp * total.killExp);
  if (total.killGold) totalGold += wins * Math.floor(avgMonster.gold * total.killGold);
  if (total.flatExp) totalExp += total.flatExp;
  if (total.doubleKill) { totalExp *= 2; totalGold *= 2; }

  player.exp += totalExp;
  if (totalGold > 0) _grantGold(player, totalGold);
  player.killCount = (player.killCount || 0) + wins;
  player.combatStats.todayKills = (player.combatStats.todayKills || 0) + wins;
  player.combatStats.monthKills = (player.combatStats.monthKills || 0) + wins;
  player.combatStats.totalWins = (player.combatStats.totalWins || 0) + wins;
  player.combatStats.totalLosses = (player.combatStats.totalLosses || 0) + losses;
  player.combatStats.totalDraws = (player.combatStats.totalDraws || 0) + draws;

  let levelUps = 0;
  while (player.exp >= expToNext(player.level)) {
    player.exp -= expToNext(player.level);
    player.level++;
    player.attrPoints += 3;
    player.skillPoints += 1;
    player.maxHp += 20;
    player.maxMp += 10;
    levelUps++;
  }
  // 离线批量结算同样满血满蓝
  player.hp = player.maxHp;
  player.mp = player.maxMp;

  const logEntry = {
    time: getNow(), type: 'battle',
    monster: { name: `离线结算 ${battles} 场`, hp: 0, atk: 0, def: 0, agi: 0 },
    strategy: player.strategy,
    result: wins > losses ? 'win' : (wins < losses ? 'lose' : 'draw'),
    rounds: 0, agiRatio: 1,
    exp: totalExp, gold: totalGold, drops: [],
    detail: [],
    finalPHp: player.hp, finalMHP: 0,
    combatAtk: total.atk || 0, combatDef: total.def || 0,
    combatAgi: total.agi || 0, combatCrit: total.crit || 0, combatDodge: total.dodge || 0,
    batch: true, battles, wins, losses, draws,
  };
  player.logs.push(logEntry);
  if (player.logs.length > 30) player.logs = player.logs.slice(-30);
  if (levelUps > 0) {
    player.logs.push({ time: getNow(), type: 'levelup', level: player.level, text: `离线结算升级！Lv.${player.level}` });
  }
  updateDailyProgress(player, 'hunt50', wins);
  updateDailyProgress(player, 'battle20', battles);
  checkAchievements(player);

  player.lastTick = getNow();
  return { logEntry, levelUps: Array(levelUps).fill(0).map((_, i) => player.level - levelUps + i + 1) };
}

// recalcMaxStats 注入（stats 模块）
let _recalcMaxStats = () => {};
function setRecalcMaxStatsHandler(fn) { if (typeof fn === 'function') _recalcMaxStats = fn; }
function recalcMaxStatsFromStats(player) { return _recalcMaxStats(player); }

module.exports = {
  calculateIdle,
  setGrantGoldHandler,
  setRecalcMaxStatsHandler,
  setMetaGetter,
};
