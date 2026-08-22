<template>
  <!-- 登录/注册/创建角色界面 -->
  <div v-if="!player" class="login-screen">
    <div class="login-bg" style="background-image: url('/img/login-bg.jpg')"></div>
    <div class="login-box">
      <div class="login-title">
        <span class="login-icon"><IconBase name="sword" :size="38" class="icon-accent-glow" /></span>
        <h1>费兰德世界</h1>
        <p>从鹰人部落到天使帝国 · 挂机文字成长</p>
      </div>

      <!-- 登录 -->
      <div v-if="loginStep === 'login'">
        <input v-model="usernameInput" class="login-input" placeholder="账号"
          @keyup.enter="$refs.pwdInput?.focus()" maxlength="16" />
        <input v-model="passwordInput" class="login-input" placeholder="密码" type="password"
          ref="pwdInput" @keyup.enter="handleLogin" maxlength="32" />
        <div class="login-btns">
          <button class="btn btn-primary login-btn" @click="handleLogin">登录</button>
          <button class="btn login-btn" @click="loginStep = 'register'">注册新账号</button>
        </div>
        <p class="login-hint">输入账号密码登录，新玩家请先注册</p>
      </div>

      <!-- 注册 -->
      <div v-else-if="loginStep === 'register'">
        <input v-model="usernameInput" class="login-input" placeholder="设置账号"
          maxlength="16" />
        <input v-model="passwordInput" class="login-input" placeholder="设置密码" type="password"
          maxlength="32" />
        <input v-model="passwordConfirm" class="login-input" placeholder="确认密码" type="password"
          @keyup.enter="handleRegister" maxlength="32" />
        <div class="login-btns">
          <button class="btn btn-primary login-btn" @click="handleRegister">确认注册</button>
          <button class="btn login-btn" @click="loginStep = 'login'">返回登录</button>
        </div>
      </div>

      <!-- 创建角色 -->
      <div v-else-if="loginStep === 'create'">
        <div class="create-hint">欢迎来到费兰德世界！请为你的角色命名</div>
        <div class="create-race-preview">
          <div class="race-portrait">
            <img src="/img/race-eagle.jpg" alt="鹰人" />
          </div>
          <span class="race-tag"><IconBase name="feather" :size="14" class="icon-accent" /> 鹰人</span>
          <span class="race-desc">凡尘大陆的低等种族，拥有飞行的天赋</span>
        </div>
        <input v-model="charNameInput" class="login-input" placeholder="输入角色名..."
          @keyup.enter="handleCreateChar" maxlength="12" />
        <button class="btn btn-primary login-btn" @click="handleCreateChar">创建角色</button>
      </div>
    </div>
  </div>
</template>

<script setup>
// ====== 登录/注册/创建角色界面 ======
// @file components/LoginScreen
// @module login-screen
// @description 游戏启动前的登录界面（登录/注册/创建角色 3 步流程）
import { ref } from 'vue';
import IconBase from './icons/IconBase.vue';
import { toast } from '../ui-bridge.js';

defineProps({
  player: { type: Object, default: null },
});
const emit = defineEmits(['login', 'register', 'create']);

const loginStep = ref('login'); // 'login' | 'register' | 'create'
const usernameInput = ref('');
const passwordInput = ref('');
const passwordConfirm = ref('');
const charNameInput = ref('');

function handleLogin() {
  if (!usernameInput.value || !passwordInput.value) return toast.warn('请输入账号和密码');
  emit('login', { username: usernameInput.value, password: passwordInput.value });
}
function handleRegister() {
  if (!usernameInput.value || !passwordInput.value) return toast.warn('请填写账号和密码');
  if (passwordInput.value !== passwordConfirm.value) return toast.warn('两次密码不一致');
  emit('register', { username: usernameInput.value, password: passwordInput.value });
}
function handleCreateChar() {
  if (!charNameInput.value.trim()) return toast.warn('请输入角色名');
  emit('create', { charName: charNameInput.value.trim() });
}
// 供父组件（App.vue）切换步骤：例如登录成功但账号还没有角色时，跳到创建角色
defineExpose({ setStep: (s) => { loginStep.value = s; } });
</script>

<style scoped>
.login-screen { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 100; }
.login-bg { position: absolute; inset: 0; background-size: cover; background-position: center; opacity: 0.4; z-index: -1; }
.login-box { background: rgba(20,22,42,0.92); border: 1px solid var(--accent); border-radius: 12px; padding: 2rem 2.5rem; max-width: 380px; width: 100%; box-shadow: 0 0 40px rgba(212,175,94,0.2); }
.login-title { text-align: center; margin-bottom: 1.5rem; }
.login-title h1 { font-size: 1.8rem; color: var(--accent); margin: 0.5rem 0; font-weight: 800; }
.login-title p { font-size: 0.78rem; color: var(--muted); margin: 0; }
.login-icon { display: inline-block; }
.login-input { width: 100%; padding: 0.6rem 0.8rem; margin-bottom: 0.7rem; background: rgba(13,14,26,0.6); border: 1px solid var(--rule); border-radius: 6px; color: var(--text); font-size: 0.9rem; font-family: inherit; outline: none; transition: border-color 0.15s; }
.login-input:focus { border-color: var(--accent); }
.login-btns { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
.login-btn { flex: 1; padding: 0.6rem; font-weight: 700; }
.login-hint { text-align: center; font-size: 0.7rem; color: var(--dim); margin-top: 0.7rem; }

.create-hint { text-align: center; color: var(--text); margin-bottom: 0.8rem; font-size: 0.85rem; }
.create-race-preview { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; padding: 0.8rem; background: rgba(20,22,42,0.6); border-radius: 6px; margin-bottom: 0.8rem; }
.race-portrait { width: 80px; height: 80px; border-radius: 50%; overflow: hidden; border: 2px solid var(--accent); }
.race-portrait img { width: 100%; height: 100%; object-fit: cover; }
.race-tag { font-size: 0.85rem; font-weight: 700; color: var(--accent); display: flex; align-items: center; gap: 0.3rem; }
.race-desc { font-size: 0.7rem; color: var(--muted); text-align: center; line-height: 1.4; }
</style>
