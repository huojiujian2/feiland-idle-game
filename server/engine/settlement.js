// ====== 结算校验：强类型 SettlementReward 白名单 ======
// @file server/engine/settlement.js
// @module settlement
// @description 结算奖励强类型白名单校验（替代 any），服务所有奖励域的 assertSettlementReward
//
// 本文件结构：
// 1. 工具函数 isPlainObject/isNonEmptyString/isNonNegativeNumber (L4-L6)
// 2. assertSettlementReward 主校验 (L8-L77) - 按 type 白名单与精确组合校验
// 3. 导出接口 (L79)
function assertSettlementReward(type, reward) {
  const isPlainObject = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
  const isNonEmptyString = (s) => typeof s === 'string' && s.trim().length > 0;
  const isNonNegativeNumber = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

  if (type === 'chest') {
    if (reward !== null) return { valid:false, message:'宝箱 reward 必须为 null' };
    return { valid:true };
  }
  if (reward === null || !isPlainObject(reward)) return { valid:false, message:'reward 必须为非空对象' };
  const keys = Object.keys(reward);
  if (keys.length === 0) return { valid:false, message:'reward 不能为空对象' };

  const allowedByType = {
    daily: ['gold','exp','materials'],
    achievement: ['gold','equips','affixId','reincPoints','title'],
    boss_participation: ['gold','exp'],
    boss_settle: ['gold','exp','titles'],
    arena_daily: ['coins'],
    arena_weekly: ['coins'],
    arena_monthly: ['coins'],
    pvp_challenge: ['gold','exp','coins'],
    cock_round: ['pointsDelta','points','title'],
    cock_exchange: ['title','cost','points'],
  };
  const allowed = allowedByType[type];
  if (!allowed) return { valid:false, message:`未知 type ${type}` };
  for (const k of keys) {
    if (!allowed.includes(k)) return { valid:false, message:`type ${type} 不允许键 ${k}` };
  }
  // 逐 type 精确组合校验（白名单组合，非至少一个）
  if (type === 'daily') {
    if (keys.length !== 1) return { valid:false, message:'daily 必须恰含其一 gold/exp/materials' };
    const k = keys[0];
    if (k === 'gold') {
      if (!isNonNegativeNumber(reward.gold)) return { valid:false, message:'gold 非法' };
    } else if (k === 'exp') {
      if (!isNonNegativeNumber(reward.exp)) return { valid:false, message:'exp 非法' };
    } else if (k === 'materials') {
      if (!Array.isArray(reward.materials) || reward.materials.length===0) return { valid:false, message:'materials 非空数组' };
      for (const m of reward.materials) {
        if (!isPlainObject(m) || !isNonEmptyString(m.name) || !isNonNegativeNumber(m.count) || m.count===0) return { valid:false, message:'materials 元素非法' };
      }
    } else return { valid:false, message:'daily 键非法' };
  } else if (type === 'achievement') {
    // 精确组合白名单：4 种合法组合
    const hasGold = 'gold' in reward;
    const hasEquips = 'equips' in reward;
    const hasAffix = 'affixId' in reward;
    const hasReinc = 'reincPoints' in reward;
    const hasTitle = 'title' in reward;
    if (!hasTitle) return { valid:false, message:'achievement 必须含 title' };
    if (!isNonEmptyString(reward.title)) return { valid:false, message:'title 非法' };
    const combo1 = hasGold && !hasEquips && !hasAffix && !hasReinc && keys.length===2; // gold+title
    const combo2 = hasGold && hasEquips && !hasAffix && !hasReinc && keys.length===3; // gold+equips+title
    const combo3 = hasAffix && !hasGold && !hasEquips && !hasReinc && keys.length===2; // affixId+title
    const combo4 = hasReinc && !hasGold && !hasEquips && !hasAffix && keys.length===2; // reincPoints+title
    if (!(combo1 || combo2 || combo3 || combo4)) return { valid:false, message:'achievement 组合非法，仅允许 {gold,title}|{gold,equips,title}|{affixId,title}|{reincPoints,title}' };
    if (hasGold && !isNonNegativeNumber(reward.gold)) return { valid:false, message:'gold 非法' };
    if (hasEquips) {
      if (!Array.isArray(reward.equips) || reward.equips.length===0) return { valid:false, message:'equips 非空' };
      for (const e of reward.equips) if (!isPlainObject(e) || !isNonEmptyString(e.templateId)) return { valid:false, message:'equips 元素非法' };
    }
    if (hasAffix && !isNonEmptyString(reward.affixId)) return { valid:false, message:'affixId 非法' };
    if (hasReinc && (!Number.isInteger(reward.reincPoints) || reward.reincPoints<=0)) return { valid:false, message:'reincPoints 非法' };
  } else if (type === 'boss_participation' || type === 'boss_settle') {
    if (!isNonNegativeNumber(reward.gold) || !isNonNegativeNumber(reward.exp)) return { valid:false, message:'boss 需 gold/exp' };
    if ('titles' in reward) {
      if (!Array.isArray(reward.titles) || reward.titles.length===0) return { valid:false, message:'titles 非空' };
      for (const t of reward.titles) if (!isNonEmptyString(t)) return { valid:false, message:'titles 元素非法' };
    }
  } else if (type.startsWith('arena_')) {
    if (!isNonNegativeNumber(reward.coins)) return { valid:false, message:'coins 非法' };
  } else if (type === 'pvp_challenge') {
    if (!isNonNegativeNumber(reward.gold) || !isNonNegativeNumber(reward.exp) || !isNonNegativeNumber(reward.coins)) return { valid:false, message:'pvp_challenge 需 gold/exp/coins' };
  } else if (type === 'cock_round') {
    if (!isNonNegativeNumber(reward.pointsDelta) && reward.pointsDelta!==0) return { valid:false, message:'pointsDelta 非法' };
    if (!isNonNegativeNumber(reward.points)) return { valid:false, message:'points 非法' };
    if ('title' in reward && reward.title!==null && !isNonEmptyString(reward.title)) return { valid:false, message:'title 非法' };
  } else if (type === 'cock_exchange') {
    if (!isNonEmptyString(reward.title)) return { valid:false, message:'title 非法' };
    if (!isNonNegativeNumber(reward.cost) || reward.cost===0) return { valid:false, message:'cost 非法' };
    if (!isNonNegativeNumber(reward.points)) return { valid:false, message:'points 非法' };
  }
  return { valid:true };
}

