// 服务器入口 v0.3 - 账号密码登录 + 种族进化/附魔/法则/登神
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const store = require('./store');
const { AREAS, JOB_TREE, SHOP_ITEMS, EQUIP_TEMPLATES, QUALITY_COLORS, MATERIAL_PRICES, MONSTER_SKILLS, ENCHANT_RECIPES, RACE_EVOLUTION, LAWS, AFFIX_TREE, AFFIX_LEVELS, STRATEGIES, STRATEGY_CD_MS, PVP_CD_MS, PVP_LEVEL_RANGE, PVP_CURRENCY_KEY, ARENA_EQUIPMENT } = require('./data');
const {
  createCharacter, calculateIdle, allocateAttributes, getPlayerView,
  chooseJob, equipItem, unequipItem, useConsumable, buyItem,
  sellMaterial, sellEquip,
  evolveRace, enchantItem, learnLaw, attemptAscension, doReincarnate,
  equipAffix, unequipAffix,
  getPowerScore, getTotalStats, getReadonlyPlayer, getStageFull,
  maybeResetWeeklyBossKills,
  claimDaily, claimChest, claimAchievement,
  updateTutorialStep,
  simulatePvP, calcPvpRating, calcPvpRewards,
  getSeasonKey, getSeasonIndex, getSeasonDaysLeft,
  getDailyKey, getWeeklyKey, getMonthlyKey,
  getRankTier,
  createBot, generateArenaBots,
  settleArenaRewards, maybeResetSeason, applySeasonResetToPlayers,
  buyArenaItem,
  autoAllocateAttributes,
  getNow
} = require('./engine');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

store.load();
// 初始化周键（周一 0 点语义）
maybeResetWeeklyBossKills(store);

// ====== 账号相关 ======

// 注册账号
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || username.trim().length < 1) {
    return res.json({ success: false, message: '请输入账号' });
  }
  if (!password || password.length < 1) {
    return res.json({ success: false, message: '请输入密码' });
  }
  if (store.accountExists(username)) {
    return res.json({ success: false, message: '账号已存在' });
  }
  store.setAccount(username, {
    username,
    password,
    hasCharacter: false,
    createdAt: getNow()
  });
  console.log(`新账号注册: ${username}`);
  res.json({ success: true, message: '注册成功' });
});

// 登录
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.json({ success: false, message: '请输入账号和密码' });
  }
  const account = store.getAccount(username);
  if (!account) {
    return res.json({ success: false, message: '账号不存在' });
  }
  if (account.password !== password) {
    return res.json({ success: false, message: '密码错误' });
  }
  // 如果已有角色，返回角色数据
  if (account.hasCharacter) {
    const player = store.getPlayer(username);
    if (player) {
      // 写入前原子切周，避免登录旁路跨周丢 bossKills
      maybeResetWeeklyBossKills(store);
      calculateIdle(player);
      store.setPlayer(username, player);
      return res.json({ success: true, hasCharacter: true, data: getPlayerView(player) });
    }
  }
  // 没有角色，返回需要创建角色
  res.json({ success: true, hasCharacter: false });
});

// 创建角色
app.post('/api/player/:username/create-character', (req, res) => {
  const { charName } = req.body;
  const username = req.params.username;
  const account = store.getAccount(username);
  if (!account) return res.json({ success: false, message: '账号不存在' });
  if (account.hasCharacter) return res.json({ success: false, message: '已有角色' });
  if (!charName || charName.trim().length < 1) {
    return res.json({ success: false, message: '请输入角色名' });
  }

  const player = createCharacter(username, charName.trim());
  store.setPlayer(username, player);
  account.hasCharacter = true;
  store.setAccount(username, account);
  console.log(`新角色创建: ${charName} (${username})`);
  res.json({ success: true, data: getPlayerView(player) });
});

// ====== 角色相关 ======

// 获取角色信息（同时计算挂机收益）
app.get('/api/player/:username', (req, res) => {
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });
  // 写入前原子切周，避免跨周丢 bossKills
  maybeResetWeeklyBossKills(store);
  calculateIdle(player);
  store.setPlayer(player.username, player);
  res.json({ success: true, data: getPlayerView(player) });
});

// 切换挂机区域
app.post('/api/player/:username/area', (req, res) => {
  const { areaId } = req.body;
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });

  const area = AREAS[areaId];
  if (!area) return res.json({ success: false, message: '区域不存在' });
  if (player.level < area.minLevel) {
    return res.json({ success: false, message: `需要 Lv.${area.minLevel} 才能进入${area.name}` });
  }

  player.currentArea = areaId;
  player.lastTick = getNow();
  store.setPlayer(player.username, player);
  res.json({ success: true, data: getPlayerView(player) });
});

// 分配属性点
app.post('/api/player/:username/attributes', (req, res) => {
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });
  const result = allocateAttributes(player, req.body);
  if (!result.success) return res.json({ success: false, message: result.message });
  store.setPlayer(player.username, player);
  res.json({ success: true, data: getPlayerView(player) });
});

// ====== 一键自动加点 ======
app.post('/api/player/:username/auto-allocate', (req, res) => {
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });
  const result = autoAllocateAttributes(player);
  if (!result.success) return res.json({ success: false, message: result.message });
  store.setPlayer(player.username, player);
  res.json({
    success: true,
    data: {
      allocated: result.allocated,
      job: result.job,
      player: getPlayerView(player)
    }
  });
});

