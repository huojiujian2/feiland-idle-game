// ====== 远征引擎：派遣 / 事件选择 / 结算 / 状态 ======
// @file engine/expedition
// @module expedition
// @description T-102 v4 远征核心（4区域×3时长×10事件×首领预骰，负时长与深渊损失闭合）
const { getNow, getRand, genUid } = require('./state');
const { calcDamage, getActionCount } = require('./combat');
const { getCombatStats, getTotalStats } = require('./stats');
const { EXPEDITION_AREAS, EXPEDITION_EVENTS, EXPEDITION_DURATIONS, MIN_EXPEDITION_MS } = require('../data/expedition');
const { assertSettlementReward } = require('./settlement');

// 注入 handlers（复用 daily 模式）
let _grantGold = (p, a) => { p.gold += a; };
let _grantExp = (p, e) => { p.exp += e; };
let _updateDailyProgress = () => {};
let _checkAchievements = () => {};
function setGrantHandlers(h) {
  if (h.grantGold) _grantGold = h.grantGold;
  if (h.grantExpWithLevelUp) _grantExp = h.grantExpWithLevelUp;
}
function setProgressHandlers(h) {
  if (h.updateDailyProgress) _updateDailyProgress = h.updateDailyProgress;
  if (h.checkAchievements) _checkAchievements = h.checkAchievements;
}

function resolveTimeDelta(raw, baseMs) {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw.endsWith('%')) {
    const pct = parseFloat(raw);
    if (!Number.isFinite(pct)) return 0;
    return Math.floor(baseMs * (pct / 100));
  }
  return 0;
}
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function randInt(min, max) { // [min,max] inclusive
  const r = getRand()();
  return Math.floor(r * (max - min + 1)) + min;
}
function pickEventOutcomes(eventTpl, baseMs) {
  // 为每 choice 生成预骰 outcome（刷新不变）
  // risk 映射成功率
  const riskSuccess = { low: 0.85, mid: 0.65, high: 0.45 };
  const choices = eventTpl.choices.map(ch => {
    const timeDelta = resolveTimeDelta(ch.timeDelta, baseMs);
    const successChance = riskSuccess[ch.risk] ?? 0.6;
    const success = getRand()() < successChance;
    const tpl = ch.template || {};
    let goldDelta = 0, expDelta = 0, lossRate = 0, bossChanceDelta = tpl.bossChanceDelta || 0, material = null, message = '';
    // 成本类（固定扣费，材料仅成功时获得）
    if (typeof tpl.costGold === 'number') {
      goldDelta = -Math.abs(tpl.costGold);
      if (success && tpl.material) material = { ...tpl.material };
      message = success ? `交易成功，获得 ${material?.name || ''}×${material?.count || 0}` : `交易完成，未获材料`;
    } else if (tpl.goldRange) {
      if (success) {
        const [a,b] = tpl.goldRange;
        goldDelta = randInt(a,b);
        if (tpl.expRange) { const [ea,eb]=tpl.expRange; expDelta = randInt(ea,eb); }
        if (tpl.material) material = { ...tpl.material };
        message = '行动成功';
      } else {
        if (tpl.failGoldRange) { const [a,b]=tpl.failGoldRange; goldDelta = randInt(a,b); } // 已为负
        else if (tpl.lossRateRange) { const [a,b]=tpl.lossRateRange; lossRate = a + getRand()()*(b-a); }
        else { goldDelta = 0; lossRate = 0; }
        message = '行动受挫';
      }
    } else {
      goldDelta = 0;
      message = success ? '顺利通过' : '略有波折';
    }
    // lossRate 单独处理（与 goldDelta 可能并存）
    if (tpl.lossRateRange && success) {
      // 成功也可能有小损失？按模板：成功时 lossRate 0，失败时才有
    } else if (tpl.lossRateRange && !success) {
      // already set above
    }
    // bossChanceDelta 已取
    // 保障 goldDelta 为整数
    goldDelta = Math.floor(goldDelta);
    expDelta = Math.floor(expDelta);
    return {
      id: ch.id, label: ch.label, risk: ch.risk, rewardHint: ch.rewardHint, timeDelta,
      outcome: { success, goldDelta, expDelta: expDelta || undefined, material, lossRate: lossRate || undefined, bossChanceDelta: bossChanceDelta || undefined, message }
    };
  });
  return choices;
}

