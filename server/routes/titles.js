// ====== 称号路由 ======
// GET  /api/player/:username/titles   → 玩家可用称号列表（已解锁职业称号 + 未过期限时称号）
// POST /api/player/:username/titles/equip { key }   → 佩戴指定称号（佩戴限时称号需未过期）
const { ok, fail } = require('./_helpers');
const { ALL_TITLES, getUnlockedJobTitles, getActiveTimeTitles, getOwnedPermanentTitles, getOwnedCockfightTitles, isValidTitleKey } = require('../data');
const { migratePlayer, getNow } = require('../engine');

function registerTitleRoutes(app, store) {
  app.get('/api/player/:username/titles', (req, res) => {
    const username = req.params.username;
    if (!username) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      migratePlayer(player);
      const now = getNow();
      if (player.titleExpiry && typeof player.titleExpiry === 'object') {
        for (const k of Object.keys(player.titleExpiry)) {
          if (player.titleExpiry[k] <= now) {
            delete player.titleExpiry[k];
            if (player.titles) delete player.titles[k];
          }
        }
      }
      if (player.currentTitle) {
        const exp = player.titleExpiry && player.titleExpiry[player.currentTitle];
        if (Number.isFinite(exp) && exp <= now) {
          player.currentTitle = null;
        } else if (player.currentTitle && !isValidTitleKey(player.currentTitle)) {
          player.currentTitle = null;
        } else if (player.currentTitle && !player.titles[player.currentTitle]) {
          // If currentTitle not in owned titles and not unlocked job title, clear? But keep logic: if expired already handled, else check if still valid via sources?
          // For safety, if currentTitle is world boss title and expired, already cleared. Otherwise, keep.
        }
      }
      // Ensure currentTitle is null if not owned and not unlocked (conservative: keep as is if unlocked job titles)
      // But spec says: if currentTitle expired set to null, which already done. No need extra.
      const job = getUnlockedJobTitles(player);
      const time = getActiveTimeTitles(player);
      const permanent = getOwnedPermanentTitles(player);
      const cockfight = getOwnedCockfightTitles(player);
      return {
        status: 200,
        data: {
          currentTitle: player.currentTitle || null,
          unlocked: job,
          active: time,
          permanent,
          cockfight,
          all: ALL_TITLES,
        }
      };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message || '保存失败请重试' });
    return ok(res, result.data);
  });

  app.post('/api/player/:username/titles/equip', (req, res) => {
    const username = req.params.username;
    if (!username) return fail(res, '缺少参数', 400);
    const existing = store.getPlayer(username);
    if (!existing) return fail(res, '角色不存在', 404);
    const body = req.body || {};
    // key can be null for unequip
    const hasKey = Object.prototype.hasOwnProperty.call(body, 'key');
    const key = body.key;
    if (!hasKey) return fail(res, '请选择称号', 400);
    // key === null means unequip
    if (key === null) {
      const result = store.withTransaction((data) => {
        const player = data.players[username];
        if (!player) return { status: 404, message: '角色不存在' };
        migratePlayer(player);
        player.currentTitle = null;
        return { status: 200, data: { currentTitle: null } };
      });
      if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message || '保存失败请重试' });
      return ok(res, result.data);
    }
    if (typeof key !== 'string' || key.trim() === '') return fail(res, '请选择称号', 400);
    if (!isValidTitleKey(key)) return fail(res, '称号不存在', 404);
    const result = store.withTransaction((data) => {
      const player = data.players[username];
      if (!player) return { status: 404, message: '角色不存在' };
      migratePlayer(player);
      // clean expired first (like GET)
      const now = getNow();
      if (player.titleExpiry && typeof player.titleExpiry === 'object') {
        for (const k of Object.keys(player.titleExpiry)) {
          if (player.titleExpiry[k] <= now) {
            delete player.titleExpiry[k];
            if (player.titles) delete player.titles[k];
          }
        }
        if (player.currentTitle && player.titleExpiry && player.titleExpiry[player.currentTitle] && player.titleExpiry[player.currentTitle] <= now) {
          player.currentTitle = null;
        }
      }
      // validate 5 sources
      const unlocked = getUnlockedJobTitles(player).some(t => t.key === key);
      const timeActive = getActiveTimeTitles(player).some(t => t.key === key);
      const permanentOwned = getOwnedPermanentTitles(player).some(t => t.key === key);
      const cockfightOwned = getOwnedCockfightTitles(player).some(t => t.key === key);
      let achievementOwned = false;
      if (player.achievements && typeof player.achievements === 'object') {
        for (const rec of Object.values(player.achievements)) {
          if (rec && rec.claimed && rec.grantedTitle === key) {
            achievementOwned = true;
            break;
          }
        }
      }
      // Also check if title is already in player.titles but not covered by above (e.g., achievement title already stored)
      // However spec's 5 sources include achievement grantedTitle, so if title exists in player.titles but not from those 4, it must be achievement.
      // We already check achievementOwned, so if not unlocked/time/permanent/cockfight/achievement, fail.
      if (!unlocked && !timeActive && !permanentOwned && !cockfightOwned && !achievementOwned) {
        // Check if title is owned via player.titles but is achievement title that we missed due to rec.grantedTitle mismatch?
        // For robustness, if player.titles[key] exists and isValidTitleKey, but none of sources matched, still consider 409.
        return { status: 409, message: '该称号尚未解锁或已过期' };
      }
      player.currentTitle = key;
      return { status: 200, data: { currentTitle: key } };
    });
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    return ok(res, result.data);
  });
}

module.exports = { registerTitleRoutes };
