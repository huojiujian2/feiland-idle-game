<template>
  <div class="view-container leaderboard-view">
    <div class="lb-header">
      <div class="lb-title"><IconBase name="trophy" :size="20" class="btn-icon icon-accent" />全服排行榜</div>
      <div class="lb-subtitle">实时排行 · 展示全服最强冒险者</div>
    </div>

    <!-- 类型切换 -->
    <div class="sub-tabs lb-tabs">
      <button v-for="t in types" :key="t.id" class="sub-tab" :class="{ active: activeType === t.id }" @click="activeType = t.id">
        <IconBase :name="t.icon" :size="14" class="btn-icon icon-accent2" /> {{ t.label }}
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
          <div v-for="item in pagedList" :key="item.username" class="lb-row" :class="[rankClass(item.rank), { self: item.username === currentUser }]">
            <span class="col-rank">
              <IconBase v-if="item.rank === 1" name="trophy" :size="20" class="rank-medal gold icon-accent" />
              <IconBase v-else-if="item.rank === 2" name="star" :size="18" class="rank-medal silver icon-accent2" />
              <IconBase v-else-if="item.rank === 3" name="gem" :size="16" class="rank-medal bronze icon-success" />
              <span v-else class="rank-num">{{ item.rank }}</span>
            </span>
            <div class="col-player">
              <div class="player-main">
                <span class="player-name">{{ item.name }}</span>
                <span v-if="item.username === currentUser" class="self-tag"><IconBase name="flag" :size="13" /></span>
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
        <!-- 分页器：每页12项 -->
        <div v-if="totalPages > 1" class="lb-pager">
          <button class="pager-btn" :disabled="page === 1" @click="page--">‹</button>
          <span class="pager-info">{{ page }}/{{ totalPages }}</span>
          <button class="pager-btn" :disabled="page === totalPages" @click="page++">›</button>
        </div>
        <div class="lb-footer">
          <span class="lb-total">共 {{ total }} 名冒险者上榜 · 显示前 100 名 · 每页 12 项</span>
        </div>
      </template>
    </div>

    <!-- 自身排名卡片（即使在100名外也能显示） -->
    <div v-if="myRank" class="card my-rank-card">
      <div class="my-rank-title">我的排名</div>
      <div class="my-rank-row">
        <span class="my-rank-num">#{{ myRank.rank }}</span>
        <span class="my-rank-name">{{ myRank.name }}</span>
        <span class="my-rank-value">{{ formatValue(myRank) }}</span>
        <span v-if="myRank.rank > 100" class="my-rank-outside">（100名外）</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import IconBase from './icons/IconBase.vue'
import api from '../api.js'

const props = defineProps(['currentUser'])

const activeType = ref('level')
const list = ref([])
const total = ref(0)
const loading = ref(false)
const myRank = ref(null)
const page = ref(1)
const pageSize = 12
const currentUser = computed(() => props.currentUser || '')

// 单一数据源：榜单元信息（label/icon/value/sub），避免 BOARD_META 与 types 重复ID/label
const BOARD_META = {
  level: { label: '等级', shortLabel: '等级', icon: 'bolt', value: (i) => `Lv.${i.level}`, sub: (i) => `${i.exp} exp` },
  power: { label: '战力', shortLabel: '战力', icon: 'crossedSwords', value: (i) => i.power.toLocaleString(), sub: (i) => `ATK ${i.atk} · DEF ${i.def}` },
  gold: { label: '金币', shortLabel: '金币', icon: 'gold', value: (i) => i.gold.toLocaleString(), sub: (i) => `Lv.${i.level}` },
  kills: { label: '击杀数', shortLabel: '击杀', icon: 'skull', value: (i) => `${i.killCount}`, sub: (i) => `Lv.${i.level}` },
  reincarnation: { label: '转生', shortLabel: '转生', icon: 'dna', value: (i) => `${i.reincarnation}`, sub: (i) => `Lv.${i.level}` },
  boss: { label: 'BOSS击杀', shortLabel: 'BOSS', icon: 'skull', value: (i) => `${i.bossKills}`, sub: (i) => `Lv.${i.level}` }
}
const types = Object.entries(BOARD_META).map(([id, m]) => ({ id, label: m.shortLabel, icon: m.icon }))

const valueLabel = computed(() => BOARD_META[activeType.value]?.label || '')
const totalPages = computed(() => Math.max(1, Math.ceil(list.value.length / pageSize)))
const pagedList = computed(() => list.value.slice((page.value - 1) * pageSize, page.value * pageSize))

function rankClass(rank) {
  if (rank === 1) return 'rank-1'
  if (rank === 2) return 'rank-2'
  if (rank === 3) return 'rank-3'
  return ''
}
function formatValue(item) { return BOARD_META[activeType.value]?.value(item) || '' }
function valueSub(item) { return BOARD_META[activeType.value]?.sub(item) || '' }

