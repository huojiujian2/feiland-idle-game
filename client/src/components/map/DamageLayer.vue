<template>
  <div class="damage-layer" aria-hidden="true">
    <div v-for="d in damageItems" :key="d.id" class="dmg-float"
      :class="[d.kind, { crit: d.crit, skill: d.isSkill }]"
      :style="{ left: d.x + '%', top: d.y + '%' }">
      <span v-if="d.kind==='heal'">+{{ d.value }}</span>
      <span v-else-if="d.kind==='miss'">闪避</span>
      <span v-else>-{{ d.value }}</span>
      <span v-if="d.skillName" class="dmg-skill-name">{{ d.skillName }}</span>
      <span v-if="d.crit" class="dmg-crit-tag">暴击</span>
    </div>
  </div>
</template>

<script setup>
// ====== 伤害飘字层 ======
// @file components/map/DamageLayer
// @module damage-layer
// @description 在战斗日志区域上方浮动的伤害数字（支持暴击/技能名飘字）
defineProps({
  damageItems: { type: Array, required: true },
});
</script>

<style scoped>
.damage-layer { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.dmg-float { position: absolute; font-weight: 800; font-size: 0.95rem; text-shadow: 0 1px 4px rgba(0,0,0,0.6); animation: dmgFloat var(--duration-damage) var(--ease-out) forwards; white-space: nowrap; }
.dmg-float.player-dmg, .dmg-float.physical-dmg { color: var(--danger); }
.dmg-float.monster-dmg, .dmg-float.magical-dmg { color: var(--accent2); }
.dmg-float.heal { color: var(--success); }
.dmg-float.miss { color: var(--muted); font-size: 0.78rem; font-weight: 600; animation: missFloat var(--duration-damage) var(--ease-out) forwards; }
.dmg-float.crit { color: var(--dmg-crit); font-size: 1.15rem; transform: scale(1.15); animation: dmgFloat var(--duration-damage) var(--ease-out) forwards, critShake var(--crit-shake-duration) var(--crit-shake-delay); }
.dmg-float.skill { display: flex; flex-direction: column; align-items: center; gap: 1px; }
.dmg-skill-name { font-size: 0.55rem; color: var(--accent2); font-weight: 600; opacity: 0.9; }
.dmg-crit-tag { font-size: 0.58rem; margin-left: 0.15rem; vertical-align: super; }
@keyframes dmgFloat { 0% { transform: translateY(0) scale(1); opacity: 0; } 12% { opacity: 1; } 100% { transform: translateY(-60px) scale(1); opacity: 0; } }
@keyframes missFloat { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(-32px); opacity: 0; } }
@keyframes critShake { 0%,100% { transform: translateX(0) scale(1.15); } 25% { transform: translateX(-2px) scale(1.3); } 50% { transform: translateX(2px) scale(1.3); } 75% { transform: translateX(-1px) scale(1.3); } }
@media (prefers-reduced-motion: reduce){ .dmg-float, .dmg-float.crit { animation: dmgFade var(--duration-damage) var(--ease-out) forwards; } @keyframes dmgFade { 0% { opacity:0;} 12%{opacity:1;} 100%{opacity:0;} } }
</style>