// ====== 职业相关 ======

app.post('/api/player/:username/job', (req, res) => {
  const { jobPath } = req.body;
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });
  const result = chooseJob(player, jobPath);
  if (!result.success) return res.json({ success: false, message: result.message });
  store.setPlayer(player.username, player);
  res.json({ success: true, data: getPlayerView(player) });
});

app.get('/api/data/jobs', (req, res) => {
  res.json({ success: true, data: JOB_TREE });
});

// ====== 词条相关 ======

app.post('/api/player/:username/affix', (req, res) => {
  const { affixId, slot } = req.body;
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });
  const result = equipAffix(player, affixId, slot);
  if (!result.success) return res.json({ success: false, message: result.message });
  store.setPlayer(player.username, player);
  res.json({ success: true, data: getPlayerView(player) });
});

app.post('/api/player/:username/affix/unequip', (req, res) => {
  const { affixId } = req.body;
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });
  const result = unequipAffix(player, affixId);
  if (!result.success) return res.json({ success: false, message: result.message });
  store.setPlayer(player.username, player);
  res.json({ success: true, data: getPlayerView(player) });
});

app.get('/api/data/affixes', (req, res) => {
  res.json({ success: true, data: { levels: AFFIX_LEVELS, tree: AFFIX_TREE } });
});

// ====== 装备相关 ======

app.post('/api/player/:username/equip', (req, res) => {
  const { itemUid } = req.body;
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });
  const result = equipItem(player, itemUid);
  if (!result.success) return res.json({ success: false, message: result.message });
  store.setPlayer(player.username, player);
  res.json({ success: true, data: getPlayerView(player) });
});

app.post('/api/player/:username/unequip', (req, res) => {
  const { slot } = req.body;
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });
  const result = unequipItem(player, slot);
  if (!result.success) return res.json({ success: false, message: result.message });
  store.setPlayer(player.username, player);
  res.json({ success: true, data: getPlayerView(player) });
});

app.get('/api/data/equipments', (req, res) => {
  res.json({ success: true, data: { templates: EQUIP_TEMPLATES, colors: QUALITY_COLORS } });
});

// ====== 商店相关 ======

app.get('/api/shop', (req, res) => {
  res.json({ success: true, data: SHOP_ITEMS });
});

app.post('/api/player/:username/buy', (req, res) => {
  const { itemId, count } = req.body;
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });
  const result = buyItem(player, itemId, count || 1);
  if (!result.success) return res.json({ success: false, message: result.message });
  store.setPlayer(player.username, player);
  res.json({ success: true, data: getPlayerView(player) });
});

app.post('/api/player/:username/use', (req, res) => {
  const { itemId, count } = req.body;
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });
  const result = useConsumable(player, itemId, count || 1);
  if (!result.success) return res.json({ success: false, message: result.message });
  store.setPlayer(player.username, player);
  res.json({ success: true, data: getPlayerView(player) });
});

// ====== 出售相关 ======

app.post('/api/player/:username/sell-material', (req, res) => {
  const { itemName, count } = req.body;
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });
  const result = sellMaterial(player, itemName, count || 1);
  if (!result.success) return res.json({ success: false, message: result.message });
  store.setPlayer(player.username, player);
  res.json({ success: true, data: getPlayerView(player) });
});

app.post('/api/player/:username/sell-equip', (req, res) => {
  const { itemUid } = req.body;
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });
  const result = sellEquip(player, itemUid);
  if (!result.success) return res.json({ success: false, message: result.message });
  store.setPlayer(player.username, player);
  res.json({ success: true, data: getPlayerView(player) });
});

// ====== 区域相关 ======

app.get('/api/areas', (req, res) => {
  const areas = Object.values(AREAS).map(a => ({
    id: a.id, name: a.name, desc: a.desc, minLevel: a.minLevel,
    monsters: a.monsters.map(m => m.name),
    drops: a.drops.map(d => d.type === 'equip' ? `${EQUIP_TEMPLATES[d.template]?.name || d.template}` : d.name)
  }));
  res.json({ success: true, data: areas });
});

// ====== 种族进化 ======
app.post('/api/player/:username/evolve', (req, res) => {
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });
  const result = evolveRace(player);
  if (!result.success) return res.json({ success: false, message: result.message });
  store.setPlayer(player.username, player);
  res.json({ success: true, data: getPlayerView(player) });
});

// ====== 附魔装备 ======
app.post('/api/player/:username/enchant', (req, res) => {
  const { itemUid, recipeId } = req.body;
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });
  const result = enchantItem(player, itemUid, recipeId);
  if (!result.success) return res.json({ success: false, message: result.message });
  store.setPlayer(player.username, player);
  res.json({ success: true, data: getPlayerView(player) });
});

// ====== 学习法则 ======
app.post('/api/player/:username/learn-law', (req, res) => {
  const { lawId } = req.body;
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });
  const result = learnLaw(player, lawId);
  if (!result.success) return res.json({ success: false, message: result.message });
  store.setPlayer(player.username, player);
  res.json({ success: true, data: getPlayerView(player) });
});

