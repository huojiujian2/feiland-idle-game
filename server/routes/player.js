// ====== 玩家基础路由：getPlayer / 区域 / 属性 / 预设 ======
const {
  calculateIdle, allocateAttributes, autoAllocateAttributes,
  saveAttrPreset, applyAttrPreset, applyAttrPresetByRatio,
  deleteAttrPreset, deleteAttrPresetBySlot,
  getPlayerView, getMapView, getOfflineSummary, updateOfflineSnapshot,
  maybeResetWeeklyBossKills, getNow,
} = require('../engine');
const { AREAS } = require('../data');
const { ok, fail } = require('./_helpers');

function registerPlayerRoutes(app, store) {
  // 获取角色（含挂机收益 + 离线收益）— 事务化（登录后第一次拉数据用）
  //   副作用：触发 calculateIdle（修改 lastTick / hp / mp / exp）+ updateOfflineSnapshot
  //   频率：登录/操作后 1 次
  app.get('/api/player/:username', (req, res) => {
    const username = req.params.username;
    if (!username) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      maybeResetWeeklyBossKills(store);
      calculateIdle(player);
      const offlineSummary = getOfflineSummary(player);
      updateOfflineSnapshot(player);
      return { status: 200, data: { playerView: getPlayerView(player), offlineSummary } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message || '保存失败请重试' });
    const pv = result.data.playerView;
    const os = result.data.offlineSummary;
    // v1.03 杠杆 4：写缓存（给后续 /view-light 用）
    try { store.viewCacheSet(username, pv, os, pv.lastTick); } catch (_) {}
    return res.json({ success: true, data: { player: pv, offlineSummary: os }, player: pv, offlineSummary: os });
  });

  // v1.03 杠杆 2：view-light 轻量 endpoint（前端 5s 轮询专用）
  //   优化：
  //     1. 不走 withTransaction（不触发 JSON.stringify(data) 120MB 序列化）
  //     2. 不调 calculateIdle（idle loop 已每 5s 跑一次，前端再调一次是浪费）
  //     3. 不调 updateOfflineSnapshot（同理，idle loop 已处理）
  //     4. viewCache 命中时跳过 getPlayerView（按 player.lastTick 失效）
  //   收益：60 用户 × 每 5s = 12 req/s → 单次响应时间从 ~10ms 降到 <1ms（缓存命中）
  //   行为变化：无（返回的 view 与 /api/player/:u 完全一致）
  app.get('/api/player/:username/view-light', (req, res) => {
    const username = req.params.username;
    if (!username) return fail(res, '缺少参数', 400);
    const player = store.getPlayer(username);
    if (!player) return fail(res, '角色不存在', 404);
    // 尝试缓存命中（按 lastTick 失效）
    try {
      const cached = store.viewCacheGet(username, player.lastTick);
      if (cached) {
        return res.json({ success: true, data: { player: cached.view, offlineSummary: cached.offlineSnapshot }, player: cached.view, offlineSummary: cached.offlineSnapshot, cached: true });
      }
    } catch (_) { /* cache miss path */ }
    // 缓存未命中：计算 view（不写盘）
    // v1.05：加防御——getPlayerView 偶发异常时记录堆栈，避免"500 空 body 难排查"
    let view;
    try {
      view = getPlayerView(player);
    } catch (e) {
      console.error(`[view-light] ${username} getPlayerView 异常:`, e && e.stack);
      return fail(res, '视图计算失败', 500);
    }
    // 注意：getOfflineSummary 修改 player.offlineSnapshot（副作用），view-light 不应触发
    //   所以这里只读 player.offlineSnapshot（已被 idle loop 维护）
    const offlineSummary = player.offlineSnapshot || { offlineSeconds: 0, batches: [] };
    // 写缓存（供下次命中）
    try { store.viewCacheSet(username, view, offlineSummary, player.lastTick); } catch (_) {}
    return res.json({ success: true, data: { player: view, offlineSummary }, player: view, offlineSummary, cached: false });
  });

  // v1.05 地图页专属轻视图：只返回地图页需要的字段（logs / currentArea / level / maxHp /
  //   strategies / strategyCdRemaining），响应体远小于 getPlayerView。
  //   与 view-light 一致：不走 withTransaction、不调 calculateIdle，纯只读。
  app.get('/api/player/:username/view-map', (req, res) => {
    const username = req.params.username;
    if (!username) return fail(res, '缺少参数', 400);
    const player = store.getPlayer(username);
    if (!player) return fail(res, '角色不存在', 404);
    let view;
    try {
      view = getMapView(player);
    } catch (e) {
      console.error(`[view-map] ${username} getMapView 异常:`, e && e.stack);
      return fail(res, '视图计算失败', 500);
    }
    return res.json({ success: true, data: { player: view } });
  });

  // 切换区域
  app.post('/api/player/:username/area', (req, res) => {
    const username = req.params.username;
    const { areaId } = req.body || {};
    if (!areaId) return fail(res, '缺少参数', 400);
    const rExists = store.getPlayer(username);
    if (!rExists) return fail(res, '角色不存在', 404);
    const area = AREAS[areaId];
    if (!area) return fail(res, '区域不存在', 404);
    if ((rExists.level || 1) < area.minLevel) return fail(res, `需要 Lv.${area.minLevel} 才能进入${area.name}`, 400);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const a = AREAS[areaId];
      if (!a) return { status: 404, message: '区域不存在' };
      if ((player.level || 1) < a.minLevel) return { status: 400, message: `需要 Lv.${a.minLevel} 才能进入${a.name}` };
      player.currentArea = areaId;
      player.lastTick = getNow();
      return { status: 200, data: getPlayerView(player) };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });

  // 分配属性
  app.post('/api/player/:username/attributes', (req, res) => {
    const username = req.params.username;
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = allocateAttributes(player, req.body || {});
      if (!r.success) return { status: 400, message: r.message };
      return { status: 200, data: getPlayerView(player) };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });

  // 一键加点
  app.post('/api/player/:username/auto-allocate', (req, res) => {
    const username = req.params.username;
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = autoAllocateAttributes(player);
      if (!r.success) return { status: 400, message: r.message };
      return { status: 200, data: { player: getPlayerView(player), allocated: r.allocated, job: r.job } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return res.json({ success: true, data: { allocated: result.data.allocated, job: result.data.job, player: result.data.player } });
  });

  // v1.02：自定义头像（点击头像弹菜单选择，5 个预设 emoji）
  app.post('/api/player/:username/avatar', (req, res) => {
    const username = req.params.username;
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const avatar = (req.body && typeof req.body.avatar === 'string') ? req.body.avatar : '';
    if (avatar.length > 8) return fail(res, '头像内容过长', 400);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      if (avatar.length > 8) return { status: 400, message: '头像内容过长' };
      player.avatar = avatar;
      return { status: 200, data: { avatar: player.avatar, playerView: getPlayerView(player) } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, { avatar: result.data.avatar });
  });

  // 属性预设
  app.post('/api/player/:username/attr-presets', (req, res) => {
    const username = req.params.username;
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = saveAttrPreset(
        player,
        req.body.name,
        Number.isInteger(req.body.slot) ? req.body.slot : null,
        req.body.attributes || null,
        req.body.delta || null
      );
      if (!r.success) return { status: 400, message: r.message };
      return { status: 200, data: getPlayerView(player) };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });
  app.post('/api/player/:username/attr-presets/:presetId/apply', (req, res) => {
    const username = req.params.username;
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = applyAttrPreset(player, req.params.presetId);
      if (!r.success) return { status: 400, message: r.message };
      return { status: 200, data: { player: getPlayerView(player), allocated: r.allocated } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return res.json({ success: true, data: result.data.player, allocated: result.data.allocated });
  });
  // v0.8+：按 4 维数字比例直接加点（4 个固定模板：全力/铁壁/血牛/风影）
  // body: { ratio: { atk, def, hp, agi } } — 内部按总和归一化
  app.post('/api/player/:username/attr-presets/apply-by-ratio', (req, res) => {
    const username = req.params.username;
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const ratio = req.body && req.body.ratio;
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = applyAttrPresetByRatio(player, ratio || {});
      if (!r.success) return { status: 400, message: r.message };
      return { status: 200, data: { player: getPlayerView(player), allocated: r.allocated } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return res.json({ success: true, data: result.data.player, allocated: result.data.allocated });
  });
  // v0.8+：按 slot 索引删除一个属性预设（前端 emit 已带 slot：0/1/2）
  app.post('/api/player/:username/attr-presets/delete-by-slot', (req, res) => {
    const username = req.params.username;
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const slot = req.body && req.body.slot;
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = deleteAttrPresetBySlot(player, Number(slot));
      if (!r.success) return { status: 400, message: r.message };
      return { status: 200, data: getPlayerView(player) };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });
  app.delete('/api/player/:username/attr-presets/:presetId', (req, res) => {
    const username = req.params.username;
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      const r = deleteAttrPreset(player, req.params.presetId);
      if (!r.success) return { status: 400, message: r.message };
      return { status: 200, data: getPlayerView(player) };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });
}

module.exports = { registerPlayerRoutes };
