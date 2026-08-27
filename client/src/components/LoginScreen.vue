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
          <div v-if="loginStep === 'login'" key="login" class="parchment">
            <div class="parchment-inner">
              <div class="field">
                <label class="field-label">✦ 真名</label>
                <div class="field-row" :class="{ 'is-focus': focusField === 'username' }">
                  <input
                    ref="userInput"
                    v-model="usernameInput"
                    class="parchment-input"
                    placeholder="账号的真名……"
                    maxlength="16"
                    autocomplete="username"
                    @focus="focusField = 'username'"
                    @blur="focusField = ''"
                    @keyup.enter="$refs.pwdInput?.focus()"
                  />
                  <span class="field-icon" aria-hidden="true">✧</span>
                </div>
              </div>

              <div class="field">
                <label class="field-label">✦ 秘钥</label>
                <div class="field-row" :class="{ 'is-focus': focusField === 'password' }">
                  <input
                    ref="pwdInput"
                    v-model="passwordInput"
                    :type="showPwd ? 'text' : 'password'"
                    class="parchment-input parchment-input--rune"
                    placeholder="遗落的符文序列……"
                    maxlength="32"
                    autocomplete="current-password"
                    @focus="focusField = 'password'"
                    @blur="focusField = ''"
                    @keyup.enter="handleLogin"
                  />
                  <button
                    type="button"
                    class="rune-toggle"
                    :title="showPwd ? '隐去秘钥' : '显化秘钥'"
                    @click="showPwd = !showPwd"
                  >
                    <span v-if="showPwd" class="rune-eye">◉</span>
                    <span v-else class="rune-eye rune-eye--closed">◌</span>
                  </button>
                </div>
                <p class="field-hint" v-if="passwordInput && !showPwd">
                  {{ runeMask(passwordInput.length) }}
                </p>
              </div>

              <label class="remember-row">
                <input type="checkbox" v-model="rememberMe" class="remember-cb" />
                <span class="remember-text">铭记此身</span>
              </label>

              <!-- v0.9：登录失败 inline 错误提示（点击右侧 × 可清掉） -->
              <p v-if="loginError" class="login-error-msg" role="alert">
                <span class="login-error-icon">⚠</span>
                <span class="login-error-text">{{ loginError }}</span>
                <button type="button" class="login-error-close" @click="loginError = ''" aria-label="关闭错误">×</button>
              </p>

              <div class="parchment-actions">
                <button class="btn-rune btn-rune--primary" :disabled="submitting" @click="handleLogin">
                  <span class="btn-rune-flame"></span>
                  <span class="btn-rune-text">{{ submitting ? '正在踏入…' : '⚔ 踏入世界' }}</span>
                </button>
                <button class="btn-rune btn-rune--ghost" @click="switchTo('register')">
                  <span class="btn-rune-text">★ 缔结契约</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 注册 -->
          <div v-else-if="loginStep === 'register'" key="register" class="parchment">
            <div class="parchment-inner">
              <div class="field">
                <label class="field-label">✦ 选择你的真名</label>
                <div
                  class="field-row"
                  :class="{
                    'is-focus': focusField === 'username',
                    'is-valid': nameCheck.state === 'ok',
                    'is-invalid': nameCheck.state === 'taken',
                  }"
                >
                  <input
                    ref="userInput"
                    v-model="usernameInput"
                    class="parchment-input"
                    placeholder="2 ~ 12 个字符，不可亵渎"
                    maxlength="12"
                    autocomplete="username"
                    @focus="focusField = 'username'"
                    @blur="focusField = ''"
                    @keyup.enter="$refs.pwdInput?.focus()"
                  />
                  <span class="field-icon field-icon--astrolabe" aria-hidden="true">
                    <template v-if="nameCheck.state === 'checking'">⌛</template>
                    <template v-else-if="nameCheck.state === 'ok'">✓</template>
                    <template v-else-if="nameCheck.state === 'taken'">✗</template>
                    <template v-else>✧</template>
                  </span>
                </div>
                <p
                  class="field-hint"
                  :class="{
                    'is-valid': nameCheck.state === 'ok',
                    'is-invalid': nameCheck.state === 'taken',
                  }"
                  v-if="usernameInput.length > 0"
                >
                  <template v-if="nameCheck.state === 'ok'">此真名尚无人占据，可为你刻下</template>
                  <template v-else-if="nameCheck.state === 'taken'">此真名已被另一个灵魂烙印</template>
                  <template v-else-if="usernameInput.length < 2">真名至少 2 个字符</template>
                  <template v-else>占星中……</template>
                </p>
              </div>

              <div class="field">
                <label class="field-label">✦ 设定灵魂秘钥</label>
                <div
                  class="field-row"
                  :class="{
                    'is-focus': focusField === 'password',
                    'is-valid': passwordInput && soulLevel.score >= 3,
                    'is-warn': passwordInput && soulLevel.score < 2,
                  }"
                >
                  <input
                    ref="pwdInput"
                    v-model="passwordInput"
                    :type="showPwd ? 'text' : 'password'"
                    class="parchment-input parchment-input--rune"
                    placeholder="秘钥至少 8 位，以防邪灵窥视"
                    maxlength="32"
                    autocomplete="new-password"
                    @focus="focusField = 'password'"
                    @blur="focusField = ''"
                    @keyup.enter="$refs.confirmInput?.focus()"
                  />
                  <button
                    type="button"
                    class="rune-toggle"
                    :title="showPwd ? '隐去秘钥' : '显化秘钥'"
                    @click="showPwd = !showPwd"
                  >
                    <span v-if="showPwd" class="rune-eye">◉</span>
                    <span v-else class="rune-eye rune-eye--closed">◌</span>
                  </button>
                </div>
                <p class="field-hint" v-if="passwordInput">
                  灵魂强度：<span :class="'soul-' + soulLevel.tier">{{ soulLevel.label }}</span>
                </p>
              </div>

              <div class="field">
                <label class="field-label">✦ 确认秘钥</label>
                <div
                  class="field-row"
                  :class="{
                    'is-focus': focusField === 'confirm',
                    'is-valid': passwordConfirm && passwordConfirm === passwordInput,
                    'is-invalid': passwordConfirm && passwordConfirm !== passwordInput,
                  }"
                >
                  <input
                    ref="confirmInput"
                    v-model="passwordConfirm"
                    :type="showPwd ? 'text' : 'password'"
                    class="parchment-input parchment-input--rune"
                    placeholder="再刻一次……"
                    maxlength="32"
                    autocomplete="new-password"
                    @focus="focusField = 'confirm'"
                    @blur="focusField = ''"
                    @keyup.enter="handleRegister"
                  />
                </div>
                <p
                  class="field-hint"
                  :class="{
                    'is-valid': passwordConfirm && passwordConfirm === passwordInput,
                    'is-invalid': passwordConfirm && passwordConfirm !== passwordInput,
                  }"
                  v-if="passwordConfirm"
                >
                  <template v-if="passwordConfirm === passwordInput">灵魂两次回响，刻痕一致</template>
                  <template v-else>两次刻痕不同，灵魂彷徨</template>
                </p>
              </div>

              <label class="remember-row">
                <input type="checkbox" v-model="agreedToLaws" class="remember-cb" />
                <span class="remember-text">我已阅读星空律法</span>
              </label>

              <div class="parchment-actions">
                <button
                  class="btn-rune btn-rune--primary"
                  @click="handleRegister"
                  :disabled="!canRegister"
                >
                  <span class="btn-rune-flame"></span>
                  <span class="btn-rune-text">{{ submitting ? '正在刻下…' : '★ 刻下契约' }}</span>
                </button>
                <button class="btn-rune btn-rune--ghost" @click="switchTo('login')">
                  <span class="btn-rune-text">↩ 返回归途</span>
                </button>
              </div>

              <!-- v0.9：注册失败 inline 错误（与登录共用 .login-error-msg 样式） -->
              <p v-if="registerError" class="login-error-msg" role="alert">
                <span class="login-error-icon">⚠</span>
                <span class="login-error-text">{{ registerError }}</span>
                <button type="button" class="login-error-close" @click="registerError = ''" aria-label="关闭错误">×</button>
              </p>
            </div>
          </div>

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

          <!-- 创建角色（三族试听 + 真名铭刻） -->
          <div v-else key="create" class="parchment">
            <div class="parchment-inner">
              <div class="create-intro">
                <span class="create-intro-line">第一纪元的低语正在低唤</span>
                <span class="create-intro-name">当前血脉进阶之路</span>
              </div>

              <!-- 三族试听：仅可点击「查看」，实际创建永远是鹰人 -->
              <div class="race-viewer">
                <button
                  v-for="(r, i) in races"
                  :key="r.id"
                  class="race-card"
                  :class="{
                    'is-active': selectedRace === r.id,
                    'is-preview': selectedRace !== r.id,
                  }"
                  :style="{ animationDelay: (i * 0.08) + 's' }"
                  @click="previewRace(r)"
                  type="button"
                >
                  <div class="race-card-frame">
                    <img :src="r.portrait" :alt="r.name" class="race-card-img" />
                    <div class="race-card-veil"></div>
                    <div class="race-card-mark">{{ r.glyph }}</div>
                    <div v-if="selectedRace !== r.id" class="race-card-lock" aria-hidden="true">观</div>
                  </div>
                  <div class="race-card-meta">
                    <div class="race-card-name">
                      <IconBase :name="r.icon" :size="13" class="icon-accent" />
                      {{ r.name }}
                    </div>
                    <div class="race-card-tier">{{ r.tier }}</div>
                  </div>
                </button>
              </div>

              <!-- 当前预览种族的铭文（实际永远是鹰人，翼人/天使只能预览观想） -->
              <transition name="oracle" mode="out-in">
                <div :key="selectedRace" class="race-oracle">
                  <div class="race-oracle-line"></div>
                  <p class="race-oracle-text">{{ currentRace.poem }}</p>
                  <p class="race-oracle-text race-oracle-text--dim">{{ currentRace.note }}</p>
                  <p
                    v-if="selectedRace !== 'eagle'"
                    class="race-oracle-text race-oracle-text--hint"
                  >路在远方 —— 此境仅供观想</p>
                  <div class="race-oracle-line"></div>
                </div>
              </transition>

              <!-- 真名铭刻 -->
              <div class="field">
                <label class="field-label">✦ 在卷轴上刻下你的真名</label>
                <div
                  class="field-row"
                  :class="{
                    'is-focus': focusField === 'char',
                    'is-valid': charNameInput.trim().length >= 2,
                    'is-warn': charNameInput.length > 0 && charNameInput.trim().length < 2,
                  }"
                >
                  <input
                    v-model="charNameInput"
                    class="parchment-input"
                    placeholder="2 ~ 12 个字符，不可与他人重复"
                    maxlength="12"
                    @focus="focusField = 'char'"
                    @blur="focusField = ''"
                    @keyup.enter="handleCreateChar"
                  />
                  <span class="field-icon field-icon--astrolabe" aria-hidden="true">
                    <template v-if="charNameInput.trim().length >= 2">✓</template>
                    <template v-else-if="charNameInput.length > 0">✗</template>
                    <template v-else>✧</template>
                  </span>
                </div>
                <p
                  class="field-hint"
                  :class="{
                    'is-valid': charNameInput.trim().length >= 2,
                    'is-invalid': charNameInput.length > 0 && charNameInput.trim().length < 2,
                  }"
                  v-if="charNameInput.length > 0"
                >
                  <template v-if="charNameInput.trim().length >= 2">真名可为你刻入命运之书</template>
                  <template v-else>真名至少 2 个字符</template>
                </p>
              </div>

              <!-- 命运之书预览（永远落档「鹰人」，上方预览不影响） -->
              <div class="fate-book" aria-hidden="true">
                <div class="fate-book-line"></div>
                <span class="fate-book-text">
                  <template v-if="charNameInput.trim().length >= 2">
                    [ <span class="fate-book-name">{{ charNameInput.trim() }}</span> ，{{ actualRace.name }} ]
                  </template>
                  <template v-else>
                    [ ______________ ，{{ actualRace.name }} ]
                  </template>
                </span>
                <div class="fate-book-line"></div>
              </div>

              <div class="parchment-actions">
                <button
                  class="btn-rune btn-rune--primary"
                  @click="handleCreateChar"
                  :disabled="charNameInput.trim().length < 2"
                >
                  <span class="btn-rune-flame"></span>
                  <span class="btn-rune-text">⚔ 踏入费兰德</span>
                </button>
              </div>
            </div>
          </div>
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
// ====== 登录/注册/创建角色界面 v0.8（沉浸版） ======
// @file components/LoginScreen
// @module login-screen
// @description 沉浸式西幻主题：羊皮卷轴 + 符文星图 + 烛光 + 翻书动画
//              + 真名实时校验 + 灵魂强度密码反馈 + 注册成功神谕过渡
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import IconBase from './icons/IconBase.vue';
import { toast } from '../ui-bridge.js';

