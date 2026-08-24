// ====== 创世引擎 ======
// @file engine/genesis
// @module engine-genesis
// @description 二转解锁的"创世之书"核心逻辑：捏怪物、造装备、删除、
//              同步进 meta.genesis（全局），并把自创装备注册到装备模板表。

const {
  AREAS, GENESIS_RACES, COMMON_SKILLS, MAX_MONSTER_SKILLS, MAX_MONSTER_DROPS,
  EQUIP_SLOTS, EQUIP_STAT_KEYS, MAX_EQUIP_STATS, GENESIS_EQUIP_QUALITY, LIMITS,
  getMonsterBudget, getEquipBudget, listAllMonsterBudgets, listAllEquipBudgets,
  oracleText,
} = require('../data/genesis');
const { EQUIP_TEMPLATES, registerCustomEquip, unregisterCustomEquip } = require('../data/equipment');
const { AFFIX_TREE } = require('../data/affixes');
const { genUid } = require('./utils');
const { migratePlayer } = require('./player');

// 工具：从 meta 取出创世世界（不存在的兜底初始化）
function getWorld(meta) {
  if (!meta) meta = {};
  if (!meta.genesis || typeof meta.genesis !== 'object') {
    meta.genesis = { monsters: [], equips: [] };
  }
  if (!Array.isArray(meta.genesis.monsters)) meta.genesis.monsters = [];
  if (!Array.isArray(meta.genesis.equips))   meta.genesis.equips   = [];
  return meta.genesis;
}

// 工具：玩家是否二转
function isUnlocked(player) {
  return (player?.reincarnation || 0) >= 2;
}

// 工具：给玩家所属自创项计数
function countOf(player, kind) {
  const w = getWorld(_getMeta());
  return w[kind].filter(x => x.creator === player.username).length;
}

// meta 注入（由 engine.setStore 装配）
let _getMeta = () => ({ genesis: { monsters: [], equips: [] } });
function setMetaGetter(fn) { if (typeof fn === 'function') _getMeta = fn; }

// ============================================================
// 降生：捏怪物
// ============================================================
function birthMonster(player, draft, meta) {
  player = migratePlayer(player);
  if (!isUnlocked(player)) return { success: false, message: '创世之书需要二转后才可翻阅' };
  const w = getWorld(meta);

  // 1. 校验名字 / 描述
  const name = (draft.name || '').trim();
  const desc = (draft.desc || '').trim();
  if (!name) return { success: false, message: '请为它赋予一个真名' };
  if (name.length > LIMITS.nameMax) return { success: false, message: `真名不可超过 ${LIMITS.nameMax} 字` };
  if (desc.length > LIMITS.descMax) return { success: false, message: `描述不可超过 ${LIMITS.descMax} 字` };

  // 2. 校验地图与预算
  const area = AREAS[draft.areaId];
  if (!area) return { success: false, message: '目标地图不存在' };
  const budget = getMonsterBudget(area);
  if (!budget) return { success: false, message: '该地图尚无基础怪，无法降生' };

  // 3. 校验种族 / 特性
  const race = GENESIS_RACES[draft.race];
  if (!race) return { success: false, message: '未知种族' };
  const skills = Array.isArray(draft.skills) ? draft.skills : [];
  if (skills.length === 0) return { success: false, message: '至少赋予一种特性' };
  if (skills.length > MAX_MONSTER_SKILLS) return { success: false, message: `最多携带 ${MAX_MONSTER_SKILLS} 种特性` };
  // 种族专属技能 + 通用池；都做白名单校验
  const allowed = new Set([...race.skills, ...COMMON_SKILLS]);
  for (const sk of skills) {
    if (!allowed.has(sk)) return { success: false, message: `特性 ${sk} 不属于该种族` };
  }

  // 4. 校验掉落（必须是合法材料名）
  const drops = Array.isArray(draft.drops) ? draft.drops : [];
  if (drops.length > MAX_MONSTER_DROPS) return { success: false, message: `最多挂 ${MAX_MONSTER_DROPS} 件掉落` };
  const knownMaterial = new Set(Object.keys(require('../data/equipment').MATERIAL_PRICES));
  for (const d of drops) {
    if (!d || !d.name) return { success: false, message: '掉落物不合法' };
    if (!knownMaterial.has(d.name)) return { success: false, message: `未知掉落物：${d.name}` };
  }

  // 5. 数值预算校验：四维总点数不超过预算；单维不超 cap
  const hp  = Math.max(1, Math.floor(Number(draft.hp  || 0)));
  const atk = Math.max(0, Math.floor(Number(draft.atk || 0)));
  const def = Math.max(0, Math.floor(Number(draft.def || 0)));
  const agi = Math.max(0, Math.floor(Number(draft.agi || 0)));
  const total = hp + atk + def + agi;
  if (hp > budget.caps.hp)  return { success: false, message: `生命超过该图上限（${budget.caps.hp}）` };
  if (atk > budget.caps.atk) return { success: false, message: `攻击超过该图上限（${budget.caps.atk}）` };
  if (def > budget.caps.def) return { success: false, message: `防御超过该图上限（${budget.caps.def}）` };
  if (agi > budget.caps.agi) return { success: false, message: `敏捷超过该图上限（${budget.caps.agi}）` };
  if (total > budget.totalBudget) return { success: false, message: `四维总点数 ${total} 超出预算 ${budget.totalBudget}` };

  // 6. 上限校验
  if (countOf({ ...player, __genesisMeta: meta }, 'monsters') >= LIMITS.perPlayerEachKind) {
    return { success: false, message: `自创怪已达 ${LIMITS.perPlayerEachKind} 个上限` };
  }

  // 7. 金币校验
  const cost = LIMITS.monsterCostGold;
  if ((player.gold || 0) < cost) return { success: false, message: `降生仪式需要 ${cost} 金币` };

  // 8. 落库
  const monster = {
    id: 'm_' + genUid(),
    name, desc, creator: player.name || player.username, areaId: area.id,
    race: draft.race, raceName: race.name,
    skills: [...skills],
    hp, atk, def, agi,
    exp: budget.exp, gold: budget.gold,
    drops: drops.map(d => ({ name: d.name, rate: Number(d.rate) > 0 ? Math.min(0.5, Number(d.rate)) : 0.08 })),
    createdAt: Date.now(),
  };
  w.monsters.push(monster);
  player.gold -= cost;
  player.logs = player.logs || [];
  player.logs.push({ time: Date.now(), type: 'genesis-monster', text: oracleText('monster', { name, area: area.name, omen: race.omen }) });
  return { success: true, monster, oracle: oracleText('monster', { name, area: area.name, omen: race.omen }) };
}

