// ====== PVP 战斗模拟 / ELO 积分 / 赛季 / 机器人 / 竞技商店 ======
const { getNow, getRand } = require('./state');
const { genUid } = require('./utils');
const { getCombatStats } = require('./stats');
const { calcDamage, getActionCount } = require('./combat');
const { findAffix } = require('./daily');
const { getActiveSkillCd } = require('./utils');
const {
  EQUIP_TEMPLATES, ENCHANT_RECIPES, AFFIX_TREE, JOB_TREE, LAWS,
  ARENA_RANK_REWARDS, ARENA_EQUIPMENT, ARENA_TITLES, BOT_NAMES, BOT_JOB_PREF,
  PVP_CURRENCY_KEY, SEASON_MONTHS,
} = require('../data');
const { getDailyKey, getWeeklyKey, getMonthlyKey } = require('./daily');

// ELO
function calcPvpRating(myRating, enemyRating, isWin) {
  const expected = 1 / (1 + Math.pow(10, (enemyRating - myRating) / 400));
  const score = isWin ? 1 : 0;
  const K = 32;
  const change = Math.round(K * (score - expected));
  return { newRating: myRating + change, change };
}
function calcPvpRewards(playerLevel, isWin, streak) {
  if (isWin) {
    const streakBonus = Math.min(0.5, streak * 0.1);
    const gold = Math.floor((50 + playerLevel * 5) * (1 + streakBonus));
    const exp = Math.floor((30 + playerLevel * 3) * (1 + streakBonus));
    return { gold, exp };
  }
  return { gold: 10, exp: 5 + playerLevel };
}

// PvP 技能
function pickPvPSkill(combat, round, cd) {
  if (!combat.activeSkill || !cd || round < 1) return null;
  if (round % cd !== 0) return null;
  return combat.activeSkill;
}