// ====== 登神 ======
app.post('/api/player/:username/ascend', (req, res) => {
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });
  const result = attemptAscension(player);
  if (!result.success) return res.json({ success: false, message: result.message });
  store.setPlayer(player.username, player);
  res.json({ success: true, data: getPlayerView(player) });
});

// ====== 图鉴 ======
app.get('/api/codex', (req, res) => {
  // 构建材料来源映射
  const materialSources = {}; // name -> [{ area, rate }]
  const equipSources = {};    // templateId -> [{ area, rate }]

  for (const area of Object.values(AREAS)) {
    for (const drop of area.drops) {
      if (drop.type === 'material') {
        if (!materialSources[drop.name]) materialSources[drop.name] = [];
        materialSources[drop.name].push({ area: area.id, areaName: area.name, rate: drop.rate });
      } else if (drop.type === 'equip') {
        if (!equipSources[drop.template]) equipSources[drop.template] = [];
        equipSources[drop.template].push({ area: area.id, areaName: area.name, rate: drop.rate });
      }
    }
  }

  // 材料用途映射
  const materialUses = {}; // name -> [use descriptions]
  for (const recipe of ENCHANT_RECIPES) {
    for (const mat of recipe.materials) {
      if (!materialUses[mat.name]) materialUses[mat.name] = [];
      materialUses[mat.name].push(`${recipe.name} (${recipe.desc})`);
    }
  }
  // 种族进化材料用途
  for (const race of Object.values(RACE_EVOLUTION)) {
    if (race.reqMaterial) {
      if (!materialUses[race.reqMaterial.name]) materialUses[race.reqMaterial.name] = [];
      materialUses[race.reqMaterial.name].push(`种族进化: ${race.name}`);
    }
  }
  // 法则材料用途
  for (const law of LAWS) {
    if (law.cost) {
      if (!materialUses[law.cost.name]) materialUses[law.cost.name] = [];
      materialUses[law.cost.name].push(`学习法则: ${law.name}`);
    }
  }

  // 构建材料列表
  const materials = Object.keys(MATERIAL_PRICES).map(name => ({
    name,
    price: MATERIAL_PRICES[name],
    sources: materialSources[name] || [],
    uses: materialUses[name] || []
  }));

  // 构建装备列表
  const equips = Object.entries(EQUIP_TEMPLATES).map(([templateId, t]) => ({
    templateId,
    name: t.name,
    slot: t.slot,
    quality: t.quality,
    reqLevel: t.reqLevel,
    stats: t.stats,
    sources: equipSources[templateId] || [],
    shopPrice: SHOP_ITEMS.find(s => s.id === templateId)?.price || null
  }));

  // 消耗品列表
  const consumables = SHOP_ITEMS.filter(s => s.type === 'consumable');

  // 怪物列表（含技能详情）
  const monsters = [];
  for (const area of Object.values(AREAS)) {
    for (const mo of area.monsters) {
      monsters.push({
        name: mo.name,
        area: area.id,
        areaName: area.name,
        areaLevel: area.minLevel,
        hp: mo.hp,
        atk: mo.atk,
        def: mo.def,
        agi: mo.agi,
        exp: mo.exp,
        gold: mo.gold,
        skills: mo.skills || [],
        skillDetails: (mo.skills || []).map(skId => MONSTER_SKILLS[skId]).filter(Boolean)
      });
    }
  }

  res.json({ success: true, data: { materials, equips, consumables, monsters } });
});

// ====== 排行榜 ======
// 榜单配置：单一数据源，避免多处 switch 重复
const LEADERBOARD_CONFIG = {
  level: { sort: (a, b) => b.level - a.level || b.exp - a.exp || b.gold - a.gold },
  power: { sort: (a, b) => b.power - a.power },
  gold: { sort: (a, b) => b.gold - a.gold },
  kills: { sort: (a, b) => b.killCount - a.killCount || b.level - a.level },
  reincarnation: { sort: (a, b) => b.reincarnation - a.reincarnation || b.level - a.level },
  boss: { sort: (a, b) => b.bossKills - a.bossKills || b.level - a.level }
};
app.get('/api/leaderboard', (req, res) => {
  const type = req.query.type || 'level';
  if (!LEADERBOARD_CONFIG[type]) {
    return res.json({ success: false, message: '无效的排行类型' });
  }
  // GET 保持无副作用：周重置由后台定时任务与写入前原子切周负责
  const players = store.getAllPlayers().map(p => {
    const rp = getReadonlyPlayer(p);
    const power = getPowerScore(rp);
    const total = getTotalStats(rp);
    const stageInfo = getStageFull(rp.level, rp.godhood);
    return {
      username: rp.username,
      name: rp.name,
      race: rp.race,
      level: rp.level,
      exp: rp.exp,
      gold: rp.gold,
      killCount: rp.killCount || 0,
      reincarnation: rp.reincarnation || 0,
      bossKills: rp.bossKills || 0,
      job: rp.job,
      jobPath: rp.jobPath,
      godhood: rp.godhood || null,
      stage: stageInfo.name,
      stageColor: stageInfo.color,
      power,
      atk: total.atk,
      def: total.def,
      hp: total.hp,
      agi: total.agi
    };
  });

  const sorted = [...players].sort(LEADERBOARD_CONFIG[type].sort);
  const rankedFull = sorted.map((p, idx) => ({ rank: idx + 1, ...p }));
  const ranked = rankedFull.slice(0, 100);
  let myRank = null;
  const queryUser = req.query.username;
  if (queryUser) {
    myRank = rankedFull.find(p => p.username === queryUser) || null;
  }
  res.json({ success: true, data: { type, total: players.length, list: ranked, myRank } });
});