function buildSnapshot(player) {
  const cs = getCombatStats(player);
  // CombatSnapshot 扁平快照
  return {
    level: player.level, strategy: player.strategy || 'balanced',
    atk: cs.atk, def: cs.def, maxHp: cs.maxHp, hp: cs.hp, agi: cs.agi,
    crit: cs.crit, critDmg: cs.critDmg, dodge: cs.dodge, lifesteal: cs.lifesteal || 0, regen: cs.regen || 0,
  };
}

function simulateExpeditionBossBattle(snapshot, boss, maxRounds = 5) {
  const mHp = boss.hp;
  const mAtk = boss.atk;
  const mDef = boss.def;
  const mAgi = boss.agi;
  const skillChance = boss.skillChance || 0.15;
  let pHp = snapshot.maxHp; // 满血出战
  let mCurHp = mHp;
  const effAgi = snapshot.agi;
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
        const r = calcDamage(snapshot.atk, mDef, 1, 0, 0, 0, snapshot.crit || 0, snapshot.critDmg || 1.5);
        mCurHp = Math.max(0, mCurHp - r.value);
        totalDamage += r.value;
        if (snapshot.lifesteal > 0) pHp = Math.min(snapshot.maxHp, pHp + Math.floor(r.value * snapshot.lifesteal));
        actions.push({ actor: 'player', skill: '远征斩击', damage: r.value, crit: r.isCrit, pHp, mHp: mCurHp });
      } else {
        if (getRand()() < (snapshot.dodge || 0)) {
          actions.push({ actor: 'monster', skill: '闪避!', dodge: true, pHp, mHp: mCurHp });
        } else {
          let mult = 1, name = '普通攻击';
          if (getRand()() < skillChance) { mult = 1.5; name = '首领怒击'; }
          const r = calcDamage(mAtk, snapshot.def, mult, 0, 0, 0, 0, 0);
          pHp = Math.max(0, pHp - r.value);
          actions.push({ actor: 'monster', skill: name, damage: r.value, pHp, mHp: mCurHp });
        }
      }
    }
    rounds.push({ round, actions, pHp: Math.max(0, pHp), mHp: Math.max(0, mCurHp), pActions: curPActions, mActions: curMActions });
    if (mCurHp <= 0) { result = 'win'; break; }
    if (pHp <= 0) { result = 'lose'; break; }
  }
  return { result, rounds, totalDamage };
}

function getExpeditionStatus(player) {
  const exp = player.expedition;
  if (!exp) return { expedition: null, remainingMs: 0, status: null };
  const remainingMs = Math.max(0, exp.endAt - getNow());
  const status = getNow() >= exp.endAt ? 'ready' : 'ongoing';
  if (exp.status !== status) exp.status = status;
  return { expedition: exp, remainingMs, status };
}