// ============================================================
// 锻造：造装备
// ============================================================
function forgeEquip(player, draft, meta) {
  player = migratePlayer(player);
  if (!isUnlocked(player)) return { success: false, message: '创世之书需要二转后才可翻阅' };
  const w = getWorld(meta);

  // 1. 校验名字 / 描述
  const name = (draft.name || '').trim();
  const desc = (draft.desc || '').trim();
  if (!name) return { success: false, message: '请为它赋予一个真名' };
  if (name.length > LIMITS.nameMax) return { success: false, message: `真名不可超过 ${LIMITS.nameMax} 字` };
  if (desc.length > LIMITS.descMax) return { success: false, message: `描述不可超过 ${LIMITS.descMax} 字` };

  // 2. 校验类型与地图（决定预算基准）
  const slot = draft.slot;
  if (!EQUIP_SLOTS[slot]) return { success: false, message: '未知装备类型' };
  const area = AREAS[draft.areaId];
  if (!area) return { success: false, message: '目标地图不存在' };
  const budget = getEquipBudget(area.id, slot);
  if (!budget) return { success: false, message: '该槽位尚无参照模板，无法锻造' };

  // 3. 属性分配校验：键必须白名单、值非负、种类≤MAX_EQUIP_STATS、总点数≤预算
  const stats = draft.stats && typeof draft.stats === 'object' ? draft.stats : {};
  const statKeys = Object.keys(stats);
  if (statKeys.length === 0) return { success: false, message: '至少赋予一种属性' };
  if (statKeys.length > MAX_EQUIP_STATS) return { success: false, message: `最多 ${MAX_EQUIP_STATS} 种属性` };
  const cleanStats = {};
  let total = 0;
  for (const k of statKeys) {
    if (!EQUIP_STAT_KEYS[k]) return { success: false, message: `属性 ${k} 不可锻造` };
    const v = Math.max(0, Math.floor(Number(stats[k] || 0)));
    if (v === 0) continue;   // 0 值视为不写
    cleanStats[k] = v;
    total += v;
  }
  if (Object.keys(cleanStats).length === 0) return { success: false, message: '至少赋予一种非零属性' };
  if (total > budget.totalBudget) return { success: false, message: `属性总点数 ${total} 超出预算 ${budget.totalBudget}（参照：${budget.refName}）` };

  // 4. 词缀（最多 1 条，从已解锁的被动词条里选）
  let affix = null;
  if (draft.affixId) {
    let found = null;
    for (const lv of Object.keys(AFFIX_TREE)) {
      for (const a of (AFFIX_TREE[lv] || [])) {
        if (a.id === draft.affixId && a.slot === 'passive') { found = { id: a.id, level: Number(lv) }; break; }
      }
      if (found) break;
    }
    if (!found) return { success: false, message: '词缀无效或非被动词条' };
    affix = found;
  }

  // 5. 上限 / 金币
  if (countOf({ ...player, __genesisMeta: meta }, 'equips') >= LIMITS.perPlayerEachKind) {
    return { success: false, message: `自创装备已达 ${LIMITS.perPlayerEachKind} 个上限` };
  }
  const cost = LIMITS.equipCostGold;
  if ((player.gold || 0) < cost) return { success: false, message: `锻造仪式需要 ${cost} 金币` };

  // 6. 落库
  const tplId = 'custom_' + genUid();
  const equip = {
    id: tplId, name, desc, creator: player.name || player.username,
    slot, quality: GENESIS_EQUIP_QUALITY, reqLevel: budget.refReqLevel || budget.reqLevel,
    stats: cleanStats, affix,
    createdAt: Date.now(),
  };
  w.equips.push(equip);
  // 同步注册进 EQUIP_TEMPLATES（让 createEquipItem/mergeEquipment/附魔/重铸自动支持）
  registerCustomEquip({ id: equip.id, name, slot, quality: equip.quality, reqLevel: equip.reqLevel, stats: cleanStats, creator: equip.creator, desc });
  player.gold -= cost;
  player.logs = player.logs || [];
  player.logs.push({ time: Date.now(), type: 'genesis-equip', text: oracleText('equip', { name }) });
  return { success: true, equip, oracle: oracleText('equip', { name }) };
}