// ====== PVP 竞技场 ======

// 获取对手列表（动态生成 3 个 Bot）
app.get('/api/arena/opponents/:username', (req, res) => {
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });

  const myLevel = player.level || 1;
  const myRating = (player.pvpStats && player.pvpStats.rating) || 1000;

  // 动态生成 3 个 Bot（±5 等级内）
  const bots = generateArenaBots(myLevel, myRating);

  // 同时混入真实玩家（如果有同等级的其他玩家）
  const allPlayers = store.getAllPlayers();
  const realOpponents = allPlayers
    .filter(p => p.username !== player.username && p.level)
    .filter(p => Math.abs((p.level || 1) - myLevel) <= PVP_LEVEL_RANGE)
    .map(p => {
      const rp = getReadonlyPlayer(p);
      const power = getPowerScore(rp);
      return {
        username: rp.username,
        name: rp.name,
        level: rp.level,
        race: rp.race,
        job: rp.job || '无',
        godhood: rp.godhood || null,
        power,
        pvpRating: (rp.pvpStats && rp.pvpStats.rating) || 1000,
        pvpWins: (rp.pvpStats && rp.pvpStats.wins) || 0,
        pvpLosses: (rp.pvpStats && rp.pvpStats.losses) || 0,
        isBot: false
      };
    });

  // Bot 视图
  const botOpponents = bots.map(b => ({
    username: b.username,
    name: b.name,
    level: b.level,
    race: b.race,
    job: b.job || '无',
    godhood: b.godhood || null,
    power: getPowerScore(b),
    pvpRating: b.pvpStats.rating,
    pvpWins: 0,
    pvpLosses: 0,
    isBot: true,
    activeAffix: b.affixes?.active || null,
    passiveCount: (b.affixes?.passive || []).length
  }));

  // 合并：Bot 优先 + 真实玩家
  const opponents = [...botOpponents, ...realOpponents]
    .sort((a, b) => Math.abs(a.level - myLevel) - Math.abs(b.level - myLevel))
    .slice(0, 10);

  const cdRemaining = player.pvpStats && player.pvpStats.lastPvpAt
    ? Math.max(0, PVP_CD_MS - (getNow() - player.pvpStats.lastPvpAt))
    : 0;

  res.json({
    success: true,
    data: {
      opponents,
      bots: botOpponents, // 单独的 Bot 列表
      myRating,
      myWins: (player.pvpStats && player.pvpStats.wins) || 0,
      myLosses: (player.pvpStats && player.pvpStats.losses) || 0,
      myStreak: (player.pvpStats && player.pvpStats.streak) || 0,
      myBestStreak: (player.pvpStats && player.pvpStats.bestStreak) || 0,
      arenaCoins: player[PVP_CURRENCY_KEY] || 0,
      cdRemaining
    }
  });
});

