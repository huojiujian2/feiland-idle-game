<template>
  <div class="pvp-content">
    <div v-if="loading" class="pvp-loading">加载中...</div>
    <div v-else class="shop-list">
      <div v-for="item in shopItems" :key="item.id" class="shop-card" :class="{ locked: !canBuyItem(item, playerLevel, arenaCoins) }">
        <div class="shop-top">
          <span class="shop-name">{{ item.name }}</span>
          <span class="shop-quality legend">传说</span>
        </div>
        <div class="shop-stats">
          <span class="shop-slot">{{ slotLabel(item.slot) }}</span>
          <span class="shop-req">需 Lv.{{ item.reqLevel }}</span>
        </div>
        <div class="shop-bonuses">
          <span v-for="(v, k) in item.stats" :key="k" class="shop-bonus">
            {{ statLabel(k) }} +{{ formatStat(k, v) }}
          </span>
        </div>
        <div class="shop-bottom">
          <span class="shop-price"><IconBase name="gem" :size="13" class="btn-icon icon-accent2" /> {{ item.price }}</span>
          <button class="shop-buy-btn" :disabled="!canBuyItem(item, playerLevel, arenaCoins)" @click="$emit('buy', item)">
            {{ buyBtnText(item, playerLevel, arenaCoins) }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// ====== PvP 竞技商店 Tab ======
// @file components/pvp/PvPShop
// @module pvp-shop
// @description 显示可购买的竞技装备（按等级梯度），含购买按钮和条件判断
import IconBase from '../icons/IconBase.vue';
import { statLabel, slotLabel, formatStat, canBuyItem, buyBtnText } from './pvpUtils';

defineProps({
  loading: { type: Boolean, default: false },
  shopItems: { type: Array, default: () => [] },
  playerLevel: { type: Number, default: 1 },
  arenaCoins: { type: Number, default: 0 },
});
defineEmits(['buy']);
</script>

<style scoped>
.pvp-content { padding: 0.6rem 0.8rem; }
.pvp-loading { text-align: center; color: var(--dim); padding: 1.5rem; font-style: italic; }

.shop-list { display: grid; grid-template-columns: 1fr; gap: 0.4rem; }
.shop-card { padding: 0.5rem 0.7rem; background: var(--bg2); border: 1px solid var(--rule); border-radius: 6px; transition: all 0.15s; }
.shop-card.locked { opacity: 0.5; }
.shop-card:not(.locked):hover { border-color: var(--accent); }
.shop-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; }
.shop-name { font-weight: 700; font-size: 0.85rem; color: var(--accent); }
.shop-quality.legend { font-size: 0.65rem; padding: 0.05rem 0.3rem; background: var(--accent); color: var(--bg); border-radius: 3px; font-weight: 700; }
.shop-stats { display: flex; gap: 0.5rem; font-size: 0.7rem; color: var(--muted); margin-bottom: 0.3rem; }
.shop-slot { color: var(--accent2); }
.shop-req { color: var(--dim); }
.shop-bonuses { display: flex; flex-wrap: wrap; gap: 0.2rem; margin-bottom: 0.4rem; }
.shop-bonus { font-size: 0.68rem; padding: 0.1rem 0.3rem; background: rgba(94,218,122,0.1); color: var(--success); border-radius: 3px; }
.shop-bottom { display: flex; justify-content: space-between; align-items: center; }
.shop-price { display: flex; align-items: center; gap: 0.2rem; color: var(--accent2); font-weight: 700; font-family: monospace; }
.shop-buy-btn { padding: 0.3rem 0.6rem; background: var(--accent); color: var(--bg); border: none; border-radius: 4px; cursor: pointer; font-weight: 700; font-size: 0.72rem; font-family: inherit; }
.shop-buy-btn:disabled { background: var(--dim); cursor: not-allowed; }
.shop-buy-btn:hover:not(:disabled) { filter: brightness(1.1); }
</style>
