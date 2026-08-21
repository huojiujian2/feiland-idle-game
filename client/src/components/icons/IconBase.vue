<template>
  <span class="icon" :class="['icon-' + name, { 'icon-glow': glow }]" :style="style" v-html="content"></span>
</template>

<script setup>
import { computed } from 'vue'
import { ICONS } from './icons.js'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 18 },
  color: { type: String, default: '' },
  glow: { type: Boolean, default: false }
})

const style = computed(() => {
  const px = typeof props.size === 'number' ? props.size + 'px' : props.size
  return {
    width: px,
    height: px,
    color: props.color || ''
  }
})

const content = computed(() => {
  const icon = ICONS[props.name]
  if (!icon) return ''
  const tag = icon.paths.join('')
  return `<svg viewBox="${icon.viewBox}" xmlns="http://www.w3.org/2000/svg">${tag}</svg>`
})
</script>

<style scoped>
.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
  flex-shrink: 0;
  transition: color var(--duration-fast, 150ms) var(--ease-out, ease);
}
.icon :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
.icon-glow { filter: drop-shadow(0 0 6px currentColor); }
</style>
