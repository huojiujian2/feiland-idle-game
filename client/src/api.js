// API 请求封装 v0.3
const BASE = '/api'

async function request(url, options = {}) {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  return res.json()
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
  getShop() { return request('/shop') },
  buy(username, itemId, count) { return request(`/player/${username}/buy`, { method: 'POST', body: JSON.stringify({ itemId, count }) }) },
  useItem(username, itemId, count) { return request(`/player/${username}/use`, { method: 'POST', body: JSON.stringify({ itemId, count }) }) },

  // 出售
  sellMaterial(username, itemName, count) { return request(`/player/${username}/sell-material`, { method: 'POST', body: JSON.stringify({ itemName, count }) }) },
  sellEquip(username, itemUid) { return request(`/player/${username}/sell-equip`, { method: 'POST', body: JSON.stringify({ itemUid }) }) },

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

  // 战斗策略
  setStrategy(username, strategy) { return request(`/player/${username}/strategy`, { method: 'POST', body: JSON.stringify({ strategy }) }) }
}
