// 数据存储层 - 账号+角色数据
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');
let data = { accounts: {}, players: {} };
let saveTimer = null;

function load() {
  try {
    if (fs.existsSync(DB_PATH)) {
      data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('加载数据失败:', e.message);
  }
  if (!data.accounts) data.accounts = {};
  if (!data.players) data.players = {};
  if (!data.meta) data.meta = {};
  if (!data.meta.bossWeek) data.meta.bossWeek = getCurrentWeekKey();
  // 迁移旧数据：如果有 players 但没有 accounts，把旧 player 当作 account
  const playerKeys = Object.keys(data.players);
  if (playerKeys.length > 0 && Object.keys(data.accounts).length === 0) {
    for (const key of playerKeys) {
      data.accounts[key] = { username: key, password: '', hasCharacter: true, createdAt: Date.now() };
    }
  }
  console.log(`已加载 ${Object.keys(data.accounts).length} 个账号, ${Object.keys(data.players).length} 个角色`);
}

function markDirty() {
  if (!saveTimer) {
    saveTimer = setTimeout(() => { save(); saveTimer = null; }, 5000);
  }
}

function save() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('保存数据失败:', e.message);
  }
}

// 账号操作
function getAccount(username) { return data.accounts[username]; }
function setAccount(username, account) { data.accounts[username] = account; markDirty(); }
function accountExists(username) { return !!data.accounts[username]; }

// 角色操作
function getPlayer(username) { return data.players[username]; }
function setPlayer(username, player) { data.players[username] = player; markDirty(); }
function getAllPlayers() { return Object.values(data.players); }

function getCurrentWeekKey() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d - jan1) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}
function maybeResetWeeklyBossKills() {
  const cur = getCurrentWeekKey();
  if (data.meta.bossWeek !== cur) {
    let changed = false;
    for (const p of Object.values(data.players)) {
      if ((p.bossKills || 0) !== 0) { p.bossKills = 0; changed = true; }
      if ((p.bossKillsWeekly || 0) !== 0) { p.bossKillsWeekly = 0; changed = true; }
    }
    data.meta.bossWeek = cur;
    // 立即持久化，避免 GET 后文件仍为旧周
    if (changed) save();
    else markDirty();
    console.log(`BOSS榜周重置: ${cur}`);
  }
}

module.exports = { load, save, getAccount, setAccount, accountExists, getPlayer, setPlayer, getAllPlayers, maybeResetWeeklyBossKills, getCurrentWeekKey };
