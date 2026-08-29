// ====== 创世系统路由 ======
const {
  isGenesisUnlocked, listGenesis,
  birthMonster, forgeEquip, deleteGenesis,
  migratePlayer, getPlayerView, getNow,
} = require('../engine');
const { ok, fail, loadPlayer, savePlayer } = require('./_helpers');

function registerGenesisRoutes(app, store) {
  // 拉取创世之书的目录（种族/词缀/限额 + 自己已创造的所有项）
  app.get('/api/player/:username/genesis', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error, 404);
    const meta = store.getMeta();
    const data = listGenesis(r.player, meta);
    return ok(res, { ...data, unlocked: isGenesisUnlocked(r.player) });
  });

  // 降生：捏怪物
  app.post('/api/player/:username/genesis/monster', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error, 404);
    const meta = store.getMeta();
    const draft = req.body || {};
    const result = birthMonster(r.player, draft, meta);
    if (!result.success) return fail(res, result.message, 400);
    savePlayer(store, r.player);
    store.setMeta(meta);
    store.safeSave();
    return ok(res, { monster: result.monster, oracle: result.oracle, player: getPlayerView(r.player) });
  });

  // 锻造：造装备
  app.post('/api/player/:username/genesis/equip', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error, 404);
    const meta = store.getMeta();
    const draft = req.body || {};
    const result = forgeEquip(r.player, draft, meta);
    if (!result.success) return fail(res, result.message, 400);
    savePlayer(store, r.player);
    store.setMeta(meta);
    store.safeSave();
    return ok(res, { equip: result.equip, oracle: result.oracle, player: getPlayerView(r.player) });
  });

  // 抹去：删除自创项
  app.post('/api/player/:username/genesis/delete', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error, 404);
    const meta = store.getMeta();
    const { kind, id } = req.body || {};
    if (kind !== 'monsters' && kind !== 'equips') return fail(res, 'kind 必须为 monsters 或 equips', 400);
    const result = deleteGenesis(r.player, kind, id, meta);
    if (!result.success) return fail(res, result.message, 400);
    savePlayer(store, r.player);
    store.setMeta(meta);
    store.safeSave();
    return ok(res, { oracle: result.oracle, player: getPlayerView(r.player) });
  });

  // 全服公开浏览：列出当前世界上所有自创怪（用于地图详情等场景）
  app.get('/api/genesis/public', (req, res) => {
    const meta = store.getMeta();
    const g = meta.genesis || { monsters: [], equips: [] };
    return ok(res, {
      monsters: g.monsters || [],
      equips:   g.equips   || [],
    });
  });
}

module.exports = { registerGenesisRoutes };