function dispatchExpedition(player, areaId, durationKey) {
  if (player.expedition) return { success: false, message: '已有进行中的远征', code: 409 };
  const area = EXPEDITION_AREAS[areaId];
  if (!area) return { success: false, message: '区域不存在', code: 404 };
  if ((player.level || 1) < area.minLevel) return { success: false, message: `需要 Lv.${area.minLevel} 才能进入${area.name}`, code: 409 };
  const dur = EXPEDITION_DURATIONS.find(d => d.key === durationKey);
  if (!dur) return { success: false, message: '时长参数非法', code: 400 };
  const now = getNow();
  const snapshot = buildSnapshot(player);
  const id = genUid();
  // 事件抽样 1-2 个（Fisher-Yates 无偏洗牌，单次 getRand/交换）
  const pool = area.eventPool || [];
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(getRand()() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const count = areaId === 'verdant_border' ? 1 : (getRand()() < 0.5 ? 1 : 2);
  const pickedIds = shuffled.slice(0, Math.min(count, pool.length));
  const events = pickedIds.map(eid => {
    const tpl = EXPEDITION_EVENTS.find(e => e.id === eid);
    if (!tpl) return null;
    const choices = pickEventOutcomes(tpl, dur.ms);
    return { eventId: tpl.id, title: tpl.title, desc: tpl.desc, choices, chosenId: null, choiceChangeCount: 0 };
  }).filter(Boolean);
  // 首领预骰
  const bossRoll = getRand()();
  const bossBaseChance = area.boss ? area.boss.chance : 0;
  const boss = area.boss ? { id: `boss_${id}`, name: area.boss.name, baseChance: bossBaseChance, roll: bossRoll, triggered: null, battle: null, rewards: null } : null;
  // 深渊基础损失预骰
  const goldLossCfg = area.base.goldLoss;
  let baseGoldLossRoll = getRand()();
  let baseGoldLossRate = 0;
  if (goldLossCfg && baseGoldLossRoll < goldLossCfg.chance) baseGoldLossRate = goldLossCfg.rate;
  // 若该区域无 goldLoss，则 roll/rate 仍存但 rate 0 便于报告
  const baseEndAt = now + dur.ms;
  const expedition = {
    id, areaId, durationKey, startAt: now, baseEndAt, endAt: baseEndAt, appliedTimeDelta: 0,
    baseGoldLossRate, baseGoldLossRoll,
    snapshot, events, boss, status: 'ongoing', settlementId: `expedition:${id}`,
  };
  player.expedition = expedition;
  // codex
  if (!player.expeditionCodex) player.expeditionCodex = {};
  if (!player.expeditionCodex[areaId]) player.expeditionCodex[areaId] = { dispatched: 0, claimed: 0, lastAt: 0, bossKills: 0 };
  player.expeditionCodex[areaId].dispatched++;
  player.expeditionCodex[areaId].lastAt = now;
  if (!player.expeditionHistory) player.expeditionHistory = [];
  if (!player.expeditionReports) player.expeditionReports = {};
  return { success: true, expedition };
}

function chooseEventOption(player, eventId, choiceId) {
  const exp = player.expedition;
  if (!exp) return { success: false, message: '无进行中的远征', code: 404 };
  if (getNow() >= exp.endAt) return { success: false, message: '远征已结束，无法再选择', code: 409 };
  const ev = exp.events.find(e => e.eventId === eventId);
  if (!ev) return { success: false, message: '事件不存在', code: 404 };
  if (!['a','b'].includes(choiceId)) return { success: false, message: '选项非法', code: 400 };
  const choice = ev.choices.find(c => c.id === choiceId);
  if (!choice) return { success: false, message: '选项不存在', code: 404 };
  if (ev.chosenId === choiceId) return { success: true, expedition: exp }; // 幂等
  if (ev.chosenId !== null && ev.choiceChangeCount >= 1) return { success: false, message: '已达改选上限', code: 409 };
  const prevDelta = ev.chosenId ? (ev.choices.find(c => c.id === ev.chosenId)?.timeDelta || 0) : 0;
  const newDelta = choice.timeDelta || 0;
  if (ev.chosenId !== null) ev.choiceChangeCount = (ev.choiceChangeCount || 0) + 1;
  ev.chosenId = choiceId;
  // 重算 endAt
  let sum = 0;
  for (const e of exp.events) {
    if (e.chosenId) {
      const ch = e.choices.find(c => c.id === e.chosenId);
      if (ch) sum += (ch.timeDelta || 0);
    }
  }
  exp.appliedTimeDelta = sum;
  const minEndAt = exp.startAt + MIN_EXPEDITION_MS;
  exp.endAt = Math.max(minEndAt, exp.baseEndAt + sum);
  // 状态保持 ongoing（若重算后已结束，下次 GET 会推导为 ready）
  return { success: true, expedition: exp };
}

function claimExpedition(player, expeditionId) {
  if (!expeditionId || typeof expeditionId !== 'string') return { success: false, message: '缺少 expeditionId', code: 400 };
  const settlementId = `expedition:${expeditionId}`;
  // 1) 先查 ledger 重放
  const ledger = Array.isArray(player.settlementLedger) ? player.settlementLedger.find(e => e.id === settlementId) : null;
  if (ledger) {
    if (!ledger.fullResult) return { success: false, message: '数据损坏', code: 500 };
    return { success: true, already: true, report: ledger.fullResult, settlementId };
  }
  // 2) 校验当前远征
  const exp = player.expedition;
  if (!exp || exp.id !== expeditionId) return { success: false, message: '远征不存在或已结算', code: 404 };
  // 默认 a 补算并判定时间
  // 计算若未选默认 a 后的最终 endAt
  let appliedForCheck = exp.appliedTimeDelta;
  let defaultDeltas = 0;
  for (const e of exp.events) {
    if (!e.chosenId) {
      const def = e.choices.find(c => c.id === 'a');
      if (def) defaultDeltas += (def.timeDelta || 0);
    }
  }
  const finalEndAtForCheck = Math.max(exp.startAt + MIN_EXPEDITION_MS, exp.baseEndAt + appliedForCheck + defaultDeltas);
  if (getNow() < finalEndAtForCheck) return { success: false, message: '远征尚未结束', code: 409 };
  // 若有默认，加到 exp
  if (defaultDeltas !== 0) {
    exp.appliedTimeDelta += defaultDeltas;
    exp.endAt = finalEndAtForCheck;
    for (const e of exp.events) if (!e.chosenId) e.chosenId = 'a';
  } else {
    // 仍需把未选的标记为 a（无时间影响）
    for (const e of exp.events) if (!e.chosenId) e.chosenId = 'a';
  }
  const area = EXPEDITION_AREAS[exp.areaId];
  if (!area) return { success: false, message: '区域配置不存在', code: 500 };
  // base 奖励
  const [gMin, gMax] = area.base.gold;
  const baseGold = randInt(gMin, gMax);
  const baseExp = area.base.exp;
  let baseMaterials = [];
  // 基础掉落按 rate 骰
  if (Array.isArray(area.base.drops)) {
    for (const d of area.base.drops) {
      if (getRand()() < (d.rate || 0)) baseMaterials.push({ name: d.name, count: 1 });
    }
  }
  // 事件汇总
  let eventGold = 0, eventExp = 0, eventLossRate = 0, bossChanceDelta = 0;
  let eventMaterials = [];
  const eventResults = [];
  for (const e of exp.events) {
    const ch = e.choices.find(c => c.id === e.chosenId);
    if (!ch) continue;
    const out = ch.outcome || {};
    eventGold += (out.goldDelta || 0);
    eventExp += (out.expDelta || 0);
    if (typeof out.lossRate === 'number') eventLossRate += out.lossRate;
    if (typeof out.bossChanceDelta === 'number') bossChanceDelta += out.bossChanceDelta;
    if (out.material) eventMaterials.push({ ...out.material });
    eventResults.push({ eventId: e.eventId, title: e.title, chosenId: e.chosenId, outcome: out, timeDelta: ch.timeDelta });
  }
  const baseGoldLossRate = exp.baseGoldLossRate || 0;
  const totalLossRate = baseGoldLossRate + eventLossRate;
  const lossGold = Math.floor(baseGold * clamp(totalLossRate, 0, 1));
  // 首领
  let triggered = false, battle = null, bossRewards = null;
  if (exp.boss) {
    const finalChance = clamp(exp.boss.baseChance + bossChanceDelta, 0, 1);
    triggered = exp.boss.roll < finalChance;
    exp.boss.triggered = triggered;
    if (triggered) {
      const snap = exp.snapshot;
      const bossCfg = area.boss;
      const bossObj = {
        hp: Math.floor(snap.maxHp * bossCfg.hpRate),
        maxHp: Math.floor(snap.maxHp * bossCfg.hpRate),
        atk: Math.floor(snap.atk * bossCfg.atkRate),
        def: Math.floor(snap.def * 0.8),
        agi: Math.floor(snap.agi * 0.9),
        skillChance: 0.15,
      };
      const res = simulateExpeditionBossBattle(snap, bossObj, 5);
      battle = res;
      // 仅 win 发奖励并计 bossKills（评审建议2）
      if (res.result === 'win') {
        const bg = Math.floor(baseGold * bossCfg.goldMul);
        const be = Math.floor(baseExp * bossCfg.expMul);
        bossRewards = { gold: bg, exp: be, material: { name: area.base.drops[0]?.name || '龙鳞', count: 1 } };
      } else {
        bossRewards = { gold: 0, exp: 0 };
        // 失败不发材料，但 triggered 仍为 true 供报告展示
      }
      exp.boss.battle = battle;
      exp.boss.rewards = bossRewards;
    } else {
      exp.boss.battle = null;
      exp.boss.rewards = null;
    }
  }
  const bossGold = bossRewards ? bossRewards.gold : 0;
  const bossExp = bossRewards ? bossRewards.exp : 0;
  let bossMaterial = bossRewards && bossRewards.material ? [bossRewards.material] : [];
  const totalGold = Math.max(0, baseGold + eventGold - lossGold + bossGold);
  const totalExp = Math.max(0, baseExp + eventExp + bossExp);
  const totalMaterials = [...baseMaterials, ...eventMaterials, ...bossMaterial];
  // 组报告
  const now = getNow();
  const report = {
    id: exp.id,
    areaId: exp.areaId,
    durationKey: exp.durationKey,
    startAt: exp.startAt,
    baseEndAt: exp.baseEndAt,
    endAt: exp.endAt,
    claimedAt: now,
    base: { gold: baseGold, exp: baseExp, drops: baseMaterials, baseGoldLossRate, baseGoldLossRoll: exp.baseGoldLossRoll },
    events: eventResults,
    boss: exp.boss ? { triggered, battle, rewards: bossRewards, baseChance: exp.boss.baseChance, roll: exp.boss.roll, finalChance: clamp(exp.boss.baseChance + bossChanceDelta, 0, 1) } : null,
    total: { gold: totalGold, exp: totalExp, materials: totalMaterials },
    appliedTimeDelta: exp.appliedTimeDelta,
  };
  // settlement 校验（仅最终奖励）
  const rewardForLedger = { gold: totalGold, exp: totalExp };
  if (totalMaterials.length > 0) rewardForLedger.materials = totalMaterials.map(m => ({ name: m.name, count: m.count }));
  // equips 本期不发，保持空
  const v = assertSettlementReward('expedition', rewardForLedger);
  if (!v.valid) return { success: false, message: v.message, code: 500 };
  // 发放
  if (totalGold > 0) _grantGold(player, totalGold);
  if (totalExp > 0) _grantExp(player, totalExp);
  if (totalMaterials.length > 0) {
    if (!Array.isArray(player.inventory)) player.inventory = [];
    for (const m of totalMaterials) {
      const ex = player.inventory.find(i => i.name === m.name);
      if (ex) ex.count += m.count;
      else player.inventory.push({ name: m.name, count: m.count, type: 'material' });
    }
  }
  // 仅 win 才计 bossKills
  if (triggered && battle && battle.result === 'win') {
    player.expeditionCodex[exp.areaId].bossKills = (player.expeditionCodex[exp.areaId].bossKills || 0) + 1;
  }
  player.expeditionCodex[exp.areaId].claimed++;
  // progress
  _updateDailyProgress(player, 'expedition1', 1);
  _checkAchievements(player);
  // ledger
  const ledgerEntry = { id: settlementId, at: now, type: 'expedition', reward: rewardForLedger, source: `expedition:${exp.areaId}:${exp.durationKey}`, fullResult: report };
  if (!Array.isArray(player.settlementLedger)) player.settlementLedger = [];
  player.settlementLedger.push(ledgerEntry);
  if (player.settlementLedger.length > 100) player.settlementLedger.splice(0, player.settlementLedger.length - 100);
  // history/reports
  if (!Array.isArray(player.expeditionHistory)) player.expeditionHistory = [];
  player.expeditionHistory.unshift({ id: exp.id, areaId: exp.areaId, durationKey: exp.durationKey, startAt: exp.startAt, endAt: exp.endAt, claimedAt: now, reward: { gold: totalGold, exp: totalExp }, bossTriggered: triggered, eventsSummary: eventResults.map(e=>e.title).join(','), totalMaterials });
  if (player.expeditionHistory.length > 20) player.expeditionHistory.splice(20);
  if (!player.expeditionReports) player.expeditionReports = {};
  player.expeditionReports[exp.id] = report;
  const rKeys = Object.keys(player.expeditionReports);
  if (rKeys.length > 20) {
    rKeys.sort((a,b)=> player.expeditionReports[a].claimedAt - player.expeditionReports[b].claimedAt);
    for (let i=0;i<rKeys.length-20;i++) delete player.expeditionReports[rKeys[i]];
  }
  player.expedition = null;
  return { success: true, report, settlementId };
}

module.exports = {
  dispatchExpedition,
  chooseEventOption,
  claimExpedition,
  getExpeditionStatus,
  simulateExpeditionBossBattle,
  buildSnapshot,
  resolveTimeDelta,
  MIN_EXPEDITION_MS,
  setGrantHandlers,
  setProgressHandlers,
};
