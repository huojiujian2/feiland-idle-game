<template>
  <!-- 登录/注册/创建角色界面（v0.8 沉浸版：羊皮卷轴 + 符文星图） -->
  <div v-if="!player" class="login-screen">
    <!-- 沉浸式层：星尘 / 符文环 / 烛光 / 羊皮纸纹理 -->
    <div class="imm-bg" aria-hidden="true">
      <div class="imm-stars"></div>
      <div class="imm-rune-ring"></div>
      <div class="imm-candle imm-candle--left"></div>
      <div class="imm-candle imm-candle--right"></div>
      <div class="imm-parchment"></div>
      <div class="imm-vignette"></div>
    </div>

    <div class="login-scroll">
      <!-- 标题区 -->
      <header class="login-hero">
        <div class="hero-rune" aria-hidden="true">
          <span class="hero-rune-dot"></span>
        </div>
        <h1 class="login-title">
          <span class="login-title-main">世界之门的回响</span>
        </h1>
        <p class="login-subtitle" :key="loginStep + '-sub'">
          <template v-if="loginStep === 'login'">以真名归来</template>
          <template v-else-if="loginStep === 'register'">你将被世界铭记</template>
          <template v-else>为你的灵魂取一个真名</template>
        </p>
      </header>

      <!-- 翻书页切换容器 -->
      <div class="page-flip" :class="{ flipping: isFlipping }">
        <transition name="parchment" mode="out-in">
          <!-- 登录 -->
          <LoginForm
            v-if="loginStep === 'login'"
            key="login"
            v-model="loginFormData"
            :login-error="loginError"
            :submitting="submitting"
            :remember-me="rememberMe"
            @update:modelValue="loginFormData = $event"
            @update:rememberMe="rememberMe = $event"
            @login="handleLogin"
            @switch="switchTo"
            @clear-login-error="loginError = ''"
            ref="loginFormRef"
          />

          <!-- 注册 -->
          <RegisterForm
            v-else-if="loginStep === 'register'"
            key="register"
            v-model="registerFormData"
            :register-error="registerError"
            :submitting="submitting"
            :agreed-to-laws="agreedToLaws"
            @update:modelValue="registerFormData = $event"
            @update:agreedToLaws="agreedToLaws = $event"
            @register="handleRegister"
            @switch="switchTo"
            @clear-register-error="registerError = ''"
          />

          <!-- 注册成功：契约刻下的过渡面板 -->
          <div v-else-if="loginStep === 'created'" key="created" class="parchment parchment--oracle">
            <div class="oracle-mark" aria-hidden="true">
              <div class="oracle-ring oracle-ring--1"></div>
              <div class="oracle-ring oracle-ring--2"></div>
              <div class="oracle-ring oracle-ring--3"></div>
              <span class="oracle-star">✦</span>
            </div>
            <p class="oracle-text">
              契约成立。<span class="oracle-name">{{ registeredName }}</span>，你的名字已刻入命运之书。
            </p>
            <p class="oracle-text oracle-text--dim">欢迎归来。</p>
          </div>

          <!-- 创建角色 -->
          <CreateCharacterForm
            v-else
            key="create"
            v-model:selected-race="selectedRace"
            v-model:char-name-input="charNameInput"
            @create="handleCreateChar"
          />
        </transition>
      </div>

      <!-- 底部神谕（不同步骤不同提示） -->
      <p class="oracle-quote" :key="loginStep + '-quote'">
        <template v-if="loginStep === 'login'">"失落的灵魂，回应星空的召唤吧"</template>
        <template v-else-if="loginStep === 'register'">"你已经归来，新名字将响彻诸界"</template>
        <template v-else-if="loginStep === 'created'">"执剑者，准备好了吗？"</template>
        <template v-else-if="loginStep === 'create'">"血脉已择，真名待刻，卷轴在等"</template>
        <template v-else>"每个英雄，都从一声呼唤开始"</template>
      </p>
    </div>
  </div>
</template>

