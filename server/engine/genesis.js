// ====== 创世引擎 ======
// @file engine/genesis
// @module engine-genesis
// @description 二转解锁的"创世之书"核心逻辑：捏怪物、造装备、删除、
//              同步进 meta.genesis（全局），并把自创装备注册到装备模板表。

const {
  AREAS, GENESIS_RACES, COMMON_SKILLS, MAX_MONSTER_SKILLS, MAX_MONSTER_DROPS,
  EQUIP_SLOTS, EQUIP_STAT_KEYS, MAX_EQUIP_STATS, GENESIS_EQUIP_QUALITY, LIMITS,
  GENESIS_EQUIP_QUALITY_CHOICES, GENESIS_EQUIP_QUALITY_MIN_LEVEL,
  getMonsterBudget, getEquipBudget, listAllMonsterBudgets, listAllEquipBudgets,
  oracleText, systemMax, CREATION_GROWTH, CREATION_CAP_MULT,
} = require('../data/genesis');
const { EQUIP_TEMPLATES, registerCustomEquip, unregisterCustomEquip } = require('../data/equipment');
const { AFFIX_TREE } = require('../data/affixes');
const { genUid } = require('./utils');
const { migratePlayer } = require('./player');

// 工具：从 meta 取出创世世界（不存在的兜底初始化）
function getWorld(meta) {
  if (!meta) meta = {};
  if (!meta.genesis || typeof meta.genesis !== 'object') {
    meta.genesis = { monsters: [], equips: [], equipsMax: {} };
  }
  if (!Array.isArray(meta.genesis.monsters)) meta.genesis.monsters = [];
  if (!Array.isArray(meta.genesis.equips))   meta.genesis.equips   = [];
  // v2.0：每地图×每槽位的"已投入世界最强自创装备点数"
  //   结构：{ areaId: { slot: maxPts } }
  if (!meta.genesis.equipsMax || typeof meta.genesis.equipsMax !== 'object') {
    meta.genesis.equipsMax = {};
  }
  return meta.genesis;
}

// 工具：计算一件装备的真实属性点（与 data/genesis.js 保持一致的算法）
const PERCENT_STAT_WEIGHTS = {
  exp: 2, gold: 1.5, crit: 40, critDmg: 12, allAttr: 70,
  ignoreDef: 18, lifesteal: 25, dodge: 25, dmgTaken: 80,
};
function equipStatTotal(stats) {
  let sum = 0;
  for (const [k, v] of Object.entries(stats || {})) {
    const w = PERCENT_STAT_WEIGHTS[k];
    sum += w ? Math.abs(v) * 100 * w : v;
  }
  return sum;
}

// 工具：把新装备的点数"投入世界"——更新 equipsMax[areaId][slot] = max(原值, 新点数)
function commitEquipToWorld(world, areaId, slot, equipPts) {
  if (!world.equipsMax[areaId]) world.equipsMax[areaId] = {};
  const prev = world.equipsMax[areaId][slot] || 0;
  if (equipPts > prev) world.equipsMax[areaId][slot] = equipPts;
}

// 工具：玩家是否二转
function isUnlocked(player) {
  return (player?.reincarnation || 0) >= 2;
}

