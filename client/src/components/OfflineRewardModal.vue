<template>
  <!-- 离线收益弹窗 -->
  <div v-if="visible" class="offline-overlay">
    <div class="offline-popup">
      <div class="offline-header">
        <IconBase name="sparkle" :size="24" class="icon-accent" />
        <span class="offline-title">欢迎回来！</span>
      </div>
      <div class="offline-duration">你离开了 {{ formatTime(offlineSeconds) }}</div>
      <div class="offline-divider"></div>
      <div class="offline-rewards">
        <div class="offline-reward-item">
          <IconBase name="scroll" :size="18" class="icon-accent2" />
          <span class="reward-label">经验</span>
          <span class="reward-value">+{{ formatNumber(expGained) }}</span>
        </div>
        <div class="offline-reward-item">
          <IconBase name="gold" :size="18" class="icon-accent" />
          <span class="reward-label">金币</span>
          <span class="reward-value">+{{ formatNumber(goldGained) }}</span>
        </div>
        <div class="offline-reward-item">
          <IconBase name="crossedSwords" :size="18" class="icon-danger" />
          <span class="reward-label">击杀</span>
          <span class="reward-value">{{ killCount }} 只</span>
        </div>
        <div v-if="levelUps > 0" class="offline-reward-item highlight">
          <span class="reward-label">等级提升</span>
          <span class="reward-value">+{{ levelUps }} 级</span>
        </div>
        <div v-if="bossKills > 0" class="offline-reward-item highlight">
          <IconBase name="skull" :size="18" class="icon-danger" />
          <span class="reward-label">BOSS击杀</span>
          <span class="reward-value">{{ bossKills }} 只</span>
        </div>
      </div>
      <button class="btn btn-primary offline-close-btn" @click="$emit('close')">太棒了！</button>
    </div>
  </div>
</template>

<script setup>
// ====== 离线收益汇总弹窗 ======
// @file components/OfflineRewardModal
// @module offline-reward-modal
// @description 玩家离线回来时弹出的收益汇总（时长/经验/金币/击杀/升级/BOSS）
import IconBase from './icons/IconBase.vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  offlineSeconds: { type: Number, default: 0 },
  expGained: { type: Number, default: 0 },
  goldGained: { type: Number, default: 0 },
  killCount: { type: Number, default: 0 },
  levelUps: { type: Number, default: 0 },
  bossKills: { type: Number, default: 0 },
});
defineEmits(['close']);

function formatTime(seconds) {
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时 ${Math.floor((seconds % 3600) / 60)} 分`;
  return `${Math.floor(seconds / 86400)} 天 ${Math.floor((seconds % 86400) / 3600)} 小时`;
}
function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}
</script>

<style scoped>
.offline-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1100; padding: 1.5rem; animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.offline-popup { background: linear-gradient(160deg, var(--bg2) 0%, #1a1c35 100%); border: 1px solid var(--accent); border-radius: 16px; padding: 1.5rem; max-width: 340px; width: 100%; text-align: center; box-shadow: 0 0 40px rgba(var(--gold-rgb),0.2); animation: popIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.offline-header { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.offline-title { font-size: 1.4rem; font-weight: 800; color: var(--accent); }
.offline-duration { font-size: 0.85rem; color: var(--muted); margin-bottom: 0.8rem; }
.offline-divider { height: 1px; background: linear-gradient(90deg, transparent, var(--rule), transparent); margin: 0.5rem 0 1rem; }
.offline-rewards { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.offline-reward-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.8rem; background: rgba(var(--panel-rgb),0.6); border-radius: 8px; font-size: 0.85rem; }
.offline-reward-item.highlight { background: rgba(var(--gold-rgb),0.1); border: 1px solid rgba(var(--gold-rgb),0.3); }
.reward-label { color: var(--muted); flex: 1; text-align: left; margin-left: 0.3rem; }
.reward-value { color: var(--text); font-weight: 700; font-family: monospace; }
.offline-reward-item.highlight .reward-value { color: var(--accent); }
.offline-close-btn { width: 100%; font-weight: 700; }
</style>
