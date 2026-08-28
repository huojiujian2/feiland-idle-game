<template>
  <!-- 三族试听：仅可点击查看，实际创建永远是鹰人 -->
  <div class="race-viewer">
    <button
      v-for="(r, i) in races"
      :key="r.id"
      class="race-card"
      :class="{
        'is-active': selectedRace === r.id,
        'is-preview': selectedRace !== r.id,
      }"
      :style="{ animationDelay: (i * 0.08) + 's' }"
      @click="$emit('select-race', r.id)"
      type="button"
    >
      <div class="race-card-frame">
        <img :src="r.portrait" :alt="r.name" class="race-card-img" />
        <div class="race-card-veil"></div>
        <div class="race-card-mark">{{ r.glyph }}</div>
        <div v-if="selectedRace !== r.id" class="race-card-lock" aria-hidden="true">观</div>
      </div>
      <div class="race-card-meta">
        <div class="race-card-name">
          <IconBase :name="r.icon" :size="13" class="icon-accent" />
          {{ r.name }}
        </div>
        <div class="race-card-tier">{{ r.tier }}</div>
      </div>
    </button>
  </div>

  <!-- 当前预览种族的铭文（实际永远是鹰人，翼人/天使只能预览观想） -->
  <transition name="oracle" mode="out-in">
    <div :key="selectedRace" class="race-oracle">
      <div class="race-oracle-line"></div>
      <p class="race-oracle-text">{{ currentRace.poem }}</p>
      <p class="race-oracle-text race-oracle-text--dim">{{ currentRace.note }}</p>
      <p
        v-if="selectedRace !== 'eagle'"
        class="race-oracle-text race-oracle-text--hint"
      >路在远方 —— 此境仅供观想</p>
      <div class="race-oracle-line"></div>
    </div>
  </transition>
</template>

<script setup>
// ====== 三族试听子组件 ======
// @file components/LoginScreen/RaceSelector
// @module login-screen-race-selector
// @description 三族试听（鹰人 / 翼人 / 天使）卡片渲染 + 当前预览种族的铭文
import { computed } from 'vue';
import IconBase from '../icons/IconBase.vue';
import { races } from './races.js';

const props = defineProps({
  selectedRace: { type: String, default: 'eagle' },
});
defineEmits(['select-race']);

const currentRace = computed(() => {
  return races.find(r => r.id === props.selectedRace) || races[0];
});
</script>

<!-- 父壳样式通过 :deep() 透传（race-card / race-viewer / race-oracle / etc.） -->
