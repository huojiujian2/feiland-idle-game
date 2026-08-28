// ====== 装备 / 词条 / 商店 / 出售 / 锻造 / 合成 / 重铸 / 附魔 ======
const { getNow, getRand } = require('./state');
const { genUid } = require('./utils');
const {
  SHOP_ITEMS, SHOP_MATERIALS, MATERIAL_PRICES, EQUIP_SELL_PRICES, EQUIP_TEMPLATES,
  RACE_EVOLUTION, ENCHANT_RECIPES, MAX_ENCHANT_SLOTS,
  AFFIX_TREE, AFFIX_LEVELS, LAWS,
  UPGRADE_LEVEL_MAX, UPGRADE_BASE_GOLD, QUALITY_GOLD_MULT, QUALITY_STAT_MULT,
  UPGRADE_MATERIAL_BY_QUALITY, QUALITY_ORDER, QUALITY_NEXT,
  createEquipItem,
} = require('../data');
const { findAffix, getPassiveSlots, getAvailableAffixLevels, ensureQuestStats, refreshDailyIfNeeded, updateDailyProgress, checkAchievements } = require('./daily');
const { migratePlayer, grantGold } = require('./player');

// recalcMaxStats 注入
let _recalcMaxStats = () => {};
function setRecalcMaxStatsHandler(fn) { if (typeof fn === 'function') _recalcMaxStats = fn; }
function recalc(player) { return _recalcMaxStats(player); }

// 装备/卸下词条
function equipAffix(player, affixId, slot) {
  player = migratePlayer(player);
  const affix = findAffix(affixId);
  if (!affix) return { success: false, message: '词条不存在' };
  const affixLevel = AFFIX_LEVELS[affix.level];
  if (player.level < affixLevel.reqLevel) return { success: false, message: `需要 Lv.${affixLevel.reqLevel}` };
  if (affix.slot === 'active') {
    player.affixes.active = affixId;
    player.logs.push({ time: getNow(), type: 'affix', text: `装备主动词条：${affix.name}` });
  } else {
    const maxSlots = getPassiveSlots(player);
    if (player.affixes.passive.length >= maxSlots) return { success: false, message: `被动词条槽位已满（${maxSlots}个）` };
    if (player.affixes.passive.includes(affixId)) return { success: false, message: '已装备此词条' };
    player.affixes.passive.push(affixId);
    player.logs.push({ time: getNow(), type: 'affix', text: `装备被动词条：${affix.name}` });
  }
  recalc(player);
  refreshDailyIfNeeded(player);
  updateDailyProgress(player, 'affix1', 1);
  ensureQuestStats(player);
  if (!player.questStats.affixSeen.includes(affixId)) player.questStats.affixSeen.push(affixId);
  checkAchievements(player);
  return { success: true };
}
function unequipAffix(player, affixId) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  if (player.affixes.active === affixId) {
    player.affixes.active = null;
    updateDailyProgress(player, 'affix1', 1);
    checkAchievements(player);
    return { success: true };
  }
  const idx = player.affixes.passive.indexOf(affixId);
  if (idx !== -1) {
    player.affixes.passive.splice(idx, 1);
    recalc(player);
    updateDailyProgress(player, 'affix1', 1);
    checkAchievements(player);
    return { success: true };
  }
  return { success: false, message: '未装备此词条' };
}

// 穿戴/卸下装备
function equipItem(player, itemUid) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  const idx = player.equips.findIndex(e => e.uid === itemUid);
  if (idx === -1) return { success: false, message: '装备不存在' };
  const item = player.equips[idx];
  if (player.level < item.reqLevel) return { success: false, message: `需要 Lv.${item.reqLevel}` };
  const old = player.equipped[item.slot];
  if (old) player.equips.push(old);
  player.equipped[item.slot] = item;
  player.equips.splice(idx, 1);
  recalc(player);
  ensureQuestStats(player);
  if (item.templateId && !player.questStats.seenEquipTemplates.includes(item.templateId)) {
    player.questStats.seenEquipTemplates.push(item.templateId);
  }
  checkAchievements(player);
  return { success: true };
}
function unequipItem(player, slot) {
  player = migratePlayer(player);
  if (!player.equipped[slot]) return { success: false, message: '该位置无装备' };
  player.equips.push(player.equipped[slot]);
  player.equipped[slot] = null;
  recalc(player);
  return { success: true };
}

