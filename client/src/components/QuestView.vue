<template>
  <div class="view-container quest-view">
    <div class="quest-header">
      <div class="quest-title"><IconBase name="scroll" :size="18" class="btn-icon icon-accent" />任务委托</div>
      <div class="quest-subtitle">日常可每日领取 · 成就永久有效</div>
    </div>
    <!-- 每日活跃 -->
    <div class="card daily-active-card">
      <div class="da-head">
        <span class="da-title">每日活跃 {{ dailyActive.points }}/100</span>
        <span class="da-pct">{{ dailyActive.progressPct }}%</span>
      </div>
      <div class="bar da-bar"><div class="bar-fill" :style="{ width: dailyActive.progressPct + '%' }"></div></div>
      <div class="da-tiers">
        <div v-for="t in dailyActive.tiers" :key="t.tier" class="da-tier" :class="{ claimed: t.claimed, canClaim: t.canClaim }">
          <span class="da-tier-label">{{ t.tier }}档 {{ t.need }}分</span>
          <span class="da-tier-reward">{{ formatActiveReward(t.reward) }}</span>
          <button class="btn btn-sm btn-primary da-claim-btn" :class="{ 'btn-disabled': !t.canClaim }" @click="onClaimActive(t.tier)">{{ t.claimed ? '已领' : (t.canClaim ? '领取' : '未满') }}</button>
        </div>
      </div>
    </div>

    <div class="sub-tabs">
      <button class="sub-tab" :class="{ active: tab==='daily' }" @click="tab='daily'; page=1">日常</button>
      <button class="sub-tab" :class="{ active: tab==='ach' }" @click="tab='ach'; page=1">成就</button>
    </div>

    <!-- 日常 -->
    <template v-if="tab==='daily'">
      <div class="card quest-chest-card">
        <div class="chest-row">
          <span class="chest-label">宝箱进度 {{ chestClaimedCount }}/{{ chestNeed }} · {{ player.questView?.chest?.claimed ? '已领取' : (player.questView?.chest?.canClaim ? '可领取' : '需领取5项') }}</span>
          <button class="btn btn-sm btn-primary" :class="{ 'btn-disabled': !canClaimChest }" @click="onClaimChest">{{ player.questView?.chest?.claimed ? '已领取' : '领取宝箱' }}</button>
        </div>
      </div>
      <div class="quest-grid">
        <div v-for="q in pagedDaily" :key="q.id" class="quest-cell" @click="selected=q">
          <div class="quest-name">{{ q.name }}</div>
          <div class="quest-desc">{{ q.desc }}</div>
          <div class="bar quest-bar"><div class="bar-fill" :style="{ width: Math.min(100, Math.round(q.progress/q.target*100)) + '%' }"></div></div>
          <div class="quest-progress">{{ q.progress }}/{{ q.target }} <span v-if="q.claimed" class="quest-claimed">已领取</span><span v-else-if="q.done" class="quest-done">可领取</span></div>
          <button class="btn btn-sm btn-primary quest-claim-btn" :class="{ 'btn-disabled': !q.done || q.claimed }" @click.stop="onClaimDaily(q.id)">{{ q.claimed ? '已领取' : (q.done ? '领取' : '未完成') }}</button>
        </div>
      </div>
      <div v-if="dailyTotalPages>1" class="quest-pager">
        <button class="pager-btn" :disabled="page===1" @click="page--">‹</button>
        <span class="pager-info">{{ page }}/{{ dailyTotalPages }}</span>
        <button class="pager-btn" :disabled="page===dailyTotalPages" @click="page++">›</button>
      </div>
    </template>

    <!-- 成就 -->
    <template v-else>
      <div class="quest-grid">
        <div v-for="a in pagedAch" :key="a.id" class="quest-cell" :class="{ unlocked: a.unlocked }">
          <div class="quest-name">{{ a.name }} <span v-if="a.title" class="quest-title-tag">{{ a.title }}</span></div>
          <div class="quest-desc">{{ a.desc }}</div>
          <div class="quest-status">
            <span v-if="a.claimed" class="quest-claimed">已领取</span>
            <span v-else-if="a.unlocked" class="quest-done">可领取</span>
            <span v-else class="quest-locked">未达成</span>
          </div>
          <button class="btn btn-sm btn-primary quest-claim-btn" :class="{ 'btn-disabled': !a.unlocked || a.claimed }" @click="onClaimAch(a.id)">{{ a.claimed ? '已领取' : (a.unlocked ? '领取' : '未达成') }}</button>
        </div>
      </div>
      <div v-if="achTotalPages>1" class="quest-pager">
        <button class="pager-btn" :disabled="page===1" @click="page--">‹</button>
        <span class="pager-info">{{ page }}/{{ achTotalPages }}</span>
        <button class="pager-btn" :disabled="page===achTotalPages" @click="page++">›</button>
      </div>
    </template>

    <!-- 详情遮罩 -->
    <div v-if="selected" class="equip-detail-overlay" @click.self="selected=null">
      <div class="quest-detail-box">
        <div class="qd-title">{{ selected.name }}</div>
        <div class="qd-desc">{{ selected.desc }}</div>
        <div class="qd-row"><span class="qd-label">进度</span><span class="qd-val">{{ selected.progress }}/{{ selected.target }}</span></div>
        <div class="qd-row"><span class="qd-label">奖励</span><span class="qd-val">{{ formatReward(selected.reward) }}</span></div>
        <button class="btn btn-sm" @click="selected=null">关闭</button>
      </div>
    </div>

    <!-- v0.8+ 创世之书入口：仅二转可见，醒目金色卡片 -->
    <div
      v-if="isGenesisUnlocked"
      class="genesis-portal"
      @click="$emit('goGenesis')"
    >
      <div class="genesis-portal-frame">
        <div class="genesis-portal-rune" aria-hidden="true">✦</div>
        <div class="genesis-portal-body">
          <div class="genesis-portal-title">创世之书 · 第二轮回已解锁</div>
          <div class="genesis-portal-desc">捏造生灵 · 铸造神器 · 让全服世界见证你的意志</div>
        </div>
        <div class="genesis-portal-arrow">›</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import api from '../api.js'