// 工具：给玩家所属自创项计数（兼容 creator 可能存的是 username 或 name）
function countOf(player, kind) {
  const w = getWorld(_getMeta());
  const aliases = new Set([player.username, player.name].filter(Boolean));
  const isMine = (x) => aliases.has(x.creator) || aliases.has(x.creatorUsername);
  return w[kind].filter(isMine).length;
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

  // 4. 校验掉落：可以是材料（kind='material'）或自创装备（kind='equip'）
  //   装备只有被怪物掉落才算"投入世界"——v2.1 装备投入世界的真正入口
  const drops = Array.isArray(draft.drops) ? draft.drops : [];
  if (drops.length > MAX_MONSTER_DROPS) return { success: false, message: `最多挂 ${MAX_MONSTER_DROPS} 件掉落` };
  const knownMaterial = new Set(Object.keys(require('../data/equipment').MATERIAL_PRICES));
  const normalizedDrops = [];
  for (const d of drops) {
    if (!d || !d.name) return { success: false, message: '掉落物不合法' };
    const kind = d.kind || 'material';   // 旧数据默认 material 兼容
    if (kind === 'material') {
      if (!knownMaterial.has(d.name)) return { success: false, message: `未知材料：${d.name}` };
      normalizedDrops.push({ kind: 'material', name: d.name, rate: Number(d.rate) > 0 ? Math.min(0.5, Number(d.rate)) : 0.08 });
    } else if (kind === 'equip') {
      // 必须是该地图下的自创装备
      const eq = w.equips.find(e => e.id === d.name);
      if (!eq) return { success: false, message: `自创装备 ${d.name} 不存在` };
      if (eq.areaId !== area.id) return { success: false, message: `装备 ${eq.name} 不属于该地图` };
      // 同一装备已被其他怪物挂着则禁止
      const lockedBy = w.monsters.find(m => (m.drops || []).some(x => x.kind === 'equip' && x.name === d.name));
      if (lockedBy) return { success: false, message: `装备「${eq.name}」已被怪物「${lockedBy.name}」绑定，请先解除` };
      normalizedDrops.push({ kind: 'equip', name: d.name, rate: Number(d.rate) > 0 ? Math.min(0.5, Number(d.rate)) : 0.05 });
    } else {
      return { success: false, message: `未知掉落类型：${kind}` };
    }
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
    name, desc,
    creator: player.username,    // v2.2 修复：显示用户名（不是账户名称）
    creatorUsername: player.username,
    creatorName: player.name || player.username,   // 冗余：账户显示名
    areaId: area.id,
    race: draft.race, raceName: race.name,
    skills: [...skills],
    hp, atk, def, agi,
    exp: budget.exp, gold: budget.gold,
    drops: normalizedDrops,   // v2.1：保留 kind 标记
    createdAt: Date.now(),
  };
  w.monsters.push(monster);

  // v2.1：怪物创建完成 → 把挂载的自创装备点数"投入世界"
  //   硬封顶：单件装备点数不超过 systemMax × 10
  const QUALITY_RATIO_CAP = { epic: 1.0, legend: 1.25, mythic: 1.5 };
  for (const drop of normalizedDrops) {
    if (drop.kind !== 'equip') continue;
    const eq = w.equips.find(e => e.id === drop.name);
    if (!eq) continue;
    const eqPts = equipStatTotal(eq.stats);
    const sysMax = systemMax(eq.areaId, eq.slot);
    const cap = Math.floor(sysMax * CREATION_CAP_MULT * (QUALITY_RATIO_CAP[eq.quality] || 1));
    if (eqPts <= cap) {
      commitEquipToWorld(w, eq.areaId, eq.slot, eqPts);
    }
    // 装备一旦被怪物挂载并降生成功，即为"committed"（投入世界）状态
    eq.worldState = 'committed';
  }

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
  // v0.8+：玩家可三选品质（epic/legend/mythic），高端品质要求目标图等级段更高
  const QUALITY = draft.quality || GENESIS_EQUIP_QUALITY;
  if (!['epic', 'legend', 'mythic'].includes(QUALITY)) {
    return { success: false, message: '自创装备品质必须在 [epic/legend/mythic] 中' };
  }
  const minLv = GENESIS_EQUIP_QUALITY_MIN_LEVEL[QUALITY] || 1;
  if (area.minLevel < minLv) {
    return { success: false, message: `${QUALITY} 品质需要目标图等级 ≥ ${minLv}` };
  }
  const budget = getEquipBudget(area.id, slot, QUALITY, w.equipsMax);
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
    id: tplId, name, desc,
    creator: player.name || player.username,
    creatorUsername: player.username,    // v2.2 冗余
    areaId: area.id,     // v2.1：记录装备投放地图，怪物创建时校验归属
    slot, quality: QUALITY, reqLevel: budget.refReqLevel || budget.reqLevel,
    stats: cleanStats, affix,
    createdAt: Date.now(),
  };
  w.equips.push(equip);
  // 同步注册进 EQUIP_TEMPLATES（让 createEquipItem/mergeEquipment/附魔/重铸自动支持）
  registerCustomEquip({ id: equip.id, name, slot, quality: equip.quality, reqLevel: equip.reqLevel, stats: cleanStats, creator: equip.creator, desc });
  // v2.1：装备造出来后**不立即**投入世界
  //   只有被某个怪物选为掉落，且该怪物降生成功时，才正式"投入世界"
  //   此时该装备的点数才会更新到 equipsMax[areaId][slot]
  equip.worldState = 'pending';  // pending / committed（前端可显示状态）
  player.gold -= cost;
  player.logs = player.logs || [];
  player.logs.push({ time: Date.now(), type: 'genesis-equip', text: oracleText('equip', { name }) });
  return { success: true, equip, oracle: oracleText('equip', { name }), budget };
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
  // 兼容：creator 可能是 player.name 或 player.username
  const aliases = new Set([player.username, player.name].filter(Boolean));
  if (!(aliases.has(item.creator) || aliases.has(item.creatorUsername))) {
    return { success: false, message: '只有造物主可以抹去其名' };
  }
  // v2.1：装备若被某怪物挂载（作为掉落），必须先从该怪物的 drops 中移除
  if (kind === 'equips') {
    const lockedBy = w.monsters.find(m => (m.drops || []).some(x => x.kind === 'equip' && x.name === id));
    if (lockedBy) return { success: false, message: `装备「${item.name}」已被怪物「${lockedBy.name}」绑定，请先解除` };
  }
  // 删除怪物时同步解除其挂载的装备的 worldState（标记回 pending）
  if (kind === 'monsters') {
    for (const drop of (item.drops || [])) {
      if (drop.kind === 'equip') {
        const eq = w.equips.find(e => e.id === drop.name);
        if (eq) eq.worldState = 'pending';
      }
    }
  }
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
  // 兼容：creator 字段在创建时存的是 player.name || player.username
  // 过滤时同时匹配两种可能，避免玩家设了真名后"我的造物"看不到自己造的东西
  const aliases = new Set([player.username, player.name].filter(Boolean));
  const isMine = (x) => aliases.has(x.creator) || aliases.has(x.creatorUsername);
  return {
    monsters: w.monsters.filter(isMine),
    equips:   w.equips.filter(isMine),
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
    equipBudgets: listAllEquipBudgets(getWorld(meta).equipsMax),  // v2.0：传入世界最强表，让前端能正确显示
    equipQualityChoices: GENESIS_EQUIP_QUALITY_CHOICES,   // ['epic','legend','mythic']
    equipQualityMinLevel: GENESIS_EQUIP_QUALITY_MIN_LEVEL, // { epic:1, legend:90, mythic:180 }
    equipsMax: getWorld(meta).equipsMax,       // v2.0：当前世界最强自创装备表
    // v2.1：给前端"怪物创建"页面按地图列出可挂载的自创装备
    equipsByArea: (() => {
      const out = {};
      for (const e of getWorld(meta).equips) {
        if (!out[e.areaId]) out[e.areaId] = [];
        out[e.areaId].push({ id: e.id, name: e.name, slot: e.slot, quality: e.quality, stats: e.stats, worldState: e.worldState || 'pending' });
      }
      return out;
    })(),
  };
}

