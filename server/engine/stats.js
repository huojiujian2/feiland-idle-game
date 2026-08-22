// ====== 属性加成系统：种族/法则/登神/装备/词条/职业/总属性/战斗属性 ======
const {
  RACE_EVOLUTION, LAWS, ASCENSION, ENCHANT_RECIPES, JOB_TREE, STRATEGIES, MONSTER_SKILLS,
} = require('../data');
const { findAffix, getJobStage } = require('./daily');
const { getRand } = require('./state');

// 力量等阶（保留旧版：返回对象；新版重命名 getStageLevel 在 view 模块使用）
function getStageFull(level, godhood) {
  if (godhood === 'god') return { name: '神灵', color: '#ffd700' };
  if (godhood === 'demigod') return { name: '半神', color: '#ff9d5e' };
  if (level <= 10) return { name: '凡人', color: '#9d9bb8' };
  if (level <= 30) return { name: '超凡·正式阶', color: '#9d8cf0' };
  if (level <= 60) return { name: '超凡·大师阶', color: '#7c6ef0' };
  if (level <= 100) return { name: '超凡·英雄阶', color: '#6c5ef0' };
  return { name: '传奇', color: '#d4af5e' };
}

// 文字版（用于 getPlayerView 字段）
function getStageLevel(level, godhood) {
  if (godhood === 'god') return '神';
  if (godhood === 'demigod') return '半神';
  if (level >= 200) return '传说';
  if (level >= 150) return '史诗';
  if (level >= 100) return '稀有';
  if (level >= 60) return '精英';
  if (level >= 30) return '普通+';
  return '普通';
}

function getRaceBonus(player) {
  const raceData = RACE_EVOLUTION[player.race];
  if (!raceData || !raceData.bonus) return {};
  return raceData.bonus;
}

function getReincarnationBonus(player) {
  const b = player.permanentBuffs || {};
  return {
    baseAtk: b.baseAtkBonus || 0,
    baseDef: b.baseDefBonus || 0,
    baseHp: b.baseHpBonus || 0,
    baseAgi: b.baseAgiBonus || 0,
    expBonus: b.expBonus || 0,
    goldBonus: b.goldBonus || 0,
  };
}

function getLawBonus(player) {
  const bonus = { damage: 0, defense: 0, exp: 0, gold: 0, heal: 0, allAttr: 0 };
  for (const lawId of player.laws) {
    const law = LAWS.find(l => l.id === lawId);
    if (!law) continue;
    const b = law.bonus;
    if (b.damage) bonus.damage += b.damage;
    if (b.defense) bonus.defense += b.defense;
    if (b.exp) bonus.exp += b.exp;
    if (b.gold) bonus.gold += b.gold;
    if (b.heal) bonus.heal += b.heal;
    if (b.allAttr) bonus.allAttr += b.allAttr;
  }
  return bonus;
}

function getGodhoodBonus(player) {
  if (!player.godhood) return {};
  const asc = ASCENSION[player.godhood];
  return asc ? asc.bonus : {};
}

function getEquipBonus(player) {
  const bonus = { atk: 0, def: 0, hp: 0, mp: 0, agi: 0, exp: 0, gold: 0 };
  for (const slot of ['weapon', 'armor', 'accessory']) {
    const item = player.equipped[slot];
    if (!item || !item.stats) continue;
    const s = item.stats;
    if (s.atk) bonus.atk += s.atk;
    if (s.def) bonus.def += s.def;
    if (s.hp) bonus.hp += s.hp;
    if (s.mp) bonus.mp += s.mp;
    if (s.agi) bonus.agi += s.agi;
    if (s.exp) bonus.exp += s.exp;
    if (s.gold) bonus.gold += s.gold;
    if (s.str) bonus.atk += s.str * 2;
    if (s.con) { bonus.def += s.con * 1.5; bonus.hp += s.con * 5; }
    if (s.spi) bonus.mp += s.spi * 3;
    if (item.enchants) {
      for (const ench of item.enchants) {
        const recipe = ENCHANT_RECIPES.find(r => r.id === ench);
        if (recipe && recipe.bonus) {
          const b = recipe.bonus;
          if (b.atk) bonus.atk += b.atk;
          if (b.def) bonus.def += b.def;
          if (b.hp) bonus.hp += b.hp;
          if (b.agi) bonus.agi += b.agi;
          if (b.exp) bonus.exp += b.exp;
          if (b.gold) bonus.gold += b.gold;
          if (b.str) bonus.atk += b.str * 2;
          if (b.con) { bonus.def += b.con * 1.5; bonus.hp += b.con * 5; }
          if (b.spi) bonus.mp += b.spi * 3;
        }
      }
    }
  }
  return bonus;
}

