<template>
  <div class="metric-card">
    <div class="metric-label">{{ label }}</div>
    <div class="metric-value" :style="valueStyle">
      {{ displayValue }}<small v-if="unit">{{ unit }}</small>
    </div>
    <div v-if="bar !== null" class="mt8">
      <div class="progress">
        <div class="progress-inner" :class="barTone" :style="{ width: Math.min(100, Math.max(0, bar)) + '%' }"></div>
      </div>
    </div>
    <div v-if="sub" class="metric-sub">{{ sub }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '—' },
  unit: { type: String, default: '' },
  sub: { type: String, default: '' },
  // 0~100 进度条（可空）
  bar: { type: Number, default: null },
  barTone: { type: String, default: '' }, // '' | is-danger | is-warning
  // 值颜色
  tone: { type: String, default: '' },   // '' | danger | warning | success
});

const displayValue = computed(() => {
  const v = props.value;
  if (typeof v !== 'number') return v;
  // 大数格式化：1234567 → 123.5万
  if (Math.abs(v) >= 100000000) return (v / 100000000).toFixed(2) + '亿';
  if (Math.abs(v) >= 10000) return (v / 10000).toFixed(1) + '万';
  return String(v);
});
const valueStyle = computed(() => {
  const map = { danger: 'var(--danger)', warning: 'var(--warning)', success: 'var(--success)' };
  const color = map[props.tone];
  return color ? { color } : {};
});
</script>
