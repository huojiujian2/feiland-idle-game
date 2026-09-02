<template>
  <div>
    <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" preserveAspectRatio="none">
      <!-- 面积渐变 -->
      <defs>
        <linearGradient :id="gid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="color" stop-opacity="0.25" />
          <stop offset="100%" :stop-color="color" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <polygon v-if="points.length > 1" :points="areaPoints" :fill="`url(#${gid})`" />
      <polyline
        v-if="points.length > 1"
        :points="points.join(' ')"
        :stroke="color"
        stroke-width="2"
        fill="none"
        stroke-linejoin="round"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
      />
      <!-- 空态 -->
      <text
        v-if="points.length <= 1"
        :x="width / 2" :y="height / 2"
        text-anchor="middle" fill="var(--text-3)" font-size="12"
      >暂无数据</text>
    </svg>
    <div class="muted" style="font-size:12px; text-align:right; margin-top:4px;">
      最近值: <b style="color:var(--text-1); font-variant-numeric:tabular-nums;">{{ lastLabel }}</b>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  data: { type: Array, default: () => [] }, // [{ ts, value }] 或数字数组
  width: { type: Number, default: 520 },
  height: { type: Number, default: 120 },
  color: { type: String, default: 'var(--primary)' },
  unit: { type: String, default: '' },
});

const gid = `spark-${Math.random().toString(36).slice(2, 8)}`;

const norm = computed(() => {
  const raw = Array.isArray(props.data) ? props.data : [];
  const arr = raw.map((d) => (typeof d === 'number' ? d : (d && typeof d.value === 'number' ? d.value : 0)));
  if (arr.length < 2) return arr;
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const span = max - min || 1;
  const pad = 6;
  return arr.map((v) => (v - min) / span);
});

const points = computed(() => {
  const n = norm.value.length;
  if (n < 2) return [];
  const stepX = props.width / (n - 1);
  return norm.value.map((r, i) => `${(i * stepX).toFixed(1)},${(props.height - 4 - r * (props.height - 16)).toFixed(1)}`);
});

const areaPoints = computed(() => {
  if (points.value.length < 2) return '';
  return `${points.value[0].split(',')[0]},${props.height} ${points.value.join(' ')} ${points.value[points.value.length - 1].split(',')[0]},${props.height}`;
});

const lastLabel = computed(() => {
  const raw = Array.isArray(props.data) ? props.data : [];
  if (raw.length === 0) return '—';
  const last = raw[raw.length - 1];
  const v = typeof last === 'number' ? last : (last && typeof last.value === 'number' ? last.value : 0);
  return `${v}${props.unit}`;
});
</script>
