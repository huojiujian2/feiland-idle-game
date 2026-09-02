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
        <button class="menu-item" :class="{ active: route === 'settings' }" @click="go('settings')">
          <span class="ico">⚙️</span> 服务器设置
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
          <button class="account-btn" :class="{ 'account-warn': mustChangePwd }" @click="openAccountModal">
            <span class="ico">👤</span>
            <span>{{ currentUsername || 'admin' }}</span>
            <span v-if="mustChangePwd" class="badge-warn">!</span>
          </button>
        </div>
      </header>

      <!-- v1.08 首登/弱密码警告横幅 -->
      <div v-if="mustChangePwd" class="warn-banner">
        <span class="warn-ico">⚠️</span>
        <span class="warn-text">
          您正在使用默认账号或需要重置密码，请尽快
          <a href="#" @click.prevent="openAccountModal">修改密码</a>
          以保障后台安全。
        </span>
        <button class="warn-btn" @click="openAccountModal">立即修改</button>
      </div>

      <main class="content">
        <Dashboard v-if="route === 'dashboard'" />
        <ServerSettings v-else-if="route === 'settings'" />
        <GmPanel v-else-if="route === 'gm'" />
      </main>
    </div>

    <!-- v1.08 账号/修改密码 弹窗 -->
    <div v-if="showAccountModal" class="modal-mask" @click.self="closeAccountModal">
      <div class="modal-card">
        <div class="modal-header">
          <span class="modal-title">账号设置</span>
          <button class="modal-close" @click="closeAccountModal">✕</button>
        </div>
        <div class="modal-body">
          <div class="row">
            <span class="muted" style="width:80px;">当前账号</span>
            <strong>{{ currentUsername || '-' }}</strong>
          </div>
          <div class="row mt12">
            <span class="muted" style="width:80px;">注册时间</span>
            <span>{{ meInfo ? fmtTime(meInfo.createdAt) : '-' }}</span>
          </div>
          <div class="row mt12">
            <span class="muted" style="width:80px;">上次登录</span>
            <span>{{ meInfo ? fmtTime(meInfo.lastLoginAt) : '-' }}</span>
          </div>

          <div class="form-divider"></div>

          <div class="form-item">
            <label class="form-label">旧密码</label>
            <input v-model="pwdForm.oldPassword" class="input" type="password" autocomplete="current-password" />
          </div>
          <div class="form-item">
            <label class="form-label">新密码 <span class="muted" style="font-size:12px;">（≥8 位，含字母与数字）</span></label>
            <input v-model="pwdForm.newPassword" class="input" type="password" autocomplete="new-password" />
          </div>
          <div class="form-item">
            <label class="form-label">确认新密码</label>
            <input v-model="pwdForm.confirmPassword" class="input" type="password" autocomplete="new-password" />
          </div>

          <div v-if="pwdErr" class="login-err">{{ pwdErr }}</div>
          <div v-if="pwdOk" class="login-ok">{{ pwdOk }}</div>

          <div class="row mt16" style="justify-content:flex-end;">
            <button class="btn" @click="closeAccountModal">取消</button>
            <button class="btn btn-primary" :disabled="pwdSaving" @click="submitChangePassword">
              {{ pwdSaving ? '保存中…' : '保存新密码' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import Login from './views/Login.vue';
import Dashboard from './views/Dashboard.vue';
import GmPanel from './views/GmPanel.vue';
import ServerSettings from './views/ServerSettings.vue';
import { getToken, setToken, adminApi } from './api';

const route = ref('login');
const isDark = ref(false);
const THEME_KEY = 'feiland_admin_theme';
const MUST_CHANGE_KEY = 'feiland_admin_must_change_pwd';
const USERNAME_KEY = 'feiland_admin_username';

const currentUsername = ref('');
const mustChangePwd = ref(localStorage.getItem(MUST_CHANGE_KEY) === '1');
const showAccountModal = ref(false);
const meInfo = ref(null);
const pwdForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' });
const pwdSaving = ref(false);
const pwdErr = ref('');
const pwdOk = ref('');

function applyTheme(dark) {
  isDark.value = dark;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
}
function toggleTheme() { applyTheme(!isDark.value); }

function readRoute() {
  const h = location.hash.replace(/^#\/?/, '') || '';
  if (h.startsWith('dashboard')) return 'dashboard';
  if (h.startsWith('settings')) return 'settings';
  if (h.startsWith('gm')) return 'gm';
  return 'login';
}

function go(name) {
  route.value = name;
  if (location.hash !== `#/${name}`) location.hash = `#/${name}`;
}

function logout() {
  setToken(null);
  localStorage.removeItem(MUST_CHANGE_KEY);
  localStorage.removeItem(USERNAME_KEY);
  mustChangePwd.value = false;
  currentUsername.value = '';
  go('login');
}

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

const pageTitle = computed(() => {
  if (route.value === 'dashboard') return '服务器监控';
  if (route.value === 'settings') return '服务器设置';
  return 'GM 工具';
});

function fmtTime(ts) {
  if (!ts) return '-';
  const d = new Date(Number(ts));
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

async function fetchMe() {
  try {
    const r = await adminApi.me();
    meInfo.value = r;
    currentUsername.value = (r && r.username) || currentUsername.value || 'admin';
    // 后端返回的 mustChangePassword 是权威，覆盖本地标志
    if (r && r.mustChangePassword) {
      mustChangePwd.value = true;
      localStorage.setItem(MUST_CHANGE_KEY, '1');
    } else if (r) {
      mustChangePwd.value = false;
      localStorage.removeItem(MUST_CHANGE_KEY);
    }
  } catch (e) {
    // 401/403 已被 request 统一处理
  }
}

function openAccountModal() {
  pwdErr.value = '';
  pwdOk.value = '';
  pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' };
  showAccountModal.value = true;
  fetchMe();
}
function closeAccountModal() {
  showAccountModal.value = false;
}

async function submitChangePassword() {
  pwdErr.value = '';
  pwdOk.value = '';
  const f = pwdForm.value;
  if (!f.oldPassword || !f.newPassword || !f.confirmPassword) {
    pwdErr.value = '请填写完整';
    return;
  }
  if (f.newPassword !== f.confirmPassword) {
    pwdErr.value = '两次输入的新密码不一致';
    return;
  }
  pwdSaving.value = true;
  try {
    await adminApi.changeMyPassword(f.oldPassword, f.newPassword);
    pwdOk.value = '修改成功，下次登录请使用新密码';
    mustChangePwd.value = false;
    localStorage.removeItem(MUST_CHANGE_KEY);
    // 清空密码字段，避免锁屏后泄露
    pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' };
    setTimeout(() => { showAccountModal.value = false; }, 1500);
  } catch (e) {
    pwdErr.value = e.message || '修改失败';
  } finally {
    pwdSaving.value = false;
  }
}

onMounted(() => {
  applyTheme(localStorage.getItem(THEME_KEY) === 'dark');
  window.addEventListener('hashchange', onHashChange);
  const r = readRoute();
  if (!getToken()) {
    route.value = 'login';
    if (r !== 'login') location.hash = '#/login';
  } else {
    // 已登录：从 localStorage 恢复首登标志 + 拉取最新账号信息
    currentUsername.value = localStorage.getItem(USERNAME_KEY) || 'admin';
    if (r === 'login') {
      route.value = 'dashboard';
      location.hash = '#/dashboard';
    } else {
      route.value = r;
    }
    fetchMe();
  }
});

onUnmounted(() => {
  window.removeEventListener('hashchange', onHashChange);
});
</script>

<style scoped>
.account-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  background: var(--bg-soft, #f5f7fa);
  border: 1px solid var(--border-light, #ebeef5);
  color: var(--text, #303133);
  cursor: pointer;
  font-size: 13px;
  position: relative;
  transition: background 0.15s;
}
.account-btn:hover {
  background: var(--bg-hover, #ecf5ff);
  border-color: var(--primary, #409eff);
}
.account-warn {
  background: rgba(245, 108, 108, 0.1);
  border-color: var(--danger, #f56c6c);
  color: var(--danger, #f56c6c);
}
.badge-warn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--danger, #f56c6c);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  margin-left: 2px;
}

.warn-banner {
  margin: 12px 16px 0;
  padding: 12px 16px;
  background: rgba(245, 108, 108, 0.1);
  border: 1px solid rgba(245, 108, 108, 0.4);
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text, #303133);
}
.warn-ico { font-size: 20px; }
.warn-text { flex: 1; font-size: 13px; }
.warn-text a {
  color: var(--primary, #409eff);
  font-weight: 600;
  text-decoration: underline;
}
.warn-btn {
  padding: 5px 14px;
  background: var(--danger, #f56c6c);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-card {
  background: var(--bg, #fff);
  border-radius: 8px;
  min-width: 400px;
  max-width: 480px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-light, #ebeef5);
  font-weight: 600;
  font-size: 16px;
}
.modal-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-muted, #909399);
}
.modal-body {
  padding: 20px;
}
.modal-body .row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.form-divider {
  height: 1px;
  background: var(--border-light, #ebeef5);
  margin: 16px 0;
}
.modal-body .form-item { margin-bottom: 12px; }
.modal-body .form-label { font-size: 13px; margin-bottom: 4px; display: block; }
.login-err {
  color: var(--danger, #f56c6c);
  font-size: 12px;
  margin: 8px 0 0;
}
.login-ok {
  color: var(--success, #67c23a);
  font-size: 12px;
  margin: 8px 0 0;
}
</style>