// 请求序号避免竞态：旧响应丢弃
let reqSeq = 0
async function fetchBoard() {
  const curSeq = ++reqSeq
  loading.value = true
  page.value = 1
  try {
    const res = await api.getLeaderboard(activeType.value, currentUser.value || undefined)
    if (curSeq !== reqSeq) return
    if (res.success) {
      list.value = res.data.list || []
      total.value = res.data.total || 0
      myRank.value = res.data.myRank || null
    } else {
      list.value = []
      total.value = 0
      myRank.value = null
    }
  } catch (e) {
    if (curSeq !== reqSeq) return
    console.error('排行榜加载失败', e)
    list.value = []
    total.value = 0
    myRank.value = null
  } finally {
    if (curSeq === reqSeq) loading.value = false
  }
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
.lb-row { display: flex; align-items: center; padding: 0.45rem 0.4rem; border-radius: 8px; background: var(--lb-row-bg); border: 1px solid transparent; transition: all var(--duration-normal) var(--ease-out); }
.lb-row:hover { background: var(--lb-row-hover); border-color: var(--accent2); }
.lb-row.rank-1 { background: linear-gradient(135deg, var(--lb-gold-bg), var(--lb-gold-bg-soft)); border-color: var(--accent); }
.lb-row.rank-2 { background: linear-gradient(135deg, var(--lb-silver-bg), var(--lb-silver-bg-soft)); border-color: var(--muted); }
.lb-row.rank-3 { background: linear-gradient(135deg, var(--lb-bronze-bg), var(--lb-bronze-bg-soft)); border-color: var(--lb-bronze-border); }
.lb-row.self { border-color: var(--accent2); box-shadow: 0 0 0 1px var(--lb-self-shadow); }

.col-rank { width: 52px; text-align: center; flex-shrink: 0; }
.rank-medal { font-size: 1.1rem; }
.rank-num { font-size: 0.8rem; font-weight: 700; color: var(--muted); font-family: monospace; }
.rank-1 .rank-num { color: var(--accent); }

.col-player { flex: 1; min-width: 0; }
.player-main { display: flex; align-items: center; gap: 0.3rem; }
.player-name { font-size: 0.82rem; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.self-tag { font-size: 0.6rem; color: var(--accent2); background: var(--lb-self-tag-bg); padding: 0.05rem 0.3rem; border-radius: 3px; font-weight: 600; }
.god-tag { font-size: 0.6rem; font-weight: 700; padding: 0.05rem 0.3rem; border-radius: 3px; }
.god-tag.god { color: var(--lb-god-gold); background: var(--lb-god-gold-bg); }
.god-tag.demi { color: var(--lb-god-demi); background: var(--lb-god-demi-bg); }
.player-sub { display: flex; gap: 0.3rem; font-size: 0.62rem; color: var(--dim); margin-top: 0.1rem; }
.player-race { color: var(--accent2); }
.player-level { color: var(--muted); }

.col-value { width: 110px; text-align: right; flex-shrink: 0; display: flex; flex-direction: column; }
.value-main { font-size: 0.82rem; font-weight: 700; color: var(--accent); }
.rank-1 .value-main { color: var(--accent); }
.value-sub { font-size: 0.6rem; color: var(--dim); }

.lb-pager { display: flex; justify-content: center; align-items: center; gap: 0.5rem; padding: 0.4rem 0 0.1rem; }
.pager-btn { padding: 0.2rem 0.6rem; border: 1px solid var(--rule); border-radius: 6px; background: var(--lb-pager-bg); color: var(--ink); font-size: 0.75rem; cursor: pointer; transition: all var(--duration-normal) var(--ease-out); }
.pager-btn:hover:not(:disabled) { border-color: var(--accent2); }
.pager-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.pager-info { font-size: 0.72rem; color: var(--muted); font-family: monospace; }

.lb-footer { text-align: center; padding: 0.4rem 0 0.1rem; font-size: 0.65rem; color: var(--dim); }

.my-rank-card { padding: 0.6rem 0.8rem; border-color: var(--accent2); background: var(--lb-rank-bg); }
.my-rank-title { font-size: 0.72rem; color: var(--muted); margin-bottom: 0.2rem; }
.my-rank-row { display: flex; align-items: center; gap: 0.5rem; }
.my-rank-num { font-size: 0.9rem; font-weight: 800; color: var(--accent); font-family: monospace; }
.my-rank-name { flex: 1; font-size: 0.82rem; font-weight: 600; }
.my-rank-value { font-size: 0.82rem; font-weight: 700; color: var(--accent); }
.my-rank-outside { font-size: 0.62rem; color: var(--dim); }
</style>
