<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-title">费兰德世界 · 后台管理</div>
      <div class="login-sub">请输入管理密码（ADMIN_TOKEN）</div>
      <form @submit.prevent="doLogin">
        <div class="form-item">
          <label class="form-label">管理密码</label>
          <input
            v-model="password"
            class="input"
            type="password"
            placeholder="ADMIN_TOKEN"
            autocomplete="current-password"
            :disabled="loading"
          />
        </div>
        <div class="login-err">{{ err }}</div>
        <button class="btn btn-primary btn-lg btn-block" type="submit" :disabled="loading || !password">
          {{ loading ? '登录中…' : '登 录' }}
        </button>
      </form>
      <div class="row mt16" style="justify-content: center;">
        <span class="muted" style="font-size: 12px;">服务器环境变量 ADMIN_TOKEN 即为登录密码</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { adminApi, setToken } from '../api';

const password = ref('');
const err = ref('');
const loading = ref(false);

async function doLogin() {
  if (!password.value || loading.value) return;
  loading.value = true;
  err.value = '';
  try {
    const data = await adminApi.login(password.value);
    setToken(data.token);
    location.hash = '#/dashboard';
  } catch (e) {
    err.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>
