<template>
  <div class="view-container leaderboard-view">
    <div class="lb-header">
      <div class="lb-title">🏆 全服排行榜</div>
      <div class="lb-subtitle">实时排行 · 展示全服最强冒险者</div>
    </div>

    <!-- 类型切换 -->
    <div class="sub-tabs lb-tabs">
      <button v-for="t in types" :key="t.id" class="sub-tab" :class="{ active: activeType === t.id }" @click="switchType(t.id)">
        <span class="tab-icon">{{ t.icon }}</span>{{ t.label }}
      </button>
    </div>

    <!-- 排行榜列表 -->
    <div class="card lb-card">
      <div v-if="loading" class="empty-hint">加载中...</div>
      <div v-else-if="list.length === 0" class="empty-hint">暂无数据</div>
      <template v-else>
        <!-- 表头 -->
        <div class="lb-head-row">
          <span class="col-rank">排名</span>
          <span class="col-player">冒险者</span>
          <span class="col-value">{{ valueLabel }}</span>
        </div>
        <div class="lb-list">
          <div v-for="item in list" :key="item.username" class="lb-row" :class="[rankClass(item.rank), { self: item.username === currentUser }]">
            <span class="col-rank">
              <span v-if="item.rank === 1" class="rank-medal gold">🥇</span>
              <span v-else-if="item.rank === 2" class="rank-medal silver">🥈</span>
              <span v-else-if="item.rank === 3" class="rank-medal bronze">🥉</span>
              <span v-else class="rank-num">{{ item.rank }}</span>
            </span>
            <div class="col-player">
              <div class="player-main">
                <span class="player-name">{{ item.name }}</span>
                <span v-if="item.username === currentUser" class="self-tag">你</span>
                <span v-if="item.godhood === 'god'" class="god-tag god">神灵</span>
                <span v-else-if="item.godhood === 'demigod'" class="god-tag demi">半神</span>
              </div>
              <div class="player-sub">
                <span class="player-race">{{ item.race }}</span>
                <span v-if="item.job !== '无'" class="player-job">{{ item.job }}</span>
                <span class="player-level">Lv.{{ item.level }}</span>
              </div>
            </div>
            <span class="col-value">
              <span class="value-main">{{ formatValue(item) }}</span>
              <span class="value-sub">{{ valueSub(item) }}</span>
            </span>
          </div>
        </div>
        <div class="lb-footer">
          <span class="lb-total">共 {{ total }} 名冒险者上榜 · 显示前 100 名</span>
        </div>
      </template>
    </div>

    <!-- 自身排名卡片 -->
    <div v-if="myRank" class="card my-rank-card">
      <div class="my-rank-title">我的排名</div>
      <div class="my-rank-row">
        <span class="my-rank-num">#{{ myRank.rank }}</span>
        <span class="my-rank-name">{{ myRank.name }}</span>
        <span class="my-rank-value">{{ formatValue(myRank) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '../api.js'

const props = defineProps(['currentUser'])

const activeType = ref('level')
const list = ref([])
const total = ref(0)
const loading = ref(false)
const currentUser = computed(() => props.currentUser || '')

const types = [
  { id: 'level', label: '等级', icon: '⬆️' },
  { id: 'power', label: '战力', icon: '⚔️' },
  { id: 'gold', label: '金币', icon: '💰' },
  { id: 'kills', label: '击杀', icon: '💀' }
]

const valueLabel = computed(() => {
  const map = { level: '等级', power: '战力', gold: '金币', kills: '击杀数' }
  return map[activeType.value] || ''
})

function rankClass(rank) {
  if (rank === 1) return 'rank-1'
  if (rank === 2) return 'rank-2'
  if (rank === 3) return 'rank-3'
  return ''
}

function formatValue(item) {
  if (activeType.value === 'level') return `Lv.${item.level}`
  if (activeType.value === 'power') return item.power.toLocaleString()
  if (activeType.value === 'gold') return item.gold.toLocaleString()
  if (activeType.value === 'kills') return `${item.killCount}`
  return ''
}

function valueSub(item) {
  if (activeType.value === 'level') return `${item.exp} exp`
  if (activeType.value === 'power') return `ATK ${item.atk} · DEF ${item.def}`
  if (activeType.value === 'gold') return `Lv.${item.level}`
  if (activeType.value === 'kills') return `Lv.${item.level}`
  return ''
}

const myRank = computed(() => {
  if (!currentUser.value) return null
  return list.value.find(i => i.username === currentUser.value) || null
})

async function fetchBoard() {
  loading.value = true
  try {
    const res = await api.getLeaderboard(activeType.value)
    if (res.success) {
      list.value = res.data.list || []
      total.value = res.data.total || 0
    }
  } catch (e) {
    console.error('排行榜加载失败', e)
  } finally {
    loading.value = false
  }
}

function switchType(t) {
  activeType.value = t
  fetchBoard()
}

onMounted(fetchBoard)
watch(activeType, fetchBoard)
defineExpose({ refresh: fetchBoard })
</script>

<style scoped>
.leaderboard-view { display: flex; flex-direction: column; gap: 0.6rem; max-width: 560px; margin: 0 auto; }
.lb-header { text-align: center; padding: 0.2rem 0; }
.lb-title { font-family: var(--font-display); font-size: 1.2rem; font-weight: 700; color: var(--accent); letter-spacing: 0.05em; }
.lb-subtitle { font-size: 0.7rem; color: var(--dim); margin-top: 0.15rem; }

.lb-tabs { margin-bottom: 0.1rem; }
.lb-tabs .sub-tab { display: flex; align-items: center; justify-content: center; gap: 0.2rem; font-size: 0.78rem; padding: 0.45rem; }
.tab-icon { font-size: 0.85rem; }

.lb-card { padding: 0.5rem 0.6rem; }
.lb-head-row { display: flex; align-items: center; padding: 0.3rem 0.4rem; font-size: 0.68rem; color: var(--dim); border-bottom: 1px solid var(--rule); margin-bottom: 0.2rem; }
.lb-head-row .col-rank { width: 52px; text-align: center; }
.lb-head-row .col-player { flex: 1; }
.lb-head-row .col-value { width: 110px; text-align: right; }

.lb-list { display: flex; flex-direction: column; gap: 0.25rem; }
.lb-row { display: flex; align-items: center; padding: 0.45rem 0.4rem; border-radius: 8px; background: rgba(20,22,42,0.4); border: 1px solid transparent; transition: all 0.15s; }
.lb-row:hover { background: rgba(20,22,42,0.6); border-color: rgba(157,140,240,0.12); }
.lb-row.rank-1 { background: linear-gradient(135deg, rgba(212,175,94,0.12), rgba(212,175,94,0.04)); border-color: rgba(212,175,94,0.25); }
.lb-row.rank-2 { background: linear-gradient(135deg, rgba(180,180,200,0.10), rgba(180,180,200,0.03)); border-color: rgba(180,180,200,0.18); }
.lb-row.rank-3 { background: linear-gradient(135deg, rgba(205,127,50,0.10), rgba(205,127,50,0.03)); border-color: rgba(205,127,50,0.18); }
.lb-row.self { border-color: var(--accent2); box-shadow: 0 0 0 1px rgba(157,140,240,0.2); }

.col-rank { width: 52px; text-align: center; flex-shrink: 0; }
.rank-medal { font-size: 1.1rem; }
.rank-num { font-size: 0.8rem; font-weight: 700; color: var(--muted); font-family: monospace; }
.rank-1 .rank-num { color: var(--accent); }

.col-player { flex: 1; min-width: 0; }
.player-main { display: flex; align-items: center; gap: 0.3rem; }
.player-name { font-size: 0.82rem; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.self-tag { font-size: 0.6rem; color: var(--accent2); background: rgba(157,140,240,0.15); padding: 0.05rem 0.3rem; border-radius: 3px; font-weight: 600; }
.god-tag { font-size: 0.6rem; font-weight: 700; padding: 0.05rem 0.3rem; border-radius: 3px; }
.god-tag.god { color: #ffd700; background: rgba(255,215,0,0.12); }
.god-tag.demi { color: #ff9d5e; background: rgba(255,157,94,0.12); }
.player-sub { display: flex; gap: 0.3rem; font-size: 0.62rem; color: var(--dim); margin-top: 0.1rem; }
.player-race { color: var(--accent2); }
.player-level { color: var(--muted); }

.col-value { width: 110px; text-align: right; flex-shrink: 0; display: flex; flex-direction: column; }
.value-main { font-size: 0.82rem; font-weight: 700; color: var(--accent); }
.rank-1 .value-main { color: #d4af5e; }
.value-sub { font-size: 0.6rem; color: var(--dim); }

.lb-footer { text-align: center; padding: 0.4rem 0 0.1rem; font-size: 0.65rem; color: var(--dim); }

.my-rank-card { padding: 0.6rem 0.8rem; border-color: var(--accent2); background: rgba(157,140,240,0.06); }
.my-rank-title { font-size: 0.72rem; color: var(--muted); margin-bottom: 0.2rem; }
.my-rank-row { display: flex; align-items: center; gap: 0.5rem; }
.my-rank-num { font-size: 0.9rem; font-weight: 800; color: var(--accent); font-family: monospace; }
.my-rank-name { flex: 1; font-size: 0.82rem; font-weight: 600; }
.my-rank-value { font-size: 0.82rem; font-weight: 700; color: var(--accent); }
</style>
