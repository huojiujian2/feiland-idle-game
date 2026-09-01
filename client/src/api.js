// API 请求封装 · v1.03 · JWT 鉴权支持
// 登录成功后服务端返回 { token, username }，这里保存到 localStorage，
// 每次请求自动附带 Authorization: Bearer <token>。
// 401 响应 → 清除 + 触发回调（让 App.vue 跳回登录页）。

const BASE = '/api'
const TOKEN_KEY = 'ferland-jwt'
const USERNAME_KEY = 'ferland-username'

// 全局 401 回调（由 App.vue 设置）
let onUnauthorized = () => {
  try {
    // 默认 fallback：清掉 token，让下次跳到登录页
    clearAuth()
  } catch (_) {}
}

export function setUnauthorizedHandler(fn) { onUnauthorized = fn }
export function getToken() { try { return localStorage.getItem(TOKEN_KEY) } catch (_) { return null } }
export function getUsername() { try { return localStorage.getItem(USERNAME_KEY) } catch (_) { return null } }
export function clearAuth() {
  try { localStorage.removeItem(TOKEN_KEY) } catch (_) {}
  try { localStorage.removeItem(USERNAME_KEY) } catch (_) {}
}
export function setAuth(token, username) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    if (username) localStorage.setItem(USERNAME_KEY, username)
  } catch (_) {}
}

async function request(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  }
  // 自动附带 Authorization header
  const tok = getToken()
  if (tok) headers['Authorization'] = `Bearer ${tok}`

  let res
  try {
    res = await fetch(BASE + url, {
      ...options,
      headers
    })
  } catch (e) {
    // v1.03 P2 3.6：网络异常打印真实信息（debug 用）+ 友好的用户提示
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[api] 网络异常:', url, e && e.message);
    }
    return { success: false, message: '网络异常：无法连接服务器，请确认后端已启动' }
  }
  // 401 → token 无效/过期 → 清掉 + 回调
  if (res.status === 401) {
    try { clearAuth() } catch (_) {}
    try { onUnauthorized() } catch (_) {}
    let data = null
    try { data = await res.json() } catch (_) {}
    return { success: false, message: (data && data.message) || '未登录或登录已过期' }
  }
  let data = null
  try { data = await res.json() } catch (_) { data = null }
  if (!res.ok) {
    // 5xx 服务端错误 → console.error 打印详情（便于排查）+ 用户友好提示
    if (res.status >= 500 && typeof console !== 'undefined' && console.error) {
      console.error('[api] 服务端错误:', url, res.status, data && data.message);
    }
    return { success: false, message: (data && data.message) || `请求失败 (${res.status})` }
  }
  if (!data || typeof data.success === 'undefined') {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[api] 响应格式异常:', url, data);
    }
    return { success: false, message: '服务器响应格式异常' }
  }
  return data
}