defineProps({
  player: { type: Object, default: null },
});
const emit = defineEmits(['login', 'register', 'create']);

const loginStep = ref('login'); // 'login' | 'register' | 'create' | 'created'
const usernameInput = ref('');
const passwordInput = ref('');
const passwordConfirm = ref('');

// v2.5：浏览器记忆——localStorage 持久化账号/密码，"铭记此身"勾选即生效
//   仅用于自动填充，不做任何加密（前端明文存储是已知的妥协，需要时再升级到 sessionStorage 或加盐 hash）
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
// 组件挂载时：自动填上次"铭记此身"保存的账号密码，勾选框自动勾上
const _remembered = loadRemembered();
if (_remembered) {
  usernameInput.value = _remembered.username;
  passwordInput.value = _remembered.password;
}
// v0.9：登录失败的 inline 错误提示（卷轴味文案）
const loginError = ref('');
const registerError = ref('');
const charNameInput = ref('');
const rememberMe = ref(!!_remembered);
const agreedToLaws = ref(false);
// 用户开始重新输入时自动清掉错误（避免一直挂在那）
// v2.7：注册页把所有相关字段都监听到，任何输入变化都清错误
watch([usernameInput, passwordInput], () => { if (loginError.value) loginError.value = ''; });
watch([usernameInput, passwordInput, passwordConfirm, agreedToLaws], () => {
  if (registerError.value) registerError.value = '';
});
const showPwd = ref(false);
const focusField = ref('');
const registeredName = ref('');
const isFlipping = ref(false);
const selectedRace = ref('eagle'); // 初始默认鹰人

