// ====== 玩家基础路由：getPlayer / 区域 / 属性 / 预设 ======
const {
  calculateIdle, allocateAttributes, autoAllocateAttributes,
  saveAttrPreset, applyAttrPreset, deleteAttrPreset,
  getPlayerView, getOfflineSummary, updateOfflineSnapshot,
  maybeResetWeeklyBossKills, getNow,
} = require('../engine');
const { AREAS } = require('../data');
const { ok, fail, loadPlayer, savePlayer } = require('./_helpers');

function registerPlayerRoutes(app, store) {
  // 获取角色（含挂机收益 + 离线收益）
  app.get('/api/player/:username', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const player = r.player;
    maybeResetWeeklyBossKills(store);
    calculateIdle(player);
    const offlineSummary = getOfflineSummary(player);
    updateOfflineSnapshot(player);
    savePlayer(store, player);
    res.json({ success: true, data: getPlayerView(player), offlineSummary });
  });

  // 切换区域
  app.post('/api/player/:username/area', (req, res) => {
    const { areaId } = req.body;
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const area = AREAS[areaId];
    if (!area) return fail(res, '区域不存在');
    if (r.player.level < area.minLevel) return fail(res, `需要 Lv.${area.minLevel} 才能进入${area.name}`);
    r.player.currentArea = areaId;
    r.player.lastTick = getNow();
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });

  // 分配属性
  app.post('/api/player/:username/attributes', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = allocateAttributes(r.player, req.body);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });

  // 一键加点
  app.post('/api/player/:username/auto-allocate', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = autoAllocateAttributes(r.player);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    res.json({ success: true, data: { allocated: result.allocated, job: result.job, player: getPlayerView(r.player) } });
  });

  // 属性预设
  app.post('/api/player/:username/attr-presets', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = saveAttrPreset(r.player, req.body.name);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });
  app.post('/api/player/:username/attr-presets/:presetId/apply', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = applyAttrPreset(r.player, req.params.presetId);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    res.json({ success: true, data: getPlayerView(r.player), allocated: result.allocated });
  });
  app.delete('/api/player/:username/attr-presets/:presetId', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const result = deleteAttrPreset(r.player, req.params.presetId);
    if (!result.success) return fail(res, result.message);
    savePlayer(store, r.player);
    ok(res, getPlayerView(r.player));
  });
}

module.exports = { registerPlayerRoutes };