// 挑战对手（Bot 或真实玩家）
app.post('/api/arena/challenge', (req, res) => {
  const { username, targetUsername, isBot } = req.body;
  if (!username || !targetUsername) {
    return res.json({ success: false, message: '缺少参数' });
  }
  if (username === targetUsername) {
    return res.json({ success: false, message: '不能挑战自己' });
  }

  const player = store.getPlayer(username);
  if (!player) return res.json({ success: false, message: '角色不存在' });

  // 冷却检查
  const lastPvp = (player.pvpStats && player.pvpStats.lastPvpAt) || 0;
  const cdRemaining = lastPvp ? Math.max(0, PVP_CD_MS - (getNow() - lastPvp)) : 0;
  if (cdRemaining > 0) {
    return res.json({ success: false, message: `冷却中，还需 ${Math.ceil(cdRemaining / 1000)} 秒` });
  }

  let target;
  let botRecord = null;

  if (isBot) {
    // Bot 模式：动态生成 Bot 进行战斗
    const myLevel = player.level || 1;
    const myRating = (player.pvpStats && player.pvpStats.rating) || 1000;
    const rating = myRating + Math.floor(Math.random() * 200) - 50;
    const bots = generateArenaBots(myLevel, Math.max(800, rating));
    // 找到 username 匹配的 Bot（client 传回的 bot username）
    target = bots.find(b => b.username === targetUsername) || bots[0];
    botRecord = { username: target.username, name: target.name, level: target.level, rating: target.pvpStats.rating };
  } else {
    target = store.getPlayer(targetUsername);
    if (!target) return res.json({ success: false, message: '对手不存在' });
  }

  // 等级差检查
  const levelDiff = Math.abs((player.level || 1) - (target.level || 1));
  if (levelDiff > PVP_LEVEL_RANGE) {
    return res.json({ success: false, message: `等级差超过 ${PVP_LEVEL_RANGE} 级，无法挑战` });
  }

  // 模拟 PVP 战斗
  const battle = simulatePvP(player, target);
  const isWin = battle.result === 'win';

  // ELO 积分变化
  const myRating = (player.pvpStats && player.pvpStats.rating) || 1000;
  const enemyRating = (target.pvpStats && target.pvpStats.rating) || 1000;
  const ratingResult = calcPvpRating(myRating, enemyRating, isWin);

  // 更新攻击者 PVP 统计
  if (!player.pvpStats) player.pvpStats = {};
  player.pvpStats.rating = ratingResult.newRating;
  player.pvpStats.lastPvpAt = getNow();
  if (isWin) {
    player.pvpStats.wins = (player.pvpStats.wins || 0) + 1;
    player.pvpStats.streak = (player.pvpStats.streak || 0) + 1;
    if (player.pvpStats.streak > (player.pvpStats.bestStreak || 0)) {
      player.pvpStats.bestStreak = player.pvpStats.streak;
    }
  } else {
    player.pvpStats.losses = (player.pvpStats.losses || 0) + 1;
    player.pvpStats.streak = 0;
  }

  // 奖励（基础奖励）
  const baseRewards = calcPvpRewards(player.level || 1, isWin, player.pvpStats.streak || 0);
  player.gold = (player.gold || 0) + baseRewards.gold;
  player.exp = (player.exp || 0) + baseRewards.exp;

  // 胜利额外竞技币（10 基础 + 等级×1 + 连胜奖励）
  let coinsEarned = 0;
  if (isWin) {
    const streakBonus = Math.min(player.pvpStats.streak || 0, 5);
    coinsEarned = 10 + (player.level || 1) + streakBonus * 5;
    player[PVP_CURRENCY_KEY] = (player[PVP_CURRENCY_KEY] || 0) + coinsEarned;
  } else {
    coinsEarned = 2;
    player[PVP_CURRENCY_KEY] = (player[PVP_CURRENCY_KEY] || 0) + coinsEarned;
  }

  // 战斗记录（Bot 也写记录，但不写被挑战者）
  const meta = store.getMeta();
  if (!Array.isArray(meta.pvpRecords)) meta.pvpRecords = [];
  meta.pvpRecords.unshift({
    time: getNow(),
    attacker: username,
    defender: targetUsername,
    attackerName: player.name,
    defenderName: target.name || target.username,
    result: isWin ? 'win' : 'lose',
    ratingChange: ratingResult.change,
    rewards: { ...baseRewards, coins: coinsEarned },
    isBot: !!isBot
  });
  if (meta.pvpRecords.length > 200) meta.pvpRecords = meta.pvpRecords.slice(0, 200);
  store.setMeta(meta);

  // 日志
  player.logs = player.logs || [];
  player.logs.push({
    time: getNow(),
    type: 'pvp',
    text: isWin
      ? `竞技场胜利！击败了 ${target.name || target.username}，+${baseRewards.gold}金币 +${baseRewards.exp}经验 +${coinsEarned}竞技币`
      : `竞技场失败...被 ${target.name || target.username} 击败，+${coinsEarned}竞技币`
  });

  // 只写攻击者（Bot 不持久化）
  store.setPlayer(player.username, player);
  store.save();

  res.json({
    success: true,
    data: {
      battle,
      isWin,
      rewards: { ...baseRewards, coins: coinsEarned },
      ratingChange: ratingResult.change,
      newRating: player.pvpStats.rating,
      arenaCoins: player[PVP_CURRENCY_KEY] || 0,
      targetName: target.name || target.username,
      targetLevel: target.level,
      player: getPlayerView(player)
    }
  });
});

// PVP 排行榜
app.get('/api/arena/ranking', (req, res) => {
  const players = store.getAllPlayers()
    .filter(p => p.level)
    .map(p => {
      const rp = getReadonlyPlayer(p);
      const stats = rp.pvpStats || {};
      return {
        username: rp.username,
        name: rp.name,
        level: rp.level,
        race: rp.race,
        job: rp.job || '无',
        godhood: rp.godhood || null,
        rating: stats.rating || 1000,
        wins: stats.wins || 0,
        losses: stats.losses || 0,
        bestStreak: stats.bestStreak || 0,
        winRate: (stats.wins || 0) + (stats.losses || 0) > 0
          ? Math.round((stats.wins || 0) / ((stats.wins || 0) + (stats.losses || 0)) * 100)
          : 0
      };
    })
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 50)
    .map((p, i) => ({ rank: i + 1, ...p }));

  res.json({ success: true, data: { list: players } });
});

// PVP 战斗记录
app.get('/api/arena/records/:username', (req, res) => {
  const meta = store.getMeta();
  const records = (meta.pvpRecords || [])
    .filter(r => r.attacker === req.params.username || r.defender === req.params.username)
    .slice(0, 20);

  res.json({ success: true, data: { records } });
});

// ====== 竞技场商店 ======

// 获取商店物品列表（按等级分组）
app.get('/api/arena/shop', (req, res) => {
  const grouped = {};
  for (const item of ARENA_EQUIPMENT) {
    if (!grouped[item.reqLevel]) grouped[item.reqLevel] = [];
    grouped[item.reqLevel].push(item);
  }
  res.json({ success: true, data: { items: ARENA_EQUIPMENT, grouped } });
});

