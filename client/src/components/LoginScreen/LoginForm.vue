<template>
  <div class="parchment">
    <div class="parchment-inner">
      <div class="field">
        <label class="field-label">✦ 真名</label>
        <div class="field-row" :class="{ 'is-focus': focusField === 'username' }">
          <input
            ref="userInput"
            :value="modelValue.username"
            class="parchment-input"
            placeholder="账号的真名……"
            maxlength="16"
            autocomplete="username"
            @input="onUserInput"
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
            :value="modelValue.password"
            :type="showPwd ? 'text' : 'password'"
            class="parchment-input parchment-input--rune"
            placeholder="遗落的符文序列……"
            maxlength="32"
            autocomplete="current-password"
            @input="onPwdInput"
            @focus="focusField = 'password'"
            @blur="focusField = ''"
            @keyup.enter="$emit('login')"
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
        <p class="field-hint" v-if="modelValue.password && !showPwd">
          {{ runeMask(modelValue.password.length) }}
        </p>
      </div>

      <label class="remember-row">
        <input
          type="checkbox"
          :checked="rememberMe"
          class="remember-cb"
          @change="onRememberChange"
        />
        <span class="remember-text">铭记此身</span>
      </label>

      <!-- v0.9：登录失败 inline 错误提示（点击右侧 × 可清掉） -->
      <p v-if="loginError" class="login-error-msg" role="alert">
        <span class="login-error-icon">⚠</span>
        <span class="login-error-text">{{ loginError }}</span>
        <button type="button" class="login-error-close" @click="$emit('clear-login-error')" aria-label="关闭错误">×</button>
      </p>

      <div class="parchment-actions">
        <button class="btn-rune btn-rune--primary" :disabled="submitting" @click="$emit('login')">
          <span class="btn-rune-flame"></span>
          <span class="btn-rune-text">{{ submitting ? '正在踏入…' : '⚔ 踏入世界' }}</span>
        </button>
        <button class="btn-rune btn-rune--ghost" @click="$emit('switch', 'register')">
          <span class="btn-rune-text">★ 缔结契约</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
// ====== 登录子组件 ======
// @file components/LoginScreen/LoginForm
// @module login-screen-login-form
// @description 真名 + 秘钥 + "铭记此身" + inline 错误；props 由父壳双向绑定
import { ref } from 'vue';

const props = defineProps({
  // 双向绑定的表单数据（父壳持有真实值）
  modelValue: { type: Object, required: true },
  loginError: { type: String, default: '' },
  submitting: { type: Boolean, default: false },
  rememberMe: { type: Boolean, default: false },
});
const emit = defineEmits([
  'update:modelValue',   // 表单数据变化（username/password）
  'login',               // 点击"踏入世界"
  'switch',              // 切换到 register 步骤
  'update:rememberMe',   // 铭记此身切换
  'clear-login-error',   // 用户关闭错误气泡
]);

// 本地 UI 状态
const showPwd = ref(false);
const focusField = ref('');

// 双向绑定：把 username/password 变化 emit 回去（父壳持有真实值）
function onUserInput(e) {
  emit('update:modelValue', { ...props.modelValue, username: e.target.value });
  // 用户开始重新输入时清错误（避免一直挂在那）
  if (props.loginError) emit('clear-login-error');
}
function onPwdInput(e) {
  emit('update:modelValue', { ...props.modelValue, password: e.target.value });
  if (props.loginError) emit('clear-login-error');
}
function onRememberChange(e) {
  emit('update:rememberMe', e.target.checked);
}

// 密码"符文"字符（覆盖默认圆点）
function runeMask(len) {
  return '◆'.repeat(Math.max(0, len));
}

// 暴露 ref 给父壳 onMounted 自动聚焦（保持与原行为一致）
const userInput = ref(null);
const pwdInput = ref(null);
defineExpose({ userInput, pwdInput });
</script>

<!-- 注意：父壳样式通过 :deep() 透传（field / field-row / parchment-input / btn-rune /
  login-error-msg / remember-row 等共用样式集中在父壳，避免重复） -->