// ============================================================
// 删除：只有创建者可移除
// ============================================================
function deleteCustom(player, kind, id, meta) {
  player = migratePlayer(player);
  const w = getWorld(meta);
  const list = w[kind];
  const idx = list.findIndex(x => x.id === id);
  if (idx === -1) return { success: false, message: '创世项不存在' };
  const item = list[idx];
  if (item.creator !== player.username) return { success: false, message: '只有造物主可以抹去其名' };
  list.splice(idx, 1);
  if (kind === 'equips') unregisterCustomEquip(id);
  player.logs = player.logs || [];
  player.logs.push({ time: Date.now(), type: 'genesis-delete', text: oracleText('delete', { name: item.name }) });
  return { success: true, oracle: oracleText('delete', { name: item.name }) };
}

// ============================================================
// 工具：列出某地图的自创怪（战斗选怪合并用）
// ============================================================
function getCustomMonstersForArea(areaId, meta) {
  const w = getWorld(meta);
  return w.monsters.filter(m => m.areaId === areaId);
}

// ============================================================
// 工具：列出某玩家的所有自创项（创世之书界面渲染用）
// ============================================================
function listByPlayer(player, meta) {
  const w = getWorld(meta);
  return {
    monsters: w.monsters.filter(m => m.creator === player.username),
    equips:   w.equips.filter(e => e.creator === player.username),
    unlocked: isUnlocked(player),
    limits: LIMITS,
    races: GENESIS_RACES,
    commonSkills: COMMON_SKILLS,
    monsterSkillsMax: MAX_MONSTER_SKILLS,
    dropsMax: MAX_MONSTER_DROPS,
    equipSlots: EQUIP_SLOTS,
    equipStatKeys: EQUIP_STAT_KEYS,
    equipStatsMax: MAX_EQUIP_STATS,
    monsterBudgets: listAllMonsterBudgets(),   // 各图怪物预算（前端直接用，避免双端公式分叉）
    equipBudgets: listAllEquipBudgets(),       // 各图×各槽位装备预算
  };
}

// ============================================================
// 启动期恢复：把已存在的自创装备同步注册回 EQUIP_TEMPLATES
// （应对服务重启）
// ============================================================
function rehydrateFromMeta(meta) {
  const w = getWorld(meta);
  for (const e of w.equips) {
    if (!EQUIP_TEMPLATES[e.id]) {
      registerCustomEquip({ id: e.id, name: e.name, slot: e.slot, quality: e.quality, reqLevel: e.reqLevel, stats: e.stats, creator: e.creator, desc: e.desc });
    }
  }
}

module.exports = {
  isUnlocked, getWorld, getCustomMonstersForArea, listByPlayer,
  birthMonster, forgeEquip, deleteCustom,
  rehydrateFromMeta,
  setMetaGetter,
};