function assertPvpChallengeResult(obj){
  const isPlainObject = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
  const isNumber = (n) => typeof n === 'number' && Number.isFinite(n);
  if (!isPlainObject(obj)) return { valid:false, message:'PvpChallengeResult 非对象' };
  const { battle, isWin, isDraw, rewards, ratingChange, newRating, arenaCoins, targetName, targetLevel, targetJob, player } = obj;
  if (!isPlainObject(battle) || !['win','lose','draw'].includes(battle.result)) return { valid:false, message:'battle.result 非法' };
  if (!Array.isArray(battle.rounds)) return { valid:false, message:'battle.rounds 非数组' };
  if (!isNumber(battle.myHp) || !isNumber(battle.myMaxHp) || !isNumber(battle.enemyHp) || !isNumber(battle.enemyMaxHp)) return { valid:false, message:'battle HP 非法' };
  for(const r of battle.rounds){
    if (!isPlainObject(r) || typeof r.round !== 'number') return { valid:false, message:'round 非法' };
    if (!isNumber(r.hpA) || !isNumber(r.hpB)) return { valid:false, message:'round hpA/hpB 非法' };
    if (!Array.isArray(r.actions)) return { valid:false, message:'actions 非数组' };
    for(const a of r.actions){
      if (!isPlainObject(a) || !['A','B'].includes(a.actor)) return { valid:false, message:'actor 非法' };
      if (typeof a.skill !== 'string') return { valid:false, message:'skill 非法' };
      if (!isNumber(a.hpA) || !isNumber(a.hpB)) return { valid:false, message:'action hpA/hpB 非法' };
    }
  }
  if (typeof isWin !== 'boolean' || typeof isDraw !== 'boolean') return { valid:false, message:'isWin/isDraw 非法' };
  if (!isPlainObject(rewards) || !isNumber(rewards.gold) || !isNumber(rewards.exp) || !isNumber(rewards.coins)) return { valid:false, message:'rewards 非法' };
  if (!isNumber(ratingChange) || !isNumber(newRating) || !isNumber(arenaCoins)) return { valid:false, message:'rating 非法' };
  if (typeof targetName !== 'string' || !isNumber(targetLevel) || typeof targetJob !== 'string') return { valid:false, message:'target 非法' };
  if (!isPlainObject(player) || typeof player.username !== 'string' || typeof player.name !== 'string' || !isNumber(player.level) || !isNumber(player.rating) || !isPlainObject(player.pvpStats)) return { valid:false, message:'player 必填字段缺失' };
  if (!isNumber(player.pvpStats.wins) || !isNumber(player.pvpStats.losses) || !isNumber(player.pvpStats.streak) || !isNumber(player.pvpStats.bestStreak)) return { valid:false, message:'player.pvpStats 非法' };
  return { valid:true };
}
function assertCockResolveResult(obj){
  const isPlainObject = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
  if (!isPlainObject(obj)) return { valid:false, message:'CockResolveResult 非对象' };
  const { win, champion, championId, report, pointsDelta, points, streak, played, todayLeft, interventionApplied, interventionDiscovered, luckMessage, newTitle, createdAt } = obj;
  if (typeof win !== 'boolean' || typeof champion !== 'string' || typeof championId !== 'string') return { valid:false, message:'win/champion 非法' };
  if (!Array.isArray(report)) return { valid:false, message:'report 非数组' };
  if (typeof pointsDelta !== 'number' || typeof points !== 'number' || typeof streak !== 'number' || typeof played !== 'number' || typeof todayLeft !== 'number') return { valid:false, message:'points 非法' };
  if (!Array.isArray(interventionApplied)) return { valid:false, message:'interventionApplied 非法' };
  if (typeof interventionDiscovered !== 'boolean') return { valid:false, message:'interventionDiscovered 非法' };
  if (luckMessage !== null && typeof luckMessage !== 'string') return { valid:false, message:'luckMessage 非法' };
  if (newTitle !== null && typeof newTitle !== 'string') return { valid:false, message:'newTitle 非法' };
  if (typeof createdAt !== 'number') return { valid:false, message:'createdAt 非法' };
  return { valid:true };
}
function assertBossSettlementResult(obj){
  const isPlainObject = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
  if (!isPlainObject(obj)) return { valid:false, message:'BossSettlementResult 非对象' };
  if (typeof obj.gold !== 'number' || typeof obj.exp !== 'number' || typeof obj.rank !== 'number' || typeof obj.tier !== 'string') return { valid:false, message:'BossSettlementResult 字段非法' };
  if (obj.titles && (!Array.isArray(obj.titles) || obj.titles.some(t=>typeof t!=='string'))) return { valid:false, message:'titles 非法' };
  return { valid:true };
}

module.exports = { assertSettlementReward, assertPvpChallengeResult, assertCockResolveResult, assertBossSettlementResult };