// 消耗品（血蓝药剂已删除：每场战斗后自动满血满蓝，无需药剂）
function useConsumable(player, itemId, count = 1) {
  const shopItem = SHOP_ITEMS.find(s => s.id === itemId);
  if (!shopItem) return { success: false, message: '物品不存在' };
  const safeCount = Math.max(1, Math.floor(Number(count) || 1));
  const invItem = player.inventory.find(i => i.name === shopItem.name);
  if (!invItem || invItem.count < safeCount) return { success: false, message: '数量不足' };
  invItem.count -= safeCount;
  if (invItem.count <= 0) player.inventory = player.inventory.filter(i => i !== invItem);
  for (let i = 0; i < safeCount; i++) {
    if (itemId === 'exp_scroll') player.exp += 500;
    else if (itemId === 'exp_scroll_great') player.exp += 3000;
  }
  return { success: true };
}

// 商店购买（消耗品/装备走 SHOP_ITEMS，材料走 SHOP_MATERIALS）
function buyItem(player, itemId, count = 1) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  const requestedCount = Number.isFinite(Number(count)) ? Math.floor(Number(count)) : 1;
  const safeCount = Math.max(1, requestedCount);
  const matItem = SHOP_MATERIALS.find(s => s.id === itemId);
  if (matItem) {
    if (player.level < matItem.requiredLevel) return { success: false, message: `需要 Lv.${matItem.requiredLevel} 解锁【${matItem.sourceMap}】后购买` };
    const actualCount = Math.min(safeCount, Math.floor(player.gold / matItem.price));
    if (actualCount < 1) return { success: false, message: '金币不足' };
    const totalCost = matItem.price * actualCount;
    player.gold -= totalCost;
    const existing = player.inventory.find(i => i.name === matItem.name && (i.type === 'material' || !i.type));
    if (existing) existing.count += actualCount;
    else player.inventory.push({ name: matItem.name, count: actualCount, type: 'material' });
    updateDailyProgress(player, 'buy1', 1);
    return { success: true };
  }
  const shopItem = SHOP_ITEMS.find(s => s.id === itemId);
  if (!shopItem) return { success: false, message: '物品不存在' };
  const actualCount = Math.min(safeCount, Math.floor(player.gold / shopItem.price));
  if (actualCount < 1) return { success: false, message: '金币不足' };
  const totalCost = shopItem.price * actualCount;
  player.gold -= totalCost;
  if (shopItem.type === 'consumable') {
    const existing = player.inventory.find(i => i.name === shopItem.name);
    if (existing) existing.count += actualCount;
    else player.inventory.push({ name: shopItem.name, count: actualCount, type: 'consumable', itemId });
  } else if (shopItem.type === 'equip') {
    for (let i = 0; i < actualCount; i++) {
      const item = createEquipItem(itemId, genUid());
      if (item) {
        player.equips.push(item);
        ensureQuestStats(player);
        if (!player.questStats.seenEquipTemplates.includes(item.templateId)) player.questStats.seenEquipTemplates.push(item.templateId);
      }
    }
    checkAchievements(player);
  }
  updateDailyProgress(player, 'buy1', 1);
  return { success: true };
}

// 出售
function sellMaterial(player, itemName, count = 1) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  const invItem = player.inventory.find(i => i.name === itemName);
  if (!invItem || invItem.count < count) return { success: false, message: '数量不足' };
  if (invItem.type && invItem.type !== 'material') return { success: false, message: '该物品不可出售' };
  const price = MATERIAL_PRICES[itemName] || 5;
  grantGold(player, price * count);
  invItem.count -= count;
  if (invItem.count <= 0) player.inventory = player.inventory.filter(i => i !== invItem);
  return { success: true, gold: price * count };
}
function sellEquip(player, itemUid) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  const idx = player.equips.findIndex(e => e.uid === itemUid);
  if (idx === -1) return { success: false, message: '装备不存在' };
  const price = EQUIP_SELL_PRICES[player.equips[idx].quality] || 20;
  grantGold(player, price);
  player.equips.splice(idx, 1);
  return { success: true, gold: price };
}

