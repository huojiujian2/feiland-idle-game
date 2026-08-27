<template>
  <div class="pvp-content">
    <div v-if="loading" class="pvp-loading">加载中...</div>
    <div v-else class="rank-list">
      <div v-for="item in ranking" :key="item.username" class="rank-row"
        :class="{ self: item.username === currentUser }">
        <span class="rank-num">
          <IconBase v-if="item.rank === 1" name="trophy" :size="20" class="icon-accent" />
          <IconBase v-else-if="item.rank === 2" name="star" :size="18" class="icon-accent2" />
          <IconBase v-else-if="item.rank === 3" name="gem" :size="16" class="icon-success" />
          <span v-else>{{ item.rank }}</span>
        </span>
        <div class="rank-info">
          <div class="rank-name">
            {{ item.name }}
            <span v-if="item.username === currentUser" class="self-tag">你</span>
            <span v-if="item.godhood === 'god'" class="opp-tag god">神</span>
            <span v-else-if="item.godhood === 'demigod'" class="opp-tag demi">半神</span>
          </div>
          <div class="rank-sub">Lv.{{ item.level }} {{ item.race }} {{ item.job }}</div>
        </div>
        <div class="rank-stats">
          <div class="rank-rating">{{ item.rating }}</div>
          <div class="rank-wl">{{ item.wins }}胜 {{ item.losses }}负 ({{ item.winRate }}%)</div>
        </div>
      </div>
      <div v-if="ranking.length === 0" class="pvp-empty">暂无排行数据</div>
    </div>
  </div>
</template>

<script setup>
// ====== PvP 竞技排行 Tab ======
// @file components/pvp/PvPRanking
// @module pvp-ranking
// @description 展示竞技积分排行榜 Top 50（前三名特殊图标）
import IconBase from '../icons/IconBase.vue';

defineProps({
  loading: { type: Boolean, default: false },
  ranking: { type: Array, default: () => [] },
  currentUser: { type: String, default: '' },
});
</script>

<style scoped>
.pvp-content { padding: 0.6rem 0.8rem; }
.pvp-loading, .pvp-empty { text-align: center; color: var(--dim); padding: 1.5rem; font-style: italic; }

.rank-list { display: flex; flex-direction: column; gap: 0.3rem; }
.rank-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.7rem; background: var(--bg2); border: 1px solid var(--rule); border-radius: 6px; transition: background 0.15s; }
.rank-row:hover { background: rgba(var(--violet-rgb),0.05); }
.rank-row.self { border-color: var(--accent); background: rgba(var(--gold-rgb),0.08); }
.rank-num { min-width: 1.6rem; display: flex; align-items: center; justify-content: center; font-weight: 700; font-family: monospace; }
.rank-info { flex: 1; }
.rank-name { display: flex; align-items: center; gap: 0.3rem; font-weight: 700; font-size: 0.85rem; }
.self-tag { font-size: 0.6rem; padding: 0.05rem 0.3rem; background: var(--accent); color: var(--bg); border-radius: 3px; }
.rank-sub { font-size: 0.65rem; color: var(--muted); margin-top: 0.1rem; }
.rank-stats { text-align: right; }
.rank-rating { font-weight: 800; color: var(--accent); font-family: monospace; font-size: 1rem; }
.rank-wl { font-size: 0.65rem; color: var(--muted); }
</style>
