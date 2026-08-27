<template>
  <div v-if="visible" class="drops-popup-overlay" @click.self="$emit('close')">
    <div class="drops-popup-box">
      <div class="drops-popup-title">
        <IconBase name="bag" :size="16" class="icon-accent2" />
        战斗掉落
      </div>
      <div class="drops-popup-list">
        <div v-for="(drop, di) in items" :key="di" class="drops-popup-item">
          <IconBase name="gem" :size="16" class="drop-icon icon-accent" />
          <span class="drop-name">{{ drop }}</span>
        </div>
      </div>
      <button class="btn btn-sm drops-popup-close" @click="$emit('close')">关闭</button>
    </div>
  </div>
</template>

<script setup>
// ====== 战斗掉落弹窗 ======
// @file components/map/DropsPopup
// @module drops-popup
// @description 点击战斗日志中的掉落物数量时弹出，展示详细掉落列表
import IconBase from '../icons/IconBase.vue';

defineProps({
  visible: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
});
defineEmits(['close']);
</script>

<style scoped>
.drops-popup-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 300; padding: 1rem; }
.drops-popup-box { background: var(--bg2); border: 1px solid var(--rule); border-radius: 12px; padding: 1rem; max-width: 300px; width: 100%; }
.drops-popup-title { display: flex; align-items: center; gap: 0.4rem; font-size: 0.95rem; font-weight: 700; margin-bottom: 0.8rem; color: var(--accent2); }
.drops-popup-list { display: flex; flex-direction: column; gap: 0.4rem; max-height: 50vh; overflow-y: auto; margin-bottom: 0.8rem; }
.drops-popup-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.6rem; background: rgba(var(--violet-rgb),0.08); border-radius: 6px; font-size: 0.82rem; }
.drop-icon { flex-shrink: 0; }
.drop-name { color: var(--text); }
.drops-popup-close { width: 100%; }
</style>