// 按等级批量出售（卖出 reqLevel <= maxLevel 的所有装备，maxLevel=null 视为全部）
function sellEquipsByLevel(player, maxLevel) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  const before = player.equips.length;
  const matched = player.equips.filter(it => maxLevel == null || (it.reqLevel || 0) <= maxLevel);
  if (matched.length === 0) return { success: false, message: '没有符合条件的装备' };
  let totalGold = 0;
  const uids = new Set(matched.map(it => it.uid));
  for (const it of matched) {
    totalGold += EQUIP_SELL_PRICES[it.quality] || 20;
  }
  player.equips = player.equips.filter(it => !uids.has(it.uid));
  grantGold(player, totalGold);
  player.logs = player.logs || [];
  player.logs.push({
    time: getNow(),
    type: 'sell',
    text: `【批量出售】卖出 ${matched.length} 件装备（≤Lv.${maxLevel ?? '全部'}），获得 ${totalGold} 金币`,
  });
  return { success: true, sold: matched.length, gold: totalGold, remaining: before - matched.length };
}

// 种族进化
function evolveRace(player) {
  player = migratePlayer(player);
  const raceData = RACE_EVOLUTION[player.race];
  if (!raceData || !raceData.nextEvolution) return { success: false, message: '已达到最高种族形态' };
  const next = RACE_EVOLUTION[raceData.nextEvolution];
  if (player.level < next.reqLevel) return { success: false, message: `需要 Lv.${next.reqLevel} 才能进化` };
  if (next.reqMaterial) {
    const mat = player.inventory.find(i => i.name === next.reqMaterial.name);
    if (!mat || mat.count < next.reqMaterial.count) {
      return { success: false, message: `需要 ${next.reqMaterial.name} ×${next.reqMaterial.count}` };
    }
    mat.count -= next.reqMaterial.count;
    if (mat.count <= 0) player.inventory = player.inventory.filter(i => i !== mat);
  }
  player.race = next.name;
  player.raceStage = next.stage;
  recalc(player);
  player.logs.push({ time: getNow(), type: 'evolve', text: `种族进化！你已蜕变为 ${next.name}！${next.bonusText}` });
  return { success: true };
}

// 附魔
function enchantItem(player, itemUid, recipeId) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  const item = player.equips.find(e => e.uid === itemUid) || Object.values(player.equipped).find(e => e && e.uid === itemUid);
  if (!item) return { success: false, message: '装备不存在' };
  const recipe = ENCHANT_RECIPES.find(r => r.id === recipeId);
  if (!recipe) return { success: false, message: '附魔配方不存在' };
  if (item.slot !== recipe.slot) return { success: false, message: `此附魔仅适用于${recipe.slot === 'weapon' ? '武器' : recipe.slot === 'armor' ? '护甲' : '饰品'}` };
  if (!item.enchants) item.enchants = [];
  if (item.enchants.length >= MAX_ENCHANT_SLOTS) return { success: false, message: '附魔槽已满（最多3个）' };
  if (item.enchants.includes(recipeId)) return { success: false, message: '已有相同附魔' };
  if (player.gold < recipe.cost) return { success: false, message: `需要 ${recipe.cost} 金币` };
  for (const mat of recipe.materials) {
    const inv = player.inventory.find(i => i.name === mat.name);
    if (!inv || inv.count < mat.count) return { success: false, message: `需要 ${mat.name} ×${mat.count}` };
  }
  player.gold -= recipe.cost;
  for (const mat of recipe.materials) {
    const inv = player.inventory.find(i => i.name === mat.name);
    inv.count -= mat.count;
    if (inv.count <= 0) player.inventory = player.inventory.filter(i => i !== inv);
  }
  item.enchants.push(recipeId);
  recalc(player);
  player.logs.push({ time: getNow(), type: 'enchant', text: `附魔成功！${item.name} 获得 ${recipe.name}效果` });
  updateDailyProgress(player, 'enchant1', 1);
  checkAchievements(player);
  return { success: true };
}

