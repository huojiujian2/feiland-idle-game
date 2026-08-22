// ====== 战斗相关路由：词条/装备/商店/使用/出售/锻造/合成/重铸 ======
const {
  equipAffix, unequipAffix,
  equipItem, unequipItem,
  useConsumable, buyItem,
  sellMaterial, sellEquip,
  upgradeEquipment, mergeEquipment, reforgeEquipment,
  getPlayerView,
} = require('../engine');
const { SHOP_ITEMS, EQUIP_TEMPLATES, QUALITY_COLORS, AFFIX_LEVELS, AFFIX_TREE } = require('../data');
const { ok, fail, loadPlayer, savePlayer } = require('./_helpers');

function registerCombatRoutes(app, store) {
  // 词条装备/卸下
  app.post('/api/player/:username/affix', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = equipAffix(r.player, req.body.affixId, req.body.slot);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });
  app.post('/api/player/:username/affix/unequip', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = unequipAffix(r.player, req.body.affixId);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });

  // 静态数据
  app.get('/api/data/affixes', (req, res) => res.json({ success: true, data: { levels: AFFIX_LEVELS, tree: AFFIX_TREE } }));

  // 装备穿戴/卸下
  app.post('/api/player/:username/equip', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = equipItem(r.player, req.body.itemUid);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });
  app.post('/api/player/:username/unequip', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = unequipItem(r.player, req.body.slot);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });
  app.get('/api/data/equipments', (req, res) => res.json({ success: true, data: { templates: EQUIP_TEMPLATES, colors: QUALITY_COLORS } }));

  // 商店
  app.get('/api/shop', (req, res) => res.json({ success: true, data: SHOP_ITEMS }));
  app.post('/api/player/:username/buy', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = buyItem(r.player, req.body.itemId, req.body.count || 1);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });
  app.post('/api/player/:username/use', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = useConsumable(r.player, req.body.itemId, req.body.count || 1);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });

  // 出售
  app.post('/api/player/:username/sell-material', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = sellMaterial(r.player, req.body.itemName, req.body.count || 1);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });
  app.post('/api/player/:username/sell-equip', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = sellEquip(r.player, req.body.itemUid);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });

  // 装备锻造：升级
  app.post('/api/player/:username/equipment/upgrade', (req, res) => {
    const { itemUid } = req.body || {};
    if (!itemUid) return fail(res, '缺少 itemUid');
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = upgradeEquipment(r.player, itemUid);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    store.save();
    res.json({ success: true, data: getPlayerView(r.player), upgradeLevel: result.upgradeLevel, goldCost: result.goldCost });
  });
  app.post('/api/player/:username/equipment/merge', (req, res) => {
    const { itemUids } = req.body || {};
    if (!Array.isArray(itemUids) || itemUids.length !== 3) return fail(res, '需要选择 3 件装备');
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = mergeEquipment(r.player, itemUids);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    store.save();
    res.json({ success: true, data: getPlayerView(r.player), newItem: result.newItem });
  });
  app.post('/api/player/:username/equipment/reforge', (req, res) => {
    const { itemUid } = req.body || {};
    if (!itemUid) return fail(res, '缺少 itemUid');
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = reforgeEquipment(r.player, itemUid);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    store.save();
    ok(res, getPlayerView(r.player));
  });
}

module.exports = { registerCombatRoutes };