// 购买竞技场装备
app.post('/api/arena/buy', (req, res) => {
  const { username, itemId } = req.body;
  if (!username || !itemId) {
    return res.json({ success: false, message: '缺少参数' });
  }
  const player = store.getPlayer(username);
  if (!player) return res.json({ success: false, message: '角色不存在' });

  const result = buyArenaItem(player, itemId);
  if (!result.success) return res.json(result);

  store.setPlayer(username, player);
  store.save();

  res.json({
    success: true,
    data: {
      item: result.item,
      arenaCoins: player[PVP_CURRENCY_KEY] || 0,
      player: getPlayerView(player)
    }
  });
});

// ====== 赛季信息与奖励 ======

// 获取赛季信息
app.get('/api/arena/season', (req, res) => {
  const meta = store.getMeta();
  const currentSeason = getSeasonKey();
  const seasonIdx = getSeasonIndex();

  // 确保 meta 上有赛季字段
  if (!meta.currentSeason) meta.currentSeason = currentSeason;
  // 检查是否需要跨赛季重置（同步在后台任务中执行，这里也兜底一次）
  const reset = maybeResetSeason(meta);
  if (reset.reset) {
    applySeasonResetToPlayers(store);
    store.save();
  }

  // 当前周期的"昨日/上周/上月"奖励是否已发（用于UI显示"未领取"等）
  const dailyKey = getDailyKey();
  const yesterday = new Date(getNow() - 24 * 60 * 60 * 1000);
  const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  res.json({
    success: true,
    data: {
      currentSeason,
      seasonIdx,
      daysLeft: getSeasonDaysLeft(),
      monthsPerSeason: 3,
      arenaCoins: store.getPlayer(req.query.username || '')?.[PVP_CURRENCY_KEY] || 0,
      lastResetFrom: meta.lastResetFrom || null,
      lastResetAt: meta.lastResetAt || null
    }
  });
});

// 获取当前周期的奖励快照（用于UI显示"你的当前排名可能获奖金"）
app.get('/api/arena/rewards/:period', (req, res) => {
  const period = req.params.period;
  if (!['daily', 'weekly', 'monthly'].includes(period)) {
    return res.json({ success: false, message: '无效的奖励周期' });
  }
  const meta = store.getMeta();
  const rankingList = store.getAllPlayers()
    .filter(p => p.level)
    .map(p => {
      const rp = getReadonlyPlayer(p);
      return { username: rp.username, rating: (rp.pvpStats && rp.pvpStats.rating) || 1000 };
    })
    .sort((a, b) => b.rating - a.rating);

  const top100 = rankingList.slice(0, 100);
  const rewardMap = {};
  for (let i = 0; i < top100.length; i++) {
    const rank = i + 1;
    const tier = getRankTier(period, rank);
    if (tier) rewardMap[top100[i].username] = { rank, tier: tier.tier, coins: tier.coins };
  }

  // 当前周期的 key
  const periodKey = period === 'daily' ? getDailyKey()
    : period === 'weekly' ? getWeeklyKey()
    : getMonthlyKey();
  const settled = (meta.arenaRewards && meta.arenaRewards[period] && meta.arenaRewards[period][periodKey]) || null;

  res.json({
    success: true,
    data: {
      period,
      periodKey,
      ranking: top100,
      myReward: req.query.username ? rewardMap[req.query.username] : null,
      rewardMap,
      settled: !!settled,
      settledRewards: settled,
      rules: {
        S: '1 名 · 1/2-3/4-10/11-20/21-50/51-100',
        tiers: { S: '1', A: '2-3', B: '4-10', C: '11-20', D: '21-50', E: '51-100' }
      }
    }
  });
});

// 手动触发一次周期结算（管理/调试用，前端也可调）
app.post('/api/arena/settle', (req, res) => {
  const { period } = req.body;
  if (!['daily', 'weekly', 'monthly'].includes(period)) {
    return res.json({ success: false, message: '无效的奖励周期' });
  }
  const meta = store.getMeta();
  const rankingList = store.getAllPlayers()
    .filter(p => p.level)
    .map(p => {
      const rp = getReadonlyPlayer(p);
      return { username: rp.username, rating: (rp.pvpStats && rp.pvpStats.rating) || 1000 };
    })
    .sort((a, b) => b.rating - a.rating);

  const result = settleArenaRewards(meta, period, rankingList);
  if (result.already) {
    return res.json({ success: true, data: { already: true, key: result.key } });
  }

  // 自动入账竞技币（每个获奖玩家）
  let credited = 0;
  for (const [username, info] of Object.entries(result.rewards)) {
    const p = store.getPlayer(username);
    if (!p) continue;
    p[PVP_CURRENCY_KEY] = (p[PVP_CURRENCY_KEY] || 0) + info.coins;
    p.logs = p.logs || [];
    p.logs.push({
      time: getNow(),
      type: 'arena-reward',
      text: `【${period === 'daily' ? '日结' : period === 'weekly' ? '周结' : '月结'}奖励】${info.tier} 级 (第 ${info.rank} 名) +${info.coins} 竞技币`
    });
    store.setPlayer(username, p);
    credited++;
  }
  store.setMeta(meta);
  store.save();

  res.json({ success: true, data: { ...result, creditedCount: credited } });
});

// ====== 转生（为转生榜提供真实写入；完整 T-010 落地前为最小可用） ======
app.post('/api/player/:username/reincarnate', (req, res) => {
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });
  const result = doReincarnate(player);
  if (!result.success) return res.json({ success: false, message: result.message });
  store.setPlayer(player.username, player);
  res.json({ success: true, data: getPlayerView(player) });
});