<script setup>
// ====== 登录/注册/创建角色界面 v0.8（模块化重定向壳） ======
// @file components/LoginScreen
// @module login-screen
// @description 沉浸式西幻主题容器：羊皮卷轴 + 符文星图 + 烛光 + 翻书动画
//              业务表单已拆分到 4 个子组件（LoginScreen/ 目录下），本文件仅保留：
//              1. 沉浸背景层 + 标题区 + 翻书容器
//              2. 跨子组件共享状态：loginStep / username / password / rememberMe / submitting / 等
//              3. 暴露给 App.vue 的 setStep / setLoginError / setRegisterError / setRegisterResult
//              4. 4 子组件通过 :deep() 透传样式（共用样式集中在下方 <style scoped>）
//
// 本文件结构：
// 1. 模板：沉浸背景 + 标题 + 翻书页 + 子组件切换（L1-L100）
// 2. 共享状态 + localStorage 记忆 + 校验 watcher（L101-L160）
// 3. 翻书页切换 + 业务处理（L161-L220）
// 4. 暴露给 App.vue 的方法（defineExpose）（L221-L250）
// 5. 样式（沉浸背景 + 标题 + 羊皮卷轴 + 字段 + 按钮 + 神谕 + 翻书 + 三族 + 命运之书 + 移动端）（L251-）
import { ref, watch, onMounted, nextTick } from 'vue';
import LoginForm from './LoginScreen/LoginForm.vue';
import RegisterForm from './LoginScreen/RegisterForm.vue';
import CreateCharacterForm from './LoginScreen/CreateCharacterForm.vue';
import { toast } from '../ui-bridge.js';

defineProps({
  player: { type: Object, default: null },
});
const emit = defineEmits(['login', 'register', 'create']);

// ====== 共享状态（跨子组件） ======
const loginStep = ref('login'); // 'login' | 'register' | 'create' | 'created'
const isFlipping = ref(false);
const submitting = ref(false);
const registeredName = ref('');
const loginError = ref('');
const registerError = ref('');

// 登录/注册共享的 username/password（注册后自动带入登录页"刚刚注册的账号"）
const loginFormData = ref({ username: '', password: '' });
const registerFormData = ref({ username: '', password: '', passwordConfirm: '' });
const rememberMe = ref(false);
const agreedToLaws = ref(false);
// 创建角色状态（selectedRace 父壳持有，避免 RaceSelector 局部重置；预览 vs 落档：永远是 eagle）
const selectedRace = ref('eagle');
const charNameInput = ref('');

// v2.5：浏览器记忆——localStorage 持久化账号/密码
const REMEMBER_KEY = 'feiland_remember_v1';
function loadRemembered() {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && typeof data.username === 'string' && typeof data.password === 'string') {
      return data;
    }
  } catch (_) { /* 忽略解析失败 */ }
  return null;
}
function saveRemembered(username, password) {
  try {
    localStorage.setItem(REMEMBER_KEY, JSON.stringify({ username, password, savedAt: Date.now() }));
  } catch (_) { /* 隐私模式 / 配额满时静默 */ }
}
function clearRemembered() {
  try { localStorage.removeItem(REMEMBER_KEY); } catch (_) {}
}
// 组件挂载时：自动填上次"铭记此身"保存的账号密码
const _remembered = loadRemembered();
if (_remembered) {
  loginFormData.value.username = _remembered.username;
  loginFormData.value.password = _remembered.password;
  rememberMe.value = true;
}

// 输入时清错误（子组件 emit clear-* 已自动清，但这里再加一道父壳兜底）
watch([() => loginFormData.value.username, () => loginFormData.value.password], () => {
  if (loginError.value) loginError.value = '';
});
watch([() => registerFormData.value.username, () => registerFormData.value.password, () => registerFormData.value.passwordConfirm, agreedToLaws], () => {
  if (registerError.value) registerError.value = '';
});

// ====== 翻书页切换 ======
function switchTo(step) {
  if (loginStep.value === step) return;
  isFlipping.value = true;
  setTimeout(() => {
    loginStep.value = step;
    isFlipping.value = false;
  }, 280);
}

// ====== 业务：登录 / 注册 / 建角色 ======
async function handleLogin() {
  if (submitting.value) return;
  const { username, password } = loginFormData.value;
  if (!username || !password) {
    return toast.warn('请输入真名与秘钥');
  }
  submitting.value = true;
  try {
    if (rememberMe.value) {
      saveRemembered(username, password);
    } else {
      clearRemembered();
    }
    await emit('login', { username, password });
  } finally {
    submitting.value = false;
  }
}
async function handleRegister() {
  if (submitting.value) return;
  const { username, password, passwordConfirm } = registerFormData.value;
  if (!username || !password) {
    return toast.warn('请填写真名与秘钥');
  }
  if (password.length < 8) {
    return toast.warn('秘钥需至少 8 位，灵魂才不会被邪灵窥视');
  }
  if (password !== passwordConfirm) {
    return toast.warn('两次秘钥不一致，灵魂彷徨');
  }
  if (!agreedToLaws.value) {
    return toast.warn('请先宣读星空律法');
  }
  submitting.value = true;
  registeredName.value = username;
  // v2.8 fix：emit 不回传父函数返回值，由 App.vue 注册完成后调 setRegisterResult()
  emit('register', { username, password });
}
function handleCreateChar() {
  const name = charNameInput.value.trim();
  if (name.length < 2) return toast.warn('真名至少 2 个字符');
  emit('create', { charName: name });
}