// input 模板引用（用于 onMounted 自动聚焦，以及 $refs 跳转）
const userInput = ref(null);
const pwdInput = ref(null);
const confirmInput = ref(null);

// 三族试听数据 —— 与文档 01-gameplay.md / 03-areas-and-equipment.md 一致
const races = [
  {
    id: 'eagle',
    name: '鹰人',
    tier: '起始血脉 · Lv.1',
    icon: 'feather',
    portrait: '/img/race-eagle.jpg',
    glyph: '⟁',
    poem: '「生于绝壁，长于风暴——翼未丰，心已远」',
    note: '凡尘大陆的低等种族，拥有飞行的天赋',
  },
  {
    id: 'winged',
    name: '翼人',
    tier: '进化形态 · Lv.30',
    icon: 'sparkle',
    portrait: '/img/race-winged.jpg',
    glyph: '⌬',
    poem: '「羽化登天，光在翼尖——夜为黎明之桥」',
    note: '受天使之羽祝福，凡俗与神圣之间的过渡血脉',
  },
  {
    id: 'angel',
    name: '天使',
    tier: '终末形态 · Lv.80',
    icon: 'book',
    portrait: '/img/race-angel.jpg',
    glyph: '✶',
    poem: '「光铸其身，律法其声——万界回响，皆为圣名」',
    note: '觉醒后属性剧增，可学习六大法则',
  },
];
// 预览态：点击切换查看，但实际永远是鹰人
const previewRace = (r) => { selectedRace.value = r.id; };
// 真名落档的种族 = 永远是鹰人（翼人/天使要 Lv.30/80 才能进化，文档一致）
const actualRace = computed(() => races.find(r => r.id === 'eagle'));
const currentRace = computed(() => races.find(r => r.id === selectedRace.value) || races[0]);

