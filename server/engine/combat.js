// ====== 回合制战斗模拟：伤害计算、行动次数、战斗循环 ======
const { findAffix } = require('./daily');
const { getRand } = require('./state');
const { getCombatStats, pickMonsterSkill } = require('./stats');
const { getActiveSkillCd, shouldTriggerActiveSkill } = require('./utils');

// 伤害计算
function calcDamage(atk, def, mult, dmgBonus, defBonus, ignoreDef, crit, critDmg) {
  const effDef = def * (1 - (ignoreDef || 0));
  let base = atk * (mult || 1);
  let reduction = effDef * 0.5;
  if (defBonus) reduction *= (1 + defBonus);
  let dmg = base - reduction;
  if (dmgBonus) dmg *= (1 + dmgBonus);
  let isCrit = false;
  if (crit && getRand()() < crit) {
    dmg *= (1 + (critDmg || 0.5));
    isCrit = true;
  }
  dmg *= (0.85 + getRand()() * 0.3);
  return { value: Math.max(1, Math.floor(dmg)), isCrit };
}

// 动态行动次数（AGI 比）
function getActionCount(attackerAgi, defenderAgi) {
  const ratio = attackerAgi / Math.max(1, defenderAgi);
  let actions = 1;
  let remaining = ratio - 1;
  while (remaining > 0 && actions < 5) {
    if (getRand()() < Math.min(1, remaining)) {
      actions++;
      remaining -= 1;
    } else {
      break;
    }
  }
  return actions;
}

