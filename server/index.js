// 服务器入口 v0.3 - 账号密码登录 + 种族进化/附魔/法则/登神
const express = require('express');
const cors = require('cors');
const store = require('./store');
const { AREAS, JOB_TREE, SHOP_ITEMS, EQUIP_TEMPLATES, QUALITY_COLORS, MATERIAL_PRICES, MONSTER_SKILLS, ENCHANT_RECIPES, RACE_EVOLUTION, LAWS, AFFIX_TREE, AFFIX_LEVELS } = require('./data');
const {
  createCharacter, calculateIdle, allocateAttributes, getPlayerView,
  chooseJob, equipItem, unequipItem, useConsumable, buyItem,
  sellMaterial, sellEquip,
  evolveRace, enchantItem, learnLaw, attemptAscension,
  equipAffix, unequipAffix,
  getPowerScore, getTotalStats, migratePlayer, getStageFull
} = require('./engine');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

store.load();

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
    createdAt: Date.now()
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
  player.lastTick = Date.now();
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
app.get('/api/leaderboard', (req, res) => {
  const type = req.query.type || 'level';
  const allowed = ['level', 'power', 'gold', 'kills', 'reincarnation', 'boss'];
  if (!allowed.includes(type)) {
    return res.json({ success: false, message: '无效的排行类型' });
  }
  const players = store.getAllPlayers().map(p => {
    migratePlayer(p);
    const power = getPowerScore(p);
    const total = getTotalStats(p);
    const stageInfo = getStageFull(p.level, p.godhood);
    return {
      username: p.username,
      name: p.name,
      race: p.race,
      level: p.level,
      exp: p.exp,
      gold: p.gold,
      killCount: p.killCount || 0,
      reincarnation: p.reincarnation || 0,
      bossKills: p.bossKills || 0,
      job: p.job,
      jobPath: p.jobPath,
      godhood: p.godhood || null,
      stage: stageInfo.name,
      stageColor: stageInfo.color,
      power,
      atk: total.atk,
      def: total.def,
      hp: total.hp,
      agi: total.agi
    };
  });

  let sorted = [];
  if (type === 'level') {
    sorted = players.sort((a, b) => b.level - a.level || b.exp - a.exp || b.gold - a.gold);
  } else if (type === 'power') {
    sorted = players.sort((a, b) => b.power - a.power);
  } else if (type === 'gold') {
    sorted = players.sort((a, b) => b.gold - a.gold);
  } else if (type === 'kills') {
    sorted = players.sort((a, b) => b.killCount - a.killCount || b.level - a.level);
  } else if (type === 'reincarnation') {
    sorted = players.sort((a, b) => b.reincarnation - a.reincarnation || b.level - a.level);
  } else if (type === 'boss') {
    sorted = players.sort((a, b) => b.bossKills - a.bossKills || b.level - a.level);
  }

  const rankedFull = sorted.map((p, idx) => ({ rank: idx + 1, ...p }));
  const ranked = rankedFull.slice(0, 100);
  // 支持查询当前用户排名（即使在100名之外）
  let myRank = null;
  const queryUser = req.query.username;
  if (queryUser) {
    myRank = rankedFull.find(p => p.username === queryUser) || null;
  }
  res.json({ success: true, data: { type, total: players.length, list: ranked, myRank } });
});

// ====== 定时任务：每5秒计算所有玩家的挂机收益 ======
setInterval(() => {
  const players = store.getAllPlayers();
  for (const player of players) {
    calculateIdle(player);
  }
  if (players.length > 0) {
    store.save();
  }
}, 5000);

setInterval(() => store.save(), 30000);

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  费兰德世界 - 挂机服务器已启动 v0.3`);
  console.log(`  API: http://localhost:${PORT}`);
  console.log(`  前端: http://localhost:3000`);
  console.log(`  系统: 账号密码/种族进化/附魔/法则/登神`);
  console.log(`========================================\n`);
});
