<!--
  ====== 界面风格切换弹窗 v2.9 ======
  三种风格：原·星夜风（默认）/ 暗金风 / 羊皮纸风
  点击即时生效（弹窗本身也会跟着换肤，所见即所得）
-->
<template>
  <div class="theme-overlay" @click.self="$emit('close')">
    <div class="theme-box">
      <div class="theme-ornament top">✦</div>
      <div class="theme-ornament bottom">✦</div>

      <div class="theme-title">界面风格</div>
      <div class="theme-subtitle">点击即时生效 · 自动保存</div>

      <div class="theme-list">
        <button
          v-for="t in THEMES"
          :key="t.key"
          type="button"
          class="theme-option"
          :class="{ active: current === t.key }"
          @click="$emit('apply', t.key)"
        >
          <!-- 色卡预览：背景 / 面板 / 强调 / 次强调 -->
          <span class="theme-swatch">
            <span
              v-for="(c, i) in t.colors"
              :key="i"
              class="swatch-dot"
              :style="{ background: c }"
            ></span>
          </span>
          <span class="theme-info">
            <span class="theme-name">{{ t.name }}</span>
            <span class="theme-desc">{{ t.desc }}</span>
          </span>
          <span class="theme-check" aria-hidden="true">{{ current === t.key ? '✓' : '' }}</span>
        </button>
      </div>

      <div class="theme-actions">
        <button class="btn btn-primary theme-done-btn" @click="$emit('close')">完成</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { THEMES } from '../theme';

defineProps({
  current: { type: String, default: 'default' },
});
defineEmits(['apply', 'close']);
</script>

<style scoped>
.theme-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  animation: fadeIn var(--duration-normal, 200ms) var(--ease-out, ease);
}
.theme-box {
  position: relative;
  width: 100%;
  max-width: 380px;
  padding: 1.6rem 1.3rem 1.3rem;
  border-radius: 14px;
  border: 1px solid rgba(var(--violet-rgb), 0.25);
  background: linear-gradient(160deg, rgba(var(--panel2-rgb), 0.97), rgba(var(--panel-rgb), 0.96));
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(var(--gold-rgb), 0.08);
  animation: box-in var(--duration-slow, 300ms) var(--ease-out, ease);
}
@keyframes box-in {
  from { opacity: 0; transform: translateY(14px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.theme-ornament {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  color: var(--accent);
  opacity: 0.6;
  font-size: 0.75rem;
}
.theme-ornament.top { top: 0.55rem; }
.theme-ornament.bottom { bottom: 0.55rem; }

.theme-title {
  text-align: center;
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.08em;
  margin-top: 0.4rem;
}
.theme-subtitle {
  text-align: center;
  font-size: 0.72rem;
  color: var(--muted);
  margin: 0.25rem 0 1rem;
}

.theme-list {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}
.theme-option {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  padding: 0.6rem 0.7rem;
  border-radius: 10px;
  border: 1px solid rgba(var(--violet-rgb), 0.18);
  background: rgba(var(--panel-rgb), 0.55);
  cursor: pointer;
  transition: all var(--duration-normal, 200ms) var(--ease-out, ease);
  text-align: left;
}
.theme-option:hover {
  border-color: rgba(var(--gold-rgb), 0.45);
  background: rgba(var(--panel2-rgb), 0.7);
  transform: translateY(-1px);
}
.theme-option.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent), 0 0 14px rgba(var(--gold-rgb), 0.18);
}

.theme-swatch {
  display: flex;
  gap: 3px;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid rgba(var(--violet-rgb), 0.2);
  background: rgba(0, 0, 0, 0.15);
}
.swatch-dot {
  width: 13px;
  height: 22px;
  border-radius: 3px;
}
.theme-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.theme-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ink);
}
.theme-desc {
  font-size: 0.7rem;
  color: var(--muted);
}
.theme-check {
  width: 1.2rem;
  text-align: center;
  color: var(--accent);
  font-weight: 700;
}

.theme-actions {
  margin-top: 1rem;
}
.theme-done-btn {
  width: 100%;
}
</style>