// 供父组件（App.vue）切换步骤 + 设置 inline 错误
defineExpose({
  setStep: (s) => { loginStep.value = s; },
  setLoginError: (msg) => { loginError.value = msg || ''; },
  setRegisterError: (msg) => { registerError.value = msg || ''; },
  // v2.8 fix：注册完成后回传结果
  setRegisterResult: (ok, rawMsg) => {
    submitting.value = false;
    if (ok) {
      registerError.value = '';
      // 注册成功后把用户名带入登录页
      loginFormData.value = {
        username: registerFormData.value.username,
        password: registerFormData.value.password,
      };
      switchTo('created');
      // 2.4s 后回到登录页（契约成立后等待服务器建账号态）
      setTimeout(() => {
        if (loginStep.value === 'created') switchTo('login');
      }, 2400);
      return;
    }
    // v2.7 文案规则：以"契约未成"开头，配合后端真实原因
    const raw = rawMsg || '契约未成';
    registerError.value = raw.includes('已存在')
      ? '此真名已被另一个灵魂烙印，请换一个'
      : `契约未成：${raw}`;
    // 滚动到错误位置
    nextTick(() => {
      const el = document.querySelector('.login-error-msg');
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  },
});

onMounted(() => {
  // 微微错峰入场（视觉节拍）
  setTimeout(() => {
    const userEl = document.querySelector('.login-screen input[autocomplete="username"]');
    userEl?.focus?.();
  }, 250);
});
</script>

<style scoped>
/* ============ 沉浸背景层 ============ */
.login-screen {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 100;
  background: #06070d;
  overflow: hidden;
}
.imm-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}
.imm-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 20% 10%, rgba(var(--violet-rgb),0.18), transparent 55%),
    radial-gradient(ellipse at 80% 90%, rgba(var(--gold-rgb),0.12), transparent 55%),
    radial-gradient(ellipse at 50% 50%, rgba(255,200,120,0.05), transparent 70%),
    linear-gradient(180deg, #0a0b14 0%, #06070d 100%);
}
.imm-stars {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(1px 1px at 12% 18%, rgba(255,235,180,0.9), transparent 50%),
    radial-gradient(1px 1px at 28% 72%, rgba(var(--gold-rgb),0.7), transparent 50%),
    radial-gradient(1px 1px at 45% 35%, rgba(255,255,255,0.8), transparent 50%),
    radial-gradient(1px 1px at 68% 22%, rgba(var(--violet-rgb),0.8), transparent 50%),
    radial-gradient(2px 2px at 82% 65%, rgba(255,220,140,0.6), transparent 50%),
    radial-gradient(1px 1px at 8% 88%, rgba(255,235,180,0.6), transparent 50%),
    radial-gradient(1px 1px at 92% 12%, rgba(255,255,255,0.7), transparent 50%);
  background-size: 600px 600px;
  animation: stars-drift 38s linear infinite;
  opacity: 0.85;
}
@keyframes stars-drift {
  from { background-position: 0 0; }
  to { background-position: -600px 600px; }
}
.imm-rune-ring {
  position: absolute;
  top: 8%;
  left: 50%;
  width: 520px;
  height: 520px;
  transform: translateX(-50%);
  border: 1px dashed rgba(var(--gold-rgb),0.18);
  border-radius: 50%;
  animation: rune-rotate 60s linear infinite;
}
.imm-rune-ring::before,
.imm-rune-ring::after {
  content: '';
  position: absolute;
  inset: 36px;
  border: 1px solid rgba(var(--gold-rgb),0.08);
  border-radius: 50%;
}
.imm-rune-ring::after {
  inset: 72px;
  border-style: dotted;
  border-color: rgba(var(--violet-rgb),0.15);
  animation: rune-rotate 90s linear infinite reverse;
}
@keyframes rune-rotate {
  to { transform: translateX(-50%) rotate(360deg); }
}
.imm-candle {
  position: absolute;
  bottom: 6%;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,180,90,0.22) 0%, rgba(255,150,60,0.06) 40%, transparent 70%);
  filter: blur(4px);
  animation: candle-flicker 3.6s ease-in-out infinite;
}
.imm-candle--left { left: -60px; }
.imm-candle--right { right: -60px; animation-delay: 1.4s; }
@keyframes candle-flicker {
  0%, 100% { opacity: 0.55; transform: scale(1); }
  35% { opacity: 0.85; transform: scale(1.06); }
  60% { opacity: 0.7; transform: scale(0.97); }
}
.imm-parchment {
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(45deg, rgba(var(--gold-rgb),0.018) 0 2px, transparent 2px 8px),
    repeating-linear-gradient(-45deg, rgba(var(--violet-rgb),0.018) 0 2px, transparent 2px 8px);
  mix-blend-mode: screen;
  opacity: 0.7;
}
.imm-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%);
}

