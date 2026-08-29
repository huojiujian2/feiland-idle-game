// ====== 结算校验：强类型 SettlementReward 白名单 ======
// 用于所有奖励域的 reward 校验，替代弱类型 any
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
  // 逐 type 必含校验
  if (type === 'daily') {
    const has = ['gold','exp','materials'].some(k => k in reward);
    if (!has) return { valid:false, message:'daily 必须含 gold/exp/materials 之一' };
    if ('gold' in reward && !isNonNegativeNumber(reward.gold)) return { valid:false, message:'gold 非法' };
    if ('exp' in reward && !isNonNegativeNumber(reward.exp)) return { valid:false, message:'exp 非法' };
    if ('materials' in reward) {
      if (!Array.isArray(reward.materials) || reward.materials.length===0) return { valid:false, message:'materials 非空数组' };
      for (const m of reward.materials) {
        if (!isPlainObject(m) || !isNonEmptyString(m.name) || !isNonNegativeNumber(m.count) || m.count===0) return { valid:false, message:'materials 元素非法' };
      }
    }
  } else if (type === 'achievement') {
    const has = ['gold','equips','affixId','reincPoints','title'].some(k => k in reward);
    if (!has) return { valid:false, message:'achievement 必须含 gold/equips/affixId/reincPoints/title 之一' };
    if ('gold' in reward && !isNonNegativeNumber(reward.gold)) return { valid:false, message:'gold 非法' };
    if ('equips' in reward) {
      if (!Array.isArray(reward.equips) || reward.equips.length===0) return { valid:false, message:'equips 非空' };
      for (const e of reward.equips) if (!isPlainObject(e) || !isNonEmptyString(e.templateId)) return { valid:false, message:'equips 元素非法' };
    }
    if ('affixId' in reward && !isNonEmptyString(reward.affixId)) return { valid:false, message:'affixId 非法' };
    if ('reincPoints' in reward && (!Number.isInteger(reward.reincPoints) || reward.reincPoints<=0)) return { valid:false, message:'reincPoints 非法' };
    if ('title' in reward && !isNonEmptyString(reward.title)) return { valid:false, message:'title 非法' };
    // 实际成就组合白名单：至少符合其一组合，但已在 has 校验，额外允许 affixId+title 等组合
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

module.exports = { assertSettlementReward };
