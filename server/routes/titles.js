// ====== 称号路由 ======
// GET  /api/player/:username/titles   → 玩家可用称号列表（已解锁职业称号 + 未过期限时称号）
// POST /api/player/:username/titles/equip { key }   → 佩戴指定称号（佩戴限时称号需未过期）
const { ok, fail, loadPlayer, savePlayer } = require('./_helpers');
const { ALL_TITLES, getUnlockedJobTitles, getActiveTimeTitles, getOwnedPermanentTitles, getOwnedCockfightTitles, isValidTitleKey } = require('../data');

function registerTitleRoutes(app, store) {
  app.get('/api/player/:username/titles', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const player = r.player;
    // 顺手把过期的限时称号从列表里清掉，避免永久堆积
    const now = Date.now();
    if (player.titleExpiry) {
      for (const k of Object.keys(player.titleExpiry)) {
        if (player.titleExpiry[k] <= now) {
          delete player.titleExpiry[k];
          delete player.titles[k];
        }
      }
      savePlayer(store, player);
    }
    const job = getUnlockedJobTitles(player);
    const time = getActiveTimeTitles(player);
    const permanent = getOwnedPermanentTitles(player);
    const cockfight = getOwnedCockfightTitles(player);
    return ok(res, {
      currentTitle: player.currentTitle || null,
      unlocked: job,
      active: time,
      permanent,
      cockfight,
      all: ALL_TITLES,
    });
  });

  app.post('/api/player/:username/titles/equip', (req, res) => {
    const r = loadPlayer(store, req.params.username);
    if (r.error) return fail(res, r.error);
    const player = r.player;
    const { key } = req.body || {};
    if (!key) return fail(res, '请选择称号');
    if (!isValidTitleKey(key)) return fail(res, '称号不存在');
    // 职业称号：必须已解锁
    const unlocked = getUnlockedJobTitles(player).some(t => t.key === key);
    // 限时称号：必须在有效期内
    const timeActive = getActiveTimeTitles(player).some(t => t.key === key);
    // 永久称号：必须已购买（竞技场商店）
    const permanentOwned = getOwnedPermanentTitles(player).some(t => t.key === key);
    // 斗鸡称号：必须已兑换/成就获得（灵鸡斗场）
    const cockfightOwned = getOwnedCockfightTitles(player).some(t => t.key === key);
    if (!unlocked && !timeActive && !permanentOwned && !cockfightOwned) {
      return fail(res, '该称号尚未解锁或已过期');
    }
    player.currentTitle = key;
    savePlayer(store, player);
    return ok(res, { currentTitle: key });
  });
}

module.exports = { registerTitleRoutes };