function getJobGrowth(player) {
  if (!player.jobPath) return { atk: 1, def: 1, hp: 1, agi: 1, exp: 0, gold: 0 };
  return JOB_TREE[player.jobPath].growth;
}

function getJobTalents(player) {
  if (!player.jobPath) return {};
  const talents = JOB_TREE[player.jobPath].talents;
  const bonus = {};
  for (const t of talents) Object.assign(bonus, t.effect);
  return bonus;
}

function getJobMechanics(player) {
  if (!player.jobPath) return {};
  const stage = getJobStage(player);
  const mechanics = JOB_TREE[player.jobPath].mechanics;
  const bonus = {};
  for (let i = 0; i < stage && i < mechanics.length; i++) {
    if (mechanics[i] && mechanics[i].effect) Object.assign(bonus, mechanics[i].effect);
  }
  return bonus;
}

function getAffixBonus(player) {
  const bonus = {
    atk: 0, def: 0, hp: 0, agi: 0, exp: 0, gold: 0,
    crit: 0, critDmg: 0, dodge: 0, regen: 0,
    lifesteal: 0, thorns: 0, dmgTaken: 0, ignoreDef: 0,
    shieldRegen: 0, lowHpAtk: 0, lowHpDef: 0,
    dodgeAtk: 0, killExp: 0, killGold: 0,
    firstTurnAgi: 0, flatExp: 0
  };
  const growth = getJobGrowth(player);
  const talents = getJobTalents(player);
  const potionBoost = talents.potionBoost || 0;

  for (const affixId of (player.affixes?.passive || [])) {
    const affix = findAffix(affixId);
    if (!affix) continue;
    const e = affix.effect;
    if (e.atk) bonus.atk += e.atk * (growth.atk || 1);
    if (e.def) bonus.def += e.def * (growth.def || 1);
    if (e.hp) bonus.hp += e.hp * (growth.hp || 1) * (1 + potionBoost);
    if (e.agi) bonus.agi += e.agi * (growth.agi || 1);
    if (e.exp) bonus.exp += e.exp * (1 + potionBoost);
    if (e.gold) bonus.gold += e.gold * (1 + potionBoost);
    if (e.crit) bonus.crit += e.crit;
    if (e.critDmg) bonus.critDmg += e.critDmg;
    if (e.dodge) bonus.dodge += e.dodge;
    if (e.regen) bonus.regen += e.regen;
    if (e.lifesteal) bonus.lifesteal += e.lifesteal;
    if (e.thorns) bonus.thorns += e.thorns;
    if (e.dmgTaken) bonus.dmgTaken += e.dmgTaken;
    if (e.ignoreDef) bonus.ignoreDef += e.ignoreDef;
    if (e.shieldRegen) bonus.shieldRegen += e.shieldRegen;
    if (e.lowHpAtk) bonus.lowHpAtk += e.lowHpAtk;
    if (e.lowHpDef) bonus.lowHpDef += e.lowHpDef;
    if (e.dodgeAtk) bonus.dodgeAtk += e.dodgeAtk;
    if (e.killExp) bonus.killExp += e.killExp;
    if (e.killGold) bonus.killGold += e.killGold;
    if (e.firstTurnAgi) bonus.firstTurnAgi += e.firstTurnAgi;
    if (e.flatExp) bonus.flatExp += e.flatExp;
  }
  return bonus;
}

