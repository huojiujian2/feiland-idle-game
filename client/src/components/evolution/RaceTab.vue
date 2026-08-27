<template>
  <!-- 种族进化 Tab -->
  <div class="evo-section">
    <div class="card race-current">
      <div class="race-stage-badge" :style="{ background: raceStageColor }">Stage {{ player.raceStage }}</div>
      <div class="race-portrait" v-if="currentRaceImg">
        <img :src="currentRaceImg" :alt="player.race" />
      </div>
      <div class="race-name">{{ player.race }}</div>
      <div class="race-desc">{{ raceInfo.current?.desc || '' }}</div>
      <div class="race-bonus">{{ raceInfo.current?.bonusText || '' }}</div>
    </div>

    <div class="card race-path" v-if="raceInfo.next">
      <div class="section-header">
        <span>进化路线</span>
        <span class="next-race-name">→ {{ raceInfo.next.name }}</span>
      </div>
      <div class="race-portrait next" v-if="nextRaceImg">
        <img :src="nextRaceImg" :alt="raceInfo.next.name" />
      </div>
      <div class="race-next-desc">{{ raceInfo.next.desc }}</div>
      <div class="race-next-bonus">加成：{{ raceInfo.next.bonusText }}</div>
      <div class="evo-reqs">
        <div class="evo-req" :class="{ met: player.level >= raceInfo.next.reqLevel }">
          <span class="req-icon">{{ player.level >= raceInfo.next.reqLevel ? '✓' : '✗' }}</span>
          <span>等级 Lv.{{ raceInfo.next.reqLevel }}（当前 Lv.{{ player.level }}）</span>
        </div>
        <div v-if="raceInfo.next.reqMaterial" class="evo-req" :class="{ met: hasMaterial }">
          <span class="req-icon">{{ hasMaterial ? '✓' : '✗' }}</span>
          <span>{{ raceInfo.next.reqMaterial.name }} ×{{ raceInfo.next.reqMaterial.count }}
            （拥有 {{ materialCount }}）</span>
        </div>
      </div>
      <button class="btn btn-primary evo-btn" :class="{ 'btn-disabled': !player.canEvolve || !hasMaterial }"
        @click="$emit('evolve')">
        {{ player.canEvolve ? '进化' : '条件不足' }}
      </button>
    </div>

    <div v-else class="card race-max">
      <div class="max-text">已达终极种族形态</div>
    </div>
  </div>
</template>

<script setup>
// ====== 种族进化 Tab ======
// @file components/evolution/RaceTab
// @module evolution-race-tab
// @description 种族进化 Tab：当前种族 + 进化路线 + 进化条件 + 进化按钮
import { computed } from 'vue';

const props = defineProps({
  player: { type: Object, required: true },
  raceInfo: { type: Object, required: true },
});
defineEmits(['evolve']);

const currentRaceImg = computed(() => {
  if (props.player.race === '鹰人') return '/img/race-eagle.jpg';
  if (props.player.race === '翼人') return '/img/race-winged.jpg';
  if (props.player.race === '天使') return '/img/race-angel.jpg';
  return null;
});
const nextRaceImg = computed(() => {
  const next = props.raceInfo.next;
  if (!next) return null;
  if (next.name === '翼人') return '/img/race-winged.jpg';
  if (next.name === '天使') return '/img/race-angel.jpg';
  return null;
});

const materialCount = computed(() => {
  const mat = props.raceInfo.next?.reqMaterial;
  if (!mat) return 0;
  const item = props.player.inventory?.find(i => i.name === mat.name);
  return item ? item.count : 0;
});
const hasMaterial = computed(() => {
  const mat = props.raceInfo.next?.reqMaterial;
  if (!mat) return true;
  return materialCount.value >= mat.count;
});

const raceStageColor = computed(() => {
  if (props.player.raceStage === 0) return 'rgba(var(--violet-rgb),0.3)';
  if (props.player.raceStage === 1) return 'rgba(94,218,122,0.3)';
  return 'rgba(var(--gold-rgb),0.4)';
});
</script>

<style scoped>
.card { padding: 0.7rem 0.9rem; background: rgba(var(--panel-rgb),0.6); border: 1px solid var(--rule); border-radius: 8px; }
.evo-section { display: flex; flex-direction: column; gap: 0.6rem; }

.race-current { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; text-align: center; position: relative; }
.race-stage-badge { position: absolute; top: 0.6rem; right: 0.6rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.65rem; font-weight: 700; color: var(--text); }
.race-portrait { width: 80px; height: 80px; border-radius: 50%; overflow: hidden; border: 3px solid var(--accent); }
.race-portrait.next { border-color: var(--accent2); width: 64px; height: 64px; }
.race-portrait img { width: 100%; height: 100%; object-fit: cover; }
.race-name { font-size: 1.2rem; font-weight: 800; color: var(--accent); }
.race-desc { font-size: 0.78rem; color: var(--muted); line-height: 1.4; }
.race-bonus { font-size: 0.72rem; color: var(--accent2); padding: 0.3rem 0.6rem; background: rgba(var(--violet-rgb),0.1); border-radius: 4px; }

.race-path { display: flex; flex-direction: column; gap: 0.4rem; }
.section-header { display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--muted); }
.next-race-name { color: var(--accent); font-weight: 700; }
.race-next-desc { font-size: 0.75rem; color: var(--muted); }
.race-next-bonus { font-size: 0.72rem; color: var(--accent2); padding: 0.3rem 0.6rem; background: rgba(94,218,122,0.08); border-radius: 4px; }

.evo-reqs { display: flex; flex-direction: column; gap: 0.3rem; margin: 0.4rem 0; }
.evo-req { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem; background: rgba(var(--panel-rgb),0.5); border-radius: 4px; font-size: 0.78rem; }
.evo-req.met { background: rgba(94,218,122,0.08); border: 1px solid rgba(94,218,122,0.3); }
.req-icon { font-size: 0.85rem; }
.evo-req.met .req-icon { color: var(--success); }
.evo-req:not(.met) .req-icon { color: var(--danger); }
.evo-btn { width: 100%; padding: 0.6rem; font-weight: 700; }

.race-max { text-align: center; padding: 1rem; color: var(--accent); }
.max-text { font-size: 0.85rem; font-weight: 600; }
</style>
