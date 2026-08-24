<template>
  <!-- 商店弹窗（底部弹出 Action Sheet） -->
  <transition name="sheet">
    <div v-if="visible" class="shop-overlay" @click.self="$emit('close')">
      <div class="shop-sheet">
        <div class="sheet-header">
          <span class="sheet-title"><IconBase name="shop" :size="18" class="btn-icon icon-accent2" /> 商店</span>
          <span class="sheet-gold"><IconBase name="gold" :size="14" class="icon-accent" /> {{ playerGold }}</span>
          <button class="btn btn-sm sheet-close header-icon-btn" @click="$emit('close')">
            <IconBase name="close" :size="14" />
          </button>
        </div>
        <div class="shop-grid">
          <div v-for="item in pagedItems" :key="item.id" class="shop-cell" :class="{ locked: item.locked }" @click="detail = item">
            <div class="shop-icon">{{ getShopIcon(item) }}</div>
            <div class="shop-name">{{ item.name }}</div>
            <div class="shop-price">💰{{ item.price }}</div>
            <div v-if="item.locked" class="shop-lock">🔒Lv{{ item.requiredLevel }}</div>
          </div>
        </div>
        <div v-if="totalPages > 1" class="shop-pager">
          <button class="pager-btn" :disabled="page === 1" @click="page--">‹</button>
          <span class="pager-info">{{ page }}/{{ totalPages }}</span>
          <button class="pager-btn" :disabled="page === totalPages" @click="page++">›</button>
        </div>
      </div>
    </div>
  </transition>

  <!-- 商店商品详情弹窗（嵌套） -->
  <div v-if="detail" class="shop-detail-overlay" @click.self="detail = null">
    <div class="shop-detail-box">
      <div class="sd-title">{{ getShopIcon(detail) }} {{ detail.name }}</div>
      <div class="sd-row"><span class="sd-label">类型</span><span class="sd-val">{{ getTypeName(detail) }}</span></div>
      <div v-if="detail.type === 'material'" class="sd-row"><span class="sd-label">产地</span><span class="sd-val">{{ detail.sourceMap }}</span></div>
      <div class="sd-row"><span class="sd-label">价格</span><span class="sd-val">💰{{ detail.price }}</span></div>
      <div class="sd-desc">{{ detail.desc }}</div>
      <div v-if="detail.locked" class="sd-locked-tip">🔒 需要 Lv.{{ detail.requiredLevel }} 解锁【{{ detail.sourceMap }}】后购买</div>
      <div v-else-if="detail.type === 'consumable' || detail.type === 'material'" class="sd-section">
        <div class="sd-section-title">购买数量</div>
        <div class="qty-controls">
          <button class="qty-btn" @click="changeBuyQty(detail.id, -1)">−</button>
          <span class="qty-val">{{ buyQty[detail.id] || 1 }}</span>
          <button class="qty-btn" @click="changeBuyQty(detail.id, 1)">+</button>
          <button class="btn btn-sm quick-btn" @click="setBuyQty(detail.id, 10)">+10</button>
        </div>
        <div class="sd-total">合计: 💰{{ detail.price * (buyQty[detail.id] || 1) }}</div>
        <button class="btn btn-primary btn-sm sd-buy-btn"
          :class="{ 'btn-disabled': playerGold < detail.price * (buyQty[detail.id] || 1) }"
          @click="$emit('buy', detail.id, buyQty[detail.id] || 1); detail = null">购买</button>
      </div>
      <div v-else class="sd-actions">
        <button class="btn btn-primary btn-sm" :class="{ 'btn-disabled': playerGold < detail.price }"
          @click="$emit('buy', detail.id, 1); detail = null">购买</button>
      </div>
      <button class="btn btn-sm sd-close-btn" @click="detail = null">关闭</button>
    </div>
  </div>
</template>

<script setup>
// ====== 商店弹窗 ======
// @file components/ShopModal
// @module shop-modal
// @description 主界面商店（底部弹出 Action Sheet + 商品详情嵌套弹窗）
import { ref, computed } from 'vue';
import IconBase from './icons/IconBase.vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
  playerGold: { type: Number, default: 0 },
  pageSize: { type: Number, default: 8 },
});
const emit = defineEmits(['close', 'buy']);

const detail = ref(null);
const buyQty = ref({});
const page = ref(1);

const totalPages = computed(() => Math.max(1, Math.ceil((props.items?.length || 0) / props.pageSize)));
const pagedItems = computed(() => (props.items || []).slice((page.value - 1) * props.pageSize, page.value * props.pageSize));

