// 数据存储层 - 账号+角色数据
const fs = require('fs');
const path = require('path');

let DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db.json');
let data = { accounts: {}, players: {} };
let saveTimer = null;
let _disableSave = false;
function __setDisableSave(v){ _disableSave = v; if(v && saveTimer){ clearTimeout(saveTimer); saveTimer=null; } }
function __setDbPath(p){ DB_PATH = p; }
function __resetStore(){ data = { accounts: {}, players: {}, meta: {} }; if(saveTimer){ clearTimeout(saveTimer); saveTimer=null; } }

function load() {
  try {
    if (fs.existsSync(DB_PATH)) {
      data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }
  } catch (e) {
    // 主存档损坏（多为写盘中途断电/崩溃导致的截断 JSON），尝试从备份恢复
    console.error('主存档损坏:', e.message);
    const bakPath = DB_PATH + '.bak';
    if (fs.existsSync(bakPath)) {
      try {
        data = JSON.parse(fs.readFileSync(bakPath, 'utf-8'));
        console.error('已从备份恢复:', bakPath);
      } catch (e2) {
        console.error('备份也损坏，使用空数据启动:', e2.message);
      }
    } else {
      console.error('无可用备份，使用空数据启动');
    }
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
  if (_disableSave) return;
  if (!saveTimer) {
    saveTimer = setTimeout(() => { save(); saveTimer = null; }, 5000);
  }
}

let _lastBakAt = 0;
function save() {
  if (_disableSave) return;
  const tmpPath = DB_PATH + '.tmp';
  try {
    // 原子写：先写临时文件，成功后整体改名替换，杜绝写盘中途崩溃产生截断 JSON
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    // 每小时滚动一次 .bak 备份（主档损坏时最多损失 1 小时进度）
    const nowMs = Date.now();
    if (fs.existsSync(DB_PATH) && nowMs - _lastBakAt > 60 * 60 * 1000) {
      fs.copyFileSync(DB_PATH, DB_PATH + '.bak');
      _lastBakAt = nowMs;
    }
    fs.renameSync(tmpPath, DB_PATH);
  } catch (e) {
    console.error('保存数据失败:', e.message);
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
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

module.exports = { load, save, getAccount, setAccount, accountExists, getPlayer, setPlayer, getAllPlayers, getMeta, setMeta, __setDisableSave, __setDbPath, __resetStore };
