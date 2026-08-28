<!--
  ====== 称号系统弹窗 v2.9 ======
  显示当前佩戴的称号 + 已解锁职业称号 + 限时称号（24h）
  - 职业称号：当前职业分支 + 玩家等级 ≥ 阶段等级 时才解锁
  - 限时称号：来自世界 BOSS 伤害前三，失效后自动隐藏
-->
<template>
  <div class="title-overlay" @click.self="$emit('close')">
    <div class="title-box">
      <div class="title-ornament top">✦</div>
      <div class="title-ornament bottom">✦</div>

      <div class="title-title">称号</div>
      <div class="title-subtitle">点击切换 · 当前佩戴：{{ currentTitleText }}</div>

      <!-- 当前佩戴 -->
      <div class="current-section">
        <span class="cur-label">佩戴中</span>
        <span class="cur-name" :style="{ color: currentTitleColor }">{{ currentTitleText }}</span>
      </div>

      <!-- 职业阶段称号（按职业分组） -->
      <div class="group" v-if="jobTitlesByJob && Object.keys(jobTitlesByJob).length > 0">
        <div class="group-title">职业阶段称号</div>
        <div v-for="(titles, jobId) in jobTitlesByJob" :key="jobId" class="job-group">
          <div class="job-label">{{ jobNames[jobId] || jobId }}</div>
          <div class="title-row">
            <button
              v-for="t in titles"
              :key="t.key"
              type="button"
              class="title-chip"
              :class="{
                'is-current': currentKey === t.key,
                'is-locked': !t.unlocked,
              }"
              :disabled="!t.unlocked"
              :title="t.unlocked ? `点击佩戴 ${t.name}` : `${jobNames[jobId]} 第 ${titles.indexOf(t)+1} 阶段 · Lv.${t.requiresLevel} 解锁`"
              @click="equip(t.key)"
            >
              <span class="chip-name" :style="{ color: t.color }">{{ t.name }}</span>
              <span v-if="!t.unlocked" class="chip-lock">🔒 Lv.{{ t.requiresLevel }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 限时称号（世界 BOSS 伤害前三） -->
      <div class="group" v-if="timeTitles && timeTitles.length > 0">
        <div class="group-title">限时称号（24h 有效）</div>
        <div class="title-row">
          <button
            v-for="t in timeTitles"
            :key="t.key"
            type="button"
            class="title-chip"
            :class="{ 'is-current': currentKey === t.key }"
            :title="`点击佩戴 ${t.name}`"
            @click="equip(t.key)"
          >
            <span class="chip-name" :style="{ color: t.color }">{{ t.name }}</span>
            <span class="chip-time">⏳ {{ formatRemaining(t.remainingMs) }}</span>
          </button>
        </div>
      </div>

      <div class="title-actions">
        <button class="btn btn-secondary" @click="equip(null)">卸下称号</button>
        <button class="btn btn-primary" @click="$emit('close')">完成</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '../api.js'
import { toast } from '../ui-bridge.js'

const props = defineProps({
  currentKey: { type: String, default: null },
  currentName: { type: String, default: null },
  currentColor: { type: String, default: '#9d8cf0' },
  username: { type: String, required: true },
})
const emit = defineEmits(['close', 'changed'])

const jobTitlesByJob = ref({})
const timeTitles = ref([])

const jobNames = {
  thunder: '雷霆系', light: '光明系', wind: '风行系', knight: '骑士系', alchemy: '炼金系',
}

const currentTitleText = computed(() => props.currentName || '无称号')

function formatRemaining(ms) {
  if (!ms || ms <= 0) return '已过期'
  const sec = Math.floor(ms / 1000);
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  return `${h}:${m}`
}

async function load() {
  try {
    const res = await api.getTitles(props.username)
    if (res.success) {
      const unlocked = res.data.unlocked || []
      const active = res.data.active || []
      // 按职业分组
      const grouped = {}
      for (const t of unlocked) {
        if (!grouped[t.jobId]) grouped[t.jobId] = []
        grouped[t.jobId].push({ ...t, unlocked: true })
      }
      // 补充未解锁的同职业阶段（用于展示锁定状态）
      const all = res.data.all || {}
      for (const key of Object.keys(all)) {
        const meta = all[key]
        if (!meta.jobId) continue
        const isUnlocked = unlocked.some(u => u.key === key)
        if (!isUnlocked) {
          if (!grouped[meta.jobId]) grouped[meta.jobId] = []
          // 把"未解锁"阶段也列出来
          const alreadyShown = grouped[meta.jobId].some(x => x.requiresLevel === meta.requiresLevel)
          if (!alreadyShown) grouped[meta.jobId].push({ ...meta, key, unlocked: false })
        }
      }
      // 排序：按 requiresLevel
      for (const j of Object.keys(grouped)) {
        grouped[j].sort((a, b) => a.requiresLevel - b.requiresLevel)
      }
      jobTitlesByJob.value = grouped
      timeTitles.value = active
    }
  } catch (e) { /* ignore */ }
}

async function equip(key) {
  try {
    const res = await api.equipTitle(props.username, key)
    if (res.success) {
      emit('changed', res.data.currentTitle)
      toast.success(key ? '已切换称号' : '已卸下称号')
      load()
    } else {
      toast.error(res.message || '切换失败')
    }
  } catch (e) {
    toast.error('切换失败：' + e.message)
  }
}

onMounted(load)
</script>

<style scoped>
.title-overlay {
  position: fixed; inset: 0; z-index: 1100;
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  animation: fadeIn 0.2s ease;
}
.title-box {
  position: relative;
  width: 100%;
  max-width: 420px;
  max-height: 88vh;
  overflow-y: auto;
  padding: 1.4rem 1.2rem 1.2rem;
  border-radius: 14px;
  border: 1px solid rgba(var(--violet-rgb), 0.25);
  background: linear-gradient(160deg, rgba(var(--panel2-rgb), 0.97), rgba(var(--panel-rgb), 0.96));
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(var(--gold-rgb), 0.08);
  animation: box-in 0.3s ease;
}
@keyframes box-in { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
.title-ornament { position: absolute; left: 50%; transform: translateX(-50%); color: var(--accent); opacity: 0.6; font-size: 0.75rem; }
.title-ornament.top { top: 0.5rem; }
.title-ornament.bottom { bottom: 0.5rem; }

.title-title {
  text-align: center;
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 1.15rem; font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.08em;
}
.title-subtitle {
  text-align: center;
  font-size: 0.72rem;
  color: var(--muted);
  margin: 0.25rem 0 0.7rem;
}

.current-section {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.4rem 0.6rem;
  background: rgba(var(--gold-rgb), 0.08);
  border: 1px solid rgba(var(--gold-rgb), 0.2);
  border-radius: 8px;
  margin-bottom: 0.7rem;
}
.cur-label { font-size: 0.72rem; color: var(--muted); }
.cur-name { font-size: 1rem; font-weight: 700; }

.group { margin-bottom: 0.8rem; }
.group-title { font-size: 0.8rem; color: var(--accent2); font-weight: 600; margin-bottom: 0.35rem; padding-left: 0.2rem; }
.job-group { margin-bottom: 0.5rem; }
.job-label { font-size: 0.7rem; color: var(--muted); margin-bottom: 0.25rem; }
.title-row { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.title-chip {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  border: 1px solid rgba(var(--violet-rgb), 0.18);
  background: rgba(var(--panel-rgb), 0.5);
  color: var(--ink);
  cursor: pointer;
  font-size: 0.78rem;
  font-family: inherit;
  transition: all 0.2s ease;
}
.title-chip:hover:not(:disabled) {
  border-color: rgba(var(--gold-rgb), 0.45);
  transform: translateY(-1px);
}
.title-chip.is-current {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent), 0 0 12px rgba(var(--gold-rgb), 0.18);
  background: rgba(var(--gold-rgb), 0.1);
}
.title-chip.is-locked {
  opacity: 0.5;
  cursor: not-allowed;
  background: rgba(var(--panel-rgb), 0.3);
}
.chip-name { font-weight: 600; }
.chip-lock { font-size: 0.65rem; color: var(--dim); }
.chip-time { font-size: 0.65rem; color: var(--accent); font-family: monospace; }

.title-actions {
  display: flex; gap: 0.5rem; margin-top: 0.8rem;
}
.title-actions .btn { flex: 1; }
</style>