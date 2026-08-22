<template>
  <div class="pvp-header">
    <div class="pvp-back">
      <button class="back-btn" @click="$emit('goBack')">‹ 返回地图</button>
    </div>

    <!-- 数据概览 -->
    <div class="pvp-card-row">
      <div class="pvp-card">
        <div class="pvp-card-icon"><IconBase name="crossedSwords" :size="22" /></div>
        <div class="pvp-card-info">
          <div class="pvp-card-label">竞技积分</div>
          <div class="pvp-card-value">{{ myRating }}</div>
        </div>
      </div>
      <div class="pvp-card">
        <div class="pvp-card-icon"><IconBase name="gem" :size="22" /></div>
        <div class="pvp-card-info">
          <div class="pvp-card-label">竞技币</div>
          <div class="pvp-card-value coins">{{ arenaCoins }}</div>
        </div>
      </div>
    </div>
    <div class="pvp-stats-row">
      <div class="pvp-stat"><span class="stat-label">胜</span><span class="stat-val win">{{ myWins }}</span></div>
      <div class="pvp-stat"><span class="stat-label">负</span><span class="stat-val lose">{{ myLosses }}</span></div>
      <div class="pvp-stat"><span class="stat-label">连胜</span><span class="stat-val streak">{{ myStreak }}</span></div>
      <div class="pvp-stat"><span class="stat-label">最高连胜</span><span class="stat-val">{{ myBestStreak }}</span></div>
    </div>
    <div v-if="cdRemaining > 0" class="pvp-cd">冷却中: {{ Math.ceil(cdRemaining / 1000) }}s</div>

    <!-- 赛季信息 -->
    <div v-if="season" class="season-bar">
      <span class="season-icon"><IconBase name="trophy" :size="18" class="icon-accent" /></span>
      <span class="season-label">赛季 {{ season.currentSeason }}</span>
      <span class="season-info">剩余 {{ season.daysLeft }} 天重置</span>
    </div>

    <!-- Tab 切换 -->
    <div class="pvp-tabs">
      <button class="pvp-tab" :class="{ active: tab === 'opponents' }" @click="$emit('tab', 'opponents')">对手</button>
      <button class="pvp-tab" :class="{ active: tab === 'ranking' }" @click="$emit('tab', 'ranking')">排行</button>
      <button class="pvp-tab" :class="{ active: tab === 'records' }" @click="$emit('tab', 'records')">记录</button>
      <button class="pvp-tab" :class="{ active: tab === 'shop' }" @click="$emit('tab', 'shop')">商店</button>
      <button class="pvp-tab" :class="{ active: tab === 'rewards' }" @click="$emit('tab', 'rewards')">奖励</button>
    </div>
  </div>
</template>

<script setup>
// ====== PvP 头部（返回按钮 + 数据概览 + 赛季 + Tabs）======
// @file components/pvp/PvPHeader
// @module pvp-header
// @description PvP 视图顶部：返回、积分/竞技币/战绩卡、赛季信息、5 个 Tab
import IconBase from '../icons/IconBase.vue';

defineProps({
  myRating: { type: Number, default: 1000 },
  arenaCoins: { type: Number, default: 0 },
  myWins: { type: Number, default: 0 },
  myLosses: { type: Number, default: 0 },
  myStreak: { type: Number, default: 0 },
  myBestStreak: { type: Number, default: 0 },
  cdRemaining: { type: Number, default: 0 },
  season: { type: Object, default: null },
  tab: { type: String, default: 'opponents' },
});
defineEmits(['goBack', 'tab']);
</script>

<style scoped>
.pvp-header { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.6rem 0.8rem; background: rgba(20,22,42,0.4); border-radius: 8px; }
.pvp-back { display: flex; align-items: center; }
.back-btn { padding: 0.3rem 0.7rem; background: rgba(157,140,240,0.1); border: 1px solid var(--rule); border-radius: 6px; color: var(--muted); cursor: pointer; font-size: 0.75rem; }
.back-btn:hover { background: rgba(157,140,240,0.2); color: var(--text); }

.pvp-card-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
.pvp-card { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.7rem; background: var(--bg2); border: 1px solid var(--rule); border-radius: 8px; }
.pvp-card-icon { color: var(--accent); }
.pvp-card-label { font-size: 0.7rem; color: var(--muted); }
.pvp-card-value { font-size: 1.3rem; font-weight: 800; color: var(--accent); font-family: monospace; }
.pvp-card-value.coins { color: var(--accent2); }

.pvp-stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.3rem; }
.pvp-stat { display: flex; flex-direction: column; align-items: center; padding: 0.3rem; background: var(--bg2); border: 1px solid var(--rule); border-radius: 6px; }
.stat-label { font-size: 0.65rem; color: var(--muted); }
.stat-val { font-weight: 700; font-family: monospace; }
.stat-val.win { color: var(--success); }
.stat-val.lose { color: var(--danger); }
.stat-val.streak { color: var(--accent); }

.pvp-cd { padding: 0.3rem 0.5rem; background: rgba(224,88,88,0.15); color: var(--danger); border-radius: 4px; text-align: center; font-size: 0.78rem; font-weight: 600; }

.season-bar { display: flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.5rem; background: rgba(212,175,94,0.1); border-radius: 4px; font-size: 0.75rem; }
.season-icon { display: flex; }
.season-label { font-weight: 700; color: var(--accent); }
.season-info { color: var(--muted); margin-left: auto; }

.pvp-tabs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.2rem; }
.pvp-tab { padding: 0.4rem; background: rgba(20,22,42,0.5); border: 1px solid var(--rule); border-radius: 6px; color: var(--muted); cursor: pointer; font-size: 0.78rem; font-family: inherit; transition: all 0.15s; }
.pvp-tab:hover { border-color: var(--accent2); }
.pvp-tab.active { background: rgba(212,175,94,0.15); border-color: var(--accent); color: var(--accent); font-weight: 700; }
</style>
