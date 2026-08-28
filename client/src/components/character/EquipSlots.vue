<template>
  <div class="equip-grid">
    <div v-for="slot in slots" :key="slot.key" class="equip-slot"
      :class="{
        filled: player.equipped[slot.key],
        'enchant-1': player.equipped[slot.key] && (player.equipped[slot.key].enchants || []).length === 1,
        'enchant-2': player.equipped[slot.key] && (player.equipped[slot.key].enchants || []).length === 2,
        'enchant-3': player.equipped[slot.key] && (player.equipped[slot.key].enchants || []).length === 3
      }"
      @click="player.equipped[slot.key] ? showEquipDetail(slot.key) : null">
      <div class="slot-icon"><IconBase :name="slot.iconName" :size="22" /></div>
      <div class="slot-label">{{ slot.label }}</div>
      <div v-if="player.equipped[slot.key]" class="slot-item"
        :style="{ color: qualityColors[player.equipped[slot.key].quality] }">
        {{ player.equipped[slot.key].name }}
      </div>
      <div v-else class="slot-empty">空</div>
      <div v-if="player.equipped[slot.key] && (player.equipped[slot.key].upgradeLevel || 0) > 0" class="slot-upgrade">
        +{{ player.equipped[slot.key].upgradeLevel }}
      </div>
    </div>
  </div>

  <!-- 装备详情弹窗（含附魔） -->
  <EquipDetailModal
    :item="detailItem"
    :slot="detailSlot"
    :qualityColors="qualityColors"
    :qualityLabels="qualityLabels"
    :slotLabels="slotLabels"
    :statLabels="statLabels"
    :enchantsBySlot="player.enchantsBySlot"
    :inventory="player.inventory"
    :playerGold="player.gold"
    @close="detailItem = null"
    @unequip="handleUnequip"
    @enchant="handleEnchant" />
</template>

<script setup>
// ====== 装备格子 + 详情弹窗子组件 ======
// @file components/character/EquipSlots
// @module character-equip-slots
// @description 3 个装备格子（武器/护甲/饰品）+ 附魔阶位边框 + 点击弹 EquipDetailModal
import { ref } from 'vue';
import IconBase from '../icons/IconBase.vue';
import EquipDetailModal from '../EquipDetailModal.vue';
import { slots, qualityColors, qualityLabels, slotLabels, statLabels } from './labels.js';

const props = defineProps({
  player: { type: Object, required: true },
});
const emit = defineEmits(['unequip', 'enchant']);

const detailItem = ref(null);
const detailSlot = ref(null);

function showEquipDetail(slot) {
  detailItem.value = props.player.equipped[slot];
  detailSlot.value = slot;
}
function handleUnequip(slot) {
  emit('unequip', slot);
  detailItem.value = null;
}
function handleEnchant(uid, recipeId) {
  emit('enchant', uid, recipeId);
}
</script>