function getTotalStats(player) {
  const eq = getEquipBonus(player);
  const affix = getAffixBonus(player);
  const raceBonus = getRaceBonus(player);
  const lawBonus = getLawBonus(player);
  const godBonus = getGodhoodBonus(player);
  const reincBonus = getReincarnationBonus(player);
  const talents = getJobTalents(player);
  const mechanics = getJobMechanics(player);
  const base = player.attributes;
  const allAttrMult = 1 + (lawBonus.allAttr || 0);

  const baseAtk = (10 + (player.level - 1) * 3 + base.atk * 2 + eq.atk + (raceBonus.str || 0) * 2 + (godBonus.atk || 0) * 2 + reincBonus.baseAtk);
  const baseDef = (5 + (player.level - 1) * 2 + base.def * 1.5 + eq.def + (raceBonus.con || 0) * 1.5 + (godBonus.def || 0) * 1.5 + reincBonus.baseDef);
  const baseHp = (100 + (player.level - 1) * 20 + base.hp * 10 + eq.hp + (raceBonus.con || 0) * 5 + (godBonus.hp || 0) * 5 + reincBonus.baseHp);
  const baseAgi = (10 + (player.level - 1) * 2 + base.agi * 1 + eq.agi + (raceBonus.agi || 0) + (godBonus.agi || 0) + reincBonus.baseAgi);

  const strat = STRATEGIES[player.strategy] || STRATEGIES.balanced;
  const sAtk = strat.effects.atk || 0;
  const sDef = strat.effects.def || 0;
  const sRegen = strat.effects.regen || 0;

  const atkTotal = Math.floor(baseAtk * (1 + affix.atk) * (1 + sAtk) * allAttrMult);
  const defTotal = Math.floor(baseDef * (1 + affix.def) * (1 + sDef) * allAttrMult);
  const hpTotal = Math.floor(baseHp * (1 + affix.hp) * allAttrMult);
  const agiTotal = Math.floor(baseAgi * (1 + affix.agi) * allAttrMult);

  const crit = affix.crit + (talents.crit || 0) + (mechanics.crit || 0);
  const critDmg = affix.critDmg + (talents.critDmg || 0) + (mechanics.critDmg || 0) + 0.5;
  const dodge = affix.dodge + (talents.dodge || 0) + (mechanics.dodge || 0);
  const regen = (affix.regen + (mechanics.regen || 0)) * (1 + sRegen);
  const dmgTaken = affix.dmgTaken + (talents.dmgTaken || 0);
  const expBonus = eq.exp + affix.exp + (getJobGrowth(player).exp || 0);
  const goldBonus = eq.gold + affix.gold + (getJobGrowth(player).gold || 0) + (talents.goldGain || 0) + (mechanics.goldGain || 0);

  return {
    atk: atkTotal, def: defTotal, hp: hpTotal, agi: agiTotal,
    equipHP: eq.hp, equipMP: eq.mp,
    expBonus, goldBonus,
    crit, critDmg, dodge, regen,
    lifesteal: affix.lifesteal,
    thorns: affix.thorns,
    dmgTaken, ignoreDef: affix.ignoreDef,
    shieldRegen: affix.shieldRegen,
    lowHpAtk: affix.lowHpAtk,
    lowHpDef: affix.lowHpDef + (talents.lowHpDef || 0),
    dodgeAtk: affix.dodgeAtk,
    killExp: affix.killExp,
    killGold: affix.killGold,
    firstTurnAgi: affix.firstTurnAgi + (talents.firstTurnAgi || 0),
    flatExp: affix.flatExp,
    stackAgi: mechanics.stackAgi || 0,
    deathShield: mechanics.deathShield || 0,
    revive: mechanics.revive || 0,
    doubleKill: mechanics.doubleKill || false
  };
}

function getCombatStats(player) {
  const total = getTotalStats(player);
  const lawBonus = getLawBonus(player);
  const activeAffix = player.affixes?.active ? findAffix(player.affixes.active) : null;
  const hpRatio = player.hp / player.maxHp;
  let bonusAtk = 0, bonusDef = 0;
  if (total.lowHpAtk && hpRatio < 0.5) bonusAtk += total.lowHpAtk;
  if (total.lowHpDef && hpRatio < 0.5) bonusDef += total.lowHpDef;
  const desEff = STRATEGIES.desperate.effects;
  if (player.strategy === 'desperate' && hpRatio < desEff.hpThreshold) bonusAtk += desEff.desperateAtk;

  return {
    atk: Math.floor(total.atk * (1 + bonusAtk)),
    def: Math.floor(total.def * (1 + bonusDef)),
    agi: total.agi,
    hp: player.hp,
    maxHp: player.maxHp,
    mp: player.mp,
    maxMp: player.maxMp,
    crit: total.crit,
    critDmg: total.critDmg,
    dodge: total.dodge,
    regen: total.regen,
    lifesteal: total.lifesteal,
    thorns: total.thorns,
    dmgTaken: total.dmgTaken,
    ignoreDef: total.ignoreDef,
    dmgBonus: lawBonus.damage || 0,
    defBonus: lawBonus.defense || 0,
    healBonus: lawBonus.heal || 0,
    expBonus: total.expBonus,
    goldBonus: total.goldBonus,
    firstTurnAgi: total.firstTurnAgi,
    stackAgi: total.stackAgi,
    dodgeAtk: total.dodgeAtk,
    deathShield: total.deathShield,
    revive: total.revive,
    doubleKill: total.doubleKill,
    activeSkill: activeAffix ? {
      id: activeAffix.id, name: activeAffix.name,
      effect: activeAffix.effect, desc: activeAffix.desc
    } : null
  };
}

// 怪物技能选择（战斗模块用）
function pickMonsterSkill(monster) {
  if (!monster.skills || monster.skills.length === 0) return null;
  for (const skillId of monster.skills) {
    const sk = MONSTER_SKILLS[skillId];
    if (!sk) continue;
    if (getRand()() < sk.chance) return sk;
  }
  return null;
}

module.exports = {
  getStageFull, getStageLevel,
  getRaceBonus, getReincarnationBonus, getLawBonus, getGodhoodBonus, getEquipBonus,
  getJobGrowth, getJobTalents, getJobMechanics, getAffixBonus,
  getTotalStats, getCombatStats,
  pickMonsterSkill,
};