// 装备升级
function upgradeEquipment(player, itemUid) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  const item = player.equips.find(e => e.uid === itemUid)
    || Object.values(player.equipped || {}).find(e => e && e.uid === itemUid);
  if (!item) return { success: false, message: '装备不存在' };
  const cur = item.upgradeLevel || 0;
  if (cur >= UPGRADE_LEVEL_MAX) return { success: false, message: `已达最高强化等级 +${UPGRADE_LEVEL_MAX}` };
  const targetLv = cur + 1;
  const cost = Math.floor(UPGRADE_BASE_GOLD * Math.pow(1.5, cur) * (QUALITY_GOLD_MULT[item.quality] || 1));
  const matSpec = UPGRADE_MATERIAL_BY_QUALITY[item.quality];
  const matCount = targetLv;
  if ((player.gold || 0) < cost) return { success: false, message: `金币不足，需要 ${cost}` };
  const inv = player.inventory.find(i => i.name === matSpec.name);
  if (!inv || inv.count < matCount) return { success: false, message: `需要 ${matSpec.name} ×${matCount}` };

  player.gold -= cost;
  inv.count -= matCount;
  if (inv.count <= 0) player.inventory = player.inventory.filter(i => i !== inv);

  item.upgradeLevel = targetLv;
  if (item.baseStats) {
    for (const k of Object.keys(item.baseStats)) {
      item.stats[k] = Math.floor(item.baseStats[k] * Math.pow(1.05, targetLv));
    }
  } else {
    item.baseStats = { ...item.stats };
    for (const k of Object.keys(item.baseStats)) {
      item.stats[k] = Math.floor(item.baseStats[k] * 1.05);
    }
  }
  recalc(player);
  player.logs = player.logs || [];
  player.logs.push({ time: getNow(), type: 'upgrade', text: `【锻造】${item.name} 强化至 +${targetLv}（消耗 ${cost} 金币 + ${matSpec.name}×${matCount}）` });
  return { success: true, upgradeLevel: targetLv, goldCost: cost };
}

// 装备三合一合成（v2.4）
//   规则：3 件 **同品质 + 同槽位** 的装备 → 1 件高一阶品质的同槽位装备
//   - 3 件必须未装备且未附魔（避免误合）
//   - 槽位锁死：3 件的 slot 必须一致（防止"3 把武器 → 武器"或"3 个混搭 → 随机"的不直观行为）
//   - 模板随机：从当前等级允许的同品质+同槽位模板里随机
//   - 强化等级：取最大保留（避免浪费已强化投入）
//   - 附魔：保留 3 件中数量最多的那件附魔列表（避免完全浪费附魔投入）；若 3 件都没附魔则新装备也无附魔
function mergeEquipment(player, itemUids) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  if (!Array.isArray(itemUids) || itemUids.length !== 3) return { success: false, message: '需要 3 件装备' };
  const items = [];
  for (const uid of itemUids) {
    const it = player.equips.find(e => e.uid === uid)
      || Object.values(player.equipped || {}).find(e => e && e.uid === uid);
    if (!it) return { success: false, message: `装备 ${uid} 不存在` };
    // 已经被穿戴的不能直接合成
    if (player.equipped && Object.values(player.equipped).some(e => e && e.uid === uid)) {
      return { success: false, message: '请先卸下要合成的装备' };
    }
    // 有附魔的不能合成（避免误操作把附魔浪费）
    if (it.enchants && it.enchants.length > 0) {
      return { success: false, message: '请先剥离附魔再合成（有附魔的装备不能合成）' };
    }
    items.push(it);
  }
  // 三件必须同品质 + 同槽位
  const q = items[0].quality;
  const slot = items[0].slot;
  if (!items.every(i => i.quality === q)) return { success: false, message: '3 件装备必须同一品质' };
  if (!items.every(i => i.slot === slot)) return { success: false, message: '3 件装备必须同一部位（如 3 把武器 / 3 件胸甲）' };

  const next = QUALITY_NEXT[q];
  if (!next) return { success: false, message: '已是最高品质神话级，无法合成' };
  const pool = Object.values(EQUIP_TEMPLATES).filter(t => t.quality === next && t.slot === slot && t.reqLevel <= player.level);
  if (pool.length === 0) return { success: false, message: `当前等级 (Lv.${player.level}) 没有可合成的 ${next} ${slot} 装备模板` };
  const tpl = pool[Math.floor(getRand()() * pool.length)];

  // 移除 3 件素材（同步从 equipped 清空，理论上上面已经挡住，这里再保险一次）
  for (const it of items) {
    if (player.equipped && Object.values(player.equipped).some(e => e && e.uid === it.uid)) {
      for (const [s, eq] of Object.entries(player.equipped)) {
        if (eq && eq.uid === it.uid) player.equipped[s] = null;
      }
    }
    player.equips = player.equips.filter(e => e.uid !== it.uid);
  }

  const maxUp = Math.max(...items.map(i => i.upgradeLevel || 0));
  // v2.4 强化等级在跨品质合成时**重置为 0**
  //   原因：跨品质后装备模板本身基础属性已经大幅提升，叠加旧强化等级的 1.05^n 倍数会过于离谱；
  //         而且强化等级是绑在原装备 uid 上的，模板一换就没意义了
  const newItem = {
    uid: genUid(),
    templateId: tpl.id || tpl.name,
    name: tpl.name, slot: tpl.slot, quality: tpl.quality, reqLevel: tpl.reqLevel,
    stats: { ...tpl.stats },
    enchants: [],
    upgradeLevel: 0,
  };
  player.equips.push(newItem);
  recalc(player);
  player.logs = player.logs || [];
  player.logs.push({ time: getNow(), type: 'merge', text: `【合成】3 件 ${q} ${slot} → 1 件 ${next} ${slot}「${newItem.name}」` });
  return { success: true, newItem };
}