// 模拟 PVE 战斗
function simulateBattle(player, monster) {
  const combat = getCombatStats(player);
  const mHp = monster.hp;
  const mAtk = monster.atk;
  const mDef = monster.def;
  const mAgi = monster.agi;

  let pHp = combat.hp;
  let mCurHp = mHp;
  let pMp = combat.mp;

  let agiBonus = 0;
  if (combat.firstTurnAgi) agiBonus = combat.firstTurnAgi;
  const effAgi = Math.floor(combat.agi * (1 + agiBonus));
  const agiRatio = effAgi / Math.max(1, mAgi);
  const playerFirst = effAgi >= mAgi;

  let stackAgiBonus = 0;
  let deathShield = combat.deathShield;
  let revived = false;
  let skillGoldBonus = 0;
  let buffs = [];

  function applyBuff(key, value, turns, round) {
    const expireRound = round + turns;
    const idx = buffs.findIndex(b => b.key === key);
    if (idx !== -1) {
      const old = buffs[idx];
      combat[old.key] = old.before;
      buffs.splice(idx, 1);
    }
    const before = combat[key];
    combat[key] = Math.floor(combat[key] * (1 + value));
    buffs.push({ key, value, before, expireRound });
  }
  function expireBuffs(round) {
    const remain = [];
    for (const b of buffs) {
      if (round >= b.expireRound) combat[b.key] = b.before;
      else remain.push(b);
    }
    buffs = remain;
  }
  function doPlayerNormalAction(actions) {
    const damageResult = calcDamage(combat.atk, mDef, 1, combat.dmgBonus, 0, combat.ignoreDef, combat.crit, combat.critDmg);
    mCurHp -= damageResult.value;
    if (combat.lifesteal > 0) pHp = Math.min(combat.maxHp, pHp + Math.floor(damageResult.value * combat.lifesteal));
    actions.push({ actor: 'player', skill: '普通攻击', damage: damageResult.value, crit: damageResult.isCrit, targetHp: Math.max(0, mCurHp), targetMaxHp: mHp });
    return damageResult;
  }
  function doMonsterNormalAction(actions) {
    if (getRand()() < (combat.dodge || 0)) {
      actions.push({ actor: 'player', skill: '闪避!', dodge: true, targetHp: pHp, targetMaxHp: combat.maxHp });
      if (combat.dodgeAtk) {
        const counterResult = calcDamage(combat.atk, mDef, 1, combat.dmgBonus, 0, combat.ignoreDef, 1, combat.critDmg);
        mCurHp -= counterResult.value;
        actions.push({ actor: 'player', skill: '闪避反击', damage: counterResult.value, type: 'passive', source: 'dodgeAtk', targetHp: Math.max(0, mCurHp), targetMaxHp: mHp });
      }
      return;
    }
    const monsterSkill = pickMonsterSkill(monster);
    let skillMult = 1, skillName = '普通攻击';
    if (monsterSkill) { skillMult = monsterSkill.mult; skillName = monsterSkill.name; }
    const monsterDamage = calcDamage(mAtk, combat.def, skillMult, 0, combat.defBonus, 0, 0, 0);
    let dmg = monsterDamage.value;
    if (combat.dmgTaken) dmg = Math.floor(dmg * (1 + combat.dmgTaken));
    pHp -= dmg;
    if (combat.thorns > 0) mCurHp -= Math.floor(dmg * combat.thorns);
    if (combat.regen > 0 && pHp > 0) pHp = Math.min(combat.maxHp, pHp + Math.floor(combat.maxHp * combat.regen));
    if (combat.healBonus > 0 && pHp > 0) pHp = Math.min(combat.maxHp, pHp + Math.floor(combat.maxHp * combat.healBonus * 0.1));
    if (pHp <= 0 && deathShield > 0) {
      pHp = Math.floor(combat.maxHp * deathShield);
      actions.push({ actor: 'player', skill: '免死护盾!', shield: true, type: 'passive', source: 'deathShield', targetHp: pHp, targetMaxHp: combat.maxHp });
      deathShield = 0;
    }
    actions.push({ actor: 'monster', skill: skillName, damage: dmg, targetHp: Math.max(0, pHp), targetMaxHp: combat.maxHp });
  }

  const activeAffix = player.affixes?.active ? findAffix(player.affixes.active) : null;
  const cd = activeAffix ? getActiveSkillCd(activeAffix.level) : null;
  const rounds = [];
  // 挂机战斗无回合限制：打到一方死为止
  // maxRounds 仅作死循环兜底（500 回合 ≈ 几千次攻击，比任何实际战斗都宽裕）
  // 触达上限后记 result = 'draw'，前端展示为「平局」
  const maxRounds = 500;
  let result = null;

  for (let round = 1; round <= maxRounds; round++) {
    const actions = [];
    expireBuffs(round);
    const roundShouldTrigger = activeAffix && shouldTriggerActiveSkill(round, cd);

    if (combat.stackAgi && round > 1) {
      stackAgiBonus += combat.stackAgi;
    }
    const curAgi = Math.floor(effAgi * (1 + stackAgiBonus));
    const curMActions = getActionCount(mAgi, curAgi);
    const curPActions = getActionCount(curAgi, mAgi);

    const queue = [];
    const maxLen = Math.max(curPActions, curMActions);
    const first = (round === 1) ? playerFirst : (curAgi >= mAgi);
    for (let i = 0; i < maxLen; i++) {
      if (first) {
        if (i < curPActions) queue.push('player');
        if (i < curMActions) queue.push('monster');
      } else {
        if (i < curMActions) queue.push('monster');
        if (i < curPActions) queue.push('player');
      }
    }
    let hasDoneFirstPlayerNormal = false;
    for (const actor of queue) {
      if (pHp <= 0 || mCurHp <= 0) break;
      if (actor === 'player' && !hasDoneFirstPlayerNormal) {
        doPlayerNormalAction(actions);
        hasDoneFirstPlayerNormal = true;
        if (roundShouldTrigger && mCurHp > 0 && pHp > 0) {
          const skillEffect = activeAffix.effect;
          let skillPushed = false;
          if (skillEffect.type === 'damage') {
            const skillDamage = calcDamage(combat.atk, mDef, skillEffect.mult, combat.dmgBonus, 0, combat.ignoreDef, combat.crit, combat.critDmg);
            mCurHp -= skillDamage.value;
            if (combat.lifesteal > 0) pHp = Math.min(combat.maxHp, pHp + Math.floor(skillDamage.value * combat.lifesteal));
            actions.push({ actor: 'player', skill: activeAffix.name, damage: skillDamage.value, crit: skillDamage.isCrit, type: 'skill', targetHp: Math.max(0, mCurHp), targetMaxHp: mHp });
            skillPushed = true;
          } else if (skillEffect.type === 'heal') {
            const healAmount = Math.floor(combat.maxHp * skillEffect.value);
            pHp = Math.min(combat.maxHp, pHp + healAmount);
            actions.push({ actor: 'player', skill: activeAffix.name, heal: healAmount, type: 'skill', targetHp: pHp, targetMaxHp: combat.maxHp, healTargetHp: pHp });
            skillPushed = true;
          } else if (['atk_buff', 'def_buff', 'agi_buff'].includes(skillEffect.type)) {
            const buffKey = skillEffect.type.split('_')[0];
            applyBuff(buffKey, skillEffect.value, skillEffect.turns, round);
            actions.push({ actor: 'player', skill: activeAffix.name, buff: skillEffect.value, type: 'skill', targetHp: pHp, targetMaxHp: combat.maxHp });
            skillPushed = true;
          } else if (skillEffect.type === 'gold_buff') {
            skillGoldBonus += skillEffect.value;
            actions.push({ actor: 'player', skill: activeAffix.name, buff: skillEffect.value, type: 'skill', targetHp: pHp, targetMaxHp: combat.maxHp });
            skillPushed = true;
          } else {
            actions.push({ actor: 'player', skill: activeAffix.name, type: 'skill', note: skillEffect.type, targetHp: pHp, targetMaxHp: combat.maxHp });
            skillPushed = true;
          }
          if (skillPushed && skillEffect.heal) {
            const healAmount = Math.floor(combat.maxHp * skillEffect.heal);
            pHp = Math.min(combat.maxHp, pHp + healAmount);
            const lastAction = actions[actions.length - 1];
            if (lastAction.heal) lastAction.heal += healAmount; else lastAction.heal = healAmount;
            lastAction.selfHeal = healAmount; lastAction.selfHp = pHp; lastAction.healTargetHp = pHp;
          }
        }
      } else if (actor === 'monster') {
        doMonsterNormalAction(actions);
      } else {
        doPlayerNormalAction(actions);
      }
    }

    rounds.push({ round, actions, pHp: Math.max(0, pHp), mHp: Math.max(0, mCurHp), pActions: curPActions, mActions: curMActions });

    if (mCurHp <= 0) { result = 'win'; break; }
    if (pHp <= 0) {
      if (combat.revive > 0 && !revived) {
        pHp = Math.floor(combat.maxHp * combat.revive);
        revived = true;
        rounds.push({ round, actions: [{ actor: 'player', skill: '圣光复生!', revive: true, type: 'passive', source: 'revive', targetHp: pHp, targetMaxHp: combat.maxHp }], pHp, mHp: Math.max(0, mCurHp), pActions: 0, mActions: 0 });
      } else {
        result = 'lose';
        break;
      }
    }
  }

  // 兜底：超过 500 回合仍未分胜负，记为平局（前端展示「平局」）
  // 触发场景：极端高反击/闪避/治疗配置让双方都死不了 —— 给玩家 30% 经验补偿
  if (!result) result = 'draw';

  pMp = Math.min(combat.maxMp, pMp + Math.floor(combat.maxMp * 0.1));

  return {
    result, rounds,
    playerHp: Math.max(0, pHp),
    playerMaxHp: combat.maxHp,
    playerMp: pMp,
    playerMaxMp: combat.maxMp,
    monsterHp: Math.max(0, mCurHp),
    monsterMaxHp: mHp,
    monsterName: monster.name,
    agiRatio: agiRatio.toFixed(2),
    combatStats: { atk: combat.atk, def: combat.def, agi: combat.agi, crit: combat.crit, dodge: combat.dodge },
    skillGoldBonus
  };
}