function getShopIcon(item) {
  if (item.type === 'consumable') {
    if (item.id?.includes('exp')) return '📜';
    return '📦';
  }
  if (item.type === 'material') {
    if (item.name?.includes('矿') || item.id?.includes('iron') || item.id?.includes('bronze')) return '🪨';
    if (item.name?.includes('草')) return '🌿';
    if (item.name?.includes('皮') || item.name?.includes('骨')) return '🦴';
    if (item.name?.includes('鳞')) return '🐉';
    if (item.name?.includes('血')) return '🩸';
    if (item.name?.includes('晶')) return '💎';
    if (item.name?.includes('羽') || item.name?.includes('露')) return '🪶';
    if (item.name?.includes('卷轴')) return '📄';
    return '🧪';
  }
  if (item.id?.includes('spear') || item.id?.includes('sword') || item.id?.includes('blade') || item.id?.includes('lance')) return '⚔️';
  if (item.id?.includes('armor') || item.id?.includes('wings') || item.id?.includes('cloak')) return '🛡️';
  return '💎';
}
function getTypeName(item) {
  if (item.type === 'consumable') return '消耗品';
  if (item.type === 'material') return '材料';
  return '装备';
}
function changeBuyQty(id, delta) {
  const cur = buyQty.value[id] || 1;
  buyQty.value = { ...buyQty.value, [id]: Math.max(1, cur + delta) };
}
function setBuyQty(id, n) { const cur = buyQty.value[id] || 1; buyQty.value = { ...buyQty.value, [id]: cur + n }; }
</script>

<style scoped>
.shop-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 400; display: flex; align-items: flex-end; justify-content: center; }
.shop-sheet { width: 100%; max-width: 560px; max-height: 70vh; background: var(--bg2); border-top: 1px solid var(--rule); border-radius: 16px 16px 0 0; display: flex; flex-direction: column; padding-bottom: 1rem; }
.sheet-header { display: flex; align-items: center; padding: 0.8rem 1rem; border-bottom: 1px solid var(--rule); gap: 0.5rem; }
.sheet-title { flex: 1; display: flex; align-items: center; gap: 0.4rem; font-weight: 700; font-size: 1rem; color: var(--text); }
.sheet-gold { display: flex; align-items: center; gap: 0.2rem; color: var(--accent); font-weight: 700; font-family: monospace; }
.sheet-close { width: 32px; height: 32px; }

.shop-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; padding: 0.8rem; overflow-y: auto; }
.shop-cell { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; padding: 0.6rem 0.3rem; background: rgba(20,22,42,0.5); border: 1px solid var(--rule); border-radius: 6px; cursor: pointer; transition: all 0.15s; position: relative; }
.shop-cell:hover { border-color: var(--accent2); transform: translateY(-1px); }
.shop-cell.locked { opacity: 0.45; filter: grayscale(0.8); }
.shop-lock { position: absolute; top: 2px; right: 3px; font-size: 0.6rem; color: var(--muted); }
.shop-icon { font-size: 1.5rem; }
.shop-name { font-size: 0.72rem; font-weight: 600; text-align: center; }
.shop-price { font-size: 0.68rem; color: var(--accent); font-weight: 700; font-family: monospace; }

.shop-pager { display: flex; justify-content: center; align-items: center; gap: 0.5rem; padding: 0.5rem 0; }
.pager-btn { padding: 0.3rem 0.7rem; background: rgba(20,22,42,0.5); border: 1px solid var(--rule); border-radius: 6px; color: var(--muted); cursor: pointer; font-size: 0.85rem; }
.pager-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.pager-info { font-size: 0.78rem; color: var(--muted); font-family: monospace; }

.sheet-enter-active, .sheet-leave-active { transition: all 0.3s ease; }
.sheet-enter-from, .sheet-leave-to { transform: translateY(100%); }

.shop-detail-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 410; display: flex; align-items: center; justify-content: center; padding: 1rem; }
.shop-detail-box { background: var(--bg2); border: 1px solid var(--rule); border-radius: 12px; padding: 1.2rem; max-width: 360px; width: 100%; }
.sd-title { font-size: 1.05rem; font-weight: 700; margin-bottom: 0.6rem; }
.sd-row { display: flex; justify-content: space-between; padding: 0.3rem 0; font-size: 0.82rem; }
.sd-label { color: var(--muted); }
.sd-val { color: var(--text); font-weight: 600; }
.sd-desc { padding: 0.5rem 0; color: var(--text); font-size: 0.82rem; border-top: 1px solid var(--rule); margin-top: 0.3rem; }
.sd-locked-tip { padding: 0.5rem; margin-top: 0.3rem; background: rgba(212,175,94,0.08); border: 1px dashed var(--rule); border-radius: 6px; color: var(--muted); font-size: 0.78rem; text-align: center; }
.sd-section { padding-top: 0.5rem; }
.sd-section-title { font-size: 0.78rem; color: var(--muted); margin-bottom: 0.3rem; }
.qty-controls { display: flex; align-items: center; gap: 0.3rem; margin-bottom: 0.4rem; }
.qty-btn { width: 28px; height: 28px; background: rgba(20,22,42,0.6); border: 1px solid var(--rule); border-radius: 4px; color: var(--text); cursor: pointer; font-family: inherit; }
.qty-val { min-width: 2rem; text-align: center; font-family: monospace; font-weight: 700; }
.quick-btn { padding: 0.2rem 0.5rem; font-size: 0.7rem; }
.sd-total { font-size: 0.85rem; color: var(--accent); font-weight: 700; font-family: monospace; margin: 0.3rem 0; }
.sd-buy-btn, .sd-actions .btn { width: 100%; padding: 0.5rem; margin-top: 0.3rem; }
.sd-close-btn { width: 100%; padding: 0.4rem; margin-top: 0.4rem; }
</style>
