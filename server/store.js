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
  // bossWeek 初始化由 engine 负责周一边界，此处仅保证存在
  if (!data.meta.bossWeek) data.meta.bossWeek = null;
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

function getMeta() { return data.meta; }
function setMeta(meta) { data.meta = meta; markDirty(); }

module.exports = { load, save, getAccount, setAccount, accountExists, getPlayer, setPlayer, getAllPlayers, getMeta, setMeta };
