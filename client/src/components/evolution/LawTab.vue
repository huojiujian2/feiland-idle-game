<template>
  <!-- 法则 Tab -->
  <div class="evo-section">
    <div class="card law-bonus-box" v-if="player.laws.length > 0">
      <div class="section-header">
        <span>已学法则加成</span>
        <span class="law-count">{{ player.laws.length }} 个法则</span>
      </div>
      <div class="law-bonus-list">
        <span v-if="lawBonus.damage" class="law-bonus-item">伤害+{{ (lawBonus.damage * 100).toFixed(0) }}%</span>
        <span v-if="lawBonus.defense" class="law-bonus-item">减伤+{{ (lawBonus.defense * 100).toFixed(0) }}%</span>
        <span v-if="lawBonus.exp" class="law-bonus-item">经验+{{ (lawBonus.exp * 100).toFixed(0) }}%</span>
        <span v-if="lawBonus.gold" class="law-bonus-item">金币+{{ (lawBonus.gold * 100).toFixed(0) }}%</span>
        <span v-if="lawBonus.heal" class="law-bonus-item">治愈+{{ (lawBonus.heal * 100).toFixed(0) }}%</span>
        <span v-if="lawBonus.allAttr" class="law-bonus-item">全属性+{{ (lawBonus.allAttr * 100).toFixed(0) }}%</span>
      </div>
    </div>

    <div class="card law-list">
      <div class="section-header"><span>法则列表</span></div>
      <div class="law-items">
        <div v-for="law in player.availableLaws" :key="law.id" class="law-item"
          :class="{ learned: law.learned, locked: law.locked }">
          <div class="law-item-header">
            <span class="law-item-name">{{ law.name }}</span>
            <span v-if="law.learned" class="law-status learned">已领悟</span>
            <span v-else-if="law.locked" class="law-status locked">Lv.{{ law.reqLevel }}</span>
            <span v-else class="law-status available">可领悟</span>
          </div>
          <div class="law-item-desc">{{ law.desc }}</div>
          <div class="law-item-bonus">
            <span v-if="law.bonus.damage">伤害+{{ (law.bonus.damage * 100).toFixed(0) }}%</span>
            <span v-if="law.bonus.defense">减伤+{{ (law.bonus.defense * 100).toFixed(0) }}%</span>
            <span v-if="law.bonus.exp">经验+{{ (law.bonus.exp * 100).toFixed(0) }}%</span>
            <span v-if="law.bonus.gold">金币+{{ (law.bonus.gold * 100).toFixed(0) }}%</span>
            <span v-if="law.bonus.heal">治愈+{{ (law.bonus.heal * 100).toFixed(0) }}%</span>
            <span v-if="law.bonus.allAttr">全属性+{{ (law.bonus.allAttr * 100).toFixed(0) }}%</span>
          </div>
          <div class="law-item-cost">消耗：{{ law.cost.name }} ×{{ law.cost.count }}
            （拥有 {{ getMaterialCount(law.cost.name) }}）</div>
          <button v-if="law.canLearn" class="btn btn-sm btn-primary law-btn"
            :class="{ 'btn-disabled': getMaterialCount(law.cost.name) < law.cost.count }"
            @click="$emit('learnLaw', law.id)">领悟法则</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// ====== 法则 Tab ======
// @file components/evolution/LawTab
// @module evolution-law-tab
// @description 法则 Tab：已学法则加成 + 法则列表（可领悟/锁定）
const props = defineProps({
  player: { type: Object, required: true },
  lawBonus: { type: Object, required: true },
});
defineEmits(['learnLaw']);

function getMaterialCount(name) {
  const item = props.player.inventory?.find(i => i.name === name);
  return item ? item.count : 0;
}
</script>

<style scoped>
.card { padding: 0.7rem 0.9rem; background: rgba(var(--panel-rgb),0.6); border: 1px solid var(--rule); border-radius: 8px; }
.evo-section { display: flex; flex-direction: column; gap: 0.6rem; }

.law-bonus-box { display: flex; flex-direction: column; gap: 0.4rem; }
.section-header { display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; color: var(--muted); margin-bottom: 0.3rem; }
.law-count { color: var(--accent); font-weight: 700; }
.law-bonus-list { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.law-bonus-item { padding: 0.2rem 0.5rem; background: rgba(94,218,122,0.1); border: 1px solid rgba(94,218,122,0.3); border-radius: 4px; font-size: 0.72rem; color: var(--success); }

.law-items { display: flex; flex-direction: column; gap: 0.5rem; }
.law-item { padding: 0.6rem; background: rgba(var(--panel-rgb),0.5); border: 1px solid var(--rule); border-radius: 6px; }
.law-item.learned { border-color: var(--success); background: rgba(94,218,122,0.05); }
.law-item.locked { opacity: 0.5; }
.law-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; }
.law-item-name { font-weight: 700; font-size: 0.85rem; color: var(--text); }
.law-status { font-size: 0.65rem; padding: 0.1rem 0.4rem; border-radius: 3px; font-weight: 700; }
.law-status.learned { background: var(--success); color: var(--bg); }
.law-status.locked { background: var(--dim); color: var(--bg); }
.law-status.available { background: var(--accent); color: var(--bg); }
.law-item-desc { font-size: 0.75rem; color: var(--muted); margin-bottom: 0.3rem; }
.law-item-bonus { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.3rem; }
.law-item-bonus span { font-size: 0.7rem; padding: 0.1rem 0.3rem; background: rgba(var(--violet-rgb),0.1); border-radius: 3px; color: var(--accent2); }
.law-item-cost { font-size: 0.7rem; color: var(--dim); margin-bottom: 0.4rem; }
.law-btn { width: 100%; padding: 0.4rem; }
</style>