import IconBase from './icons/IconBase.vue'
import { toast } from '../ui-bridge.js'
const props = defineProps(['player','currentUser'])
const emit = defineEmits(['refresh', 'goGenesis'])
const tab = ref('daily')
const page = ref(1)
const pageSize = 12
const selected = ref(null)
const player = computed(()=> props.player || {})
// v0.8+：创世之书仅二转（reincarnation >= 2）解锁
const isGenesisUnlocked = computed(() => (player.value.reincarnation || 0) >= 2);
const dailyActive = computed(()=> player.value.questView?.dailyActive || player.value.dailyActive || { points:0, claimed:[], tiers:[], progressPct:0 })
const dailyList = computed(()=> player.value.questView?.dailyQuests || [])
const achList = computed(()=> player.value.questView?.achievements || [])
const chestNeed = computed(()=> player.value.questView?.chest?.need || 5)
const chestClaimedCount = computed(()=> dailyList.value.filter(q=>q.claimed).length)
const canClaimChest = computed(()=> !!player.value.questView?.chest?.canClaim)
const dailyTotalPages = computed(()=> Math.max(1, Math.ceil(dailyList.value.length / pageSize)))
const achTotalPages = computed(()=> Math.max(1, Math.ceil(achList.value.length / pageSize)))
const pagedDaily = computed(()=> dailyList.value.slice((page.value-1)*pageSize, page.value*pageSize))
const pagedAch = computed(()=> achList.value.slice((page.value-1)*pageSize, page.value*pageSize))
watch(tab, ()=> page.value=1)
function formatReward(r){
  if(!r) return '-'
  if(r.gold) return r.gold + ' 金币'
  if(r.exp) return r.exp + ' 经验'
  if(r.materialPool) return '随机材料×' + (r.count||1)
  if(r.materials) return r.materials.map(m=>m.name+'×'+m.count).join('、')
  if(r.equipPool) return '随机装备×1'
  if(r.affixLevel) return '大师词条×1'
  if(r.reincPoints) return '转生点×' + r.reincPoints
  return JSON.stringify(r)
}
function formatActiveReward(r){
  if(!r) return '-'
  if(r.gold) return r.gold + ' 金币'
  if(r.exp && r.materials) return r.exp + '经验+' + r.materials.map(m=>m.name+'×'+m.count).join('、')
  if(r.exp) return r.exp + ' 经验'
  if(r.materials) return r.materials.map(m=>m.name+'×'+m.count).join('、')
  return JSON.stringify(r)
}
async function onClaimDaily(id){
  const res = await api.claimDaily(props.currentUser, id)
  if(!res.success) { toast.error(res.message||'领取失败'); return }
  emit('refresh', res.data)
}
async function onClaimChest(){
  if(!canClaimChest.value && !player.value.questView?.chest?.claimed) { toast.warn('需完成5项已领取'); return }
  const res = await api.claimChest(props.currentUser)
  if(!res.success) { toast.error(res.message||'领取失败'); return }
  emit('refresh', res.data)
}
async function onClaimAch(id){
  const res = await api.claimAchievement(props.currentUser, id)
  if(!res.success) { toast.error(res.message||'领取失败'); return }
  emit('refresh', res.data)
}
async function onClaimActive(tier){
  const res = await api.claimDailyActive(props.currentUser, tier)
  if(!res.success) { toast.error(res.message||'领取失败'); return }
  if(res.already) toast.success('已领取（重放）')
  else if(res.reward) toast.success('领取成功：' + formatActiveReward(res.reward))
  emit('refresh', res.data)
}
</script>