// ====== 战斗策略 ======
app.post('/api/player/:username/strategy', (req, res) => {
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });
  const { strategy } = req.body;

  // A — 无副作用校验（必须在任何迁移/写盘前，避免 __proto__ 等非法请求污染存档）
  if (typeof strategy !== 'string' || !Object.hasOwn(STRATEGIES, strategy)) {
    return res.json({ success: false, message: '策略不存在' });
  }
  // 计算迁移后有效值（不原地修改），用于幂等与 CD 判断，确保任意 A 失败无副作用
  const { migratePlayer } = require('./engine');
  const effStrategy = (typeof player.strategy === 'string' && Object.hasOwn(STRATEGIES, player.strategy)) ? player.strategy : 'balanced';
  const effChangedAt = Number.isFinite(player.strategyChangedAt) ? player.strategyChangedAt : 0;
  // 幂等：同策略直接成功，绕过等级与 CD；若需迁移则落盘
  if (strategy === effStrategy) {
    const beforeS = player.strategy, beforeC = player.strategyChangedAt;
    migratePlayer(player);
    const migrated = (beforeS !== player.strategy) || (beforeC !== player.strategyChangedAt);
    if (migrated) { store.setPlayer(player.username, player); store.save(); }
    return res.json({ success: true, data: getPlayerView(player) });
  }
  if (effChangedAt !== 0 && getNow() - effChangedAt < STRATEGY_CD_MS) {
    const remain = Math.ceil((STRATEGY_CD_MS - (getNow() - effChangedAt)) / 1000);
    return res.json({ success: false, message: `策略切换冷却中，剩余${remain}s` });
  }
  // 全部 A 通过后再原地迁移（旧存档缺失字段、背包清理等），进入 B
  migratePlayer(player);

  // B — 旧策略结算（按旧 strategy）
  maybeResetWeeklyBossKills(store);
  const result = calculateIdle(player);
  // C — 等级复核（以结算后等级为准）
  if (player.level < STRATEGIES[strategy].reqLevel) {
    // 保留 B 的结算结果并落盘
    store.setPlayer(player.username, player);
    // 关窗：若 B 无收益，显式推进 lastTick 避免 <3s 窗口追溯
    if (result === null) {
      player.lastTick = getNow();
      store.setPlayer(player.username, player);
    }
    store.save();
    return res.json({ success: false, message: `需要 Lv.${STRATEGIES[strategy].reqLevel} 才能使用该策略`, data: getPlayerView(player) });
  }

  // C2 — 写入新策略
  const old = player.strategy;
  player.strategy = strategy;
  player.strategyChangedAt = getNow();
  // 关窗：若 B 无收益，显式推进
  if (result === null) {
    player.lastTick = getNow();
  }
  player.logs.push({
    time: getNow(),
    type: 'strategy',
    from: old,
    to: strategy,
    strategy,
    text: `策略切换：${STRATEGIES[old].name}→${STRATEGIES[strategy].name}`
  });
  if (player.logs.length > 30) player.logs = player.logs.slice(-30);
  store.setPlayer(player.username, player);
  store.save();
  res.json({ success: true, data: getPlayerView(player) });
});

// ====== 任务/委托 ======
app.post('/api/player/:username/quest/daily/:id/claim', (req, res) => {
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });
  const result = claimDaily(player, req.params.id);
  if (!result.success) return res.status(result.status).json({ success: false, message: result.message });
  store.setPlayer(player.username, player);
  res.json({ success: true, data: getPlayerView(player) });
});
app.post('/api/player/:username/quest/chest/claim', (req, res) => {
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });
  const result = claimChest(player);
  if (!result.success) return res.status(result.status).json({ success: false, message: result.message });
  store.setPlayer(player.username, player);
  res.json({ success: true, data: getPlayerView(player) });
});
app.post('/api/player/:username/quest/achievement/:id/claim', (req, res) => {
  const player = store.getPlayer(req.params.username);
  if (!player) return res.json({ success: false, message: '角色不存在' });
  const result = claimAchievement(player, req.params.id);
  if (!result.success) return res.status(result.status).json({ success: false, message: result.message });
  store.setPlayer(player.username, player);
  res.json({ success: true, data: getPlayerView(player) });
});
app.post('/api/player/:username/tutorial', (req, res) => {
  const player = store.getPlayer(req.params.username);
  if (!player) return res.status(404).json({ success: false, message: '角色不存在' });
  const step = req.body && req.body.step;
  const result = updateTutorialStep(player, step);
  if (!result.success) return res.status(result.status).json({ success: false, message: result.message });
  store.setPlayer(player.username, player);
  res.json({ success: true, data: result.data });
});

// BOSS 榜仅由权威战斗结算写入（engine.calculateIdle 判定 isBoss），不再提供公开计数入口，避免伪造

