<template>
  <!-- Toast 容器：右下角堆叠 -->
  <div class="toast-stack">
    <transition-group name="toast" tag="div">
      <div v-for="t in state.toasts" :key="t.id" class="toast" :class="`toast-${t.type}`">
        <span class="toast-icon">
          <template v-if="t.type === 'success'">✓</template>
          <template v-else-if="t.type === 'error'">✕</template>
          <template v-else-if="t.type === 'warn'">⚠</template>
          <template v-else>ⓘ</template>
        </span>
        <span class="toast-text">{{ t.text }}</span>
      </div>
    </transition-group>
  </div>

  <!-- Modal 容器（取代 alert/confirm） -->
  <transition name="modal">
    <div v-if="state.modal" class="modal-overlay" @click.self="state.modal.onCancel">
      <div class="modal-box" :class="`modal-${state.modal.type}`" role="dialog">
        <div class="modal-head">{{ state.modal.title }}</div>
        <div class="modal-body">{{ state.modal.body }}</div>
        <div class="modal-acts">
          <button v-if="!state.modal.hideCancel" class="btn" @click="state.modal.onCancel">
            {{ state.modal.cancelText }}
          </button>
          <button class="btn" :class="state.modal.type === 'warning' ? 'btn-danger' : 'btn-primary'"
            @click="state.modal.onOk">
            {{ state.modal.okText }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
// ====== 全局 UI 桥接容器 ======
// @file components/UIBridge
// @module ui-bridge-host
// @description 同时承载全局 toast 堆叠 和 modal(取代alert/confirm)。使用 ui-bridge.js 提供的 state。
import { state } from '../ui-bridge.js'
</script>

<style scoped>
/* ====== Toast 堆叠 ====== */
.toast-stack {
  position: fixed;
  bottom: 80px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  min-width: 180px;
  max-width: 320px;
  padding: 10px 14px;
  background: linear-gradient(135deg, rgba(28,30,54,0.96), rgba(20,22,42,0.94));
  backdrop-filter: blur(12px);
  color: var(--ink);
  border-radius: 8px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  border: 1px solid rgba(157,140,240,0.18);
  border-left-width: 3px;
}
.toast-icon {
  width: 22px; height: 22px;
  border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}
.toast-text { flex: 1; line-height: 1.4; }
.toast-success { border-left-color: var(--success); }
.toast-success .toast-icon { background: rgba(94,218,122,0.15); color: var(--success); }
.toast-error { border-left-color: var(--danger); }
.toast-error .toast-icon { background: rgba(224,88,88,0.15); color: var(--danger); }
.toast-warn { border-left-color: var(--accent); }
.toast-warn .toast-icon { background: rgba(212,175,94,0.15); color: var(--accent); }
.toast-info { border-left-color: var(--accent2); }
.toast-info .toast-icon { background: rgba(157,140,240,0.15); color: var(--accent2); }

/* toast 过渡 */
.toast-enter-from, .toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
.toast-enter-active, .toast-leave-active {
  transition: all 200ms ease;
}

/* ====== Modal ====== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9500;
  padding: 1rem;
}
.modal-box {
  width: 100%;
  max-width: 320px;
  background: linear-gradient(135deg, rgba(28,30,54,0.96), rgba(20,22,42,0.94));
  backdrop-filter: blur(16px);
  border: 1px solid rgba(212,175,94,0.3);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(212,175,94,0.15);
  padding: 1rem 1.1rem 1.1rem;
  position: relative;
  overflow: hidden;
}
.modal-box::before {
  content: '';
  position: absolute;
  top: 0; left: 16px; right: 16px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(212,175,94,0.6), transparent);
}
.modal-warning { border-color: rgba(224,88,88,0.35); }
.modal-warning::before { background: linear-gradient(90deg, transparent, rgba(224,88,88,0.5), transparent); }
.modal-head {
  font-weight: 700;
  color: var(--accent);
  font-size: 15px;
  margin-bottom: 8px;
}
.modal-warning .modal-head { color: var(--danger); }
.modal-body {
  color: var(--ink);
  font-size: 13px;
  line-height: 1.55;
  margin-bottom: 14px;
  white-space: pre-wrap;
}
.modal-acts {
  display: flex;
  gap: 8px;
}
.modal-acts .btn { flex: 1; }

/* modal 过渡 */
.modal-enter-from, .modal-leave-to {
  opacity: 0;
}
.modal-enter-from .modal-box, .modal-leave-to .modal-box {
  transform: scale(0.85) translateY(20px);
}
.modal-enter-active, .modal-leave-active {
  transition: opacity 180ms ease;
}
.modal-enter-active .modal-box, .modal-leave-active .modal-box {
  transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
</style>