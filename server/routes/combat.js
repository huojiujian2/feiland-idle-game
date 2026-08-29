// ====== 战斗相关路由：词条/装备/商店/使用/出售/锻造/合成/重铸 ======
const {
  equipAffix, unequipAffix,
  equipItem, unequipItem,
  useConsumable, buyItem,
  sellMaterial, sellEquip, sellEquipsByLevel,
  upgradeEquipment, mergeEquipment, reforgeEquipment,
  sortInventory,
  getPlayerView,
} = require('../engine');
const { SHOP_ITEMS, SHOP_MATERIALS, EQUIP_TEMPLATES, QUALITY_COLORS, AFFIX_LEVELS, AFFIX_TREE } = require('../data');
const { ok, fail, loadPlayer, savePlayer } = require('./_helpers');

function registerCombatRoutes(app, store) {
  // 词条装备/卸下
  app.post('/api/player/:username/affix', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error, 404);
    const result = equipAffix(r.player, req.body.affixId, req.body.slot);
    if (!result.success) return fail(res, result.message, 400);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });
  app.post('/api/player/:username/affix/unequip', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error, 404);
    const result = unequipAffix(r.player, req.body.affixId);
    if (!result.success) return fail(res, result.message, 400);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });

  // 静态数据
  app.get('/api/data/affixes', (req, res) => res.json({ success: true, data: { levels: AFFIX_LEVELS, tree: AFFIX_TREE } }));

  // 装备穿戴/卸下
  app.post('/api/player/:username/equip', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error, 404);
    const result = equipItem(r.player, req.body.itemUid);
    if (!result.success) return fail(res, result.message, 400);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });
  app.post('/api/player/:username/unequip', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error, 404);
    const result = unequipItem(r.player, req.body.slot);
    if (!result.success) return fail(res, result.message, 400);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });
  app.get('/api/data/equipments', (req, res) => res.json({ success: true, data: { templates: EQUIP_TEMPLATES, colors: QUALITY_COLORS } }));

  // 商店（消耗品/装备全量；材料按已解锁地图过滤——与进图门槛一致）
  app.get('/api/shop', (req, res) => {
    const r = loadPlayer(store, req.query.username);
    if (r.error) return ok(res, { consumables: [], equips: [], materials: [] });
    const lv = r.player.level || 1;
    return ok(res, {
      consumables: SHOP_ITEMS.filter(i => i.type === 'consumable'),
      equips: SHOP_ITEMS.filter(i => i.type === 'equip'),
      materials: SHOP_MATERIALS.filter(m => lv >= m.requiredLevel),
      allMaterials: SHOP_MATERIALS,
    });
  });
  app.post('/api/player/:username/buy', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error, 404);
    const result = buyItem(r.player, req.body.itemId, req.body.count || 1);
    if (!result.success) return fail(res, result.message, 400);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });
  app.post('/api/player/:username/use', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error, 404);
    const result = useConsumable(r.player, req.body.itemId, req.body.count || 1);
    if (!result.success) return fail(res, result.message, 400);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });

  // 出售
  app.post('/api/player/:username/sell-material', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error, 404);
    const result = sellMaterial(r.player, req.body.itemName, req.body.count || 1);
    if (!result.success) return fail(res, result.message, 400);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });
  app.post('/api/player/:username/sell-equip', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error, 404);
    const result = sellEquip(r.player, req.body.itemUid);
    if (!result.success) return fail(res, result.message, 400);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });

  // 按等级批量出售装备（maxLevel=null 视为全部）
  app.post('/api/player/:username/sell-equip-by-level', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error, 404);
    const { maxLevel } = req.body || {};
    const lv = maxLevel == null ? null : Number(maxLevel);
    if (lv != null && (Number.isNaN(lv) || lv < 0)) return fail(res, 'maxLevel 非法', 400);
    const result = sellEquipsByLevel(r.player, lv);
    if (!result.success) return fail(res, result.message, 400);
    savePlayer(store, r.player);
    res.json({ success: true, data: getPlayerView(r.player), sold: result.sold, gold: result.gold, remaining: result.remaining });
  });

  // 装备锻造：升级
  app.post('/api/player/:username/equipment/upgrade', (req, res) => {
    const { itemUid } = req.body || {};
    if (!itemUid) return fail(res, '缺少 itemUid', 400);
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error, 404);
    const result = upgradeEquipment(r.player, itemUid);
    if (!result.success) return fail(res, result.message, 400);
    savePlayer(store, r.player);
    store.safeSave();
    res.json({ success: true, data: getPlayerView(r.player), upgradeLevel: result.upgradeLevel, goldCost: result.goldCost });
  });
  app.post('/api/player/:username/equipment/merge', (req, res) => {
    const { itemUids } = req.body || {};
    if (!Array.isArray(itemUids) || itemUids.length !== 3) return fail(res, '需要选择 3 件装备', 400);
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error, 404);
    const result = mergeEquipment(r.player, itemUids);
    if (!result.success) return fail(res, result.message, 400);
    savePlayer(store, r.player);
    store.safeSave();
    res.json({ success: true, data: getPlayerView(r.player), newItem: result.newItem });
  });
  app.post('/api/player/:username/equipment/reforge', (req, res) => {
    const { itemUid } = req.body || {};
    if (!itemUid) return fail(res, '缺少 itemUid', 400);
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error, 404);
    const result = reforgeEquipment(r.player, itemUid);
    if (!result.success) return fail(res, result.message, 400);
    savePlayer(store, r.player);
    store.safeSave();
    ok(res, getPlayerView(r.player));
  });

  // v1.02：背包排序持久化（前端"整理"按钮触发）
  app.post('/api/player/:username/inventory/sort', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error, 404);
    const result = sortInventory(r.player);
    if (!result.success) return fail(res, result.message, 400);
    savePlayer(store, r.player);
    store.safeSave();
    ok(res, getPlayerView(r.player));
  });
}

module.exports = { registerCombatRoutes };
