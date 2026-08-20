<template>
  <div v-if="overlayVisible" class="tutorial-root">
    <template v-if="!fallbackCenter">
      <div class="backdrop top" :style="backdropTop" @click="onBackdrop"></div>
      <div class="backdrop bottom" :style="backdropBottom" @click="onBackdrop"></div>
      <div class="backdrop left" :style="backdropLeft" @click="onBackdrop"></div>
      <div class="backdrop right" :style="backdropRight" @click="onBackdrop"></div>
      <div class="tutorial-hole" :style="holeStyle"></div>
    </template>
    <template v-else>
      <div class="backdrop full" @click="onBackdrop"></div>
    </template>
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
const backdropTop = ref({})
const backdropBottom = ref({})
const backdropLeft = ref({})
const backdropRight = ref({})

const current = computed(()=> STEPS[step.value] || STEPS[0])
const fallbackCenter = computed(()=> baseVisible.value && step.value===2 && !targetReady.value)

function updateRect(){
  if(!overlayVisible.value){
    targetReady.value = true
    return
  }
  const sel = current.value.target
  let rect = null
  if(sel === '[data-tutorial=alloc-wrap]'){
    const wrap = document.querySelector('[data-tutorial=alloc-wrap]')
    if(!wrap){
      targetReady.value=false
      cardStyle.value = { left:'50%', top:'50%', transform:'translate(-50%,-50%)' }
      holeStyle.value = { display:'none' }
      backdropTop.value = { display:'none' }
      backdropBottom.value = { display:'none' }
      backdropLeft.value = { display:'none' }
      backdropRight.value = { display:'none' }
      return
    }
    const avail = wrap.querySelectorAll('[data-alloc-available]')
    if(avail.length>0){
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity, found=false
      avail.forEach(a=>{
        const r=a.getBoundingClientRect()
        if(r.width===0&&r.height===0) return
        found=true
        minX=Math.min(minX,r.left); minY=Math.min(minY,r.top); maxX=Math.max(maxX,r.right); maxY=Math.max(maxY,r.bottom)
      })
      if(found){
        rect={left:minX,top:minY,right:maxX,bottom:maxY,width:maxX-minX,height:maxY-minY}
        targetReady.value=true
      } else {
        targetReady.value=false
      }
    } else {
      targetReady.value=false
    }
    if(!targetReady.value){
      cardStyle.value = { left:'50%', top:'50%', transform:'translate(-50%,-50%)' }
      holeStyle.value = { display:'none' }
      backdropTop.value = { display:'none' }
      backdropBottom.value = { display:'none' }
      backdropLeft.value = { display:'none' }
      backdropRight.value = { display:'none' }
      return
    }
  } else {
    const el = document.querySelector(sel)
    if(el){
      const r=el.getBoundingClientRect()
      if(r.width>0||r.height>0){
        rect=r
        targetReady.value=true
      } else {
        targetReady.value=false
        return
      }
    } else {
      targetReady.value=false
      return
    }
  }
  if(!rect) return
  const pad=4
  const hole = { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad*2, height: rect.height + pad*2 }
  holeStyle.value = { left: hole.left+'px', top: hole.top+'px', width: hole.width+'px', height: hole.height+'px' }
  // backdrops
  backdropTop.value = { left:'0', top:'0', width:'100%', height: hole.top+'px' }
  backdropBottom.value = { left:'0', top: (hole.top+hole.height)+'px', width:'100%', height: `calc(100% - ${hole.top+hole.height}px)` }
  backdropLeft.value = { left:'0', top: hole.top+'px', width: hole.left+'px', height: hole.height+'px' }
  backdropRight.value = { left: (hole.left+hole.width)+'px', top: hole.top+'px', width: `calc(100% - ${hole.left+hole.width}px)`, height: hole.height+'px' }
  // card
  let top = hole.top + hole.height + 10
  let left = hole.left
  if(top + 100 > window.innerHeight) top = hole.top - 80
  if(left + 260 > window.innerWidth) left = window.innerWidth - 270
  if(fallbackCenter.value){
    cardStyle.value = { left:'50%', top:'50%', transform:'translate(-50%,-50%)' }
  } else {
    cardStyle.value = { left: left+'px', top: top+'px' }
  }
  if(fallbackCenter.value){
    holeStyle.value = { display:'none' }
    backdropTop.value = { display:'none' }
    backdropBottom.value = { display:'none' }
    backdropLeft.value = { display:'none' }
    backdropRight.value = { display:'none' }
  }
}

let raf = null
let running = false
function startLoop(){
  if(running) return
  running=true
  function loop(){
    if(!overlayVisible.value){
      running=false
      return
    }
    updateRect()
    if(targetReady.value && !waiting.value && !fallbackCenter.value){
      running=false
      return
    }
    raf = requestAnimationFrame(loop)
  }
  loop()
}
function stopLoop(){
  if(raf) cancelAnimationFrame(raf)
  raf=null
  running=false
}
watch([step, level, jobPath], ()=> nextTick(()=>{ updateRect(); startLoop() }), {immediate:true})
watch(overlayVisible, (v)=>{
  if(v) startLoop()
  else stopLoop()
})
onMounted(()=>{ nextTick(()=>{ updateRect(); startLoop() }) })
onUnmounted(()=> stopLoop())

function onBackdrop(){
  // backdrop click does nothing, hole is transparent to clicks
}
</script>

<style scoped>
.tutorial-root{ position:fixed; inset:0; z-index:var(--tutorial-z); pointer-events:none; }
.backdrop{ position:fixed; background:var(--tutorial-overlay-bg); backdrop-filter:var(--tutorial-blur); pointer-events:auto; }
.backdrop.full{ inset:0; }
.tutorial-hole{ position:fixed; border:var(--tutorial-outline); border-radius:var(--tutorial-hole-radius); pointer-events:none; box-shadow:var(--tutorial-hole-shadow); transition:all var(--duration-normal) var(--ease-out); }
.tutorial-card{ position:fixed; background:var(--tutorial-card-bg); border:1px solid var(--tutorial-card-border); border-radius:var(--tutorial-card-radius); padding:0.6rem 0.8rem; max-width:260px; z-index:calc(var(--tutorial-z) + 1); box-shadow:var(--tutorial-card-shadow); pointer-events:auto; }
.tutorial-step{ font-size:0.62rem; color:var(--dim); margin-bottom:0.2rem; }
.tutorial-text{ font-size:0.78rem; color:var(--ink); line-height:1.4; margin-bottom:0.4rem; }
.tutorial-actions{ display:flex; justify-content:space-between; align-items:center; gap:0.4rem; }
.tutorial-hint{ font-size:0.62rem; color:var(--muted); }
</style>