// 装备重铸
function reforgeEquipment(player, itemUid, cost = 1000) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  const item = player.equips.find(e => e.uid === itemUid)
    || Object.values(player.equipped || {}).find(e => e && e.uid === itemUid);
  if (!item) return { success: false, message: '装备不存在' };
  if ((player.gold || 0) < cost) return { success: false, message: `金币不足，需要 ${cost}` };
  // v2.4：重置附魔 = **清空当前所有附魔**，不自动填充新附魔
  //   玩家随后自己用附魔界面（每次附魔可挑 1 个新附魔附上去，最多 3 槽）
  //   这与"锻造 → 强化"的体验对齐：强化按 +1 累加，附魔按 1 个累加
  const cleared = (item.enchants || []).length;
  item.enchants = [];
  recalc(player);
  player.gold -= cost;
  player.logs = player.logs || [];
  player.logs.push({ time: getNow(), type: 'reforge', text: `【重置附魔】${item.name} 清空 ${cleared} 个旧附魔（消耗 ${cost} 金币）` });
  return { success: true };
}

// 学习法则
function learnLaw(player, lawId) {
  player = migratePlayer(player);
  const law = LAWS.find(l => l.id === lawId);
  if (!law) return { success: false, message: '法则不存在' };
  if (player.level < law.reqLevel) return { success: false, message: `需要 Lv.${law.reqLevel}` };
  if (player.laws.includes(lawId)) return { success: false, message: '已学习此法则' };
  const mat = player.inventory.find(i => i.name === law.cost.name);
  if (!mat || mat.count < law.cost.count) return { success: false, message: `需要 ${law.cost.name} ×${law.cost.count}` };
  mat.count -= law.cost.count;
  if (mat.count <= 0) player.inventory = player.inventory.filter(i => i !== mat);
  player.laws.push(lawId);
  player.logs.push({ time: getNow(), type: 'law', text: `领悟了 ${law.name}！${law.desc}` });
  return { success: true };
}

module.exports = {
  equipAffix, unequipAffix,
  equipItem, unequipItem,
  useConsumable, buyItem,
  sellMaterial, sellEquip, sellEquipsByLevel,
  evolveRace, enchantItem,
  upgradeEquipment, mergeEquipment, reforgeEquipment,
  learnLaw,
  setRecalcMaxStatsHandler,
};