// ====== 定时任务（仅主进程，避免测试挂起） ======
if (require.main === module) {
  setInterval(() => {
    // 跨周不丢数据：写入前原子切周（全局）
    maybeResetWeeklyBossKills(store);
    const players = store.getAllPlayers();
    for (const player of players) {
      calculateIdle(player);
    }
    if (players.length > 0) {
      store.save();
    }
  }, 5000);

  // ====== 后台周重置（兜底，避免 GET 需副作用） ======
  setInterval(() => maybeResetWeeklyBossKills(store), 60 * 1000);

  setInterval(() => store.save(), 30000);

  // ====== 竞技场周期结算（每分钟检查一次日/周/月边界） ======
  // 仅在跨过周期边界的分钟才执行结算
  let lastDailyKey = getDailyKey();
  let lastWeeklyKey = getWeeklyKey();
  let lastMonthlyKey = getMonthlyKey();
  let lastSeasonKey = getSeasonKey();

  function tryAutoSettle() {
    const meta = store.getMeta();
    const curSeason = getSeasonKey();
    if (curSeason !== lastSeasonKey) {
      const resetInfo = maybeResetSeason(meta);
      if (resetInfo.reset) {
        applySeasonResetToPlayers(store);
        console.log(`[赛季重置] ${resetInfo.from} → ${resetInfo.to}`);
      }
      lastSeasonKey = curSeason;
      store.setMeta(meta);
      store.save();
    }

    const curDaily = getDailyKey();
    if (curDaily !== lastDailyKey) {
      const ranking = store.getAllPlayers()
        .filter(p => p.level)
        .map(p => ({ username: p.username, rating: (p.pvpStats && p.pvpStats.rating) || 1000 }))
        .sort((a, b) => b.rating - a.rating);
      const r = settleArenaRewards(meta, 'daily', ranking);
      if (r.rewarded > 0) {
        for (const [username, info] of Object.entries(r.rewards)) {
          const p = store.getPlayer(username);
          if (!p) continue;
          p[PVP_CURRENCY_KEY] = (p[PVP_CURRENCY_KEY] || 0) + info.coins;
          p.logs = p.logs || [];
          p.logs.push({ time: getNow(), type: 'arena-reward', text: `【日结奖励】${info.tier}级 (第 ${info.rank} 名) +${info.coins} 竞技币` });
          store.setPlayer(username, p);
        }
        console.log(`[竞技场日结] ${r.rewarded} 人获奖金 (${curDaily})`);
      }
      lastDailyKey = curDaily;
      store.setMeta(meta);
      store.save();
    }

    const curWeekly = getWeeklyKey();
    if (curWeekly !== lastWeeklyKey) {
      const ranking = store.getAllPlayers()
        .filter(p => p.level)
        .map(p => ({ username: p.username, rating: (p.pvpStats && p.pvpStats.rating) || 1000 }))
        .sort((a, b) => b.rating - a.rating);
      const r = settleArenaRewards(meta, 'weekly', ranking);
      if (r.rewarded > 0) {
        for (const [username, info] of Object.entries(r.rewards)) {
          const p = store.getPlayer(username);
          if (!p) continue;
          p[PVP_CURRENCY_KEY] = (p[PVP_CURRENCY_KEY] || 0) + info.coins;
          p.logs = p.logs || [];
          p.logs.push({ time: getNow(), type: 'arena-reward', text: `【周结奖励】${info.tier}级 (第 ${info.rank} 名) +${info.coins} 竞技币` });
          store.setPlayer(username, p);
        }
        console.log(`[竞技场周结] ${r.rewarded} 人获奖金 (${curWeekly})`);
      }
      lastWeeklyKey = curWeekly;
      store.setMeta(meta);
      store.save();
    }

    const curMonthly = getMonthlyKey();
    if (curMonthly !== lastMonthlyKey) {
      const ranking = store.getAllPlayers()
        .filter(p => p.level)
        .map(p => ({ username: p.username, rating: (p.pvpStats && p.pvpStats.rating) || 1000 }))
        .sort((a, b) => b.rating - a.rating);
      const r = settleArenaRewards(meta, 'monthly', ranking);
      if (r.rewarded > 0) {
        for (const [username, info] of Object.entries(r.rewards)) {
          const p = store.getPlayer(username);
          if (!p) continue;
          p[PVP_CURRENCY_KEY] = (p[PVP_CURRENCY_KEY] || 0) + info.coins;
          p.logs = p.logs || [];
          p.logs.push({ time: getNow(), type: 'arena-reward', text: `【月结奖励】${info.tier}级 (第 ${info.rank} 名) +${info.coins} 竞技币` });
          store.setPlayer(username, p);
        }
        console.log(`[竞技场月结] ${r.rewarded} 人获奖金 (${curMonthly})`);
      }
      lastMonthlyKey = curMonthly;
      store.setMeta(meta);
      store.save();
    }
  }
  setInterval(tryAutoSettle, 60 * 1000); // 每分钟检查一次

  // ====== 生产模式：托管前端构建产物 ======
  const distPath = path.join(__dirname, '..', 'client', 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
    console.log(`  静态文件: ${distPath}`);
  }

  const HOST = process.env.HOST || '0.0.0.0';
  app.listen(PORT, HOST, () => {
    console.log(`\n========================================`);
    console.log(`  费兰德世界 - 挂机服务器已启动 v0.3`);
    console.log(`  访问: http://localhost:${PORT}`);
    console.log(`  监听: ${HOST}:${PORT}`);
    console.log(`  系统: 账号密码/种族进化/附魔/法则/登神`);
    console.log(`========================================\n`);
  });
}
module.exports = app;