// ====== 密码"符文"字符（覆盖默认圆点） ======
// 利用 CSS font-feature + 字体回退使每个字符渲染为 ◆；
// 占位预览仍展示 ◆，但因为 type=password 浏览器实际掩码不可控，
// 所以在切换 showPwd 时再用相同字符回退到 ●。
function runeMask(len) {
  return '◆'.repeat(Math.max(0, len));
}

// ====== 灵魂强度（注册时密码强度） ======
const soulLevel = computed(() => {
  const p = passwordInput.value || '';
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
  if (/\d/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (score <= 1) return { score, tier: 'thin', label: '薄弱' };
  if (score === 2) return { score, tier: 'common', label: '凡俗' };
  if (score === 3) return { score, tier: 'hero', label: '英灵' };
  return { score, tier: 'demigod', label: '半神' };
});

// ====== 真名实时校验（防抖请求 /api/account-exists） ======
const nameCheck = ref({ state: 'idle' }); // idle | checking | ok | taken
let nameCheckTimer = null;
let nameCheckSeq = 0;

watch(usernameInput, (val) => {
  if (loginStep.value !== 'register') return;
  if (nameCheckTimer) clearTimeout(nameCheckTimer);
  const trimmed = (val || '').trim();
  if (!trimmed || trimmed.length < 2) {
    nameCheck.value = { state: 'idle' };
    return;
  }
  nameCheck.value = { state: 'checking' };
  const seq = ++nameCheckSeq;
  nameCheckTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/account-exists?username=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (seq !== nameCheckSeq) return; // 过时响应丢弃
      nameCheck.value = data?.exists
        ? { state: 'taken' }
        : { state: 'ok' };
    } catch (_) {
      if (seq !== nameCheckSeq) return;
      nameCheck.value = { state: 'idle' };
    }
  }, 350);
});

