// ====== 后台管理页 API 封装 · 零依赖 ======
// 登录后 token 存 localStorage，所有请求自动带 Authorization: Bearer
// 401/403 时清 token 并跳回登录页

const TOKEN_KEY = 'feiland_admin_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (_) {
    throw new Error('网络请求失败，请确认后端已启动');
  }

  let data = null;
  try { data = await res.json(); } catch (_) {}

  if (res.status === 401 || res.status === 403) {
    setToken(null);
    if (!location.hash.includes('/login')) location.hash = '#/login';
    throw new Error((data && data.message) || '登录已过期，请重新登录');
  }
  if (!res.ok || !data || !data.success) {
    throw new Error((data && data.message) || `请求失败(${res.status})`);
  }
  return data.data;
}

export const adminApi = {
  // 登录：ADMIN_TOKEN 换 admin JWT
  login(password) {
    return request('/admin/login', { method: 'POST', body: { password } });
  },
  // 监控总览
  overview() {
    return request('/admin/monitor/overview');
  },
  // ====== GM 功能 ======
  // 全服公告：发送 + 历史
  announce(content) {
    return request('/admin/announce', { method: 'POST', body: { content } });
  },
  announceList() {
    return request('/admin/announce/list');
  },
  // 玩家检索：搜索 + 档案
  searchPlayers(keyword) {
    return request(`/admin/players/search?keyword=${encodeURIComponent(keyword)}`);
  },
  getPlayer(username) {
    return request(`/admin/players/${encodeURIComponent(username)}`);
  },
  // ====== GM 资源发放 ======
  gmGold(username, amount) {
    return request(`/admin/players/${encodeURIComponent(username)}/gm/gold`, { method: 'POST', body: { amount } });
  },
  gmExp(username, exp) {
    return request(`/admin/players/${encodeURIComponent(username)}/gm/exp`, { method: 'POST', body: { exp } });
  },
  // 世界 BOSS：强制重新召唤（清空当前进度）
  spawnWorldBoss() {
    return request('/admin/worldboss/spawn', { method: 'POST' });
  },
};