/* ============ 主滚动容器 ============ */
.login-scroll {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0.5rem 1rem;
}

/* ============ 标题区 ============ */
.login-hero {
  text-align: center;
  position: relative;
  padding: 0.4rem 0 0.2rem;
  animation: fadeInUp 0.7s var(--ease-out, ease) both;
}
.hero-rune {
  width: 56px;
  height: 56px;
  margin: 0 auto 0.6rem;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hero-rune::before,
.hero-rune::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid rgba(var(--gold-rgb),0.35);
  border-radius: 50%;
  animation: rune-rotate 22s linear infinite;
}
.hero-rune::after {
  inset: 8px;
  border-style: dotted;
  border-color: rgba(var(--violet-rgb),0.3);
  animation-duration: 14s;
  animation-direction: reverse;
}
.hero-rune-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 16px rgba(var(--gold-rgb),0.7), 0 0 4px #fff;
  animation: rune-pulse 2.4s ease-in-out infinite;
}
@keyframes rune-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 16px rgba(var(--gold-rgb),0.7), 0 0 4px #fff; }
  50% { transform: scale(1.25); box-shadow: 0 0 24px rgba(var(--gold-rgb),1), 0 0 6px #fff; }
}
.login-title {
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 1.7rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: 0.06em;
  position: relative;
}
.login-title-main {
  background: linear-gradient(135deg, #f0d896 0%, #d4af5e 45%, #9d7c3a 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 0 36px rgba(var(--gold-rgb),0.3);
  filter: drop-shadow(0 0 12px rgba(var(--gold-rgb),0.25));
}
.login-subtitle {
  font-size: 0.82rem;
  color: rgba(var(--gold-rgb),0.7);
  letter-spacing: 0.16em;
  margin-top: 0.4rem;
  font-style: italic;
  animation: fadeIn 0.5s var(--ease-out, ease) both;
}

/* ============ 羊皮卷轴卡片 ============ */
.page-flip {
  width: 100%;
  perspective: 1200px;
  position: relative;
}
.parchment {
  position: relative;
  width: 100%;
  background:
    linear-gradient(135deg, rgba(60,46,28,0.88) 0%, rgba(38,28,16,0.92) 100%);
  border: 1px solid rgba(var(--gold-rgb),0.18);
  border-radius: 4px;
  padding: 1.6rem 1.6rem 1.4rem;
  box-shadow:
    0 0 0 1px rgba(0,0,0,0.4) inset,
    0 0 24px rgba(var(--gold-rgb),0.10),
    0 8px 28px rgba(0,0,0,0.5);
}
.parchment::before,
.parchment::after {
  content: '';
  position: absolute;
  left: 8px; right: 8px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(var(--gold-rgb),0.55), transparent);
}
.parchment::before { top: 6px; }
.parchment::after { bottom: 6px; }
.parchment-inner {
  position: relative;
  border: 0;
  padding: 0.5rem 0.4rem 0.2rem;
  border-radius: 0;
}
.parchment-inner::before {
  content: '✦';
  position: absolute;
  top: -6px;
  left: -6px;
  width: 16px; height: 16px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #d4af5e, #8a6c2e);
  color: #1a1208;
  font-size: 9px;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(var(--gold-rgb),0.7);
  z-index: 2;
}
.parchment-inner::after {
  content: '✦';
  position: absolute;
  bottom: -6px;
  right: -6px;
  width: 16px; height: 16px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #d4af5e, #8a6c2e);
  color: #1a1208;
  font-size: 9px;
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(var(--gold-rgb),0.6);
}