// v2.7 fix：防重复提交锁——快速双击"刻下契约/踏入世界"会发出两次请求，
//   第二次因"账号已存在"失败，造成"先成功后报错"的混乱反馈
const submitting = ref(false);

const canRegister = computed(
  () =>
    !submitting.value &&
    usernameInput.value.length >= 2 &&
    passwordInput.value.length >= 8 &&
    passwordInput.value === passwordConfirm.value &&
    agreedToLaws.value &&
    nameCheck.value.state === 'ok'
);

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
  if (submitting.value) return;              // v2.7 fix：防重复提交
  if (!usernameInput.value || !passwordInput.value) {
    return toast.warn('请输入真名与秘钥');
  }
  submitting.value = true;
  try {
    // v2.5：按"铭记此身"勾选决定是否持久化
    if (rememberMe.value) {
      saveRemembered(usernameInput.value, passwordInput.value);
    } else {
      clearRemembered();
    }
    await emit('login', { username: usernameInput.value, password: passwordInput.value });
  } finally {
    submitting.value = false;
  }
}
async function handleRegister() {
  if (submitting.value) return;              // v2.7 fix：防重复提交
  if (!usernameInput.value || !passwordInput.value) {
    return toast.warn('请填写真名与秘钥');
  }
  if (passwordInput.value.length < 8) {
    return toast.warn('秘钥需至少 8 位，灵魂才不会被邪灵窥视');
  }
  if (passwordInput.value !== passwordConfirm.value) {
    return toast.warn('两次秘钥不一致，灵魂彷徨');
  }
  if (!agreedToLaws.value) {
    return toast.warn('请先宣读星空律法');
  }
  if (nameCheck.value.state === 'taken') {
    return toast.warn('此真名已被另一个灵魂烙印');
  }
  submitting.value = true;
  registeredName.value = usernameInput.value;
  // v2.8 fix：当前 Vue 版本的 emit 不会把父组件 handleRegister 的返回值传回来，
  //   拿到的永远是 undefined（旧代码因此"注册成功也报契约未成"）。
  //   改为：App.vue 注册完成后调用 setRegisterResult() 回传结果并解除 submitting 锁
  emit('register', { username: usernameInput.value, password: passwordInput.value });
}
function handleCreateChar() {
  const name = charNameInput.value.trim();
  if (name.length < 2) return toast.warn('真名至少 2 个字符');
  emit('create', { charName: name });
}

