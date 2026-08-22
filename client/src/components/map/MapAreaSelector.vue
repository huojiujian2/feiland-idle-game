<template>
  <div class="map-section">
    <div class="section-header">
      <span><IconBase name="map" :size="14" class="section-icon" />挂机区域</span>
      <span class="current-area" v-if="currentAreaName">当前: {{ currentAreaName }}</span>
    </div>
    <div class="area-list">
      <div v-for="area in areas" :key="area.id" class="area-item"
        :class="{ active: area.id === player.currentArea, locked: player.level < area.minLevel }"
        @click="player.level >= area.minLevel ? $emit('select', area.id) : null">
        <div class="area-top">
          <span class="area-name">{{ area.name }}</span>
          <span v-if="area.id === player.currentArea" class="area-tag">挂机中</span>
          <span v-else-if="player.level < area.minLevel" class="area-lock">🔒Lv.{{ area.minLevel }}</span>
          <span v-else class="area-go">前往</span>
        </div>
        <div class="area-desc">{{ area.desc }}</div>
        <div class="area-monsters">{{ area.monsters.join('、') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
// ====== 地图区域选择 ======
// @file components/map/MapAreaSelector
// @module map-area-selector
// @description 上半屏：可选挂机区域列表，标注当前区域、等级锁定、怪物
import IconBase from '../icons/IconBase.vue';
import { computed } from 'vue';

const props = defineProps({
  player: { type: Object, required: true },
  areas: { type: Array, required: true },
});
defineEmits(['select']);

const currentAreaName = computed(() => props.areas.find(a => a.id === props.player.currentArea)?.name || '');
</script>

<style scoped>
.map-section { padding: 0.6rem 0.8rem; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; font-size: 0.85rem; color: var(--muted); }
.current-area { color: var(--accent); font-size: 0.72rem; }
.area-list { display: flex; flex-direction: column; gap: 0.3rem; max-height: 240px; overflow-y: auto; }
.area-item { padding: 0.5rem 0.6rem; background: rgba(20,22,42,0.5); border: 1px solid var(--rule); border-radius: 6px; cursor: pointer; transition: all 0.15s; }
.area-item:hover:not(.locked) { border-color: var(--accent2); background: rgba(157,140,240,0.06); }
.area-item.active { border-color: var(--accent); background: rgba(212,175,94,0.1); }
.area-item.locked { opacity: 0.5; cursor: not-allowed; }
.area-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem; }
.area-name { font-weight: 700; font-size: 0.85rem; }
.area-tag { font-size: 0.65rem; padding: 0.1rem 0.4rem; background: var(--accent); color: var(--bg); border-radius: 4px; font-weight: 700; }
.area-lock { font-size: 0.65rem; color: var(--dim); }
.area-go { font-size: 0.65rem; color: var(--accent2); }
.area-desc { font-size: 0.7rem; color: var(--muted); margin-bottom: 0.15rem; line-height: 1.3; }
.area-monsters { font-size: 0.65rem; color: var(--dim); }
</style>
