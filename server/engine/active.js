// ====== 每日活跃：积分累加与三档领取 ======
// @file server/engine/active.js
// @module active
// @description T-104 v2 每日活跃核心（5来源、封顶100、3档幂等、随机材料持久化）
//
// 本文件结构（已模块化拆分后主文件 ~155 行）：
// 1. 注入与工具 getTodayKeyActive/setGrantHandlers (L12-L30)
// 2. 刷新与视图 refreshIfNeeded/getDailyActiveView (L32-L81)
// 3. 计分 addActivePoints (L83-L89)
// 4. 领取 claimActive (L91-L146)
// 5. 导出 (L148-L155)
//
// 本文件结构：
// 1. 注入与工具 getTodayKeyActive (L12-L22)
// 2. 刷新与视图 refreshIfNeeded/getDailyActiveView (L24-L81)
// 3. 计分 addActivePoints (L83-L89)
// 4. 领取 claimActive (L91-L146)
// 5. 导出 (L148)
const { getNow, getRand } = require('./state');
const { DAILY_ACTIVE_TIERS, DAILY_ACTIVE_SOURCES, INITIAL_MATERIAL_POOL } = require('../data');
const { assertSettlementReward } = require('./settlement');

let _grantGold = (p, a) => { p.gold += a; };
let _grantExp = (p, e) => { p.exp += e; };
function setGrantHandlers(h) {
  if (h.grantGold) _grantGold = h.grantGold;
  if (h.grantExpWithLevelUp) _grantExp = h.grantExpWithLevelUp;
}

