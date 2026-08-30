// ====== 每日活跃配置 ======
// @file server/data/active.js
// @module data-active
// @description 每日活跃 3 档阈值与 5 来源权重（T-104 v2）
//
// 本文件结构：
// 1. 三档阈值配置 DAILY_ACTIVE_TIERS (L5-L9)
// 2. 来源权重 DAILY_ACTIVE_SOURCES (L10-L16)
// 3. 导出 (L18)
const DAILY_ACTIVE_TIERS = [
  { tier: 1, need: 20, reward: { gold: 100 } },
  { tier: 2, need: 50, reward: { exp: 200, materials: [{ name: '草药', count: 2 }] } },
  { tier: 3, need: 100, reward: { materials: null } }, // 占位，首次领取时 3 次独立抽取
];
const DAILY_ACTIVE_SOURCES = {
  idle_claim: 5,
  daily_claim: 10,
  pvp: 15,
  boss: 15,
  expedition: 20,
};

module.exports = { DAILY_ACTIVE_TIERS, DAILY_ACTIVE_SOURCES };