export default {
  // 账号
  register(username, password) {
    return request('/register', { method: 'POST', body: JSON.stringify({ username, password }) })
  },
  async login(username, password) {
    const r = await request('/login', { method: 'POST', body: JSON.stringify({ username, password }) })
    // 登录成功后保存 token
    if (r && r.success && r.token) {
      setAuth(r.token, r.username || username)
    }
    return r
  },
  async createCharacter(username, charName) {
    const r = await request(`/player/${username}/create-character`, { method: 'POST', body: JSON.stringify({ charName }) })
    // 创建角色成功后 token 可能不变（已在登录时拿到）；若服务端同时返回新 token 也覆盖
    if (r && r.success && r.token) setAuth(r.token, r.username || username)
    return r
  },

  // 玩家
  getPlayer(username) { return request(`/player/${username}`) },
  // v1.03 杠杆 2：轻量 view（前端轮询专用）
  //   跳过 withTransaction + calculateIdle → 不触发 JSON.stringify(data) 120MB
  //   行为与 getPlayer 一致，但响应时间 <1ms（命中缓存时）
  getPlayerLight(username) { return request(`/player/${username}/view-light`) },
  changeArea(username, areaId) { return request(`/player/${username}/area`, { method: 'POST', body: JSON.stringify({ areaId }) }) },
  allocateAttributes(username, allocation) { return request(`/player/${username}/attributes`, { method: 'POST', body: JSON.stringify(allocation) }) },
  autoAllocate(username) { return request(`/player/${username}/auto-allocate`, { method: 'POST' }) },
  applyPresetRatio(username, ratio) { return request(`/player/${username}/attr-presets/apply-by-ratio`, { method: 'POST', body: JSON.stringify({ ratio }) }) },

  // 属性预设
  setAvatar(username, avatar) {
    return request(`/player/${username}/avatar`, { method: 'POST', body: JSON.stringify({ avatar: avatar || '' }) })
  },
  saveAttrPreset(username, payload) {
    let body;
    if (typeof payload === 'string') {
      body = { name: payload };
    } else {
      body = payload;
    }
    return request(`/player/${username}/attr-presets`, {
      method: 'POST', body: JSON.stringify(body)
    })
  },
  applyAttrPreset(username, presetId) {
    return request(`/player/${username}/attr-presets/${presetId}/apply`, { method: 'POST' })
  },
  deleteAttrPresetBySlot(username, slot) {
    return request(`/player/${username}/attr-presets/delete-by-slot`, { method: 'POST', body: JSON.stringify({ slot }) })
  },
  deleteAttrPreset(username, presetId) {
    return request(`/player/${username}/attr-presets/${presetId}`, { method: 'DELETE' })
  },

  // 转生点商店
  getReincShop(username) {
    return request(`/reinc-shop${username ? `?username=${encodeURIComponent(username)}` : ''}`)
  },
  buyReincShopItem(username, itemId, option) {
    return request('/reinc-shop/buy', {
      method: 'POST', body: JSON.stringify({ username, itemId, option })
    })
  },

  // 职业
  chooseJob(username, jobPath) { return request(`/player/${username}/job`, { method: 'POST', body: JSON.stringify({ jobPath }) }) },
  getJobs() { return request('/data/jobs') },

  // 词条
  equipAffix(username, affixId, slot) { return request(`/player/${username}/affix`, { method: 'POST', body: JSON.stringify({ affixId, slot }) }) },
  unequipAffix(username, affixId) { return request(`/player/${username}/affix/unequip`, { method: 'POST', body: JSON.stringify({ affixId }) }) },
  getAffixes() { return request('/data/affixes') },

  // 装备
  equip(username, itemUid) { return request(`/player/${username}/equip`, { method: 'POST', body: JSON.stringify({ itemUid }) }) },
  unequip(username, slot) { return request(`/player/${username}/unequip`, { method: 'POST', body: JSON.stringify({ slot }) }) },

  // 商店
  getShop(username) { return request(`/shop${username ? `?username=${encodeURIComponent(username)}` : ''}`) },
  buy(username, itemId, count) { return request(`/player/${username}/buy`, { method: 'POST', body: JSON.stringify({ itemId, count }) }) },
  useItem(username, itemId, count) { return request(`/player/${username}/use`, { method: 'POST', body: JSON.stringify({ itemId, count }) }) },

  // 出售
  sellMaterial(username, itemName, count) { return request(`/player/${username}/sell-material`, { method: 'POST', body: JSON.stringify({ itemName, count }) }) },
  sellEquip(username, itemUid) { return request(`/player/${username}/sell-equip`, { method: 'POST', body: JSON.stringify({ itemUid }) }) },
  sellEquipsByLevel(username, maxLevel) { return request(`/player/${username}/sell-equip-by-level`, { method: 'POST', body: JSON.stringify({ maxLevel }) }) },

  // 区域
  getAreas() { return request('/areas') },

  // 种族进化
  evolve(username) { return request(`/player/${username}/evolve`, { method: 'POST' }) },

  // 附魔
  enchant(username, itemUid, recipeId) { return request(`/player/${username}/enchant`, { method: 'POST', body: JSON.stringify({ itemUid, recipeId }) }) },

  // 法则
  learnLaw(username, lawId) { return request(`/player/${username}/learn-law`, { method: 'POST', body: JSON.stringify({ lawId }) }) },

  // 登神
  ascend(username) { return request(`/player/${username}/ascend`, { method: 'POST' }) },

  // 图鉴
  getCodex() { return request('/codex') },

  // 排行榜
  getLeaderboard(type, username) {
    const q = username ? `?type=${type}&username=${encodeURIComponent(username)}` : `?type=${type}`;
    return request(`/leaderboard${q}`)
  },
  reincarnate(username) { return request(`/player/${username}/reincarnate`, { method: 'POST' }) },
  autoReincarnate(username, times, targetLevel) {
    return request(`/player/${username}/auto-reincarnate`, { method: 'POST', body: JSON.stringify({ times, targetLevel }) })
  },
  getReincarnationInfo(username) { return request(`/player/${username}/reincarnation`) },
  markReincarnHintShown(username) { return request(`/player/${username}/reincarn-hint-shown`, { method: 'POST' }) },
  upgradeEquipment(username, itemUid) {
    return request(`/player/${username}/equipment/upgrade`, {
      method: 'POST',
      body: JSON.stringify({ itemUid })
    })
  },
  mergeEquipment(username, itemUids) {
    return request(`/player/${username}/equipment/merge`, {
      method: 'POST',
      body: JSON.stringify({ itemUids })
    })
  },
  reforgeEquipment(username, itemUid) {
    return request(`/player/${username}/equipment/reforge`, {
      method: 'POST',
      body: JSON.stringify({ itemUid })
    })
  },
  sortInventory(username) {
    return request(`/player/${username}/inventory/sort`, {
      method: 'POST',
      body: JSON.stringify({})
    })
  },
  // 世界 BOSS
  getWorldBoss(username) {
    const q = username ? `?username=${encodeURIComponent(username)}` : '';
    return request(`/worldboss/active${q}`);
  },
  attackWorldBoss(username) {
    return request(`/player/${username}/worldboss/attack`, { method: 'POST' })
  },

  // 称号
  getTitles(username) { return request(`/player/${username}/titles`) },
  equipTitle(username, key) { return request(`/player/${username}/titles/equip`, { method: 'POST', body: JSON.stringify({ key }) }) },

  // 灵鸡斗场
  getCockfight(username) { return request(`/player/${username}/cockfight`) },
  enterCockArena(username) { return request(`/player/${username}/cockfight/enter`, { method: 'POST' }) },
  resolveCockRound(username, bet, intervention, createdAt) {
    return request(`/player/${username}/cockfight/resolve`, { method: 'POST', body: JSON.stringify({ bet, intervention, createdAt }) })
  },
  exchangeCockfightTitle(username, titleKey) {
    return request(`/player/${username}/cockfight/exchange`, { method: 'POST', body: JSON.stringify({ titleKey }) })
  },

  // 创世之书
  getGenesis(username) { return request(`/player/${username}/genesis`) },
  birthMonster(username, draft) { return request(`/player/${username}/genesis/monster`, { method: 'POST', body: JSON.stringify(draft) }) },
  forgeEquip(username, draft) { return request(`/player/${username}/genesis/equip`, { method: 'POST', body: JSON.stringify(draft) }) },
  deleteGenesis(username, kind, id) { return request(`/player/${username}/genesis/delete`, { method: 'POST', body: JSON.stringify({ kind, id }) }) },
  getPlayerNames() { return request('/players/names') },

  // 战斗策略
  setStrategy(username, strategy) { return request(`/player/${username}/strategy`, { method: 'POST', body: JSON.stringify({ strategy }) }) },

  // 远征
  getExpeditionConfig() { return request('/expedition/config') },
  getExpedition(username) { return request(`/player/${username}/expedition`) },
  dispatchExpedition(username, areaId, durationKey) { return request(`/player/${username}/expedition/dispatch`, { method: 'POST', body: JSON.stringify({ areaId, durationKey }) }) },
  chooseExpeditionEvent(username, eventId, choiceId) { return request(`/player/${username}/expedition/event/choose`, { method: 'POST', body: JSON.stringify({ eventId, choiceId }) }) },
  claimExpedition(username, expeditionId) { return request(`/player/${username}/expedition/claim`, { method: 'POST', body: JSON.stringify({ expeditionId }) }) },

  // 公会
  getGuilds(q, page, pageSize) {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (page) qs.set('page', String(page));
    if (pageSize) qs.set('pageSize', String(pageSize));
    const s = qs.toString();
    return request(`/guilds${s ? `?${s}` : ''}`);
  },
  getMyGuild(username) { return request(`/player/${username}/guild`) },
  createGuild(username, name) { return request(`/player/${username}/guild/create`, { method: 'POST', body: JSON.stringify({ name }) }) },
  joinGuild(username, guildId) { return request(`/player/${username}/guild/join`, { method: 'POST', body: JSON.stringify({ guildId }) }) },
  leaveGuild(username) { return request(`/player/${username}/guild/leave`, { method: 'POST' }) },
  kickGuildMember(username, targetUsername) { return request(`/player/${username}/guild/kick`, { method: 'POST', body: JSON.stringify({ targetUsername }) }) },
  updateGuildRole(username, targetUsername, role) { return request(`/player/${username}/guild/role`, { method: 'POST', body: JSON.stringify({ targetUsername, role }) }) },
  transferGuild(username, targetUsername) { return request(`/player/${username}/guild/transfer`, { method: 'POST', body: JSON.stringify({ targetUsername }) }) },
  updateGuildAnnouncement(username, text) { return request(`/player/${username}/guild/announcement`, { method: 'POST', body: JSON.stringify({ text }) }) },
  donateGuild(username, donateId) { return request(`/player/${username}/guild/donate`, { method: 'POST', body: JSON.stringify({ donateId }) }) },
  disbandGuild(username) { return request(`/player/${username}/guild/disband`, { method: 'POST' }) },

  // 任务
  claimDaily(username, questId) { return request(`/player/${username}/quest/daily/${questId}/claim`, { method: 'POST' }) },
  claimChest(username) { return request(`/player/${username}/quest/chest/claim`, { method: 'POST' }) },
  claimAchievement(username, achId) { return request(`/player/${username}/quest/achievement/${achId}/claim`, { method: 'POST' }) },
  claimDailyActive(username, tier) { return request(`/player/${username}/daily-active/claim`, { method: 'POST', body: JSON.stringify({ tier }) }) },

  // 引导
  updateTutorial(username, step) { return request(`/player/${username}/tutorial`, { method: 'POST', body: JSON.stringify({ step }) }) },

  // 竞技场
  getOpponents(username) { return request(`/arena/opponents/${username}`) },
  challenge(username, targetUsername, isBot, requestId) {
    return request('/arena/challenge', {
      method: 'POST',
      body: JSON.stringify({ username, targetUsername, isBot, requestId })
    })
  },
  getArenaRanking() { return request('/arena/ranking') },
  getArenaRecords(username) { return request(`/arena/records/${username}`) },
  getArenaShop(username) { return request(`/arena/shop${username ? `?username=${encodeURIComponent(username)}` : ''}`) },
  buyArenaItem(username, itemId) {
    return request('/arena/buy', {
      method: 'POST',
      body: JSON.stringify({ username, itemId })
    })
  },
  getArenaSeason(username) {
    const q = username ? `?username=${encodeURIComponent(username)}` : '';
    return request(`/arena/season${q}`)
  },
  getArenaRewards(period, username) {
    const q = username ? `?username=${encodeURIComponent(username)}` : '';
    return request(`/arena/rewards/${period}${q}`)
  },
}