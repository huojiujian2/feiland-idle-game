// API 请求封装 v0.3
const BASE = '/api'

async function request(url, options = {}) {
  try {
    const res = await fetch(BASE + url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    })
    // 先解析 body（服务器出错时 body 里也可能带 message）
    let data = null
    try { data = await res.json() } catch (_) { data = null }
    if (!res.ok) {
      return { success: false, message: (data && data.message) || `请求失败 (${res.status})` }
    }
    if (!data || typeof data.success === 'undefined') {
      return { success: false, message: '服务器响应格式异常' }
    }
    return data
  } catch (_) {
    // 断网 / 后端未启动 / DNS 失败等：统一转为可提示的错误结果，避免 unhandled rejection
    return { success: false, message: '网络异常：无法连接服务器，请确认后端已启动' }
  }
}

export default {
  // 账号
  register(username, password) { return request('/register', { method: 'POST', body: JSON.stringify({ username, password }) }) },
  login(username, password) { return request('/login', { method: 'POST', body: JSON.stringify({ username, password }) }) },
  createCharacter(username, charName) { return request(`/player/${username}/create-character`, { method: 'POST', body: JSON.stringify({ charName }) }) },

  // 角色
  getPlayer(username) { return request(`/player/${username}`) },
  changeArea(username, areaId) { return request(`/player/${username}/area`, { method: 'POST', body: JSON.stringify({ areaId }) }) },
  allocateAttributes(username, allocation) { return request(`/player/${username}/attributes`, { method: 'POST', body: JSON.stringify(allocation) }) },
  autoAllocate(username) { return request(`/player/${username}/auto-allocate`, { method: 'POST' }) },

  // 属性预设
  saveAttrPreset(username, name) {
    return request(`/player/${username}/attr-presets`, {
      method: 'POST', body: JSON.stringify({ name })
    })
  },
  applyAttrPreset(username, presetId) {
    return request(`/player/${username}/attr-presets/${presetId}/apply`, { method: 'POST' })
  },
  deleteAttrPreset(username, presetId) {
    return request(`/player/${username}/attr-presets/${presetId}`, { method: 'DELETE' })
  },

  // 转生点商店
  getReincShop() { return request('/reinc-shop') },
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

  // 商店（携带用户名，后端按等级过滤材料货架）
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
    const q = username ? `?type=${type}&username=${encodeURIComponent(username)}` : `?type=${type}`
    return request(`/leaderboard${q}`)
  },
  reincarnate(username) { return request(`/player/${username}/reincarnate`, { method: 'POST' }) },
  getReincarnationInfo(username) { return request(`/player/${username}/reincarnation`) },
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
  // 世界 BOSS
  getWorldBoss() { return request('/worldboss/active') },
  attackWorldBoss(username) {
    return request(`/player/${username}/worldboss/attack`, { method: 'POST' })
  },

  // 战斗策略
  setStrategy(username, strategy) { return request(`/player/${username}/strategy`, { method: 'POST', body: JSON.stringify({ strategy }) }) },

  // 任务/委托
  claimDaily(username, questId) { return request(`/player/${username}/quest/daily/${questId}/claim`, { method: 'POST' }) },
  claimChest(username) { return request(`/player/${username}/quest/chest/claim`, { method: 'POST' }) },
  claimAchievement(username, achId) { return request(`/player/${username}/quest/achievement/${achId}/claim`, { method: 'POST' }) },

  // 引导
  updateTutorial(username, step) { return request(`/player/${username}/tutorial`, { method: 'POST', body: JSON.stringify({ step }) }) },

  // 竞技场
  getOpponents(username) { return request(`/arena/opponents/${username}`) },
  challenge(username, targetUsername, isBot) {
    return request('/arena/challenge', {
      method: 'POST',
      body: JSON.stringify({ username, targetUsername, isBot })
    })
  },
  getArenaRanking() { return request('/arena/ranking') },
  getArenaRecords(username) { return request(`/arena/records/${username}`) },
  getArenaShop() { return request('/arena/shop') },
  buyArenaItem(username, itemId) {
    return request('/arena/buy', {
      method: 'POST',
      body: JSON.stringify({ username, itemId })
    })
  },
  getArenaSeason(username) {
    const q = username ? `?username=${encodeURIComponent(username)}` : ''
    return request(`/arena/season${q}`)
  },
  getArenaRewards(period, username) {
    const q = username ? `?username=${encodeURIComponent(username)}` : ''
    return request(`/arena/rewards/${period}${q}`)
  },
  // settleArena 已废弃：竞技场奖励改为自动结算，前端不再调用
  // （接口保留以便日后排查/管理员手动触发）
  // settleArena(period) {
  //   return request('/arena/settle', {
  //     method: 'POST',
  //     body: JSON.stringify({ period })
  //   })
  // }
}
