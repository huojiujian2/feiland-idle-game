<template>
  <div v-if="route === 'login'">
    <Login />
  </div>

  <div v-else class="layout">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <div class="sidebar-logo">
        <span class="dot"></span>
        费兰德 · 后台
      </div>
      <nav class="menu">
        <button class="menu-item" :class="{ active: route === 'dashboard' }" @click="go('dashboard')">
          <span class="ico">📊</span> 服务器监控
        </button>
        <button class="menu-item" :class="{ active: route === 'gm' }" @click="go('gm')">
          <span class="ico">🎮</span> GM 工具
        </button>
      </nav>
      <div style="padding: 12px; border-top: 1px solid var(--border-light);">
        <button class="btn btn-block" @click="logout">退出登录</button>
      </div>
    </aside>

    <!-- 主区 -->
    <div class="main">
      <header class="header">
        <div class="header-title">{{ pageTitle }}</div>
        <div class="header-right">
          <button class="btn" @click="toggleTheme">{{ isDark ? '☀️ 亮色' : '🌙 暗色' }}</button>
          <span>admin</span>
        </div>
      </header>
      <main class="content">
        <Dashboard v-if="route === 'dashboard'" />
        <GmPanel v-else-if="route === 'gm'" />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import Login from './views/Login.vue';
import Dashboard from './views/Dashboard.vue';
import GmPanel from './views/GmPanel.vue';
import { getToken, setToken } from './api';

const route = ref('login');
const isDark = ref(false);

const THEME_KEY = 'feiland_admin_theme';

function applyTheme(dark) {
  isDark.value = dark;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
}

function toggleTheme() {
  applyTheme(!isDark.value);
}

function readRoute() {
  const h = location.hash.replace(/^#\/?/, '') || '';
  if (h.startsWith('dashboard')) return 'dashboard';
  if (h.startsWith('gm')) return 'gm';
  return 'login';
}

// 路由切换：直接更新 route（立即生效，不依赖 hashchange 事件），再同步 URL hash
function go(name) {
  route.value = name;
  if (location.hash !== `#/${name}`) location.hash = `#/${name}`;
}

function logout() {
  setToken(null);
  go('login');
}

// 原生 hashchange 兜底：浏览器前进/后退、登录成功后跳转
function onHashChange() {
  const r = readRoute();
  if (!getToken()) {
    route.value = 'login';
    if (r !== 'login') location.hash = '#/login';
    return;
  }
  if (r === 'login') {
    route.value = 'dashboard';
    location.hash = '#/dashboard';
    return;
  }
  route.value = r;
}

const pageTitle = computed(() => (route.value === 'dashboard' ? '服务器监控' : 'GM 工具'));

onMounted(() => {
  applyTheme(localStorage.getItem(THEME_KEY) === 'dark');
  window.addEventListener('hashchange', onHashChange);
  const r = readRoute();
  if (!getToken()) {
    route.value = 'login';
    if (r !== 'login') location.hash = '#/login';
  } else if (r === 'login') {
    route.value = 'dashboard';
    location.hash = '#/dashboard';
  } else {
    route.value = r;
  }
});

onUnmounted(() => {
  window.removeEventListener('hashchange', onHashChange);
});
</script>
