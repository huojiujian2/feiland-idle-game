<template>
  <div class="pvp-content">
    <div v-if="loading" class="pvp-loading">加载中...</div>
    <div v-else-if="records.length === 0" class="pvp-empty">暂无战斗记录</div>
    <div v-else class="rec-list">
      <div v-for="(rec, i) in records" :key="i" class="rec-row" :class="resultClass(rec)">
        <span class="rec-result">{{ resultText(rec) }}</span>
        <span class="rec-vs">
          {{ rec.attackerName }} vs {{ rec.defenderName }}
          <span v-if="rec.isBot" class="bot-tag-small">BOT</span>
        </span>
        <span class="rec-change" :class="{ up: rec.ratingChange > 0, down: rec.ratingChange < 0 }">
          {{ rec.ratingChange > 0 ? '+' : '' }}{{ rec.ratingChange }}
        </span>
        <span v-if="rec.rewards" class="rec-reward">+{{ rec.rewards.coins || 0 }}币</span>
      </div>
    </div>
  </div>
</template>

<script setup>
// ====== PvP 战斗记录 Tab ======
// @file components/pvp/PvPRecords
// @module pvp-records
// @description 显示玩家最近的战斗记录（胜/负、BOT/玩家、积分变化、奖励）
defineProps({
  loading: { type: Boolean, default: false },
  records: { type: Array, default: () => [] },
});

function isWin(rec) {
  if (rec.attacker === rec.defender) return rec.result === 'win';
  // 当前用户的胜负：自己作为攻击者→看 result；作为防守者→看对手胜负
  return false;
}
function resultClass(rec) {
  // record.result 是攻击者视角
  return rec.result === 'win' ? 'win' : 'lose';
}
function resultText(rec) {
  return rec.result === 'win' ? '胜' : '负';
}
</script>

<style scoped>
.pvp-content { padding: 0.6rem 0.8rem; }
.pvp-loading, .pvp-empty { text-align: center; color: var(--dim); padding: 1.5rem; font-style: italic; }

.rec-list { display: flex; flex-direction: column; gap: 0.3rem; }
.rec-row { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 0.5rem; padding: 0.4rem 0.6rem; background: var(--bg2); border: 1px solid var(--rule); border-radius: 6px; font-size: 0.78rem; }
.rec-row.win { border-left: 3px solid var(--success); }
.rec-row.lose { border-left: 3px solid var(--danger); }
.rec-result { font-weight: 800; }
.rec-row.win .rec-result { color: var(--success); }
.rec-row.lose .rec-result { color: var(--danger); }
.rec-vs { color: var(--text); }
.bot-tag-small { font-size: 0.55rem; padding: 0.05rem 0.25rem; background: rgba(157,140,240,0.2); color: var(--accent2); border-radius: 3px; margin-left: 0.3rem; }
.rec-change { font-family: monospace; font-weight: 700; }
.rec-change.up { color: var(--success); }
.rec-change.down { color: var(--danger); }
.rec-reward { color: var(--accent); font-family: monospace; font-weight: 700; font-size: 0.7rem; }
</style>
