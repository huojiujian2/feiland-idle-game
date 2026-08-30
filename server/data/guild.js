// ====== 公会静态配置 ======
// @file data/guild
// @module data-guild
// @description 公会等级/权限/捐献配置（T-103 v2.2）

const GUILD_ROLES = { leader: '会长', vice: '副会长', officer: '官员', member: '成员' };
const GUILD_ROLE_ORDER = { member: 0, officer: 1, vice: 2, leader: 3 };
const GUILD_PERMS = {
  kick: ['leader', 'vice'],
  promote: ['leader', 'vice'],
  announce: ['leader', 'vice', 'officer'],
  disband: ['leader'],
  transfer: ['leader'],
};

const GUILD_LEVELS = [
  { level: 1, exp: 0, maxMembers: 10, name: '初创' },
  { level: 2, exp: 500, maxMembers: 15, name: '崛起' },
  { level: 3, exp: 2000, maxMembers: 20, name: '鼎盛' },
  { level: 4, exp: 5000, maxMembers: 30, name: '传奇' },
  { level: 5, exp: 10000, maxMembers: 40, name: '不朽' },
];

const GUILD_CREATE_COST = { gold: 500 };
const GUILD_NAME_RULE = { min: 2, max: 12, pattern: /^[\u4e00-\u9fa5a-zA-Z0-9_\u4e00-\u9fa5]+$/ };
const DONATE_OPTIONS = [
  { id: 'gold_small', label: '小额捐献', cost: { gold: 200 }, reward: { guildExp: 10, contrib: 10 }, dailyLimit: 5 },
  { id: 'gold_large', label: '大力捐献', cost: { gold: 1000 }, reward: { guildExp: 60, contrib: 50 }, dailyLimit: 3 },
  { id: 'mat_herb', label: '草药捐献', cost: { material: '草药', count: 5 }, reward: { guildExp: 15, contrib: 15 }, dailyLimit: 5 },
];
const MAX_GUILDS = 200;
const GUILD_LOG_LIMIT = 30;
const GUILD_ARCHIVE_LIMIT = 50;
const VICE_LIMIT_PER_GUILD = 1;
const OFFICER_LIMIT_PER_GUILD = 2;

function getGuildLevel(exp) {
  let cur = GUILD_LEVELS[0];
  for (const lv of GUILD_LEVELS) if (exp >= lv.exp) cur = lv;
  return cur;
}
function getNextLevelExp(level) {
  const next = GUILD_LEVELS.find((l) => l.level === level + 1);
  return next ? next.exp : null;
}
function getGuildMaxMembers(level) {
  const lv = GUILD_LEVELS.find((l) => l.level === level);
  return lv ? lv.maxMembers : 10;
}

module.exports = {
  GUILD_ROLES,
  GUILD_ROLE_ORDER,
  GUILD_PERMS,
  GUILD_LEVELS,
  GUILD_CREATE_COST,
  GUILD_NAME_RULE,
  DONATE_OPTIONS,
  MAX_GUILDS,
  GUILD_LOG_LIMIT,
  GUILD_ARCHIVE_LIMIT,
  VICE_LIMIT_PER_GUILD,
  OFFICER_LIMIT_PER_GUILD,
  getGuildLevel,
  getNextLevelExp,
  getGuildMaxMembers,
};