/* ============ 子组件样式透传（:deep()） ============
   4 个子组件（LoginForm / RegisterForm / CreateCharacterForm / RaceSelector）都使用
   .field / .field-row / .parchment-input / .btn-rune / .login-error-msg 等 class。
   scoped 样式只对当前组件模板生效，必须用 :deep() 让子组件内部 class 命中。*/
:deep(.field) { margin-bottom: 0.9rem; }
:deep(.field-label) {
  display: block;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--accent);
  letter-spacing: 0.12em;
  margin-bottom: 0.35rem;
  font-family: var(--font-display, 'Cinzel', serif);
  text-shadow: 0 0 8px rgba(var(--gold-rgb),0.25);
}
:deep(.field-row) {
  position: relative;
  display: flex;
  align-items: center;
  background: transparent;
  border: 0;
  border-bottom: 1px solid rgba(var(--gold-rgb),0.35);
  border-radius: 0;
  padding: 0.2rem 0.1rem 0.55rem;
  transition: border-color 0.25s var(--ease-out, ease), background 0.25s;
}
:deep(.field-row::before) {
  content: '';
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0,0,0,0.4), transparent);
  pointer-events: none;
}
:deep(.field-row.is-focus) {
  border-bottom-color: var(--accent);
  background: linear-gradient(180deg, transparent 0%, rgba(var(--gold-rgb),0.06) 100%);
}
:deep(.field-row.is-focus::before) { opacity: 0; }
:deep(.field-row.is-valid) { border-bottom-color: rgba(94,218,122,0.7); }
:deep(.field-row.is-warn) { border-bottom-color: rgba(224,180,80,0.65); }
:deep(.field-row.is-invalid) { border-bottom-color: rgba(224,88,88,0.7); }
:deep(.parchment-input) {
  flex: 1;
  background: transparent;
  border: 0;
  outline: 0;
  padding: 0.45rem 0.4rem;
  color: #f3e8c4;
  font-size: 0.98rem;
  font-family: inherit;
  letter-spacing: 0.04em;
  caret-color: var(--accent);
}
:deep(.parchment-input::placeholder) { color: rgba(var(--gold-rgb),0.4); font-style: italic; }
:deep(.parchment-input--rune) {
  font-family: 'Cinzel', 'Noto Sans SC', serif;
  letter-spacing: 0.18em;
}
:deep(.field-icon) {
  padding: 0 0.4rem;
  color: rgba(var(--gold-rgb),0.6);
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 0;
  user-select: none;
  pointer-events: none;
  line-height: 1;
}
:deep(.field-row.is-valid .field-icon) { color: var(--success); }
:deep(.field-row.is-invalid .field-icon) { color: var(--danger); }
:deep(.field-icon--astrolabe) { transition: color 0.2s; }
:deep(.rune-toggle) {
  background: transparent;
  border: 0;
  padding: 0 0.4rem;
  cursor: pointer;
  color: rgba(var(--gold-rgb),0.55);
  font-size: 1.05rem;
  display: flex;
  align-items: center;
  transition: color 0.15s;
  border-radius: 0;
  box-shadow: none;
  outline: 0;
  line-height: 1;
}
:deep(.rune-toggle:hover) { color: var(--accent); }
:deep(.rune-eye) { line-height: 1; }
:deep(.rune-eye--closed) { color: rgba(var(--violet-rgb),0.55); }
:deep(.field-hint) {
  font-size: 0.7rem;
  color: rgba(var(--gold-rgb),0.55);
  margin: 0.35rem 0 0 0.1rem;
  letter-spacing: 0.05em;
  font-style: italic;
}
:deep(.field-hint.is-valid) { color: rgba(94,218,122,0.85); }
:deep(.field-hint.is-invalid) { color: rgba(224,88,88,0.85); }
:deep(.login-error-msg) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.6rem 0 0;
  padding: 0.55rem 0.7rem;
  background: rgba(224,88,88,0.10);
  border: 1px solid rgba(224,88,88,0.35);
  border-radius: 6px;
  color: rgba(255,180,180,0.95);
  font-size: 0.78rem;
  line-height: 1.4;
  animation: errorShake 0.36s ease;
}
:deep(.login-error-icon) { font-size: 0.95rem; flex-shrink: 0; }
:deep(.login-error-text) { flex: 1; }
:deep(.login-error-close) {
  background: transparent;
  border: none;
  color: rgba(255,180,180,0.6);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.2rem;
  border-radius: 3px;
  font-family: inherit;
  transition: color 0.15s, background 0.15s;
}
:deep(.login-error-close:hover) { color: rgba(255,180,180,1); background: rgba(224,88,88,0.15); }
@keyframes errorShake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(5px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(2px); }
}
:deep(.soul-thin) { color: #b8a87c; }
:deep(.soul-common) { color: #d4af5e; }
:deep(.soul-hero) { color: #5eda7a; }
:deep(.soul-demigod) {
  color: #ff9d5e;
  text-shadow: 0 0 8px rgba(255,157,94,0.5);
}
:deep(.remember-row) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.8rem 0 1rem;
  font-size: 0.8rem;
  color: var(--muted);
  cursor: pointer;
  user-select: none;
}
:deep(.remember-cb) {
  width: 16px;
  height: 16px;
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
  background: rgba(8,8,14,0.55);
  border: 1px solid rgba(var(--gold-rgb),0.45);
  border-radius: 3px;
  cursor: pointer;
  position: relative;
  transition: all 0.15s;
}
:deep(.remember-cb:checked) {
  background: var(--accent);
  border-color: var(--accent);
  box-shadow: 0 0 8px rgba(var(--gold-rgb),0.4);
}
:deep(.remember-cb:checked::after) {
  content: '✓';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1a1208;
  font-size: 11px;
  font-weight: 800;
}
:deep(.parchment-actions) {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin-top: 0.6rem;
}
:deep(.btn-rune) {
  position: relative;
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(var(--gold-rgb),0.45);
  border-radius: 4px;
  background: linear-gradient(135deg, rgba(60,46,28,0.85), rgba(38,28,16,0.85));
  color: #f3e8c4;
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.25s var(--ease-out, ease);
}
:deep(.btn-rune::before) {
  content: '';
  position: absolute;
  inset: 1px;
  border: 1px solid rgba(var(--gold-rgb),0.18);
  border-radius: 3px;
  pointer-events: none;
}
:deep(.btn-rune-text) { position: relative; z-index: 1; }
:deep(.btn-rune--primary) {
  background: linear-gradient(135deg, var(--accent) 0%, #a8884a 60%, #6e5520 100%);
  color: #1a1208;
  border-color: #d4af5e;
  box-shadow:
    0 2px 12px rgba(var(--gold-rgb),0.35),
    inset 0 1px 0 rgba(255,235,180,0.3);
}
:deep(.btn-rune--primary:hover) {
  background: linear-gradient(135deg, #f0d896 0%, var(--accent) 50%, #8a6c2e 100%);
  transform: translateY(-1px);
  box-shadow:
    0 4px 18px rgba(var(--gold-rgb),0.55),
    inset 0 1px 0 rgba(255,235,180,0.5);
}
:deep(.btn-rune-flame) {
  position: absolute;
  inset: -2px;
  background: radial-gradient(ellipse at 50% 120%, rgba(255,180,90,0.5), transparent 60%);
  opacity: 0;
  transition: opacity 0.3s;
  animation: flame-pulse 1.6s ease-in-out infinite;
}
:deep(.btn-rune--primary:hover .btn-rune-flame) { opacity: 1; }
@keyframes flame-pulse {
  0%, 100% { transform: scale(1); opacity: 0.65; }
  50% { transform: scale(1.08); opacity: 0.9; }
}
:deep(.btn-rune--ghost) {
  background: transparent;
  border-color: rgba(var(--violet-rgb),0.35);
  color: rgba(var(--violet-rgb),0.85);
}
:deep(.btn-rune--ghost:hover) {
  background: rgba(var(--violet-rgb),0.08);
  border-color: rgba(var(--violet-rgb),0.6);
  color: #c9bcf8;
  transform: translateY(-1px);
}
:deep(.btn-rune:disabled) {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
  filter: grayscale(0.5);
}
:deep(.btn-rune:active) { transform: translateY(0) scale(0.98); }

/* ============ 神谕面板（注册成功） ============ */
.parchment--oracle {
  text-align: center;
  padding: 2rem 1.6rem;
}
.oracle-mark {
  position: relative;
  width: 96px; height: 96px;
  margin: 0 auto 1rem;
}
.oracle-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid rgba(var(--gold-rgb),0.45);
  animation: rune-rotate 8s linear infinite;
}
.oracle-ring--1 { inset: 0; }
.oracle-ring--2 { inset: 12px; border-style: dashed; animation-duration: 6s; animation-direction: reverse; }
.oracle-ring--3 { inset: 24px; border-color: rgba(var(--violet-rgb),0.5); animation-duration: 5s; }
.oracle-star {
  position: absolute;
  inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.8rem;
  color: var(--accent);
  filter: drop-shadow(0 0 12px rgba(var(--gold-rgb),0.7));
}
.oracle-text {
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 1rem;
  color: #f3e8c4;
  margin: 0.5rem 0;
  letter-spacing: 0.05em;
  line-height: 1.6;
}
.oracle-text--dim { color: rgba(var(--gold-rgb),0.6); font-style: italic; font-size: 0.88rem; }
.oracle-name { color: var(--accent); font-weight: 700; text-shadow: 0 0 8px rgba(var(--gold-rgb),0.5); }

/* ============ 底部神谕 ============ */
.oracle-quote {
  margin-top: 0.6rem;
  font-family: var(--font-display, 'Cinzel', serif);
  font-style: italic;
  font-size: 0.78rem;
  color: rgba(var(--gold-rgb),0.55);
  letter-spacing: 0.06em;
  text-align: center;
  animation: fadeIn 0.6s var(--ease-out, ease) both;
}

/* ============ 翻书页过渡 ============ */
.parchment-enter-active,
.parchment-leave-active {
  transition: opacity 0.45s var(--ease-out, ease), transform 0.45s var(--ease-out, ease);
  transform-origin: center top;
}
.parchment-enter-from {
  opacity: 0;
  transform: perspective(900px) rotateX(-22deg) translateY(20px);
}
.parchment-leave-to {
  opacity: 0;
  transform: perspective(900px) rotateX(18deg) translateY(-20px);
}
.page-flip.flipping::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 0%, rgba(var(--gold-rgb),0.15) 50%, transparent 100%);
  animation: flip-shimmer 0.28s ease-in-out;
  pointer-events: none;
}
@keyframes flip-shimmer {
  0% { opacity: 0; }
  50% { opacity: 1; }
  100% { opacity: 0; }
}

/* ============ 创建角色（三族试听 + 铭文） ============ */
.create-intro {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  margin-bottom: 0.9rem;
  animation: fadeInUp 0.5s var(--ease-out, ease) both;
}
.create-intro-line {
  font-size: 0.72rem;
  color: rgba(var(--gold-rgb),0.55);
  letter-spacing: 0.16em;
  font-style: italic;
}
.create-intro-name {
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.18em;
  text-shadow: 0 0 12px rgba(var(--gold-rgb),0.3);
}

/* 三族试听（RaceSelector 子组件透传） */
:deep(.race-viewer) {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.55rem;
  margin-bottom: 0.9rem;
}
:deep(.race-card) {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.3rem 0.55rem;
  background: rgba(8,8,14,0.55);
  border: 1px solid rgba(var(--gold-rgb),0.18);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.25s var(--ease-out, ease);
  font-family: inherit;
  color: inherit;
  animation: fadeInUp 0.5s var(--ease-out, ease) both;
}
:deep(.race-card:hover) {
  border-color: rgba(var(--gold-rgb),0.5);
  background: rgba(8,8,14,0.75);
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0,0,0,0.4);
}
:deep(.race-card.is-active) {
  border-color: var(--accent);
  background: linear-gradient(180deg, rgba(var(--gold-rgb),0.12) 0%, rgba(8,8,14,0.75) 100%);
  box-shadow:
    0 0 0 1px rgba(var(--gold-rgb),0.4),
    0 0 18px rgba(var(--gold-rgb),0.25);
}
:deep(.race-card.is-active::before) {
  content: '';
  position: absolute;
  top: -1px; left: 10%; right: 10%;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
}
:deep(.race-card-frame) {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 3px;
  border: 1px solid rgba(var(--gold-rgb),0.3);
}
:deep(.race-card-img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s var(--ease-out, ease), filter 0.3s;
  filter: brightness(0.85) saturate(0.95);
}
:deep(.race-card:hover .race-card-img) { transform: scale(1.08); filter: brightness(1) saturate(1.1); }
:deep(.race-card.is-active .race-card-img) { filter: brightness(1.05) saturate(1.15); }
:deep(.race-card-veil) {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 40%, rgba(8,8,14,0.75) 100%);
  pointer-events: none;
}
:deep(.race-card-mark) {
  position: absolute;
  top: 4px; right: 6px;
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 0.95rem;
  color: var(--accent);
  text-shadow: 0 0 8px rgba(var(--gold-rgb),0.6);
  filter: drop-shadow(0 0 4px rgba(0,0,0,0.8));
}
:deep(.race-card-meta) { display: flex; flex-direction: column; align-items: center; gap: 0.1rem; }
:deep(.race-card-name) {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--ink);
  display: flex; align-items: center; gap: 0.25rem;
  font-family: var(--font-display, 'Cinzel', serif);
  letter-spacing: 0.06em;
}
:deep(.race-card.is-active .race-card-name) { color: var(--accent); text-shadow: 0 0 6px rgba(var(--gold-rgb),0.4); }
:deep(.race-card.is-preview) {
  filter: brightness(0.72) saturate(0.7);
  opacity: 0.75;
}
:deep(.race-card.is-preview:hover) {
  filter: brightness(0.9) saturate(0.95);
  opacity: 0.95;
}
:deep(.race-card.is-preview .race-card-frame) {
  border-color: rgba(var(--gold-rgb),0.18);
}
:deep(.race-card.is-preview .race-card-mark) {
  color: rgba(var(--gold-rgb),0.5);
  text-shadow: none;
}
:deep(.race-card-lock) {
  position: absolute;
  bottom: 4px; left: 4px;
  width: 18px; height: 18px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(8,8,14,0.7);
  border: 1px solid rgba(var(--gold-rgb),0.5);
  color: var(--accent);
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 10px;
  font-weight: 700;
  border-radius: 50%;
  box-shadow: 0 0 6px rgba(var(--gold-rgb),0.4);
}
:deep(.race-card-tier) {
  font-size: 0.6rem;
  color: rgba(var(--violet-rgb),0.7);
  letter-spacing: 0.08em;
}

