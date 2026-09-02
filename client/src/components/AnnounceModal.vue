<template>
  <!-- 全服公告弹窗：与离线收益弹窗同风格的大弹窗，需手动关闭 -->
  <div v-if="visible" class="ann-overlay">
    <div class="ann-popup">
      <button class="ann-close-x" title="关闭公告" @click="$emit('close')">✕</button>
      <div class="ann-header">
        <IconBase name="sparkle" :size="22" class="icon-accent" />
        <span class="ann-title">全服公告</span>
      </div>
      <div class="ann-divider"></div>
      <div class="ann-body">
        <div v-if="list.length === 0" class="ann-empty">暂无公告</div>
        <div v-for="a in list" :key="a.id" class="ann-item">
          <div class="ann-meta">#{{ a.id }} · {{ fmtTime(a.ts) }}</div>
          <div class="ann-content">{{ a.content }}</div>
        </div>
      </div>
      <button class="btn btn-primary ann-close-btn" @click="$emit('close')">我知道了</button>
    </div>
  </div>
</template>

<script setup>
// ====== 全服公告弹窗 ======
// 显示最新公告（新在前，最多 10 条），右上角 ✕ 或底部按钮均可手动关闭
import IconBase from './icons/IconBase.vue';

defineProps({
  visible: { type: Boolean, default: false },
  list: { type: Array, default: () => [] }, // [{ id, content, ts }]，调用方保证新→旧
});
defineEmits(['close']);

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
</script>

<style scoped>
.ann-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1100; padding: 1.5rem; animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.ann-popup { position: relative; background: linear-gradient(160deg, var(--bg2) 0%, #1a1c35 100%); border: 1px solid var(--accent); border-radius: 16px; padding: 1.5rem; max-width: 400px; width: 100%; text-align: center; box-shadow: 0 0 40px rgba(var(--gold-rgb),0.2); animation: popIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.ann-close-x { position: absolute; top: 10px; right: 12px; background: none; border: none; color: var(--muted); font-size: 1rem; cursor: pointer; padding: 4px 8px; border-radius: 6px; }
.ann-close-x:hover { color: var(--text); background: rgba(var(--panel-rgb),0.6); }
.ann-header { display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.ann-title { font-size: 1.4rem; font-weight: 800; color: var(--accent); }
.ann-divider { height: 1px; background: linear-gradient(90deg, transparent, var(--rule), transparent); margin: 0.5rem 0 1rem; }
.ann-body { max-height: 320px; overflow-y: auto; margin-bottom: 1rem; }
.ann-empty { color: var(--muted); font-size: 0.85rem; padding: 1rem 0; }
.ann-item { text-align: left; padding: 0.6rem 0.8rem; margin-bottom: 0.5rem; background: rgba(var(--panel-rgb),0.6); border-radius: 8px; }
.ann-item:last-child { margin-bottom: 0; }
.ann-meta { font-size: 0.75rem; color: var(--muted); margin-bottom: 0.3rem; font-family: monospace; }
.ann-content { font-size: 0.9rem; color: var(--text); line-height: 1.6; word-break: break-all; white-space: pre-wrap; }
.ann-close-btn { width: 100%; font-weight: 700; }
</style>
