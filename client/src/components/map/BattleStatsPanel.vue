<template>
  <div class="combat-stats card" v-if="player.combatStats">
    <div class="section-header">
      <span><IconBase name="sword" :size="14" class="section-icon" />战斗属性</span>
    </div>
    <div class="combat-stats-grid">
      <div class="cs-item"><span class="cs-label">攻击</span><span class="cs-val atk">{{ player.combatStats.atk }}</span></div>
      <div class="cs-item"><span class="cs-label">防御</span><span class="cs-val def">{{ player.combatStats.def }}</span></div>
      <div class="cs-item"><span class="cs-label">敏捷</span><span class="cs-val agi">{{ player.combatStats.agi }}</span></div>
      <div class="cs-item" v-if="player.combatStats.dmgBonus"><span class="cs-label">增伤</span><span class="cs-val">+{{ (player.combatStats.dmgBonus * 100).toFixed(0) }}%</span></div>
      <div class="cs-item" v-if="player.combatStats.defBonus"><span class="cs-label">减伤</span><span class="cs-val">+{{ (player.combatStats.defBonus * 100).toFixed(0) }}%</span></div>
      <div class="cs-item" v-if="player.combatStats.healBonus"><span class="cs-label">治愈</span><span class="cs-val">+{{ (player.combatStats.healBonus * 100).toFixed(0) }}%</span></div>
    </div>
  </div>
</template>

<script setup>
// ====== 战斗属性面板 ======
// @file components/map/BattleStatsPanel
// @module battle-stats-panel
// @description 显示玩家进入战斗时的属性（ATK/DEF/AGI + 增伤/减伤/治愈加成）
import IconBase from '../icons/IconBase.vue';

defineProps({
  player: { type: Object, required: true },
});
</script>

<style scoped>
.combat-stats { padding: 0.6rem 0.8rem; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; font-size: 0.85rem; color: var(--muted); }
.combat-stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.3rem; }
.cs-item { display: flex; flex-direction: column; align-items: center; padding: 0.4rem 0.3rem; background: rgba(20,22,42,0.5); border-radius: 6px; }
.cs-label { font-size: 0.65rem; color: var(--muted); margin-bottom: 0.15rem; }
.cs-val { font-weight: 700; font-family: monospace; }
.cs-val.atk { color: var(--danger); }
.cs-val.def { color: var(--accent2); }
.cs-val.agi { color: var(--accent); }
</style>
