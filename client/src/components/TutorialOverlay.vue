<template>
  <div v-if="overlayVisible" class="tutorial-overlay" @click.self="onBackdrop">
    <div class="tutorial-hole" :style="holeStyle"></div>
    <div class="tutorial-card" :style="cardStyle">
      <div class="tutorial-step">步骤 {{ step + 1 }}/6</div>
      <div class="tutorial-text">{{ current.text }}</div>
      <div class="tutorial-actions">
        <button class="btn btn-sm" @click="emit('skip')">跳过</button>
        <button v-if="step===0" class="btn btn-sm btn-primary" @click="emit('next')">下一步</button>
        <span v-else class="tutorial-hint">点击高亮目标继续</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
const props = defineProps(['player'])
const emit = defineEmits(['next','skip'])
const STEPS = [
  { text: '欢迎来到费兰德世界！你的角色已经开始自动战斗了', target: '[data-tutorial=log]' },
  { text: '你升级了！点击「角色」分配属性点', target: '[data-tab=char]' },
  { text: '点击 + 号加属性，然后点确认分配', target: '[data-tutorial=alloc-wrap]' },
  { text: '到 Lv.11 后可以选职业，现在先继续挂机升级', target: '[data-tab=map]' },
  { text: '背包里有装备了，去装备上吧', target: '[data-tab=bag]' },
  { text: '词条系统可以在技能页搭配主动和被动技能', target: '[data-tab=skill]' }
]
const step = computed(()=> props.player?.tutorialStep ?? 0)
const level = computed(()=> props.player?.level ?? 1)
const jobPath = computed(()=> props.player?.jobPath)
const waiting = computed(()=> (step.value===4 && level.value<5) || (step.value===5 && !jobPath.value))
const baseVisible = computed(()=> step.value>=0 && step.value<=5 && !waiting.value)
const overlayVisible = computed(()=> baseVisible.value)
const targetReady = ref(true)
const holeStyle = ref({})
const cardStyle = ref({})

const current = computed(()=> STEPS[step.value] || STEPS[0])

function updateRect(){
  if(!overlayVisible.value){
    holeStyle.value = {}
    cardStyle.value = {}
    targetReady.value = true
    return
  }
  const sel = current.value.target
  let el = null
  if(sel === '[data-tutorial=alloc-wrap]'){
    const wrap = document.querySelector('[data-tutorial=alloc-wrap]')
    if(wrap){
      const avail = wrap.querySelectorAll('[data-alloc-available]')
      if(avail.length>0){
        // merge rects
        let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity
        avail.forEach(a=>{
          const r=a.getBoundingClientRect()
          if(r.width===0&&r.height===0) return
          minX=Math.min(minX,r.left); minY=Math.min(minY,r.top); maxX=Math.max(maxX,r.right); maxY=Math.max(maxY,r.bottom)
        })
        if(isFinite(minX)){
          const r={left:minX,top:minY,right:maxX,bottom:maxY,width:maxX-minX,height:maxY-minY}
          el={getBoundingClientRect:()=>r}
          targetReady.value=true
        } else {
          targetReady.value=false
        }
      } else {
        targetReady.value=false
      }
      if(!targetReady.value){
        // fallback center
        holeStyle.value = { display:'none' }
        cardStyle.value = { left:'50%', top:'50%', transform:'translate(-50%,-50%)' }
        return
      }
    }
  } else {
    el = document.querySelector(sel)
    targetReady.value = !!el && el.getBoundingClientRect().width>0
    if(!targetReady.value){
      holeStyle.value = { display:'none' }
      cardStyle.value = { left:'50%', top:'50%', transform:'translate(-50%,-50%)' }
      return
    }
  }
  if(!el) return
  const rect = el.getBoundingClientRect()
  holeStyle.value = {
    left: rect.left - 4 + 'px',
    top: rect.top - 4 + 'px',
    width: rect.width + 8 + 'px',
    height: rect.height + 8 + 'px'
  }
  // card below target or centered
  let top = rect.bottom + 10
  let left = rect.left
  if(top + 100 > window.innerHeight) top = rect.top - 80
  if(left + 260 > window.innerWidth) left = window.innerWidth - 270
  cardStyle.value = { left: left + 'px', top: top + 'px' }
}

let raf = null
function loop(){
  updateRect()
  raf = requestAnimationFrame(loop)
}
watch([step, level, jobPath], ()=> nextTick(updateRect), {immediate:true})
onMounted(()=>{ nextTick(updateRect); raf=requestAnimationFrame(loop) })
onUnmounted(()=>{ if(raf) cancelAnimationFrame(raf) })

function onBackdrop(){
  // backdrop click does not advance, only target hole is click-through
}
</script>

<style scoped>
.tutorial-overlay{ position:fixed; inset:0; z-index:var(--tutorial-z); pointer-events:auto; }
.tutorial-overlay::before{ content:''; position:fixed; inset:0; background:var(--tutorial-overlay-bg); backdrop-filter:var(--tutorial-blur); }
.tutorial-hole{ position:fixed; border:var(--tutorial-outline); border-radius:8px; box-shadow:0 0 0 9999px var(--tutorial-overlay-bg); pointer-events:none; transition:all var(--duration-normal) var(--ease-out); }
.tutorial-card{ position:fixed; background:var(--bg2); border:1px solid var(--accent); border-radius:10px; padding:0.6rem 0.8rem; max-width:260px; z-index:calc(var(--tutorial-z) + 1); box-shadow:0 8px 24px rgba(0,0,0,0.4); }
.tutorial-step{ font-size:0.62rem; color:var(--dim); margin-bottom:0.2rem; }
.tutorial-text{ font-size:0.78rem; color:var(--ink); line-height:1.4; margin-bottom:0.4rem; }
.tutorial-actions{ display:flex; justify-content:space-between; align-items:center; gap:0.4rem; }
.tutorial-hint{ font-size:0.62rem; color:var(--muted); }
</style>