// 模拟世界 BOSS 战斗（精简版，固定回合数，到回合上限或 Boss 死为止）
//   player：玩家对象
//   boss：BOSS 对象（含 hp/maxHp/atk/def/agi/skillChance）
//   maxRounds：最大回合数（默认 5）
// 返回：{ rounds, totalDamage, result: 'win' | 'timeout' }
function simulateBossBattle(player, boss, maxRounds = 5) {
  const combat = getCombatStats(player);
  const mHp = boss.maxHp || boss.hp;
  const mAtk = boss.atk;
  const mDef = boss.def;
  const mAgi = boss.agi;

  let pHp = combat.hp;
  let mCurHp = mHp;
  const effAgi = combat.agi;
  const playerFirst = effAgi >= mAgi;

  const rounds = [];
  let totalDamage = 0;
  let result = 'timeout';

  for (let round = 1; round <= maxRounds; round++) {
    if (mCurHp <= 0 || pHp <= 0) break;
    const actions = [];
    const curMActions = getActionCount(mAgi, effAgi);
    const curPActions = getActionCount(effAgi, mAgi);

    const queue = [];
    const maxLen = Math.max(curPActions, curMActions);
    for (let i = 0; i < maxLen; i++) {
      if (playerFirst) {
        if (i < curPActions) queue.push('player');
        if (i < curMActions) queue.push('monster');
      } else {
        if (i < curMActions) queue.push('monster');
        if (i < curPActions) queue.push('player');
      }
    }
    for (const actor of queue) {
      if (pHp <= 0 || mCurHp <= 0) break;
      if (actor === 'player') {
        // 玩家攻击 BOSS
        const r = calcDamage(combat.atk, mDef, 1, combat.dmgBonus, 0, combat.ignoreDef, combat.crit, combat.critDmg);
        mCurHp = Math.max(0, mCurHp - r.value);
        totalDamage += r.value;
        if (combat.lifesteal > 0) pHp = Math.min(combat.maxHp, pHp + Math.floor(r.value * combat.lifesteal));
        actions.push({ actor: 'player', skill: '普通攻击', damage: r.value, crit: r.isCrit, targetHp: mCurHp, targetMaxHp: mHp });
      } else {
        // BOSS 攻击玩家
        if (getRand()() < (combat.dodge || 0)) {
          actions.push({ actor: 'player', skill: '闪避!', dodge: true, targetHp: pHp, targetMaxHp: combat.maxHp });
        } else {
          // BOSS 技能触发（按 boss.skillChance 概率放大）
          let mult = 1, name = '普通攻击';
          if (boss.skillChance && getRand()() < boss.skillChance) {
            mult = 1.5;
            name = 'BOSS 怒击';
          }
          const r = calcDamage(mAtk, combat.def, mult, 0, combat.defBonus, 0, 0, 0);
          pHp = Math.max(0, pHp - r.value);
          actions.push({ actor: 'monster', skill: name, damage: r.value, targetHp: pHp, targetMaxHp: combat.maxHp });
        }
      }
    }
    rounds.push({
      round,
      actions,
      pHp: Math.max(0, pHp),
      mHp: Math.max(0, mCurHp),
      pActions: curPActions,
      mActions: curMActions,
    });
    if (mCurHp <= 0) { result = 'win'; break; }
    if (pHp <= 0) { result = 'lose'; break; }
  }
  return { rounds, totalDamage, result };
}

module.exports = {
  calcDamage,
  getActionCount,
  simulateBattle,
  simulateBossBattle,
};