:deep(.race-oracle) {
  position: relative;
  text-align: center;
  margin: 0.6rem 0 1rem;
  padding: 0.5rem 0.4rem;
}
:deep(.race-oracle-line) {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(var(--gold-rgb),0.45), transparent);
  margin: 0.3rem 0;
}
:deep(.race-oracle-text) {
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 0.84rem;
  color: rgba(243,232,196,0.9);
  margin: 0.15rem 0;
  letter-spacing: 0.06em;
  line-height: 1.5;
  font-style: italic;
}
:deep(.race-oracle-text--dim) {
  color: rgba(var(--gold-rgb),0.55);
  font-size: 0.74rem;
}
:deep(.race-oracle-text--hint) {
  color: rgba(224,180,80,0.85);
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  margin-top: 0.4rem;
  font-style: italic;
  text-shadow: 0 0 6px rgba(224,180,80,0.25);
}
:deep(.oracle-enter-active),
:deep(.oracle-leave-active) {
  transition: opacity 0.35s var(--ease-out, ease), transform 0.35s var(--ease-out, ease);
}
:deep(.oracle-enter-from) { opacity: 0; transform: translateY(6px); }
:deep(.oracle-leave-to) { opacity: 0; transform: translateY(-6px); }

:deep(.fate-book) {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0.4rem 0 0.9rem;
  padding: 0.5rem 0.7rem;
  background: rgba(8,8,14,0.65);
  border: 1px dashed rgba(var(--gold-rgb),0.35);
  border-radius: 3px;
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 0.84rem;
}
:deep(.fate-book-line) {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(var(--gold-rgb),0.4), transparent);
}
:deep(.fate-book-text) {
  color: rgba(var(--gold-rgb),0.75);
  letter-spacing: 0.1em;
  font-style: italic;
  white-space: nowrap;
  max-width: 70%;
  overflow: hidden;
  text-overflow: ellipsis;
}
:deep(.fate-book-name) {
  color: var(--accent);
  font-weight: 700;
  text-shadow: 0 0 8px rgba(var(--gold-rgb),0.5);
  font-style: normal;
}

/* ============ 通用入场动画 ============ */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ============ 移动端微调 ============ */
@media (max-width: 480px) {
  .imm-rune-ring { width: 360px; height: 360px; top: 4%; }
  .login-title { font-size: 1.4rem; }
  .parchment { padding: 1.3rem 1.2rem 1.1rem; }
  .parchment-inner { padding: 0.4rem 0.4rem; }
}
</style>
