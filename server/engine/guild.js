// ====== 公会引擎：创建/成员/职位/公告/捐献/等级 ======
// @file engine/guild
// @module guild
// @description T-103 v2.2 工会基础核心（4级职位、捐献日限、等级循环、日志归档、同事务远征联动）
//
// 本文件结构（~380行）：
// 1. 依赖与工具 2. 日志与等级 3. 投影与自愈 4. 创建/列表/详情 5. 成员操作 6. 公告/捐献/解散 7. 远征联动 8. 导出

const { getNow, genUid } = require('./state');
const {
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
} = require('../data/guild');

function getTodayKey() {
  const d = new Date(getNow());
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function appendGuildLog(guild, entry) {
  if (!guild.logs) guild.logs = [];
  guild.logs.push({ at: getNow(), ...entry });
  if (guild.logs.length > GUILD_LOG_LIMIT) guild.logs.splice(0, guild.logs.length - GUILD_LOG_LIMIT);
}
function tryGuildLevelUp(guild, by) {
  const before = guild.level;
  const after = getGuildLevel(guild.exp).level;
  if (after !== before) {
    guild.level = after;
    appendGuildLog(guild, { by: by || 'system', action: 'levelup', detail: `${before}->${after}` });
    return true;
  }
  return false;
}

function syncMembersProjection(guild, players) {
  if (!guild || !Array.isArray(guild.members)) return;
  for (const m of guild.members) {
    const p = players[m.username];
    if (p) {
      if (p.name) m.name = p.name;
      if (Number.isFinite(p.level)) m.level = p.level;
    }
  }
}

function ensureGuildConsistency(player, ctx) {
  if (!player || !ctx || !ctx.meta) return { changed: false };
  const meta = ctx.meta;
  const players = ctx.players;
  let changed = false;
  // 校验 donateDaily 跨日
  const today = getTodayKey();
  if (!player.guildDonateDaily || player.guildDonateDaily.dayKey !== today) {
    player.guildDonateDaily = { dayKey: today, counts: {} };
    changed = true;
  }
  if (typeof player.guildId === 'string' && player.guildId) {
    const guild = meta.guilds[player.guildId];
    if (!guild) {
      player.guildId = null;
      player.guildRole = null;
      player.guildJoinAt = null;
      changed = true;
      return { changed };
    }
    // guild 存在但不在 members
    const member = guild.members.find((m) => m.username === player.username);
    if (!member) {
      player.guildId = null;
      player.guildRole = null;
      player.guildJoinAt = null;
      changed = true;
      return { changed };
    }
    if (player.guildRole !== member.role) {
      player.guildRole = member.role;
      changed = true;
    }
    if (player.guildJoinAt !== member.joinedAt) {
      player.guildJoinAt = member.joinedAt;
      changed = true;
    }
    syncMembersProjection(guild, players);
  } else {
    if (player.guildRole !== null) { player.guildRole = null; changed = true; }
    if (player.guildJoinAt !== null) { player.guildJoinAt = null; changed = true; }
  }
  return { changed };
}

function toGuildSummary(guild, players) {
  syncMembersProjection(guild, players || {});
  const lv = getGuildLevel(guild.exp);
  const nextExp = getNextLevelExp(lv.level);
  const leaderMember = guild.members.find((m) => m.username === guild.leaderUsername);
  const leaderLevel = leaderMember ? leaderMember.level : (players[guild.leaderUsername]?.level || 1);
  const leaderName = leaderMember ? leaderMember.name : guild.leaderUsername;
  return {
    id: guild.id,
    name: guild.name,
    level: lv.level,
    exp: guild.exp,
    nextLevelExp: nextExp,
    maxMembers: getGuildMaxMembers(lv.level),
    memberCount: guild.members.length,
    announcement: guild.announcement || '',
    announcementAt: guild.announcementAt || null,
    announcementBy: guild.announcementBy || null,
    createdAt: guild.createdAt,
    leaderUsername: guild.leaderUsername,
    leaderName,
    leaderLevel,
  };
}

function toGuildDetail(guild, players) {
  syncMembersProjection(guild, players || {});
  const lv = getGuildLevel(guild.exp);
  const nextExp = getNextLevelExp(lv.level);
  // 排序 members: role desc, contribution desc
  const sortedMembers = [...guild.members].sort((a, b) => {
    const ra = GUILD_ROLE_ORDER[a.role] || 0;
    const rb = GUILD_ROLE_ORDER[b.role] || 0;
    if (rb !== ra) return rb - ra;
    return (b.contribution || 0) - (a.contribution || 0);
  });
  return {
    id: guild.id,
    name: guild.name,
    level: lv.level,
    exp: guild.exp,
    nextLevelExp: nextExp,
    maxMembers: getGuildMaxMembers(lv.level),
    memberCount: guild.members.length,
    announcement: guild.announcement || '',
    announcementAt: guild.announcementAt || null,
    announcementBy: guild.announcementBy || null,
    createdAt: guild.createdAt,
    leaderUsername: guild.leaderUsername,
    members: sortedMembers.map((m) => ({ username: m.username, name: m.name, level: m.level, role: m.role, contribution: m.contribution, joinedAt: m.joinedAt })),
    store: { gold: guild.store.gold || 0, materials: { ...(guild.store.materials || {}) } },
    logs: (guild.logs || []).slice(-GUILD_LOG_LIMIT),
  };
}

function toViewer(player, guild) {
  let currentContribution = 0;
  if (guild && player.guildId === guild.id) {
    const m = guild.members.find((x) => x.username === player.username);
    if (m) currentContribution = m.contribution || 0;
  }
  const lifetimeContribution = Number.isFinite(player.guildContribution) ? player.guildContribution : 0;
  const donateDaily = player.guildDonateDaily && player.guildDonateDaily.dayKey === getTodayKey()
    ? player.guildDonateDaily
    : { dayKey: getTodayKey(), counts: {} };
  return {
    role: player.guildRole || null,
    currentContribution,
    lifetimeContribution,
    donateDaily,
    joinAt: player.guildJoinAt || null,
  };
}

function validateGuildName(name) {
  if (typeof name !== 'string') return '名称必须为字符串';
  const trimmed = name.trim();
  if (trimmed.length < GUILD_NAME_RULE.min || trimmed.length > GUILD_NAME_RULE.max) return `名称长度需 ${GUILD_NAME_RULE.min}-${GUILD_NAME_RULE.max} 字符`;
  if (!GUILD_NAME_RULE.pattern.test(trimmed)) return '名称仅支持中英数下划线';
  return null;
}

function createGuild(player, name, ctx) {
  if (!player) return { success: false, status: 404, message: '角色不存在' };
  ensureGuildConsistency(player, ctx);
  if (player.guildId) return { success: false, status: 409, message: '已在公会中' };
  const err = validateGuildName(name);
  if (err) return { success: false, status: 400, message: err };
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  const meta = ctx.meta;
  if (!meta.guilds) meta.guilds = {};
  if (!meta.guildNameIndex) meta.guildNameIndex = {};
  if (meta.guildNameIndex[lower]) return { success: false, status: 409, message: '公会名已存在' };
  if (Object.keys(meta.guilds).length >= MAX_GUILDS) return { success: false, status: 409, message: '全服公会已达上限' };
  if ((player.gold || 0) < GUILD_CREATE_COST.gold) return { success: false, status: 409, message: '金币不足' };
  player.gold -= GUILD_CREATE_COST.gold;
  const id = genUid();
  const now = getNow();
  const guild = {
    id,
    name: trimmed,
    level: 1,
    exp: 0,
    announcement: '',
    announcementAt: null,
    announcementBy: null,
    createdAt: now,
    leaderUsername: player.username,
    members: [{ username: player.username, name: player.name, level: player.level, role: 'leader', contribution: 0, joinedAt: now }],
    store: { gold: 0, materials: {} },
    logs: [],
  };
  appendGuildLog(guild, { by: player.username, action: 'create', detail: trimmed });
  meta.guilds[id] = guild;
  meta.guildNameIndex[lower] = id;
  player.guildId = id;
  player.guildRole = 'leader';
  player.guildJoinAt = now;
  if (!Number.isFinite(player.guildContribution)) player.guildContribution = 0;
  if (!player.guildDonateDaily) player.guildDonateDaily = { dayKey: getTodayKey(), counts: {} };
  return { success: true, status: 200, guild: toGuildDetail(guild, ctx.players), viewer: toViewer(player, guild) };
}

function listGuilds(ctx, opts = {}) {
  const meta = ctx.meta;
  const players = ctx.players || {};
  const q = (opts.q || '').trim().toLowerCase();
  let list = Object.values(meta.guilds || {});
  if (q) list = list.filter((g) => g.name.toLowerCase().includes(q));
  list.sort((a, b) => {
    const la = getGuildLevel(a.exp).level;
    const lb = getGuildLevel(b.exp).level;
    if (lb !== la) return lb - la;
    if (b.exp !== a.exp) return b.exp - a.exp;
    return a.createdAt - b.createdAt;
  });
  const total = list.length;
  const page = Math.max(1, parseInt(opts.page, 10) || 1);
  let pageSize = parseInt(opts.pageSize, 10) || 10;
  pageSize = Math.min(20, Math.max(10, pageSize));
  const start = (page - 1) * pageSize;
  const sliced = list.slice(start, start + pageSize).map((g) => toGuildSummary(g, players));
  return { success: true, status: 200, data: { list: sliced, total, page, pageSize } };
}

function getMyGuild(player, ctx) {
  if (!player) return { success: false, status: 404, message: '角色不存在' };
  const r = ensureGuildConsistency(player, ctx);
  // 若 ensure 触发清理且在只读路径，不落盘则仅内存修正；写路径由事务提交决定，此处仅返回
  if (!player.guildId) {
    return { success: true, status: 200, data: { guild: null, viewer: toViewer(player, null) } };
  }
  const guild = ctx.meta.guilds[player.guildId];
  if (!guild) {
    player.guildId = null;
    player.guildRole = null;
    player.guildJoinAt = null;
    return { success: true, status: 200, data: { guild: null, viewer: toViewer(player, null) } };
  }
  syncMembersProjection(guild, ctx.players);
  return { success: true, status: 200, data: { guild: toGuildDetail(guild, ctx.players), viewer: toViewer(player, guild) } };
}

function joinGuild(player, guildId, ctx) {
  if (!player) return { success: false, status: 404, message: '角色不存在' };
  ensureGuildConsistency(player, ctx);
  if (player.guildId) return { success: false, status: 409, message: '已在公会中' };
  if (!guildId) return { success: false, status: 400, message: '缺少 guildId' };
  const guild = ctx.meta.guilds[guildId];
  if (!guild) return { success: false, status: 404, message: '公会不存在' };
  const lv = getGuildLevel(guild.exp);
  const max = getGuildMaxMembers(lv.level);
  if (guild.members.length >= max) return { success: false, status: 409, message: '公会已满' };
  const now = getNow();
  const member = { username: player.username, name: player.name, level: player.level, role: 'member', contribution: 0, joinedAt: now };
  guild.members.push(member);
  appendGuildLog(guild, { by: player.username, action: 'join' });
  player.guildId = guild.id;
  player.guildRole = 'member';
  player.guildJoinAt = now;
  if (!Number.isFinite(player.guildContribution)) player.guildContribution = 0;
  return { success: true, status: 200, guild: toGuildDetail(guild, ctx.players), viewer: toViewer(player, guild) };
}

function leaveGuild(player, ctx) {
  if (!player) return { success: false, status: 404, message: '角色不存在' };
  ensureGuildConsistency(player, ctx);
  if (!player.guildId) return { success: false, status: 404, message: '未加入公会' };
  const guild = ctx.meta.guilds[player.guildId];
  if (!guild) {
    player.guildId = null; player.guildRole = null; player.guildJoinAt = null;
    return { success: true, status: 200 };
  }
  const member = guild.members.find((m) => m.username === player.username);
  if (!member) {
    player.guildId = null; player.guildRole = null; player.guildJoinAt = null;
    return { success: true, status: 200 };
  }
  if (member.role === 'leader') {
    if (guild.members.length > 1) return { success: false, status: 409, message: '会长需先转让' };
    // 单成员解散归档（先写 disband 日志再快照）
    appendGuildLog(guild, { by: player.username, action: 'disband', detail: guild.name });
    const meta = ctx.meta;
    if (!meta.guildArchive) meta.guildArchive = {};
    meta.guildArchive[guild.id] = { id: guild.id, name: guild.name, disbandedAt: getNow(), by: player.username, snapshot: JSON.parse(JSON.stringify(guild)), logs: [...guild.logs] };
    const keys = Object.keys(meta.guildArchive);
    if (keys.length > GUILD_ARCHIVE_LIMIT) {
      keys.sort((a, b) => (meta.guildArchive[a].disbandedAt || 0) - (meta.guildArchive[b].disbandedAt || 0));
      for (let i = 0; i < keys.length - GUILD_ARCHIVE_LIMIT; i++) delete meta.guildArchive[keys[i]];
    }
    delete meta.guilds[guild.id];
    delete meta.guildNameIndex[guild.name.trim().toLowerCase()];
    player.guildId = null; player.guildRole = null; player.guildJoinAt = null;
    return { success: true, status: 200 };
  }
  guild.members = guild.members.filter((m) => m.username !== player.username);
  appendGuildLog(guild, { by: player.username, action: 'leave' });
  player.guildId = null; player.guildRole = null; player.guildJoinAt = null;
  return { success: true, status: 200 };
}

function kickMember(operatorPlayer, targetUsername, ctx) {
  if (!operatorPlayer) return { success: false, status: 404, message: '角色不存在' };
  ensureGuildConsistency(operatorPlayer, ctx);
  if (!operatorPlayer.guildId) return { success: false, status: 404, message: '未加入公会' };
  const guild = ctx.meta.guilds[operatorPlayer.guildId];
  if (!guild) return { success: false, status: 404, message: '公会不存在' };
  if (!targetUsername) return { success: false, status: 400, message: '缺少 targetUsername' };
  if (targetUsername === operatorPlayer.username) return { success: false, status: 409, message: '不能踢自己' };
  const opRole = operatorPlayer.guildRole;
  if (!GUILD_PERMS.kick.includes(opRole)) return { success: false, status: 403, message: '无权限' };
  const targetMember = guild.members.find((m) => m.username === targetUsername);
  if (!targetMember) return { success: false, status: 404, message: '目标不在公会' };
  const opOrder = GUILD_ROLE_ORDER[opRole] || 0;
  const tgtOrder = GUILD_ROLE_ORDER[targetMember.role] || 0;
  if (opOrder <= tgtOrder) return { success: false, status: 409, message: '不能踢同级或更高级' };
  guild.members = guild.members.filter((m) => m.username !== targetUsername);
  appendGuildLog(guild, { by: operatorPlayer.username, action: 'kick', target: targetUsername });
  const targetPlayer = ctx.players[targetUsername];
  if (targetPlayer) {
    targetPlayer.guildId = null; targetPlayer.guildRole = null; targetPlayer.guildJoinAt = null;
  }
  return { success: true, status: 200, guild: toGuildDetail(guild, ctx.players) };
}

function updateRole(operatorPlayer, targetUsername, newRole, ctx) {
  if (!operatorPlayer) return { success: false, status: 404, message: '角色不存在' };
  ensureGuildConsistency(operatorPlayer, ctx);
  if (!operatorPlayer.guildId) return { success: false, status: 404, message: '未加入公会' };
  const guild = ctx.meta.guilds[operatorPlayer.guildId];
  if (!guild) return { success: false, status: 404, message: '公会不存在' };
  if (!targetUsername || !newRole) return { success: false, status: 400, message: '缺少参数' };
  if (!['vice', 'officer', 'member'].includes(newRole)) return { success: false, status: 400, message: 'role 非法' };
  if (targetUsername === operatorPlayer.username) return { success: false, status: 409, message: '不能调整自己' };
  const opRole = operatorPlayer.guildRole;
  if (!GUILD_PERMS.promote.includes(opRole)) return { success: false, status: 403, message: '无权限' };
  const targetMember = guild.members.find((m) => m.username === targetUsername);
  if (!targetMember) return { success: false, status: 404, message: '目标不在公会' };
  if (targetMember.role === 'leader') return { success: false, status: 409, message: '不能调整会长' };
  // vice 权限限制
  if (opRole === 'vice') {
    if (!['officer', 'member'].includes(targetMember.role) || !['officer', 'member'].includes(newRole)) {
      return { success: false, status: 403, message: '副会长仅可调整官员与成员' };
    }
  }
  if (targetMember.role === newRole) return { success: true, status: 200, guild: toGuildDetail(guild, ctx.players) };
  // 数量限制
  if (newRole === 'vice') {
    const cnt = guild.members.filter((m) => m.role === 'vice').length;
    if (cnt >= VICE_LIMIT_PER_GUILD) return { success: false, status: 409, message: '副会长已达上限' };
  }
  if (newRole === 'officer') {
    const cnt = guild.members.filter((m) => m.role === 'officer').length;
    if (cnt >= OFFICER_LIMIT_PER_GUILD) return { success: false, status: 409, message: '官员已达上限' };
  }
  targetMember.role = newRole;
  const tp = ctx.players[targetUsername];
  if (tp) tp.guildRole = newRole;
  appendGuildLog(guild, { by: operatorPlayer.username, action: 'role', target: targetUsername, detail: newRole });
  return { success: true, status: 200, guild: toGuildDetail(guild, ctx.players) };
}

function transferGuild(operatorPlayer, targetUsername, ctx) {
  if (!operatorPlayer) return { success: false, status: 404, message: '角色不存在' };
  ensureGuildConsistency(operatorPlayer, ctx);
  if (!operatorPlayer.guildId) return { success: false, status: 404, message: '未加入公会' };
  const guild = ctx.meta.guilds[operatorPlayer.guildId];
  if (!guild) return { success: false, status: 404, message: '公会不存在' };
  if (!targetUsername) return { success: false, status: 400, message: '缺少 targetUsername' };
  if (targetUsername === operatorPlayer.username) return { success: false, status: 409, message: '不能转让给自己' };
  if (operatorPlayer.guildRole !== 'leader') return { success: false, status: 403, message: '仅会长可转让' };
  const targetMember = guild.members.find((m) => m.username === targetUsername);
  if (!targetMember) return { success: false, status: 404, message: '目标不在公会' };
  // 原会长降为 member
  const opMember = guild.members.find((m) => m.username === operatorPlayer.username);
  if (opMember) opMember.role = 'member';
  targetMember.role = 'leader';
  guild.leaderUsername = targetUsername;
  operatorPlayer.guildRole = 'member';
  const tp = ctx.players[targetUsername];
  if (tp) tp.guildRole = 'leader';
  appendGuildLog(guild, { by: operatorPlayer.username, action: 'transfer', target: targetUsername });
  return { success: true, status: 200, guild: toGuildDetail(guild, ctx.players) };
}

function updateAnnouncement(operatorPlayer, text, ctx) {
  if (!operatorPlayer) return { success: false, status: 404, message: '角色不存在' };
  ensureGuildConsistency(operatorPlayer, ctx);
  if (!operatorPlayer.guildId) return { success: false, status: 404, message: '未加入公会' };
  const guild = ctx.meta.guilds[operatorPlayer.guildId];
  if (!guild) return { success: false, status: 404, message: '公会不存在' };
  if (typeof text !== 'string') return { success: false, status: 400, message: '缺少 text' };
  const trimmed = text.trim();
  if (trimmed.length > 200) return { success: false, status: 400, message: '公告不能超过200字' };
  if (!GUILD_PERMS.announce.includes(operatorPlayer.guildRole)) return { success: false, status: 403, message: '无权限' };
  guild.announcement = trimmed;
  guild.announcementAt = getNow();
  guild.announcementBy = operatorPlayer.username;
  appendGuildLog(guild, { by: operatorPlayer.username, action: 'announce', detail: trimmed.slice(0, 20) });
  return { success: true, status: 200, guild: toGuildDetail(guild, ctx.players) };
}

function donate(player, donateId, ctx) {
  if (!player) return { success: false, status: 404, message: '角色不存在' };
  ensureGuildConsistency(player, ctx);
  if (!player.guildId) return { success: false, status: 409, message: '未加入公会' };
  const guild = ctx.meta.guilds[player.guildId];
  if (!guild) {
    player.guildId = null; player.guildRole = null; player.guildJoinAt = null;
    return { success: false, status: 404, message: '公会不存在' };
  }
  const opt = DONATE_OPTIONS.find((o) => o.id === donateId);
  if (!opt) return { success: false, status: 400, message: '捐献选项不存在' };
  const today = getTodayKey();
  if (!player.guildDonateDaily || player.guildDonateDaily.dayKey !== today) {
    player.guildDonateDaily = { dayKey: today, counts: {} };
  }
  const cnt = player.guildDonateDaily.counts[donateId] || 0;
  if (cnt >= opt.dailyLimit) return { success: false, status: 409, message: '今日已达上限' };
  // 资源校验
  if (opt.cost.gold) {
    if ((player.gold || 0) < opt.cost.gold) return { success: false, status: 409, message: '金币不足' };
    player.gold -= opt.cost.gold;
    guild.store.gold = (guild.store.gold || 0) + opt.cost.gold;
  } else if (opt.cost.material) {
    const need = opt.cost.count;
    const inv = player.inventory || [];
    const item = inv.find((i) => i.name === opt.cost.material);
    if (!item || (item.count || 0) < need) return { success: false, status: 409, message: '材料不足' };
    item.count -= need;
    if (item.count <= 0) {
      const idx = inv.indexOf(item);
      if (idx >= 0) inv.splice(idx, 1);
    }
    if (!guild.store.materials) guild.store.materials = {};
    guild.store.materials[opt.cost.material] = (guild.store.materials[opt.cost.material] || 0) + need;
  }
  const member = guild.members.find((m) => m.username === player.username);
  guild.exp += opt.reward.guildExp;
  if (member) member.contribution += opt.reward.contrib;
  if (!Number.isFinite(player.guildContribution)) player.guildContribution = 0;
  player.guildContribution += opt.reward.contrib;
  player.guildDonateDaily.counts[donateId] = cnt + 1;
  tryGuildLevelUp(guild, player.username);
  appendGuildLog(guild, { by: player.username, action: 'donate', detail: donateId });
  return {
    success: true,
    status: 200,
    guild: toGuildDetail(guild, ctx.players),
    viewer: toViewer(player, guild),
    reward: { guildExp: opt.reward.guildExp, contrib: opt.reward.contrib },
  };
}

function disbandGuild(operatorPlayer, ctx) {
  if (!operatorPlayer) return { success: false, status: 404, message: '角色不存在' };
  ensureGuildConsistency(operatorPlayer, ctx);
  if (!operatorPlayer.guildId) return { success: false, status: 404, message: '未加入公会' };
  const guild = ctx.meta.guilds[operatorPlayer.guildId];
  if (!guild) return { success: false, status: 404, message: '公会不存在' };
  if (operatorPlayer.guildRole !== 'leader') return { success: false, status: 403, message: '仅会长可解散' };
  appendGuildLog(guild, { by: operatorPlayer.username, action: 'disband', detail: guild.name });
  const meta = ctx.meta;
  if (!meta.guildArchive) meta.guildArchive = {};
  meta.guildArchive[guild.id] = {
    id: guild.id,
    name: guild.name,
    disbandedAt: getNow(),
    by: operatorPlayer.username,
    snapshot: JSON.parse(JSON.stringify(guild)),
    logs: [...guild.logs],
  };
  const keys = Object.keys(meta.guildArchive);
  if (keys.length > GUILD_ARCHIVE_LIMIT) {
    keys.sort((a, b) => (meta.guildArchive[a].disbandedAt || 0) - (meta.guildArchive[b].disbandedAt || 0));
    for (let i = 0; i < keys.length - GUILD_ARCHIVE_LIMIT; i++) delete meta.guildArchive[keys[i]];
  }
  for (const m of guild.members) {
    const p = ctx.players[m.username];
    if (p) { p.guildId = null; p.guildRole = null; p.guildJoinAt = null; }
  }
  delete meta.guilds[guild.id];
  delete meta.guildNameIndex[guild.name.trim().toLowerCase()];
  return { success: true, status: 200 };
}

function addGuildContribution(player, amount, source, ctx) {
  if (!player || !player.guildId) return;
  const guild = ctx.meta.guilds[player.guildId];
  if (!guild) {
    player.guildId = null; player.guildRole = null; player.guildJoinAt = null;
    return;
  }
  const member = guild.members.find((m) => m.username === player.username);
  if (!member) {
    player.guildId = null; player.guildRole = null; player.guildJoinAt = null;
    return;
  }
  guild.exp += amount;
  member.contribution += amount;
  if (!Number.isFinite(player.guildContribution)) player.guildContribution = 0;
  player.guildContribution += amount;
  tryGuildLevelUp(guild, player.username);
  appendGuildLog(guild, { by: player.username, action: `expedition`, detail: source });
}

module.exports = {
  createGuild,
  listGuilds,
  getMyGuild,
  joinGuild,
  leaveGuild,
  kickMember,
  updateRole,
  transferGuild,
  updateAnnouncement,
  donate,
  disbandGuild,
  addGuildContribution,
  ensureGuildConsistency,
  appendGuildLog,
  toGuildSummary,
  toGuildDetail,
  toViewer,
  getGuildLevel,
  getNextLevelExp,
  getGuildMaxMembers,
  syncMembersProjection,
};