<style scoped>
.quest-view{ display:flex; flex-direction:column; gap:0.6rem; max-width:560px; margin:0 auto; }
.quest-header{ text-align:center; padding:0.2rem 0; }
.quest-title{ font-family:var(--font-display); font-size:1.2rem; font-weight:700; color:var(--accent); letter-spacing:0.05em; }
.quest-subtitle{ font-size:0.7rem; color:var(--dim); margin-top:0.15rem; }
.quest-chest-card{ padding:0.5rem 0.6rem; }
.chest-row{ display:flex; align-items:center; justify-content:space-between; gap:0.5rem; font-size:0.78rem; }
.chest-label{ color:var(--muted); }
.quest-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:0.35rem; }
.quest-cell{ display:flex; flex-direction:column; gap:0.15rem; padding:0.5rem 0.35rem; border:1px solid var(--rule); border-radius:8px; background:var(--quest-card-bg); transition:all var(--duration-normal) var(--ease-out); min-height:118px; }
.quest-cell:hover{ border-color:var(--accent2); background:var(--quest-card-hover); transform:translateY(-1px); }
.quest-name{ font-size:0.7rem; font-weight:600; color:var(--ink); line-height:1.2; }
.quest-title-tag{ font-size:0.58rem; color:var(--accent); background:rgba(var(--gold-rgb),0.12); padding:0.05rem 0.25rem; border-radius:3px; margin-left:0.2rem; }
.quest-desc{ font-size:0.62rem; color:var(--dim); line-height:1.3; min-height:1.6em; }
.quest-bar{ height:5px; margin:0.1rem 0; background:var(--quest-progress-bg); }
.quest-bar .bar-fill{ background:var(--quest-progress-fill); }
.quest-progress{ font-size:0.6rem; color:var(--muted); }
.quest-done{ color:var(--success); font-weight:600; margin-left:0.2rem; }
.quest-claimed{ color:var(--accent); font-weight:600; margin-left:0.2rem; }
.quest-locked{ color:var(--dim); }
.quest-status{ font-size:0.6rem; }
.quest-claim-btn{ margin-top:auto; font-size:0.62rem; padding:0.2rem 0.3rem; }
.quest-pager{ display:flex; justify-content:center; align-items:center; gap:0.5rem; padding:0.3rem 0 0.1rem; }
.pager-btn{ padding:0.2rem 0.6rem; border:1px solid var(--rule); border-radius:6px; background:var(--lb-pager-bg); color:var(--ink); font-size:0.75rem; cursor:pointer; transition:all var(--duration-normal) var(--ease-out); }
.pager-btn:hover:not(:disabled){ border-color:var(--accent2); }
.pager-btn:disabled{ opacity:0.3; cursor:not-allowed; }
.pager-info{ font-size:0.72rem; color:var(--muted); font-family:monospace; }
.daily-active-card{ padding:0.5rem 0.6rem; }
.da-head{ display:flex; justify-content:space-between; font-size:0.78rem; font-weight:700; color:var(--ink); }
.da-pct{ color:var(--accent); font-family:monospace; }
.da-bar{ height:6px; margin:0.3rem 0; background:var(--quest-progress-bg); }
.da-tiers{ display:grid; grid-template-columns:repeat(3,1fr); gap:0.3rem; }
.da-tier{ display:flex; flex-direction:column; gap:0.15rem; padding:0.4rem; border:1px solid var(--rule); border-radius:6px; background:var(--bg); text-align:center; }
.da-tier.canClaim{ border-color:var(--success); background:rgba(80,200,120,0.08); }
.da-tier.claimed{ opacity:0.6; }
.da-tier-label{ font-size:0.65rem; color:var(--muted); }
.da-tier-reward{ font-size:0.62rem; color:var(--accent); min-height:1.2em; }
.da-claim-btn{ font-size:0.62rem; padding:0.2rem 0.3rem; }
.quest-detail-box{ background:var(--bg2); border:1px solid var(--rule); border-radius:12px; padding:1.2rem; max-width:320px; width:100%; }
.qd-title{ font-size:1rem; font-weight:700; margin-bottom:0.4rem; }
.qd-desc{ font-size:0.78rem; color:var(--dim); margin-bottom:0.4rem; }
.qd-row{ display:flex; justify-content:space-between; font-size:0.78rem; padding:0.2rem 0; }
.qd-label{ color:var(--muted); }
.qd-val{ color:var(--accent); font-weight:600; }

