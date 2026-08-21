<template>
  <span class="icon" :class="['icon-' + name, { 'icon-glow': glow }]" :style="style">
    <img v-if="useAi" :src="aiSrc" :alt="name" class="icon-img" />
    <span v-else v-html="svgContent" />
  </span>
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

// AI PNG 图标清单（只要文件存在就优先使用 PNG）
const AI_ICON_SET = new Set([
  'gold','gem','sword','shield','heart','bolt','feather','skull','user','bag',
  'map','skill','star','scroll','book','trophy','dna','flag','shop','logout',
  'chevronRight','close','plus','minus','sparkle','crossedSwords','confirm'
])

const useAi = computed(() => AI_ICON_SET.has(props.name))
const aiSrc = computed(() => `/icons/ai/${props.name}.png`)

const svgContent = computed(() => {
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
  transition: filter var(--duration-fast, 150ms) var(--ease-out, ease);
}
.icon :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
.icon-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  pointer-events: none;
  /* 透明背景化：白色像素跟深色 UI 背景叠加时透出 */
  mix-blend-mode: screen;
}
.icon-glow { filter: drop-shadow(0 0 6px rgba(212,175,94,0.45)); }
</style>