function getTodayKeyActive() {
  const d = new Date(getNow());
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function refreshIfNeeded(player) {
  const today = getTodayKeyActive();
  if (!player.dailyActive || typeof player.dailyActive !== 'object' || Array.isArray(player.dailyActive)) {
    player.dailyActive = { points: 0, claimed: [], lastResetAt: today, rewards: {} };
  }
  if (typeof player.dailyActive.lastResetAt !== 'string') {
    player.dailyActive.lastResetAt = today;
  } else if (player.dailyActive.lastResetAt !== today) {
    player.dailyActive.points = 0;
    player.dailyActive.claimed = [];
    player.dailyActive.rewards = {};
    player.dailyActive.lastResetAt = today;
  }
  if (!player.dailyActive.rewards || typeof player.dailyActive.rewards !== 'object' || Array.isArray(player.dailyActive.rewards)) player.dailyActive.rewards = {};
  // 清洗 claimed：仅 1/2/3 去重排序
  if (!Array.isArray(player.dailyActive.claimed)) player.dailyActive.claimed = [];
  player.dailyActive.claimed = [...new Set(player.dailyActive.claimed.filter(v => [1,2,3].includes(v)))].sort((a,b)=>a-b);
  if (!Number.isFinite(player.dailyActive.points) || player.dailyActive.points < 0) player.dailyActive.points = 0;
  if (player.dailyActive.points > 100) player.dailyActive.points = 100;
}

function addActivePoints(player, source, inc = 1) {
  refreshIfNeeded(player);
  const per = DAILY_ACTIVE_SOURCES[source];
  if (!per) return;
  player.dailyActive.points = Math.min(100, (player.dailyActive.points || 0) + per * inc);
}

function getDailyActiveView(player) {
  refreshIfNeeded(player);
  const points = player.dailyActive.points || 0;
  const claimed = player.dailyActive.claimed || [];
  const tiers = DAILY_ACTIVE_TIERS.map(t => {
    const isClaimed = claimed.includes(t.tier);
    const canClaim = points >= t.need && !isClaimed;
    let rewardView = t.reward;
    if (t.tier === 3) {
      if (!isClaimed) rewardView = { materials: [{ name: '随机材料', count: 3 }] };
      else {
        const snap = player.dailyActive.rewards && player.dailyActive.rewards[t.tier];
        if (snap) rewardView = snap;
        else {
          const sid = `daily_active:${getTodayKeyActive()}:${t.tier}`;
          const entry = (player.settlementLedger || []).find(e => e.id === sid);
          if (entry && entry.reward && entry.reward.materials) {
            rewardView = entry.reward;
            if (!player.dailyActive.rewards) player.dailyActive.rewards = {};
            player.dailyActive.rewards[t.tier] = entry.reward;
          }
        }
      }
    }
    return { tier: t.tier, need: t.need, reward: rewardView, canClaim, claimed: isClaimed };
  });
  const progressPct = Math.min(100, Math.floor((points / 100) * 100));
  return { points, claimed, tiers, progressPct, lastResetAt: player.dailyActive.lastResetAt };
}

function claimActive(player, tier) {
  refreshIfNeeded(player);
  if (![1,2,3].includes(tier)) return { success: false, status: 400, message: 'tier 非法' };
  const settlementId = `daily_active:${getTodayKeyActive()}:${tier}`;
  const existing = (player.settlementLedger || []).find(e => e.id === settlementId);
  if (existing) {
    if (!existing.fullResult) return { success: false, status: 500, message: '数据损坏' };
    if (!player.dailyActive.claimed.includes(tier)) {
      player.dailyActive.claimed.push(tier);
      player.dailyActive.claimed.sort((a,b)=>a-b);
    }
    if (!player.dailyActive.rewards) player.dailyActive.rewards = {};
    if (!player.dailyActive.rewards[tier]) player.dailyActive.rewards[tier] = existing.reward;
    return { success: true, status: 200, already: true, report: existing.fullResult, reward: existing.reward };
  }
  if (player.dailyActive.claimed.includes(tier)) {
    // ledger 已淘汰但 claimed 仍标记：从 rewards 快照恢复
    const snap = player.dailyActive.rewards && player.dailyActive.rewards[tier];
    if (snap) return { success: true, status: 200, already: true, report: { tier, need: DAILY_ACTIVE_TIERS.find(t=>t.tier===tier).need, points: player.dailyActive.points, reward: snap }, reward: snap };
    return { success: true, status: 200, already: true };
  }
  const tpl = DAILY_ACTIVE_TIERS.find(t => t.tier === tier);
  if (!tpl) return { success: false, status: 404, message: '档位不存在' };
  if ((player.dailyActive.points || 0) < tpl.need) return { success: false, status: 409, message: '积分不足' };
  // 生成 reward（tier3 3次独立抽取合并同名）
  let reward = {};
  if (tier === 1) {
    reward = { gold: tpl.reward.gold };
  } else if (tier === 2) {
    reward = { exp: tpl.reward.exp, materials: tpl.reward.materials.map(m=>({name:m.name,count:m.count})) };
  } else if (tier === 3) {
    const cntMap = {};
    for (let i=0;i<3;i++) {
      const pool = INITIAL_MATERIAL_POOL;
      const name = pool[Math.floor(getRand()() * pool.length)] || '草药';
      cntMap[name] = (cntMap[name]||0) + 1;
    }
    const mats = Object.entries(cntMap).map(([name,count])=>({name,count}));
    reward = { materials: mats };
  }
  const v = assertSettlementReward('daily_active', reward);
  if (!v.valid) return { success: false, status: 500, message: v.message };
  // 发放
  if (reward.gold) _grantGold(player, reward.gold);
  if (reward.exp) _grantExp(player, reward.exp);
  if (reward.materials) {
    if (!Array.isArray(player.inventory)) player.inventory = [];
    for (const m of reward.materials) {
      const ex = player.inventory.find(i=>i.name===m.name);
      if (ex) ex.count += m.count;
      else player.inventory.push({ name:m.name, count:m.count, type:'material' });
    }
  }
  player.dailyActive.claimed.push(tier);
  player.dailyActive.claimed.sort((a,b)=>a-b);
  if (!player.dailyActive.rewards) player.dailyActive.rewards = {};
  player.dailyActive.rewards[tier] = reward;
  const fullResult = { tier, need: tpl.need, points: player.dailyActive.points, reward };
  if (!Array.isArray(player.settlementLedger)) player.settlementLedger = [];
  const entry = { id: settlementId, at: getNow(), type: 'daily_active', reward, source: 'daily_active', fullResult };
  player.settlementLedger.push(entry);
  if (player.settlementLedger.length > 100) player.settlementLedger.splice(0, player.settlementLedger.length-100);
  return { success: true, status: 200, reward, report: fullResult };
}

module.exports = { refreshIfNeeded, addActivePoints, getDailyActiveView, claimActive, setGrantHandlers };
