<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-title">费兰德世界 · 后台管理</div>
      <div class="login-sub">请输入账号与密码</div>
      <form @submit.prevent="doLogin">
        <div class="form-item">
          <label class="form-label">账号</label>
          <input
            v-model="username"
            class="input"
            type="text"
            placeholder="admin"
            autocomplete="username"
            :disabled="loading"
          />
        </div>
        <div class="form-item">
          <label class="form-label">密码</label>
          <input
            v-model="password"
            class="input"
            type="password"
            placeholder="首次登录密码：admin"
            autocomplete="current-password"
            :disabled="loading"
          />
        </div>
        <div v-if="err" class="login-err">{{ err }}</div>
        <button class="btn btn-primary btn-lg btn-block" type="submit" :disabled="loading || !username || !password">
          {{ loading ? '登录中…' : '登 录' }}
        </button>
      </form>
      <div class="login-hint">
        <span class="muted">首次部署默认账号 <code>admin</code> / 密码 <code>admin</code>，登录后会强制要求修改密码。</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { adminApi, setToken } from '../api';

const username = ref('admin');
const password = ref('');
const err = ref('');
const loading = ref(false);

async function doLogin() {
  if (!username.value || !password.value || loading.value) return;
  loading.value = true;
  err.value = '';
  try {
    const data = await adminApi.login(username.value, password.value);
    setToken(data.token);
    // 首登：把 mustChangePassword 暂存到 localStorage（顶栏 App.vue 读这个展示警告 + 跳转）
    if (data.mustChangePassword) {
      localStorage.setItem('feiland_admin_must_change_pwd', '1');
    } else {
      localStorage.removeItem('feiland_admin_must_change_pwd');
    }
    localStorage.setItem('feiland_admin_username', data.username || username.value);
    location.hash = '#/dashboard';
  } catch (e) {
    err.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-hint {
  margin-top: 16px;
  padding: 10px 12px;
  background: var(--bg-soft, #f5f7fa);
  border-radius: 6px;
  text-align: center;
  font-size: 12px;
  line-height: 1.6;
}
.login-hint code {
  background: rgba(64, 158, 255, 0.12);
  color: var(--primary, #409eff);
  padding: 1px 6px;
  border-radius: 3px;
  font-family: monospace;
}
</style>
