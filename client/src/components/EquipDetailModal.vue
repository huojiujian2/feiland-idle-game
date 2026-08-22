<template>
  <!-- 装备详情弹窗（含附魔） -->
  <div v-if="item" class="equip-detail-overlay" @click.self="$emit('close')">
    <div class="equip-detail-box">
      <div class="detail-name" :style="{ color: qualityColors[item.quality] }">{{ item.name }}</div>
      <div class="detail-quality" :style="{ color: qualityColors[item.quality] }">
        {{ qualityLabels[item.quality] }} · {{ slotLabels[slot] }}
      </div>
      <div class="detail-stats">
        <div v-for="(val, key) in item.stats" :key="key" class="detail-stat">
          {{ statLabels[key] || key }} +{{ val }}{{ ['exp','gold'].includes(key) ? '%' : '' }}
        </div>
      </div>
      <div v-if="item.enchants && item.enchants.length > 0" class="enchanted-list">
        <div class="enchant-header">已附魔（{{ item.enchants.length }}/3）</div>
        <div v-for="enchId in item.enchants" :key="enchId" class="enchant-item">
          <span class="enchant-name">{{ getEnchantName(enchId) }}</span>
          <span class="enchant-desc">{{ getEnchantDesc(enchId) }}</span>
        </div>
      </div>
      <div v-if="availableEnchants.length > 0 && (!item.enchants || item.enchants.length < 3)" class="enchant-section">
        <div class="enchant-header">可用附魔</div>
        <div v-for="recipe in availableEnchants" :key="recipe.id" class="enchant-recipe"
          :class="{ disabled: isEnchantDisabled(recipe) }">
          <div class="recipe-info">
            <span class="recipe-name">{{ recipe.name }}</span>
            <span class="recipe-desc">{{ recipe.desc }}</span>
            <span class="recipe-cost">{{ recipe.cost }}金 + {{ formatMaterials(recipe.materials) }}</span>
          </div>
          <button class="btn btn-sm btn-primary" :class="{ 'btn-disabled': isEnchantDisabled(recipe) }"
            @click="$emit('enchant', recipe.id)">附魔</button>
        </div>
      </div>
      <div class="detail-actions">
        <button class="btn btn-danger" @click="$emit('unequip')">卸下</button>
        <button class="btn" @click="$emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
// ====== 装备详情弹窗 ======
// @file components/EquipDetailModal
// @module equip-detail-modal
// @description 显示装备属性 + 已附魔列表 + 可附魔操作 + 卸下/关闭
import { computed } from 'vue';

const props = defineProps({
  item: { type: Object, default: null },
  slot: { type: String, default: '' },
  qualityColors: { type: Object, required: true },
  qualityLabels: { type: Object, required: true },
  slotLabels: { type: Object, required: true },
  statLabels: { type: Object, required: true },
  enchantsBySlot: { type: Object, default: () => ({ weapon: [], armor: [], accessory: [] }) },
  inventory: { type: Array, default: () => [] },
  playerGold: { type: Number, default: 0 },
});
const emit = defineEmits(['close', 'unequip', 'enchant']);

const availableEnchants = computed(() => {
  if (!props.item) return [];
  const slot = props.item.slot;
  const enchants = props.enchantsBySlot?.[slot] || [];
  const existing = props.item.enchants || [];
  return enchants.filter(r => !existing.includes(r.id));
});

function getAllEnchants() {
  return [
    ...(props.enchantsBySlot?.weapon || []),
    ...(props.enchantsBySlot?.armor || []),
    ...(props.enchantsBySlot?.accessory || []),
  ];
}
function getEnchantName(id) {
  const r = getAllEnchants().find(e => e.id === id);
  return r ? r.name : id;
}
function getEnchantDesc(id) {
  const r = getAllEnchants().find(e => e.id === id);
  return r ? r.desc : '';
}
function getMaterialCount(name) {
  const item = props.inventory?.find(i => i.name === name);
  return item ? item.count : 0;
}
function formatMaterials(materials) {
  return materials.map(m => {
    const count = getMaterialCount(m.name);
    return `${m.name}×${m.count}(${count})`;
  }).join(' ');
}
function isEnchantDisabled(recipe) {
  if (props.playerGold < recipe.cost) return true;
  for (const mat of recipe.materials) {
    if (getMaterialCount(mat.name) < mat.count) return true;
  }
  return false;
}
</script>

<style scoped>
.equip-detail-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 1rem; }
.equip-detail-box { background: var(--bg2); border: 1px solid var(--rule); border-radius: 12px; padding: 1rem 1.2rem; max-width: 360px; width: 100%; max-height: 80vh; overflow-y: auto; }
.detail-name { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.2rem; }
.detail-quality { font-size: 0.78rem; margin-bottom: 0.6rem; }
.detail-stats { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.4rem; background: rgba(20,22,42,0.6); border-radius: 6px; margin-bottom: 0.6rem; }
.detail-stat { font-size: 0.78rem; color: var(--accent2); }
.enchanted-list, .enchant-section { padding: 0.4rem; background: rgba(20,22,42,0.5); border-radius: 6px; margin-bottom: 0.5rem; }
.enchant-header { font-size: 0.78rem; font-weight: 700; color: var(--accent); margin-bottom: 0.3rem; }
.enchant-item { padding: 0.3rem 0; font-size: 0.75rem; border-bottom: 1px solid var(--rule); }
.enchant-item:last-child { border-bottom: none; }
.enchant-name { font-weight: 600; color: var(--text); margin-right: 0.4rem; }
.enchant-desc { color: var(--muted); font-size: 0.7rem; }
.enchant-recipe { padding: 0.4rem; background: rgba(157,140,240,0.06); border-radius: 6px; margin-bottom: 0.3rem; }
.enchant-recipe.disabled { opacity: 0.5; }
.enchant-recipe:last-child { margin-bottom: 0; }
.recipe-info { display: flex; flex-direction: column; gap: 0.1rem; margin-bottom: 0.3rem; }
.recipe-name { font-size: 0.78rem; font-weight: 600; color: var(--text); }
.recipe-desc { font-size: 0.7rem; color: var(--muted); }
.recipe-cost { font-size: 0.68rem; color: var(--accent); font-family: monospace; }
.detail-actions { display: flex; gap: 0.5rem; margin-top: 0.6rem; }
.detail-actions .btn { flex: 1; padding: 0.5rem; font-size: 0.82rem; }
.btn-danger { background: var(--danger); color: white; border: none; border-radius: 6px; cursor: pointer; }
.btn-danger:hover { filter: brightness(1.1); }
</style>
