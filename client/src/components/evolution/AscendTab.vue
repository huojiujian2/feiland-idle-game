<template>
  <!-- 登神 Tab -->
  <div class="evo-section">
    <div class="card ascend-current">
      <div class="section-header"><span>当前神格</span></div>
      <div class="godhood-display" :class="player.godhood || 'none'">
        <span class="godhood-name">{{ godhoodName }}</span>
        <span v-if="player.godhood === 'demigod'" class="godhood-icon">⚜️</span>
        <span v-else-if="player.godhood === 'god'" class="godhood-icon">👑</span>
        <span v-else class="godhood-icon">·</span>
      </div>
      <div v-if="player.godhood" class="godhood-bonus">
        <div v-for="(val, key) in ascendBonus" :key="key" class="godhood-bonus-item">
          {{ bonusLabel(key) }} +{{ val }}
        </div>
      </div>
    </div>

    <div v-if="nextAscension" class="card ascend-target">
      <div class="section-header">
        <span>下一阶段</span>
        <span class="next-god-name">{{ nextAscension.name }}</span>
      </div>
      <div class="ascend-desc">{{ nextAscension.desc }}</div>
      <div class="ascend-bonus-text">{{ nextAscension.bonusText }}</div>

      <div class="evo-reqs">
        <div class="evo-req" :class="{ met: player.level >= nextAscension.reqLevel }">
          <span class="req-icon">{{ player.level >= nextAscension.reqLevel ? '✓' : '✗' }}</span>
          <span>等级 Lv.{{ nextAscension.reqLevel }}（当前 Lv.{{ player.level }}）</span>
        </div>
        <div class="evo-req" :class="{ met: minAttr >= (nextAscension.reqAttr || 0) }">
          <span class="req-icon">{{ minAttr >= (nextAscension.reqAttr || 0) ? '✓' : '✗' }}</span>
          <span>每项属性 ≥ {{ nextAscension.reqAttr || 50 }}（最低项：{{ minAttr }}）</span>
        </div>
        <div class="evo-req" :class="{ met: player.laws.length >= (nextAscension.reqLaws || 3) }">
          <span class="req-icon">{{ player.laws.length >= (nextAscension.reqLaws || 3) ? '✓' : '✗' }}</span>
          <span>已学法则 ≥ {{ nextAscension.reqLaws || 3 }}（当前：{{ player.laws.length }}）</span>
        </div>
        <div v-if="nextAscension.reqFaith" class="evo-req" :class="{ met: player.faith >= nextAscension.reqFaith }">
          <span class="req-icon">{{ player.faith >= nextAscension.reqFaith ? '✓' : '✗' }}</span>
          <span>信仰 ≥ {{ nextAscension.reqFaith }}（当前：{{ player.faith }}）</span>
        </div>
      </div>

      <button class="btn btn-primary evo-btn" :class="{ 'btn-disabled': !canAscend }" @click="$emit('ascend')">
        {{ canAscend ? '登神' : '条件不足' }}
      </button>
    </div>
  </div>
</template>

<script setup>
// ====== 登神 Tab ======
// @file components/evolution/AscendTab
// @module evolution-ascend-tab
// @description 登神 Tab：当前神格 + 下一阶段目标 + 登神条件 + 登神按钮
import { computed } from 'vue';

const props = defineProps({
  player: { type: Object, required: true },
  ascInfo: { type: Object, required: true },
});
defineEmits(['ascend']);

const godhoodName = computed(() => {
  if (props.player.godhood === 'god') return '神灵';
  if (props.player.godhood === 'demigod') return '半神';
  return '凡人';
});
const nextAscension = computed(() => props.ascInfo.currentReq || null);
const minAttr = computed(() => Math.min(
  props.player.attributes?.atk || 0,
  props.player.attributes?.def || 0,
  props.player.attributes?.hp || 0,
  props.player.attributes?.agi || 0
));
const canAscend = computed(() => {
  if (!nextAscension.value) return false;
  if (props.player.godhood === 'god') return false;
  if (props.player.level < nextAscension.value.reqLevel) return false;
  if (minAttr.value < (nextAscension.value.reqAttr || 50)) return false;
  if (props.player.laws.length < (nextAscension.value.reqLaws || 3)) return false;
  if (nextAscension.value.reqFaith && props.player.faith < nextAscension.value.reqFaith) return false;
  return true;
});
const ascendBonus = computed(() => nextAscension.value?.bonus || {});
function bonusLabel(key) {
  return { atk: '攻击', def: '防御', hp: '生命', agi: '敏捷' }[key] || key;
}
</script>

<style scoped>
.card { padding: 0.7rem 0.9rem; background: rgba(20,22,42,0.6); border: 1px solid var(--rule); border-radius: 8px; }
.evo-section { display: flex; flex-direction: column; gap: 0.6rem; }

.section-header { display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--muted); margin-bottom: 0.4rem; }
.next-god-name { color: var(--accent); font-weight: 700; font-size: 0.9rem; }

.ascend-current { display: flex; flex-direction: column; gap: 0.4rem; align-items: center; }
.godhood-display { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1rem; background: linear-gradient(135deg, rgba(212,175,94,0.15), rgba(94,218,122,0.1)); border-radius: 8px; font-size: 1.2rem; font-weight: 800; color: var(--accent); }
.godhood-display.none { background: rgba(20,22,42,0.5); color: var(--muted); }
.godhood-icon { font-size: 1.4rem; }
.godhood-bonus { display: flex; flex-wrap: wrap; gap: 0.3rem; justify-content: center; }
.godhood-bonus-item { padding: 0.2rem 0.5rem; background: rgba(157,140,240,0.1); border-radius: 4px; font-size: 0.75rem; color: var(--accent2); }

.ascend-target { display: flex; flex-direction: column; gap: 0.4rem; }
.ascend-desc { font-size: 0.78rem; color: var(--muted); line-height: 1.4; }
.ascend-bonus-text { padding: 0.4rem 0.6rem; background: rgba(94,218,122,0.08); border-radius: 4px; font-size: 0.78rem; color: var(--success); text-align: center; }

.evo-reqs { display: flex; flex-direction: column; gap: 0.3rem; margin: 0.5rem 0; }
.evo-req { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem; background: rgba(20,22,42,0.5); border-radius: 4px; font-size: 0.78rem; }
.evo-req.met { background: rgba(94,218,122,0.08); border: 1px solid rgba(94,218,122,0.3); }
.req-icon { font-size: 0.85rem; }
.evo-req.met .req-icon { color: var(--success); }
.evo-req:not(.met) .req-icon { color: var(--danger); }
.evo-btn { width: 100%; padding: 0.6rem; font-weight: 700; }
</style>
