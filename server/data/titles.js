// ====== 称号库 ======
// 玩家可佩戴的称号分两类：
//   1) 职业阶段称号（解锁后永久可用）：由 JOB_TREE 的 stages.name 自动派生
//   2) 世界 BOSS 限时称号（24h 有效）：来自 BOSS 伤害前三，发奖时把过期时间写入 player.titleExpiry

const { JOB_TREE } = require('./jobs');

// 世界 BOSS 限时称号（key / 名称 / 描述 / 颜色）
const WORLD_BOSS_TITLES = {
  boss_killer_1: { name: '天命弑神者', desc: '世界 BOSS 伤害第一（24h 限时）', color: '#ffd700' },
  boss_killer_2: { name: '深渊征服者', desc: '世界 BOSS 伤害第二（24h 限时）', color: '#c0c0c0' },
  boss_killer_3: { name: '暗影屠戮者', desc: '世界 BOSS 伤害第三（24h 限时）', color: '#cd7f32' },
};

// 竞技场商店永久称号（10000 竞技币购买，无过期时间）
//   key 与 data/pvp.js ARENA_TITLES[].titleKey 对应
const ARENA_SHOP_TITLES = {
  arena_immortal_star: { name: '不朽星灵', desc: '竞技场商店购买（永久）', color: '#7fffd4', source: 'arena' },
  arena_samsara_lord:  { name: '轮回之主', desc: '竞技场商店购买（永久）', color: '#d4af5e', source: 'arena' },
};

// 灵鸡斗场称号（斗鸡积分兑换 / 成就自动获得，无过期时间）
//   key 与 data/cockfight.js COCKFIGHT_TITLES 对应
const COCKFIGHT_TITLE_COLORS = {
  cock_newbie: '#f5c542', cock_knight: '#5eda7a', cock_slayer: '#9d8cf0',
  cock_saint: '#d4af5e', cock_king: '#ff6738', cock_maniac: '#ff6738',
};
const { COCKFIGHT_TITLES } = require('./cockfight');
const COCKFIGHT_DISPLAY_TITLES = {};
for (const [key, t] of Object.entries(COCKFIGHT_TITLES)) {
  COCKFIGHT_DISPLAY_TITLES[key] = {
    name: t.name,
    desc: t.desc,
    color: COCKFIGHT_TITLE_COLORS[key] || '#f5c542',
    source: 'cockfight',
  };
}

// 职业阶段称号：遍历 JOB_TREE[].stages（5 职业 × 4 阶段 = 20 个）
//   同一阶段名可能多职业共用（如"雷霆之翼"）→ 用 `${jobId}:${stageName}` 作为唯一 key
function buildJobTitles() {
  const out = {};
  for (const job of Object.values(JOB_TREE)) {
    for (const stage of (job.stages || [])) {
      const k = `${job.id}:${stage.name}`;
      out[k] = {
        name: stage.name,
        desc: `${job.name}职业第 ${job.stages.indexOf(stage) + 1} 阶段`,
        jobId: job.id,
        jobName: job.name,
        requiresLevel: stage.level,
        color: '#9d8cf0',
      };
    }
  }
  return out;
}

const JOB_TITLES = buildJobTitles();

// 所有称号（key → 描述）
const ALL_TITLES = { ...JOB_TITLES, ...WORLD_BOSS_TITLES, ...ARENA_SHOP_TITLES, ...COCKFIGHT_DISPLAY_TITLES };

// 取玩家当前能解锁的所有职业称号（按已解锁的 jobId + 已达阶段等级）
function getUnlockedJobTitles(player) {
  if (!player || !player.jobPath) return [];
  const unlocked = [];
  for (const [key, meta] of Object.entries(JOB_TITLES)) {
    if (meta.jobId !== player.jobPath) continue;
    if ((player.level || 0) >= (meta.requiresLevel || 0)) {
      unlocked.push({ key, ...meta });
    }
  }
  return unlocked;
}

// 取玩家未过期的限时称号（按 player.titles 记录 + titleExpiry 过期时间）
function getActiveTimeTitles(player) {
  const now = Date.now();
  const out = [];
  const expiry = player.titleExpiry || {};
  for (const key of Object.keys(player.titles || [])) {
    const meta = WORLD_BOSS_TITLES[key];
    if (!meta) continue;
    const until = expiry[key] || 0;
    if (until > now) {
      out.push({ key, ...meta, expiresAt: until, remainingMs: until - now });
    }
  }
  return out;
}

// 取玩家已购买的永久称号（竞技场商店；无过期时间，只看 player.titles 记录）
function getOwnedPermanentTitles(player) {
  if (!player || !player.titles) return [];
  const out = [];
  for (const key of Object.keys(player.titles)) {
    const meta = ARENA_SHOP_TITLES[key];
    if (meta) out.push({ key, ...meta });
  }
  return out;
}

// 取玩家已拥有的斗鸡称号（积分兑换 / 成就；无过期时间）
function getOwnedCockfightTitles(player) {
  if (!player || !player.titles) return [];
  const out = [];
  for (const key of Object.keys(player.titles)) {
    const meta = COCKFIGHT_DISPLAY_TITLES[key];
    if (meta) out.push({ key, ...meta });
  }
  return out;
}

// 校验 key 是否合法
function isValidTitleKey(key) {
  return key && ALL_TITLES[key];
}

module.exports = {
  WORLD_BOSS_TITLES,
  ARENA_SHOP_TITLES,
  COCKFIGHT_DISPLAY_TITLES,
  JOB_TITLES,
  ALL_TITLES,
  getUnlockedJobTitles,
  getActiveTimeTitles,
  getOwnedPermanentTitles,
  getOwnedCockfightTitles,
  isValidTitleKey,
};