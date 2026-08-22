<template>
  <div class="pvp-content">
    <div v-if="loading" class="pvp-loading">正在寻找对手...</div>
    <div v-else-if="opponents.length === 0" class="pvp-empty">暂无匹配对手</div>
    <div v-else class="opp-grid">
      <div v-for="opp in opponents" :key="opp.username" class="opp-card" @click="$emit('challenge', opp)">
        <div class="opp-top">
          <span class="opp-name">{{ opp.name }}</span>
          <span v-if="opp.isBot" class="bot-tag"><IconBase name="dna" :size="12" /> BOT</span>
          <span v-if="opp.godhood === 'god'" class="opp-tag god">神灵</span>
          <span v-else-if="opp.godhood === 'demigod'" class="opp-tag demi">半神</span>
        </div>
        <div class="opp-mid">
          <span class="opp-race">{{ opp.race }}</span>
          <span v-if="opp.job !== '无'" class="opp-job">{{ opp.job }}</span>
          <span class="opp-level">Lv.{{ opp.level }}</span>
        </div>
        <div class="opp-bottom">
          <span class="opp-power">战力 {{ opp.power ? opp.power.toLocaleString() : '?' }}</span>
          <span class="opp-rating">积分 {{ opp.pvpRating }}</span>
        </div>
        <div v-if="opp.isBot && opp.activeAffix" class="opp-skill">主动技: {{ opp.activeAffix }}</div>
        <div v-else-if="opp.isBot" class="opp-skill">被动 x{{ opp.passiveCount || 0 }}</div>
        <div v-else class="opp-record">{{ opp.pvpWins }}胜 {{ opp.pvpLosses }}负</div>
      </div>
    </div>
  </div>
</template>

<script setup>
// ====== PvP 对手列表 Tab ======
// @file components/pvp/PvPOpponents
// @module pvp-opponents
// @description 显示可挑战的对手卡片（Bot + 真实玩家）
import IconBase from '../icons/IconBase.vue';

defineProps({
  loading: { type: Boolean, default: false },
  opponents: { type: Array, default: () => [] },
});
defineEmits(['challenge']);
</script>

<style scoped>
.pvp-content { padding: 0.6rem 0.8rem; }
.pvp-loading, .pvp-empty { text-align: center; color: var(--dim); padding: 1.5rem; font-style: italic; }

.opp-grid { display: grid; grid-template-columns: 1fr; gap: 0.4rem; }
.opp-card { padding: 0.5rem 0.7rem; background: var(--bg2); border: 1px solid var(--rule); border-radius: 6px; cursor: pointer; transition: all 0.15s; }
.opp-card:hover { border-color: var(--accent); transform: translateY(-1px); }
.opp-top { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.25rem; }
.opp-name { font-weight: 700; font-size: 0.9rem; }
.bot-tag { font-size: 0.6rem; padding: 0.05rem 0.3rem; background: rgba(157,140,240,0.2); color: var(--accent2); border-radius: 3px; display: inline-flex; align-items: center; gap: 0.15rem; }
.opp-tag { font-size: 0.6rem; padding: 0.05rem 0.3rem; border-radius: 3px; font-weight: 700; }
.opp-tag.god { background: var(--accent); color: var(--bg); }
.opp-tag.demi { background: var(--accent2); color: var(--bg); }
.opp-mid { display: flex; gap: 0.4rem; font-size: 0.7rem; color: var(--muted); margin-bottom: 0.2rem; }
.opp-race { color: var(--text); }
.opp-job { color: var(--accent2); }
.opp-level { color: var(--accent); font-weight: 700; margin-left: auto; }
.opp-bottom { display: flex; gap: 0.8rem; font-size: 0.72rem; }
.opp-power { color: var(--text); font-weight: 600; }
.opp-rating { color: var(--muted); }
.opp-skill, .opp-record { font-size: 0.65rem; color: var(--accent2); margin-top: 0.2rem; }
</style>