// 供父组件（App.vue）切换步骤：例如登录成功但账号还没有角色时，跳到创建角色
defineExpose({
  setStep: (s) => { loginStep.value = s; },
  // v0.9：让 App.vue 设置/清空 inline 错误
  setLoginError: (msg) => { loginError.value = msg || ''; },
  setRegisterError: (msg) => { registerError.value = msg || ''; },
  // v2.8 fix：App.vue 注册完成后回传结果（emit 不回传父函数返回值）
  //   ok=true：清错误 → 翻到神谕面板 → 2.4s 后回登录页
  //   ok=false：留在注册页显示 inline 错误
  setRegisterResult: (ok, rawMsg) => {
    submitting.value = false;
    if (ok) {
      registerError.value = '';
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
    // 滚动到错误位置（防止错误在视口外用户看不到）
    nextTick(() => {
      const el = document.querySelector('.login-error-msg');
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  },
});

onMounted(() => {
  // 微微错峰入场（视觉节拍）
  setTimeout(() => userInput.value?.focus?.(), 250);
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
/* 紫夜城堡兜底 + 星空辐射 */
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
/* 星尘飘落：多层 background-position 动画 */
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
/* 标题符文环（缓慢旋转） */
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
/* 烛光摇曳（角落径向渐变脉冲） */
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
/* 羊皮纸纹理（CSS 噪点 + 暖色叠加） */
.imm-parchment {
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(45deg, rgba(var(--gold-rgb),0.018) 0 2px, transparent 2px 8px),
    repeating-linear-gradient(-45deg, rgba(var(--violet-rgb),0.018) 0 2px, transparent 2px 8px);
  mix-blend-mode: screen;
  opacity: 0.7;
}
/* 暗角遮罩 */
.imm-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%);
}

/* ============ 主滚动容器 ============
   不要嵌套 overflow-y —— 外层 App.vue 的 game-body/view-container 已经在控制整页滚动。
   这里只做居中容器，让 LoginScreen 跟随外层一起滚动，避免出现「页内嵌套滚动条」。*/
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
    /* 羊皮纸暖色基底 */
    linear-gradient(135deg, rgba(60,46,28,0.88) 0%, rgba(38,28,16,0.92) 100%);
  /* 卷轴纸边：淡化金线，避免硬边矩形感；保留纸质感 */
  border: 1px solid rgba(var(--gold-rgb),0.18);
  border-radius: 4px;
  padding: 1.6rem 1.6rem 1.4rem;
  box-shadow:
    0 0 0 1px rgba(0,0,0,0.4) inset,
    0 0 24px rgba(var(--gold-rgb),0.10),
    0 8px 28px rgba(0,0,0,0.5);
}
/* 羊皮纸四条边的双线 + 角饰 */
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
/* 内层卷面：去掉 1px 边框和四角 ✦ 装饰，与外层 parchment 融为一体；
   仅保留微微内边距，给字段留呼吸空间 */
.parchment-inner {
  position: relative;
  border: 0;
  padding: 0.5rem 0.4rem 0.2rem;
  border-radius: 0;
}
/* 左上、右下放两颗小的浮动金珠（不靠 ::before/::after 撑盒子，浮在边角处更轻盈） */
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

/* ============ 字段（卷轴书写区：无边框，仅底边线 + 聚焦描边） ============ */
.field { margin-bottom: 0.9rem; }
.field-label {
  display: block;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--accent);
  letter-spacing: 0.12em;
  margin-bottom: 0.35rem;
  font-family: var(--font-display, 'Cinzel', serif);
  text-shadow: 0 0 8px rgba(var(--gold-rgb),0.25);
}
/* 字段行：去掉突兀方框，改用「卷轴书写区」样式 —— 透明背景 + 底部金线 + 微凹阴影 */
.field-row {
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
.field-row::before {
  /* 卷轴的横向凹槽阴影，强化"在纸上书写"质感 */
  content: '';
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0,0,0,0.4), transparent);
  pointer-events: none;
}
.field-row.is-focus {
  border-bottom-color: var(--accent);
  background: linear-gradient(180deg, transparent 0%, rgba(var(--gold-rgb),0.06) 100%);
}
.field-row.is-focus::before { opacity: 0; }
.field-row.is-valid {
  border-bottom-color: rgba(94,218,122,0.7);
}
.field-row.is-warn {
  border-bottom-color: rgba(224,180,80,0.65);
}
.field-row.is-invalid {
  border-bottom-color: rgba(224,88,88,0.7);
}
.parchment-input {
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
.parchment-input::placeholder { color: rgba(var(--gold-rgb),0.4); font-style: italic; }
/* 密码输入：字符掩码在 type=password 模式下由浏览器原生提供（Cinzel 字体下视觉接近 ◆） */
.parchment-input--rune {
  font-family: 'Cinzel', 'Noto Sans SC', serif;
  letter-spacing: 0.18em;
}
/* 字段右侧图标 —— 与羊皮纸卷面无缝融合，静态纯图标（不闪烁） */
.field-icon {
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
.field-row.is-valid .field-icon { color: var(--success); }
.field-row.is-invalid .field-icon { color: var(--danger); }
/* 占星小图标 = 静态纯色字符，和眼睛按钮同款风格，不再闪烁 */
.field-icon--astrolabe { transition: color 0.2s; }
.rune-toggle {
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
.rune-toggle:hover { color: var(--accent); }
.rune-eye { line-height: 1; }
.rune-eye--closed { color: rgba(var(--violet-rgb),0.55); }
.field-hint {
  font-size: 0.7rem;
  color: rgba(var(--gold-rgb),0.55);
  margin: 0.35rem 0 0 0.1rem;
  letter-spacing: 0.05em;
  font-style: italic;
}
.field-hint.is-valid { color: rgba(94,218,122,0.85); }
.field-hint.is-invalid { color: rgba(224,88,88,0.85); }

/* v0.9：登录/注册错误提示（卷轴上的红印） */
.login-error-msg {
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
.login-error-icon { font-size: 0.95rem; flex-shrink: 0; }
.login-error-text { flex: 1; }
.login-error-close {
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
.login-error-close:hover { color: rgba(255,180,180,1); background: rgba(224,88,88,0.15); }
@keyframes errorShake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(5px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(2px); }
}

/* 灵魂强度等级色 */
.soul-thin { color: #b8a87c; }
.soul-common { color: #d4af5e; }
.soul-hero { color: #5eda7a; }
.soul-demigod {
  color: #ff9d5e;
  text-shadow: 0 0 8px rgba(255,157,94,0.5);
}

/* 记住我 / 协议 */
.remember-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.8rem 0 1rem;
  font-size: 0.8rem;
  color: var(--muted);
  cursor: pointer;
  user-select: none;
}
.remember-cb {
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
.remember-cb:checked {
  background: var(--accent);
  border-color: var(--accent);
  box-shadow: 0 0 8px rgba(var(--gold-rgb),0.4);
}
.remember-cb:checked::after {
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

/* ============ 卷轴按钮 ============ */
.parchment-actions {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin-top: 0.6rem;
}
.btn-rune {
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
.btn-rune::before {
  content: '';
  position: absolute;
  inset: 1px;
  border: 1px solid rgba(var(--gold-rgb),0.18);
  border-radius: 3px;
  pointer-events: none;
}
.btn-rune-text { position: relative; z-index: 1; }
.btn-rune--primary {
  background: linear-gradient(135deg, var(--accent) 0%, #a8884a 60%, #6e5520 100%);
  color: #1a1208;
  border-color: #d4af5e;
  box-shadow:
    0 2px 12px rgba(var(--gold-rgb),0.35),
    inset 0 1px 0 rgba(255,235,180,0.3);
}
.btn-rune--primary:hover {
  background: linear-gradient(135deg, #f0d896 0%, var(--accent) 50%, #8a6c2e 100%);
  transform: translateY(-1px);
  box-shadow:
    0 4px 18px rgba(var(--gold-rgb),0.55),
    inset 0 1px 0 rgba(255,235,180,0.5);
}
/* 火焰微动效 */
.btn-rune-flame {
  position: absolute;
  inset: -2px;
  background: radial-gradient(ellipse at 50% 120%, rgba(255,180,90,0.5), transparent 60%);
  opacity: 0;
  transition: opacity 0.3s;
  animation: flame-pulse 1.6s ease-in-out infinite;
}
.btn-rune--primary:hover .btn-rune-flame { opacity: 1; }
@keyframes flame-pulse {
  0%, 100% { transform: scale(1); opacity: 0.65; }
  50% { transform: scale(1.08); opacity: 0.9; }
}
.btn-rune--ghost {
  background: transparent;
  border-color: rgba(var(--violet-rgb),0.35);
  color: rgba(var(--violet-rgb),0.85);
}
.btn-rune--ghost:hover {
  background: rgba(var(--violet-rgb),0.08);
  border-color: rgba(var(--violet-rgb),0.6);
  color: #c9bcf8;
  transform: translateY(-1px);
}
.btn-rune:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
  filter: grayscale(0.5);
}
.btn-rune:active { transform: translateY(0) scale(0.98); }

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
  /* v2.8 fix：去掉 rune-pulse 循环缩放爆光（用户反馈"一闪一闪"），改为静止常亮 */
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

/* 三族试听 */
.race-viewer {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.55rem;
  margin-bottom: 0.9rem;
}
.race-card {
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
.race-card:hover {
  border-color: rgba(var(--gold-rgb),0.5);
  background: rgba(8,8,14,0.75);
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0,0,0,0.4);
}
.race-card.is-active {
  border-color: var(--accent);
  background: linear-gradient(180deg, rgba(var(--gold-rgb),0.12) 0%, rgba(8,8,14,0.75) 100%);
  box-shadow:
    0 0 0 1px rgba(var(--gold-rgb),0.4),
    0 0 18px rgba(var(--gold-rgb),0.25);
}
.race-card.is-active::before {
  content: '';
  position: absolute;
  top: -1px; left: 10%; right: 10%;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
}
.race-card-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 3px;
  border: 1px solid rgba(var(--gold-rgb),0.3);
}
.race-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s var(--ease-out, ease), filter 0.3s;
  filter: brightness(0.85) saturate(0.95);
}
.race-card:hover .race-card-img { transform: scale(1.08); filter: brightness(1) saturate(1.1); }
.race-card.is-active .race-card-img { filter: brightness(1.05) saturate(1.15); }
.race-card-veil {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 40%, rgba(8,8,14,0.75) 100%);
  pointer-events: none;
}
.race-card-mark {
  position: absolute;
  top: 4px; right: 6px;
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 0.95rem;
  color: var(--accent);
  text-shadow: 0 0 8px rgba(var(--gold-rgb),0.6);
  filter: drop-shadow(0 0 4px rgba(0,0,0,0.8));
}
.race-card-meta { display: flex; flex-direction: column; align-items: center; gap: 0.1rem; }
.race-card-name {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--ink);
  display: flex; align-items: center; gap: 0.25rem;
  font-family: var(--font-display, 'Cinzel', serif);
  letter-spacing: 0.06em;
}
.race-card.is-active .race-card-name { color: var(--accent); text-shadow: 0 0 6px rgba(var(--gold-rgb),0.4); }
/* 预览态：翼人/天使不让选，只能看看 —— 整张卡降饱和+右上角「观」角徽 */
.race-card.is-preview {
  filter: brightness(0.72) saturate(0.7);
  opacity: 0.75;
}
.race-card.is-preview:hover {
  filter: brightness(0.9) saturate(0.95);
  opacity: 0.95;
}
.race-card.is-preview .race-card-frame {
  border-color: rgba(var(--gold-rgb),0.18);
}
.race-card.is-preview .race-card-mark {
  color: rgba(var(--gold-rgb),0.5);
  text-shadow: none;
}
.race-card-lock {
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
.race-card-tier {
  font-size: 0.6rem;
  color: rgba(var(--violet-rgb),0.7);
  letter-spacing: 0.08em;
}

/* 当前选中种族的铭文 */
.race-oracle {
  position: relative;
  text-align: center;
  margin: 0.6rem 0 1rem;
  padding: 0.5rem 0.4rem;
}
.race-oracle-line {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(var(--gold-rgb),0.45), transparent);
  margin: 0.3rem 0;
}
.race-oracle-text {
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 0.84rem;
  color: rgba(243,232,196,0.9);
  margin: 0.15rem 0;
  letter-spacing: 0.06em;
  line-height: 1.5;
  font-style: italic;
}
.race-oracle-text--dim {
  color: rgba(var(--gold-rgb),0.55);
  font-size: 0.74rem;
}
.race-oracle-text--hint {
  color: rgba(224,180,80,0.85);
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  margin-top: 0.4rem;
  font-style: italic;
  text-shadow: 0 0 6px rgba(224,180,80,0.25);
}
.oracle-enter-active,
.oracle-leave-active {
  transition: opacity 0.35s var(--ease-out, ease), transform 0.35s var(--ease-out, ease);
}
.oracle-enter-from { opacity: 0; transform: translateY(6px); }
.oracle-leave-to { opacity: 0; transform: translateY(-6px); }

/* 命运之书预览（用户输入的真名 + 选中的血脉） */
.fate-book {
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
.fate-book-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(var(--gold-rgb),0.4), transparent);
}
.fate-book-text {
  color: rgba(var(--gold-rgb),0.75);
  letter-spacing: 0.1em;
  font-style: italic;
  white-space: nowrap;
  max-width: 70%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fate-book-name {
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