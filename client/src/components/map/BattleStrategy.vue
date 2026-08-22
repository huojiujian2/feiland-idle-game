<template>
  <div class="strategy-section card" v-if="player.strategies">
    <div class="section-header">
      <span><IconBase name="crossedSwords" :size="14" class="section-icon" />战斗策略</span>
      <span v-if="strategyCdText" class="strategy-cd">{{ strategyCdText }}</span>
    </div>
    <div class="strategy-grid">
      <button v-for="s in player.strategies" :key="s.id"
        class="strategy-btn"
        :class="{ active: s.active, locked: !s.unlocked && !s.active }"
        :disabled="(!s.unlocked && !s.active) || (strategyCdRemaining>0 && !s.active)"
        :aria-pressed="s.active ? 'true' : 'false'"
        @click="$emit('strategy-change', s.id)">
        <span class="strategy-name">{{ s.name }}</span>
        <span class="strategy-desc">{{ s.desc }}</span>
        <span v-if="!s.unlocked && !s.active" class="strategy-lock">🔒Lv.{{ s.reqLevel }}</span>
        <span v-else-if="s.active" class="strategy-tag">当前</span>
      </button>
    </div>
  </div>
</template>

<script setup>
// ====== 战斗策略选择面板 ======
// @file components/map/BattleStrategy
// @module battle-strategy
// @description T-004 6 种战斗策略选择（含冷却显示与等级解锁）
import IconBase from '../icons/IconBase.vue';
import { computed, ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  player: { type: Object, required: true },
});
defineEmits(['strategy-change']);

const strategyCdRemaining = ref(0);
let cdTimer = null;

function refreshCd() {
  strategyCdRemaining.value = props.player.strategyCdRemaining || 0;
}
const strategyCdText = computed(() => {
  if (!strategyCdRemaining.value) return '';
  const s = Math.ceil(strategyCdRemaining.value / 1000);
  return `冷却 ${s}s`;
});

onMounted(() => {
  refreshCd();
  cdTimer = setInterval(refreshCd, 1000);
});
onUnmounted(() => {
  if (cdTimer) clearInterval(cdTimer);
});
</script>

<style scoped>
.strategy-section { padding: 0.6rem 0.8rem; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; font-size: 0.85rem; color: var(--muted); }
.strategy-cd { font-size: 0.7rem; color: var(--danger); font-weight: 600; }
.strategy-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.3rem; }
.strategy-btn { padding: 0.4rem 0.3rem; background: rgba(20,22,42,0.5); border: 1px solid var(--rule); border-radius: 6px; color: var(--text); cursor: pointer; transition: all 0.15s; font-family: inherit; display: flex; flex-direction: column; align-items: center; gap: 0.1rem; font-size: 0.75rem; }
.strategy-btn:hover:not(:disabled) { border-color: var(--accent2); background: rgba(157,140,240,0.08); }
.strategy-btn.active { border-color: var(--accent); background: rgba(212,175,94,0.15); }
.strategy-btn.locked { opacity: 0.5; cursor: not-allowed; }
.strategy-btn:disabled { cursor: not-allowed; }
.strategy-name { font-weight: 700; }
.strategy-desc { font-size: 0.62rem; color: var(--muted); line-height: 1.2; }
.strategy-lock { font-size: 0.6rem; color: var(--dim); }
.strategy-tag { font-size: 0.6rem; color: var(--accent); font-weight: 700; }
</style>
