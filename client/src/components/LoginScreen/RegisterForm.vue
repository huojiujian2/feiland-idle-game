<template>
  <div class="parchment">
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
            :value="modelValue.username"
            class="parchment-input"
            placeholder="2 ~ 12 个字符，不可亵渎"
            maxlength="12"
            autocomplete="username"
            @input="onUserInput"
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
          v-if="modelValue.username.length > 0"
        >
          <template v-if="nameCheck.state === 'ok'">此真名尚无人占据，可为你刻下</template>
          <template v-else-if="nameCheck.state === 'taken'">此真名已被另一个灵魂烙印</template>
          <template v-else-if="modelValue.username.length < 2">真名至少 2 个字符</template>
          <template v-else>占星中……</template>
        </p>
      </div>

      <div class="field">
        <label class="field-label">✦ 设定灵魂秘钥</label>
        <div
          class="field-row"
          :class="{
            'is-focus': focusField === 'password',
            'is-valid': modelValue.password && soulLevel.score >= 3,
            'is-warn': modelValue.password && soulLevel.score < 2,
          }"
        >
          <input
            ref="pwdInput"
            :value="modelValue.password"
            :type="showPwd ? 'text' : 'password'"
            class="parchment-input parchment-input--rune"
            placeholder="秘钥至少 8 位，以防邪灵窥视"
            maxlength="32"
            autocomplete="new-password"
            @input="onPwdInput"
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
        <p class="field-hint" v-if="modelValue.password">
          灵魂强度：<span :class="'soul-' + soulLevel.tier">{{ soulLevel.label }}</span>
        </p>
      </div>

      <div class="field">
        <label class="field-label">✦ 确认秘钥</label>
        <div
          class="field-row"
          :class="{
            'is-focus': focusField === 'confirm',
            'is-valid': modelValue.passwordConfirm && modelValue.passwordConfirm === modelValue.password,
            'is-invalid': modelValue.passwordConfirm && modelValue.passwordConfirm !== modelValue.password,
          }"
        >
          <input
            ref="confirmInput"
            :value="modelValue.passwordConfirm"
            :type="showPwd ? 'text' : 'password'"
            class="parchment-input parchment-input--rune"
            placeholder="再刻一次……"
            maxlength="32"
            autocomplete="new-password"
            @input="onConfirmInput"
            @focus="focusField = 'confirm'"
            @blur="focusField = ''"
            @keyup.enter="$emit('register')"
          />
        </div>
        <p
          class="field-hint"
          :class="{
            'is-valid': modelValue.passwordConfirm && modelValue.passwordConfirm === modelValue.password,
            'is-invalid': modelValue.passwordConfirm && modelValue.passwordConfirm !== modelValue.password,
          }"
          v-if="modelValue.passwordConfirm"
        >
          <template v-if="modelValue.passwordConfirm === modelValue.password">灵魂两次回响，刻痕一致</template>
          <template v-else>两次刻痕不同，灵魂彷徨</template>
        </p>
      </div>

      <label class="remember-row">
        <input
          type="checkbox"
          :checked="agreedToLaws"
          class="remember-cb"
          @change="onAgreedChange"
        />
        <span class="remember-text">我已阅读星空律法</span>
      </label>

      <div class="parchment-actions">
        <button
          class="btn-rune btn-rune--primary"
          @click="$emit('register')"
          :disabled="!canRegister"
        >
          <span class="btn-rune-flame"></span>
          <span class="btn-rune-text">{{ submitting ? '正在刻下…' : '★ 刻下契约' }}</span>
        </button>
        <button class="btn-rune btn-rune--ghost" @click="$emit('switch', 'login')">
          <span class="btn-rune-text">↩ 返回归途</span>
        </button>
      </div>

      <!-- v0.9：注册失败 inline 错误（与登录共用 .login-error-msg 样式） -->
      <p v-if="registerError" class="login-error-msg" role="alert">
        <span class="login-error-icon">⚠</span>
        <span class="login-error-text">{{ registerError }}</span>
        <button type="button" class="login-error-close" @click="$emit('clear-register-error')" aria-label="关闭错误">×</button>
      </p>
    </div>
  </div>
</template>

<script setup>
// ====== 注册子组件 ======
// @file components/LoginScreen/RegisterForm
// @module login-screen-register-form
// @description 真名实时校验 + 灵魂强度密码反馈 + 协议勾选
import { ref, computed, watch, onUnmounted } from 'vue';

const props = defineProps({
  modelValue: { type: Object, required: true },
  registerError: { type: String, default: '' },
  submitting: { type: Boolean, default: false },
  agreedToLaws: { type: Boolean, default: false },
});
const emit = defineEmits([
  'update:modelValue',
  'update:agreedToLaws',
  'register',
  'switch',
  'clear-register-error',
]);

const showPwd = ref(false);
const focusField = ref('');

function onUserInput(e) {
  emit('update:modelValue', { ...props.modelValue, username: e.target.value });
  if (props.registerError) emit('clear-register-error');
}
function onPwdInput(e) {
  emit('update:modelValue', { ...props.modelValue, password: e.target.value });
  if (props.registerError) emit('clear-register-error');
}
function onConfirmInput(e) {
  emit('update:modelValue', { ...props.modelValue, passwordConfirm: e.target.value });
  if (props.registerError) emit('clear-register-error');
}
function onAgreedChange(e) {
  emit('update:agreedToLaws', e.target.checked);
}

// ====== 灵魂强度（注册时密码强度） ======
const soulLevel = computed(() => {
  const p = props.modelValue.password || '';
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

watch(() => props.modelValue.username, (val) => {
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

onUnmounted(() => {
  if (nameCheckTimer) clearTimeout(nameCheckTimer);
});

// 防重复提交锁 + 协议勾选 + 真名校验通过 → 才能注册
const canRegister = computed(
  () =>
    !props.submitting &&
    props.modelValue.username.length >= 2 &&
    props.modelValue.password.length >= 8 &&
    props.modelValue.password === props.modelValue.passwordConfirm &&
    props.agreedToLaws &&
    nameCheck.value.state === 'ok'
);

const userInput = ref(null);
const pwdInput = ref(null);
const confirmInput = ref(null);
defineExpose({ userInput, pwdInput, confirmInput });
</script>

<!-- 父壳样式通过 :deep() 透传（field / soul-* / login-error-msg / btn-rune / parchment / etc.） -->