// ============================================================
// 启动期恢复：把已存在的自创装备同步注册回 EQUIP_TEMPLATES
// （应对服务重启）
// ============================================================
function rehydrateFromMeta(meta) {
  const w = getWorld(meta);
  // v2.2 兼容：旧 monster / equip 可能缺 creatorUsername，
  //   启动时按"creator 看起来像 username 还是 name"做最小回填
  //   这里只是补字段，逻辑严格按别名（username / name 都行）
  for (const e of w.equips) {
    if (e.creator && !e.creatorUsername) e.creatorUsername = e.creator;
    if (!EQUIP_TEMPLATES[e.id]) {
      registerCustomEquip({ id: e.id, name: e.name, slot: e.slot, quality: e.quality, reqLevel: e.reqLevel, stats: e.stats, creator: e.creator, desc: e.desc });
    }
    // v2.1：旧数据兼容——无 worldState 字段视为 pending
    if (!e.worldState) e.worldState = 'pending';
  }
  for (const m of w.monsters) {
    if (m.creator && !m.creatorUsername) m.creatorUsername = m.creator;
  }
  // 重新计算"已投入世界"的装备状态（基于怪物 drops 推导）
  for (const m of w.monsters) {
    for (const drop of (m.drops || [])) {
      if (drop.kind === 'equip') {
        const eq = w.equips.find(x => x.id === drop.name);
        if (eq) eq.worldState = 'committed';
      }
    }
  }
}

module.exports = {
  isUnlocked, getWorld, getCustomMonstersForArea, listByPlayer,
  birthMonster, forgeEquip, deleteCustom,
  rehydrateFromMeta,
  setMetaGetter,
};