// 模拟 PvP
function simulatePvP(playerA, playerB) {
  const combatA = getCombatStats(playerA);
  const combatB = getCombatStats(playerB);
  let hpA = combatA.maxHp;
  let hpB = combatB.maxHp;
  const agiA = Math.floor(combatA.agi * (1 + (combatA.firstTurnAgi || 0)));
  const agiB = Math.floor(combatB.agi * (1 + (combatB.firstTurnAgi || 0)));
  const aFirst = agiA >= agiB;
  let stackAgiA = 0, stackAgiB = 0;
  let deathShieldA = combatA.deathShield, deathShieldB = combatB.deathShield;
  let revivedA = false, revivedB = false;

  const activeAffixA = playerA.affixes?.active ? findAffix(playerA.affixes.active) : null;
  const cdA = activeAffixA ? getActiveSkillCd(activeAffixA.level) : null;
  const activeAffixB = playerB.affixes?.active ? findAffix(playerB.affixes.active) : null;
  const cdB = activeAffixB ? getActiveSkillCd(activeAffixB.level) : null;

  const rounds = [];
  // PVP 同样无回合上限，超出记为 draw（平局）
  const maxRounds = 500;
  let result = null;

  const doPvPAction = (atkCombat, defCombat, attacker) => {
    if (hpA <= 0 || hpB <= 0) return;
    const isA = attacker === 'A';
    if (getRand()() < (defCombat.dodge || 0)) {
      const r = rounds[rounds.length - 1];
      r.actions.push({ actor: attacker, skill: '闪避!', dodge: true, hpA: Math.max(0, hpA), hpB: Math.max(0, hpB) });
      return;
    }
    const skill = pickPvPSkill(atkCombat, rounds.length, atkCombat === combatA ? cdA : cdB);
    let mult = 1;
    let skillName = '普通攻击';
    if (skill) {
      const eff = skill.effect;
      skillName = skill.name;
      if (eff.type === 'damage') {
        mult = eff.mult || 1;
        if (eff.atk_buff) atkCombat.atk = Math.floor(atkCombat.atk * (1 + eff.atk_buff));
        if (eff.agi_buff) atkCombat.agi = Math.floor(atkCombat.agi * (1 + eff.agi_buff));
        if (eff.crit_buff) atkCombat.crit += eff.crit_buff;
      } else if (eff.type === 'heal') {
        const heal = Math.floor(atkCombat.maxHp * eff.value);
        if (isA) hpA = Math.min(combatA.maxHp, hpA + heal);
        else hpB = Math.min(combatB.maxHp, hpB + heal);
        const r = rounds[rounds.length - 1];
        r.actions.push({ actor: attacker, skill: skillName, heal, hpA: Math.max(0, hpA), hpB: Math.max(0, hpB) });
        return;
      } else if (eff.type === 'atk_buff') {
        atkCombat.atk = Math.floor(atkCombat.atk * (1 + eff.value));
        const r = rounds[rounds.length - 1];
        r.actions.push({ actor: attacker, skill: skillName + '(增益)', buff: true, hpA: Math.max(0, hpA), hpB: Math.max(0, hpB) });
        return;
      } else if (eff.type === 'def_buff') {
        atkCombat.def = Math.floor(atkCombat.def * (1 + eff.value));
        const r = rounds[rounds.length - 1];
        r.actions.push({ actor: attacker, skill: skillName + '(防御)', buff: true, hpA: Math.max(0, hpA), hpB: Math.max(0, hpB) });
        return;
      } else if (eff.type === 'agi_buff') {
        atkCombat.agi = Math.floor(atkCombat.agi * (1 + eff.value));
        const r = rounds[rounds.length - 1];
        r.actions.push({ actor: attacker, skill: skillName + '(加速)', buff: true, hpA: Math.max(0, hpA), hpB: Math.max(0, hpB) });
        return;
      } else if (eff.type === 'crit_buff') {
        atkCombat.crit += eff.value;
        const r = rounds[rounds.length - 1];
        r.actions.push({ actor: attacker, skill: skillName + '(暴击)', buff: true, hpA: Math.max(0, hpA), hpB: Math.max(0, hpB) });
        return;
      }
    }

    const dmgResult = calcDamage(atkCombat.atk, defCombat.def, mult, atkCombat.dmgBonus, 0, atkCombat.ignoreDef, atkCombat.crit, atkCombat.critDmg);
    if (isA) {
      hpB -= dmgResult.value;
      if (atkCombat.lifesteal > 0) hpA = Math.min(combatA.maxHp, hpA + Math.floor(dmgResult.value * atkCombat.lifesteal));
      if (defCombat.thorns > 0) hpA -= Math.floor(dmgResult.value * defCombat.thorns);
    } else {
      hpA -= dmgResult.value;
      if (atkCombat.lifesteal > 0) hpB = Math.min(combatB.maxHp, hpB + Math.floor(dmgResult.value * atkCombat.lifesteal));
      if (defCombat.thorns > 0) hpB -= Math.floor(dmgResult.value * defCombat.thorns);
    }
    const r = rounds[rounds.length - 1];
    r.actions.push({ actor: attacker, skill: skillName, damage: dmgResult.value, crit: dmgResult.isCrit, hpA: Math.max(0, hpA), hpB: Math.max(0, hpB) });
  };

  for (let round = 1; round <= maxRounds; round++) {
    const actions = [];
    rounds.push({ round, actions, hpA: Math.max(0, hpA), hpB: Math.max(0, hpB) });
    if (combatA.stackAgi && round > 1) stackAgiA += combatA.stackAgi;
    if (combatB.stackAgi && round > 1) stackAgiB += combatB.stackAgi;
    const curAgiA = Math.floor(agiA * (1 + stackAgiA));
    const curAgiB = Math.floor(agiB * (1 + stackAgiB));
    const aActions = getActionCount(curAgiA, curAgiB);
    const bActions = getActionCount(curAgiB, curAgiA);
    const queue = [];
    const maxLen = Math.max(aActions, bActions);
    const first = (round === 1) ? aFirst : (curAgiA >= curAgiB);
    for (let i = 0; i < maxLen; i++) {
      if (first) {
        if (i < aActions) queue.push('A');
        if (i < bActions) queue.push('B');
      } else {
        if (i < bActions) queue.push('B');
        if (i < aActions) queue.push('A');
      }
    }
    for (const actor of queue) {
      if (hpA <= 0 || hpB <= 0) break;
      if (actor === 'A') doPvPAction(combatA, combatB, 'A');
      else doPvPAction(combatB, combatA, 'B');
    }
    if (combatA.regen > 0 && hpA > 0) hpA = Math.min(combatA.maxHp, hpA + Math.floor(combatA.maxHp * combatA.regen));
    if (combatB.regen > 0 && hpB > 0) hpB = Math.min(combatB.maxHp, hpB + Math.floor(combatB.maxHp * combatB.regen));
    if (hpB <= 0 && deathShieldB > 0) { hpB = Math.floor(combatB.maxHp * deathShieldB); deathShieldB = 0; rounds[rounds.length - 1].actions.push({ actor: 'B', skill: '免死护盾!', shield: true, hpA: Math.max(0, hpA), hpB: Math.max(0, hpB) }); }
    if (hpA <= 0 && deathShieldA > 0) { hpA = Math.floor(combatA.maxHp * deathShieldA); deathShieldA = 0; rounds[rounds.length - 1].actions.push({ actor: 'A', skill: '免死护盾!', shield: true, hpA: Math.max(0, hpA), hpB: Math.max(0, hpB) }); }
    const cur = rounds[rounds.length - 1];
    cur.hpA = Math.max(0, hpA);
    cur.hpB = Math.max(0, hpB);
    if (hpB <= 0) { result = 'win'; break; }
    if (hpA <= 0) {
      if (combatA.revive > 0 && !revivedA) {
        hpA = Math.floor(combatA.maxHp * combatA.revive);
        revivedA = true;
        cur.actions.push({ actor: 'A', skill: '圣光复生!', revive: true, hpA: Math.max(0, hpA), hpB: Math.max(0, hpB) });
      } else {
        result = 'lose';
        break;
      }
    }
  }
  // 兜底：500 回合仍未分胜负，记为平局（draw）
  // 实际中双方配置悬殊或极端反弹堆叠可能触发，按 ELO 平局处理
  if (!result) result = 'draw';
  return {
    result, rounds,
    myHp: Math.max(0, hpA), myMaxHp: combatA.maxHp,
    enemyHp: Math.max(0, hpB), enemyMaxHp: combatB.maxHp,
    myStats: { atk: combatA.atk, def: combatA.def, agi: combatA.agi, crit: combatA.crit, dodge: combatA.dodge },
    enemyStats: { atk: combatB.atk, def: combatB.def, agi: combatB.agi, crit: combatB.crit, dodge: combatB.dodge },
    enemyName: playerB.name || playerB.username,
    enemyJob: playerB.job || '无',
    enemyRace: playerB.race || '鹰人',
    enemyLevel: playerB.level || 1
  };
}