/* v0.8+ 创世之书入口：二转后才显示的金色横幅 */
.genesis-portal {
  margin-top: 1rem;
  cursor: pointer;
  transition: transform 0.2s var(--ease-out, ease);
}
.genesis-portal:hover { transform: translateY(-2px); }
.genesis-portal-frame {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.7rem 1rem;
  background: linear-gradient(135deg, rgba(var(--gold-rgb),0.15) 0%, rgba(var(--panel2-rgb),0.85) 100%);
  border: 1px solid var(--accent);
  border-radius: 6px;
  box-shadow: 0 0 24px rgba(var(--gold-rgb),0.25), inset 0 1px 0 rgba(255,235,180,0.18);
}
.genesis-portal-rune {
  font-size: 1.6rem;
  font-family: var(--font-display, 'Cinzel', serif);
  color: var(--accent);
  text-shadow: 0 0 12px rgba(var(--gold-rgb),0.7);
  filter: drop-shadow(0 0 8px rgba(var(--gold-rgb),0.5));
  flex-shrink: 0;
  animation: rune-pulse 2.4s ease-in-out infinite;
}
.genesis-portal-body { flex: 1; min-width: 0; }
.genesis-portal-title {
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.08em;
  text-shadow: 0 0 8px rgba(var(--gold-rgb),0.35);
}
.genesis-portal-desc {
  font-size: 0.72rem;
  color: rgba(var(--gold-rgb),0.65);
  letter-spacing: 0.04em;
  margin-top: 0.15rem;
  font-style: italic;
}
.genesis-portal-arrow {
  font-size: 1.4rem;
  color: var(--accent);
  font-weight: 700;
  opacity: 0.65;
  transition: opacity 0.2s, transform 0.2s;
}
.genesis-portal:hover .genesis-portal-arrow { opacity: 1; transform: translateX(3px); }
@keyframes rune-pulse {
  0%, 100% { text-shadow: 0 0 12px rgba(var(--gold-rgb),0.7); transform: scale(1); }
  50% { text-shadow: 0 0 22px rgba(var(--gold-rgb),1); transform: scale(1.08); }
}
</style>