// 赛季
function getSeasonKey() {
  const d = new Date(getNow());
  const y = d.getFullYear();
  const monthIdx = d.getMonth();
  const seasonIdx = Math.floor(monthIdx / SEASON_MONTHS);
  return `${y}-S${seasonIdx + 1}`;
}
function getSeasonIndex() {
  const d = new Date(getNow());
  return Math.floor(d.getMonth() / SEASON_MONTHS);
}
function getSeasonDaysLeft() {
  const d = new Date(getNow());
  const seasonIdx = getSeasonIndex();
  const nextStartMonth = (seasonIdx + 1) * SEASON_MONTHS;
  const nextStart = new Date(d.getFullYear(), nextStartMonth, 1);
  const ms = nextStart.getTime() - d.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function getRankTier(period, rankNum) {
  if (!rankNum || rankNum < 1 || rankNum > 100) return null;
  for (const r of ARENA_RANK_REWARDS[period]) {
    if (rankNum >= r.minRank && rankNum <= r.maxRank) return r;
  }
  return null;
}

// 机器人
const BOT_TITLES = ['初出茅庐', '崭露头角', '身经百战', '老谋深算', '名震一方'];

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function getUnlockedAffixLevels(lv) {
  const out = [1];
  if (lv >= 31) out.push(2);
  if (lv >= 61) out.push(3);
  if (lv >= 100) out.push(4);
  return out;
}
function genBotId(idx) { return `bot_${getNow()}_${idx}_${Math.floor(Math.random() * 10000)}`; }

// createBot 依赖 createCharacter/recalcMaxStats（注入）
let _createCharacter = (u, n) => ({ username: u, name: n });
let _recalcMaxStats = () => {};
function setBotCharacterDeps({ createCharacter, recalcMaxStats }) {
  if (createCharacter) _createCharacter = createCharacter;
  if (recalcMaxStats) _recalcMaxStats = recalcMaxStats;
}

function createBot(idx, baseLevel, rating, tierOffset = 0) {
  const level = Math.max(1, baseLevel);
  const isFemale = Math.random() < 0.5;
  const baseName = pickRandom(isFemale ? BOT_NAMES.female : BOT_NAMES.male);
  const jobKeys = ['thunder', 'light', 'wind', 'knight', 'alchemy'];
  const jobPath = level >= 11 ? pickRandom(jobKeys) : null;
  let charName;
  if (jobPath && level >= 20) {
    const pref = pickRandom(BOT_JOB_PREF[jobPath]);
    charName = pref + baseName;
  } else if (level >= 11) {
    charName = baseName;
  } else {
    charName = pickRandom(['见习', '冒险者']) + baseName;
  }

  const baseChar = _createCharacter(genBotId(idx), charName);
  baseChar.level = level;
  baseChar.exp = 0;
  baseChar.jobPath = jobPath;
  if (jobPath) {
    const tree = JOB_TREE[jobPath];
    const stage = tree.stages.find(s => s.level <= level) || tree.stages[0];
    baseChar.job = stage.name;
  }

  const totalPoints = (level - 1) * 3;
  const growth = JOB_TREE[jobPath]?.growth || { atk: 1, def: 1, hp: 1, agi: 1, exp: 0, gold: 0 };
  const wAtk = 1.0 * (growth.atk || 1);
  const wDef = 1.0 * (growth.def || 1);
  const wHp = 1.0 * (growth.hp || 1);
  const wAgi = 1.0 * (growth.agi || 1);
  const wSum = wAtk + wDef + wHp + wAgi;
  const pointsAtk = Math.floor(totalPoints * wAtk / wSum);
  const pointsDef = Math.floor(totalPoints * wDef / wSum);
  const pointsHp = Math.floor(totalPoints * wHp / wSum);
  const pointsAgi = totalPoints - pointsAtk - pointsDef - pointsHp;

  const tierScale = tierOffset >= 4 ? 1.50 : tierOffset <= -4 ? 0.50 : 1.00;
  baseChar.attributes = {
    atk: Math.floor((5 + pointsAtk) * tierScale),
    def: Math.floor((4 + pointsDef) * tierScale),
    hp: Math.floor((5 + pointsHp) * tierScale),
    agi: Math.floor((8 + pointsAgi) * tierScale)
  };
  baseChar.botTier = tierOffset;

  let targetQuality;
  if (tierOffset >= 4) targetQuality = 'legend';
  else if (tierOffset <= -4) targetQuality = level >= 15 ? 'fine' : 'normal';
  else targetQuality = level >= 60 ? 'legend' : level >= 30 ? 'epic' : level >= 15 ? 'fine' : 'normal';

  const eqPool = Object.values(EQUIP_TEMPLATES).filter(t => t.reqLevel <= level && t.quality === targetQuality);
  const slotMap = { weapon: null, armor: null, accessory: null };
  for (const slot of ['weapon', 'armor', 'accessory']) {
    const candidates = eqPool.filter(t => t.slot === slot);
    if (candidates.length > 0) {
      const tpl = pickRandom(candidates);
      slotMap[slot] = {
        uid: `bot_eq_${idx}_${slot}_${Math.floor(Math.random() * 10000)}`,
        templateId: tpl.id || tpl.name,
        name: tpl.name, slot: tpl.slot, quality: tpl.quality,
        reqLevel: tpl.reqLevel, stats: { ...tpl.stats }, enchants: []
      };
    }
  }

  const enchantCount = tierOffset >= 4 ? 2 : tierOffset <= -4 ? 0 : 1;
  const enchantPool = ENCHANT_RECIPES.filter(r => {
    const slot = slotMap[r.slot];
    return slot && r.reqLevel <= level;
  });
  if (enchantPool.length > 0 && enchantCount > 0) {
    const copy = [...enchantPool];
    for (let i = 0; i < Math.min(enchantCount, copy.length); i++) {
      const recipe = pickRandom(copy);
      copy.splice(copy.indexOf(recipe), 1);
      const slot = slotMap[recipe.slot];
      if (slot) {
        slot.enchants.push(recipe.id);
        if (recipe.bonus) {
          for (const [k, v] of Object.entries(recipe.bonus)) {
            slot.stats[k] = (slot.stats[k] || 0) + v;
          }
        }
      }
    }
  }

  baseChar.equipped = slotMap;
  baseChar.equips = Object.values(slotMap).filter(Boolean);
  baseChar.inventory = [];

  const affixLvls = getUnlockedAffixLevels(level);
  const jobStage = jobPath ? JOB_TREE[jobPath].stages.findIndex(s => s.level <= level) + 1 : 0;
  const passiveCount = jobPath ? Math.min(jobStage, 5) : 1;
  const allActiveIds = [];
  const allPassiveIds = [];
  for (const lv of affixLvls) {
    const tree = AFFIX_TREE[lv] || [];
    for (const a of tree) {
      if (a.slot === 'active') allActiveIds.push(a.id);
      else allPassiveIds.push(a.id);
    }
  }

  let botActive = null;
  const activeChance = tierOffset >= 4 ? 1.0 : tierOffset <= -4 ? 0.30 : 0.70;
  if (allActiveIds.length > 0 && Math.random() < activeChance) {
    if (tierOffset >= 4) {
      const highestLevel = affixLvls[affixLvls.length - 1];
      const candidates = (AFFIX_TREE[highestLevel] || []).filter(a => a.slot === 'active');
      botActive = candidates.length > 0 ? pickRandom(candidates).id : pickRandom(allActiveIds);
    } else {
      botActive = pickRandom(allActiveIds);
    }
  }
  const tierPassiveMul = tierOffset >= 4 ? 1.0 : tierOffset <= -4 ? 0.4 : 0.7;
  const finalPassiveCount = Math.max(1, Math.floor(passiveCount * tierPassiveMul));
  const botPassive = [];
  if (allPassiveIds.length > 0) {
    const copy = [...allPassiveIds];
    for (let i = 0; i < Math.min(finalPassiveCount, copy.length); i++) {
      const idx2 = Math.floor(Math.random() * copy.length);
      botPassive.push(copy.splice(idx2, 1)[0]);
    }
  }
  baseChar.affixes = { active: botActive, passive: botPassive };

  if (tierOffset >= 4) baseChar.strategy = pickRandom(['defensive', 'greedy', 'defensive', 'aggressive']);
  else if (tierOffset <= -4) baseChar.strategy = pickRandom(['aggressive', 'balanced', 'balanced']);
  else baseChar.strategy = pickRandom(['aggressive', 'aggressive', 'balanced', 'defensive']);

  const lawCount = tierOffset >= 4 ? 3 : tierOffset <= -4 ? 0 : 1;
  if (lawCount > 0 && level >= 100) {
    const availableLaws = LAWS.filter(l => l.reqLevel <= level);
    const copy = [...availableLaws];
    for (let i = 0; i < Math.min(lawCount, copy.length); i++) {
      const law = pickRandom(copy);
      copy.splice(copy.indexOf(law), 1);
      if (!baseChar.laws) baseChar.laws = [];
      if (!baseChar.laws.includes(law.id)) baseChar.laws.push(law.id);
    }
  }

  let race = '鹰人';
  let raceStage = 0;
  if (level >= 80) { race = '天使'; raceStage = 2; }
  else if (level >= 30) { race = '翼人'; raceStage = 1; }
  baseChar.race = race;
  baseChar.raceStage = raceStage;

  baseChar.exp = 0;
  _recalcMaxStats(baseChar);
  baseChar.hp = baseChar.maxHp;
  baseChar.mp = baseChar.maxMp;

  if (!baseChar.pvpStats) baseChar.pvpStats = {};
  baseChar.pvpStats.wins = 0;
  baseChar.pvpStats.losses = 0;
  baseChar.pvpStats.rating = rating;
  baseChar.pvpStats.streak = 0;
  baseChar.pvpStats.bestStreak = 0;
  baseChar.pvpStats.lastPvpAt = 0;
  baseChar.isBot = true;
  baseChar.botRating = rating;
  return baseChar;
}

function generateArenaBots(playerLevel, playerRating) {
  const tierOffsets = [-5, 0, 5];
  const bots = [];
  for (let i = 0; i < 3; i++) {
    const rating = playerRating + Math.floor(Math.random() * 200) - 50;
    const bot = createBot(i, playerLevel + tierOffsets[i], Math.max(800, rating), tierOffsets[i]);
    bots.push(bot);
  }
  return bots;
}

// 赛季结算
function settleArenaRewards(meta, period, rankingList) {
  if (!period || !rankingList || rankingList.length === 0) return { rewarded: 0 };
  const key = period === 'daily' ? getDailyKey()
    : period === 'weekly' ? getWeeklyKey()
    : getMonthlyKey();
  if (!meta.arenaRewards) meta.arenaRewards = {};
  if (!meta.arenaRewards[period]) meta.arenaRewards[period] = {};
  if (meta.arenaRewards[period][key]) return { rewarded: 0, already: true, key };
  const rewards = {};
  let rewardedCount = 0;
  for (let i = 0; i < rankingList.length && i < 100; i++) {
    const p = rankingList[i];
    const rank = i + 1;
    const tier = getRankTier(period, rank);
    if (!tier) continue;
    rewards[p.username] = { tier: tier.tier, rank, coins: tier.coins };
    rewardedCount++;
  }
  meta.arenaRewards[period][key] = rewards;
  return { rewarded: rewardedCount, key, rewards };
}

function maybeResetSeason(meta) {
  const currentSeason = getSeasonKey();
  if (!meta.currentSeason) {
    meta.currentSeason = currentSeason;
    return { reset: false };
  }
  if (meta.currentSeason !== currentSeason) {
    const old = meta.currentSeason;
    meta.currentSeason = currentSeason;
    meta.lastResetFrom = old;
    meta.lastResetAt = getNow();
    return { reset: true, from: old, to: currentSeason };
  }
  return { reset: false };
}

function applySeasonResetToPlayers(store) {
  const players = store.getAllPlayers();
  for (const p of players) {
    if (!p.pvpStats) continue;
    p.pvpStats.rating = 1000;
    p.pvpStats.streak = 0;
    p.pvpStats.lastPvpAt = 0;
    if (PVP_CURRENCY_KEY in p) p[PVP_CURRENCY_KEY] = 0;
  }
}

// 竞技商店
function buyArenaItem(player, itemId) {
  // 永久称号商品：type = 'title'
  const titleItem = ARENA_TITLES.find(e => e.id === itemId);
  if (titleItem) return buyArenaTitle(player, titleItem);

  const item = ARENA_EQUIPMENT.find(e => e.id === itemId);
  if (!item) return { success: false, message: '装备不存在' };
  if ((player.level || 1) < item.reqLevel) {
    return { success: false, message: `需要 Lv.${item.reqLevel} 才能购买` };
  }
  const coins = player[PVP_CURRENCY_KEY] || 0;
  if (coins < item.price) {
    return { success: false, message: `竞技币不足，需要 ${item.price} 币` };
  }
  player[PVP_CURRENCY_KEY] = coins - item.price;
  const newItem = {
    uid: genUid(),
    templateId: item.id,
    name: item.name, slot: item.slot, quality: item.quality, reqLevel: item.reqLevel,
    stats: { ...item.stats }, enchants: []
  };
  player.equips = player.equips || [];
  // v1.02 持久化：竞技商店买装备也按排序插入
  addEquipToSortedPositionLocal(player, newItem);
  player.logs = player.logs || [];
  player.logs.push({ time: getNow(), type: 'arena', text: `竞技商店购买：${item.name} [传说]` });
  return { success: true, item: newItem };
}

// 竞技商店：购买永久称号（写入 player.titles，无 titleExpiry → 永久有效）
function buyArenaTitle(player, item) {
  player.titles = player.titles || {};
  if (player.titles[item.titleKey]) {
    return { success: false, message: '已拥有该称号' };
  }
  const coins = player[PVP_CURRENCY_KEY] || 0;
  if (coins < item.price) {
    return { success: false, message: `竞技币不足，需要 ${item.price} 币` };
  }
  player[PVP_CURRENCY_KEY] = coins - item.price;
  player.titles[item.titleKey] = true; // 无过期时间 = 永久
  player.logs = player.logs || [];
  player.logs.push({ time: getNow(), type: 'arena', text: `竞技商店购买：永久称号「${item.name}」` });
  return { success: true, item: { id: item.id, type: 'title', titleKey: item.titleKey, name: item.name } };
}

// v1.02 本地版"按排序插入"（与 items.js 同步）
const SLOT_ORDER_PVP = { weapon: 0, armor: 1, accessory: 2 };
function getEquipSortKeyPvp(item) {
  if (!item || !item.stats) return 0;
  let max = 0;
  for (const v of Object.values(item.stats)) {
    if (typeof v === 'number' && v > max) max = v;
  }
  return max;
}
function compareEquipPvp(a, b) {
  const sa = SLOT_ORDER_PVP[a.slot] ?? 99;
  const sb = SLOT_ORDER_PVP[b.slot] ?? 99;
  if (sa !== sb) return sa - sb;
  const va = getEquipSortKeyPvp(a);
  const vb = getEquipSortKeyPvp(b);
  if (va !== vb) return vb - va;
  const qOrder = { mythic: 5, legend: 4, epic: 3, fine: 2, normal: 1 };
  return (qOrder[b.quality] || 0) - (qOrder[a.quality] || 0);
}
function addEquipToSortedPositionLocal(player, item) {
  if (!item) return;
  player.equips = player.equips || [];
  let insertIdx = player.equips.length;
  for (let i = 0; i < player.equips.length; i++) {
    if (compareEquipPvp(item, player.equips[i]) < 0) {
      insertIdx = i;
      break;
    }
  }
  player.equips.splice(insertIdx, 0, item);
}

module.exports = {
  calcPvpRating, calcPvpRewards,
  pickPvPSkill, simulatePvP,
  getSeasonKey, getSeasonIndex, getSeasonDaysLeft,
  getRankTier,
  createBot, generateArenaBots, genBotId,
  settleArenaRewards, maybeResetSeason, applySeasonResetToPlayers,
  buyArenaItem,
  setBotCharacterDeps,
};
