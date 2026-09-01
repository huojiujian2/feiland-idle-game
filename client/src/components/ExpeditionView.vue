<template>
  <div class="exp-view">
    <div class="exp-header">
      <button class="back-btn" type="button" @click="$emit('goBack')">‹ 返回地图</button>
      <div class="exp-title-row">
        <span class="exp-title-icon">🗺️</span>
        <span class="exp-title-text">远征营地</span>
      </div>
      <div class="exp-sub">选择区域 · 等待结算 · 处理随机事件 · 领取报告</div>
    </div>

    <div v-if="loadingConfig" class="empty-tip">加载配置中…</div>
    <template v-else>
      <!-- 远征状态 -->
      <div v-if="expedition" class="exp-active">
        <div class="active-card" :class="statusClass">
          <div class="active-head">
            <span class="area-name">{{ areaName(expedition.areaId) }}</span>
            <span class="status-badge" :class="statusClass">{{ statusLabel }}</span>
          </div>
          <div class="active-meta">
            <span>时长：{{ durationLabel(expedition.durationKey) }}</span>
            <span>剩余：{{ formatMs(remainingMs) }}</span>
          </div>
          <div class="time-bar">
            <div class="time-fill" :style="{ width: progressPct + '%' }"></div>
          </div>
          <div class="snapshot-line">出战快照 Lv.{{ expedition.snapshot.level }} · 攻{{ expedition.snapshot.atk }} 防{{ expedition.snapshot.def }} 生命{{ expedition.snapshot.maxHp }}</div>
          <div v-if="expedition.baseGoldLossRate > 0" class="loss-tip">⚠️ 深渊基础损失：{{ Math.round(expedition.baseGoldLossRate*100) }}% 基础金币</div>
        </div>

        <!-- 事件 -->
        <div v-if="expedition.events && expedition.events.length" class="event-section">
          <div class="section-title">随机事件（{{ expedition.events.length }}）</div>
          <div v-for="ev in expedition.events" :key="ev.eventId" class="event-card">
            <div class="event-head">
              <span class="event-title">{{ ev.title }}</span>
              <span class="event-type">{{ ev.type || '' }}</span>
            </div>
            <div class="event-desc">{{ ev.desc }}</div>
            <div class="choice-grid">
              <button
                v-for="ch in ev.choices"
                :key="ch.id"
                class="choice-btn"
                :class="{ picked: ev.chosenId === ch.id, disabled: remainingMs <= 0 || loadingChoose }"
                :disabled="loadingChoose || remainingMs <= 0"
                @click="chooseEvent(ev.eventId, ch.id)"
              >
                <div class="choice-label">{{ ch.label }} <span class="risk" :class="ch.risk">{{ riskLabel(ch.risk) }}</span></div>
                <div class="choice-hint">{{ ch.rewardHint }}</div>
                <div v-if="ch.timeDelta" class="choice-time" :class="{ neg: ch.timeDelta < 0 }">{{ formatDelta(ch.timeDelta) }}</div>
                <div v-if="ev.chosenId === ch.id" class="chosen-tag">已选</div>
              </button>
            </div>
            <div v-if="ev.chosenId" class="chosen-msg">
              已选：{{ chosenLabel(ev) }} · {{ chosenOutcomeMsg(ev) }}
              <span v-if="ev.choiceChangeCount >= 1" class="change-limit">（已达改选上限）</span>
            </div>
            <div v-else class="chosen-msg muted">未选择，结算时默认按 A 选项结算（含时长影响）</div>
          </div>
        </div>
        <div v-else class="empty-tip">本次远征未触发随机事件</div>

        <!-- 首领预告 -->
        <div v-if="expedition.boss" class="boss-preview">
          <span>区域首领：{{ expedition.boss.name }} · 基础概率 {{ Math.round(expedition.boss.baseChance*100) }}% · {{ expedition.boss.triggered === null ? '待结算时判定' : (expedition.boss.triggered ? '已触发' : '未触发') }}</span>
        </div>

        <button v-if="remainingMs <= 0" class="claim-btn" type="button" :disabled="loadingClaim" @click="claim">
          {{ loadingClaim ? '结算中…' : '领取结算报告' }}
        </button>
        <div v-else class="wait-tip">远征进行中，{{ formatMs(remainingMs) }} 后可领取</div>
      </div>

      <!-- 无远征：选区派遣 -->
      <div v-else class="exp-dispatch">
        <div class="dispatch-tip">选择远征区域与时长（单队并发，冷却由倒计时控制）</div>
        <div class="area-grid">
          <div
            v-for="area in areaList"
            :key="area.id"
            class="area-card"
            :class="{ picked: pickedArea === area.id, locked: (player.level||1) < area.minLevel }"
            @click="pickArea(area.id)"
          >
            <div class="area-head">
              <span class="area-name">{{ area.name }}</span>
              <span class="area-risk" :class="area.risk">{{ riskLabel(area.risk) }}</span>
            </div>
            <div class="area-desc">{{ area.desc }}</div>
            <div class="area-req">推荐 Lv.{{ area.minLevel }} <span v-if="(player.level||1) < area.minLevel" class="req-lock">（等级不足）</span></div>
            <div class="area-reward">基础：{{ area.base.gold[0] }}~{{ area.base.gold[1] }} 金币 · {{ area.base.exp }} 经验</div>
            <div class="area-drops">掉落：{{ area.base.drops.map(d=>d.name).join('、') }}</div>
            <div v-if="area.base.goldLoss" class="area-loss">深渊损失：{{ Math.round(area.base.goldLoss.chance*100) }}%概率扣{{ Math.round(area.base.goldLoss.rate*100) }}%金币</div>
            <div class="area-boss">首领：{{ area.boss.name }}（{{ Math.round(area.boss.chance*100) }}%）</div>
          </div>
        </div>

        <div class="duration-row">
          <span class="duration-label">时长：</span>
          <button
            v-for="d in durations"
            :key="d.key"
            class="dur-btn"
            :class="{ picked: pickedDuration === d.key }"
            @click="pickedDuration = d.key"
          >{{ d.label }}</button>
        </div>

        <button class="dispatch-btn" type="button" :disabled="!canDispatch || loadingDispatch" @click="dispatch">
          {{ loadingDispatch ? '派遣中…' : '派遣远征' }}
        </button>
      </div>

      <!-- 报告 -->
      <div v-if="lastReport" class="report-section">
        <div class="section-title">最新结算报告</div>
        <div class="report-card">
          <div class="report-head">{{ areaName(lastReport.areaId) }} · {{ durationLabel(lastReport.durationKey) }}</div>
          <div class="report-time">{{ formatTime(lastReport.startAt) }} → {{ formatTime(lastReport.endAt) }} · {{ formatMs(lastReport.endAt - lastReport.startAt) }}</div>
          <div class="report-base">基础：{{ lastReport.base.gold }} 金币 · {{ lastReport.base.exp }} 经验 · 掉落 {{ lastReport.base.drops.map(d=>d.name).join('、') || '无' }}<span v-if="lastReport.base.baseGoldLossRate"> · 深渊损失{{ Math.round(lastReport.base.baseGoldLossRate*100) }}%</span></div>
          <div v-for="er in lastReport.events" :key="er.eventId" class="report-event">
            <span class="ev-title">{{ er.title || er.eventId }}</span>
            <span class="ev-choice">选{{ er.chosenId?.toUpperCase() }}</span>
            <span class="ev-msg">{{ er.outcome.message }}</span>
            <span class="ev-gold" :class="{ neg: er.outcome.goldDelta < 0 }">{{ er.outcome.goldDelta >=0 ? '+' : '' }}{{ er.outcome.goldDelta }}金币</span>
            <span v-if="er.outcome.lossRate" class="ev-loss">-{{ Math.round(er.outcome.lossRate*100) }}%基础</span>
          </div>
          <div v-if="lastReport.boss" class="report-boss" :class="{ win: lastReport.boss.triggered && lastReport.boss.battle?.result==='win' }">
            <div>首领：{{ lastReport.boss.triggered ? (lastReport.boss.battle ? `已触发 · ${lastReport.boss.battle.result}` : '已触发') : '未触发' }} · 概率 {{ Math.round((lastReport.boss.finalChance||0)*100) }}%（roll {{ (lastReport.boss.roll||0).toFixed(2) }}）</div>
            <div v-if="lastReport.boss.rewards">首领奖励：{{ lastReport.boss.rewards.gold }}金币 · {{ lastReport.boss.rewards.exp }}经验<span v-if="lastReport.boss.rewards.material"> · {{ lastReport.boss.rewards.material.name }}×{{ lastReport.boss.rewards.material.count }}</span></div>
            <div v-if="lastReport.boss.battle && lastReport.boss.battle.rounds" class="boss-rounds">
              <div v-for="r in lastReport.boss.battle.rounds" :key="r.round" class="boss-round">
                <span class="round-label">R{{ r.round }}</span>
                <span v-for="(a,i) in r.actions" :key="i" class="action" :class="a.actor">
                  {{ a.actor==='player' ? '我' : '首领' }} {{ a.skill }} {{ a.damage ? a.damage : '' }}{{ a.crit ? '暴击' : '' }}{{ a.dodge ? '闪避' : '' }}
                </span>
              </div>
            </div>
          </div>
          <div class="report-total">合计：{{ lastReport.total.gold }}金币 · {{ lastReport.total.exp }}经验<span v-if="lastReport.total.materials && lastReport.total.materials.length"> · 材料 {{ lastReport.total.materials.map(m=>m.name+'×'+m.count).join('、') }}</span></div>
        </div>
      </div>

      <!-- 历史 -->
      <div v-if="history && history.length" class="history-section">
        <div class="section-title">远征历史（近{{ history.length }}）</div>
        <div class="history-list">
          <div v-for="h in history.slice(0,10)" :key="h.id" class="history-item">
            <span class="h-area">{{ areaName(h.areaId) }}</span>
            <span class="h-dur">{{ durationLabel(h.durationKey) }}</span>
            <span class="h-gold">+{{ h.reward.gold }}金</span>
            <span class="h-boss" v-if="h.bossTriggered">首领</span>
          </div>
        </div>
      </div>

      <!-- 图鉴 -->
      <div v-if="codex" class="codex-section">
        <div class="section-title">远征图鉴</div>
        <div class="codex-grid">
          <div v-for="area in areaList" :key="area.id" class="codex-item">
            <span class="codex-name">{{ area.name }}</span>
            <span class="codex-cnt">派遣{{ (codex[area.id]?.dispatched)||0 }} · 完成{{ (codex[area.id]?.claimed)||0 }} · 首领胜{{ (codex[area.id]?.bossKills)||0 }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import api from '../api.js';
import { toast } from '../ui-bridge.js';

const props = defineProps(['player', 'currentUser']);
defineEmits(['goBack']);

const loadingConfig = ref(true);
const areaList = ref([]);
const durations = ref([]);
const expedition = ref(null);
const history = ref([]);
const codex = ref({});
const reports = ref({});
const lastReport = ref(null);
const remainingMs = ref(0);
const pickedArea = ref(null);
const pickedDuration = ref('30m');
const loadingDispatch = ref(false);
const loadingChoose = ref(false);
const loadingClaim = ref(false);

let ticker = null;
let poller = null;

function formatMs(ms) {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
function formatDelta(ms) {
  if (!ms) return '';
  const sign = ms > 0 ? '+' : '-';
  return sign + formatMs(Math.abs(ms));
}
function formatTime(ts) {
  if (!ts) return '--';
  const d = new Date(ts);
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function areaName(id) {
  const a = areaList.value.find(x => x.id === id);
  return a ? a.name : id;
}
function durationLabel(k) {
  const d = durations.value.find(x => x.key === k);
  return d ? d.label : k;
}
function riskLabel(r) {
  const m = { low: '低风险', mid: '中风险', high: '高风险' };
  return m[r] || r;
}
function chosenLabel(ev) {
  const ch = ev.choices.find(c => c.id === ev.chosenId);
  return ch ? ch.label : ev.chosenId;
}
function chosenOutcomeMsg(ev) {
  const ch = ev.choices.find(c => c.id === ev.chosenId);
  if (!ch) return '';
  const o = ch.outcome;
  return o.message + (o.goldDelta ? ` (${o.goldDelta>0?'+':''}${o.goldDelta}金币)` : '');
}

const statusLabel = computed(() => {
  if (!expedition.value) return '';
  return remainingMs.value <= 0 ? '可领取' : '进行中';
});
const statusClass = computed(() => remainingMs.value <= 0 ? 'ready' : 'ongoing');
const progressPct = computed(() => {
  if (!expedition.value) return 0;
  const total = expedition.value.endAt - expedition.value.startAt;
  const rem = remainingMs.value;
  const elapsed = total - rem;
  const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
  return Math.round(pct);
});
const canDispatch = computed(() => {
  if (!pickedArea.value || !pickedDuration.value) return false;
  const area = areaList.value.find(a => a.id === pickedArea.value);
  if (!area) return false;
  if ((props.player.level||1) < area.minLevel) return false;
  return true;
});

function pickArea(id) {
  const area = areaList.value.find(a=>a.id===id);
  if (!area) return;
  if ((props.player.level||1) < area.minLevel) {
    toast.error(`需要 Lv.${area.minLevel} 才能进入${area.name}`);
    return;
  }
  pickedArea.value = id;
}

async function loadConfig() {
  const res = await api.getExpeditionConfig();
  if (res.success) {
    const data = res.data || res;
    const areas = data.areas || {};
    areaList.value = Object.values(areas);
    durations.value = data.durations || [];
    if (areaList.value.length && !pickedArea.value) pickedArea.value = areaList.value[0].id;
  }
  loadingConfig.value = false;
}
async function loadExpedition() {
  const res = await api.getExpedition(props.currentUser);
  if (res.success) {
    const data = res.data || res;
    expedition.value = data.expedition || null;
    history.value = data.history || [];
    codex.value = data.codex || {};
    reports.value = data.reports || {};
    remainingMs.value = data.remainingMs ?? (expedition.value ? Math.max(0, expedition.value.endAt - Date.now()) : 0);
    // 同步本地基准，避免 Date.now 漂移：后续 ticker 以递减 remainingMs 为准，不再直接用 Date.now() 重算
    if (data.reports && Object.keys(data.reports).length) {
      const keys = Object.keys(data.reports).sort((a,b)=> (data.reports[b].claimedAt||0)-(data.reports[a].claimedAt||0));
      lastReport.value = data.reports[keys[0]];
    } else if (!expedition.value && history.value.length) {
      // fallback to history latest if no reports
      // keep lastReport null
    }
    if (data.expedition && !lastReport.value && data.expedition.settlementId) {
      // check ledger? ignore
    }
  }
}

async function dispatch() {
  if (!canDispatch.value || loadingDispatch.value) return;
  loadingDispatch.value = true;
  const res = await api.dispatchExpedition(props.currentUser, pickedArea.value, pickedDuration.value);
  loadingDispatch.value = false;
  if (res.success) {
    toast.success('远征已派遣');
    await loadExpedition();
  } else {
    toast.error(res.message || '派遣失败');
  }
}
async function chooseEvent(eventId, choiceId) {
  if (loadingChoose.value) return;
  loadingChoose.value = true;
  const res = await api.chooseExpeditionEvent(props.currentUser, eventId, choiceId);
  loadingChoose.value = false;
  if (res.success) {
    const data = res.data || res;
    if (data.expedition) expedition.value = data.expedition;
    await loadExpedition();
  } else {
    toast.error(res.message || '选择失败');
  }
}
async function claim() {
  if (!expedition.value || loadingClaim.value) return;
  loadingClaim.value = true;
  const res = await api.claimExpedition(props.currentUser, expedition.value.id);
  loadingClaim.value = false;
  if (res.success) {
    const isReplay = res.already || (res.data && res.data.already);
    const data = res.data || res;
    const rep = data.report || data;
    if (isReplay) toast.success('已领取（重放）');
    else toast.success(`远征完成：+${rep.total.gold}金币 +${rep.total.exp}经验`);
    lastReport.value = rep;
    await loadExpedition();
  } else {
    toast.error(res.message || '领取失败');
  }
}

function startTimers() {
  ticker = setInterval(() => {
    if (remainingMs.value > 0) remainingMs.value = Math.max(0, remainingMs.value - 1000);
  }, 1000);
  poller = setInterval(loadExpedition, 15000); // v1.03 优化：5s→15s（远征页面独立轮询）
}

onMounted(async () => {
  await loadConfig();
  await loadExpedition();
  startTimers();
});
onBeforeUnmount(() => {
  if (ticker) clearInterval(ticker);
  if (poller) clearInterval(poller);
});

watch(() => props.player, () => {
  // 保持 pickedArea 合法
  if (pickedArea.value) {
    const a = areaList.value.find(x=>x.id===pickedArea.value);
    if (a && (props.player.level||1) < a.minLevel) {
      // 不自动清，仅提示
    }
  }
});
</script>

<style scoped>
.exp-view { display:flex; flex-direction:column; gap:0.6rem; padding:0.6rem 0.8rem; padding-bottom:calc(var(--tabbar-h) + var(--safe-bottom) + var(--browser-bar-h,0px) + 0.75rem); max-width:560px; margin:0 auto; }
.exp-header { display:flex; flex-direction:column; gap:0.2rem; }
.back-btn { align-self:flex-start; padding:0.3rem 0.7rem; background:rgba(var(--violet-rgb),0.1); border:1px solid var(--rule); border-radius:6px; color:var(--muted); cursor:pointer; font-size:0.75rem; }
.back-btn:hover { background:rgba(var(--violet-rgb),0.2); color:var(--text); }
.exp-title-row { display:flex; align-items:center; gap:0.4rem; }
.exp-title-icon { font-size:1.4rem; }
.exp-title-text { font-size:1.1rem; font-weight:800; color:var(--accent); }
.exp-sub { font-size:0.7rem; color:var(--muted); }
.empty-tip { padding:0.8rem; text-align:center; color:var(--muted); font-size:0.78rem; }
.active-card { padding:0.6rem; background:var(--bg2); border:1px solid var(--rule); border-radius:8px; }
.active-card.ready { border-color:var(--success); background:rgba(80,200,120,0.08); }
.active-head { display:flex; justify-content:space-between; align-items:center; }
.area-name { font-weight:800; color:var(--text); }
.status-badge { padding:0.15rem 0.45rem; border-radius:10px; font-size:0.68rem; font-weight:700; }
.status-badge.ongoing { background:rgba(var(--violet-rgb),0.15); color:var(--violet); }
.status-badge.ready { background:rgba(80,200,120,0.15); color:var(--success); }
.active-meta { display:flex; gap:0.8rem; margin-top:0.3rem; font-size:0.72rem; color:var(--muted); font-family:monospace; }
.time-bar { margin-top:0.4rem; height:6px; background:rgba(var(--panel-rgb),0.5); border-radius:3px; overflow:hidden; }
.time-fill { height:100%; background:linear-gradient(90deg,var(--accent),var(--accent2)); transition:width 0.5s; }
.snapshot-line { margin-top:0.3rem; font-size:0.68rem; color:var(--muted); }
.loss-tip { margin-top:0.2rem; font-size:0.68rem; color:var(--danger); }
.event-section { display:flex; flex-direction:column; gap:0.4rem; }
.section-title { font-size:0.78rem; font-weight:700; color:var(--accent); margin-top:0.4rem; }
.event-card { padding:0.5rem; background:var(--bg2); border:1px solid var(--rule); border-radius:8px; }
.event-head { display:flex; justify-content:space-between; align-items:center; }
.event-title { font-weight:700; font-size:0.85rem; color:var(--text); }
.event-type { font-size:0.65rem; color:var(--muted); background:rgba(var(--panel-rgb),0.5); padding:0.15rem 0.4rem; border-radius:4px; }
.event-desc { margin-top:0.2rem; font-size:0.72rem; color:var(--muted); }
.choice-grid { display:grid; grid-template-columns:1fr 1fr; gap:0.3rem; margin-top:0.4rem; }
.choice-btn { position:relative; padding:0.45rem; background:var(--bg); border:1px solid var(--rule); border-radius:6px; cursor:pointer; text-align:left; transition:all 0.15s; }
.choice-btn:hover { border-color:var(--accent2); }
.choice-btn.picked { border-color:var(--accent); background:rgba(var(--gold-rgb),0.1); }
.choice-btn.disabled { opacity:0.6; cursor:not-allowed; }
.choice-label { font-size:0.78rem; font-weight:700; color:var(--text); display:flex; justify-content:space-between; align-items:center; }
.risk.low { color:var(--success); font-size:0.65rem; }
.risk.mid { color:var(--accent2); font-size:0.65rem; }
.risk.high { color:var(--danger); font-size:0.65rem; }
.choice-hint { font-size:0.68rem; color:var(--muted); margin-top:0.15rem; }
.choice-time { font-size:0.65rem; color:var(--muted); font-family:monospace; margin-top:0.15rem; }
.choice-time.neg { color:var(--success); }
.chosen-tag { position:absolute; top:0.3rem; right:0.3rem; font-size:0.6rem; background:var(--accent); color:#1a1208; padding:0.1rem 0.3rem; border-radius:4px; font-weight:700; }
.chosen-msg { margin-top:0.3rem; font-size:0.68rem; color:var(--accent2); }
.chosen-msg.muted { color:var(--muted); }
.change-limit { color:var(--danger); }
.boss-preview { padding:0.4rem 0.5rem; background:rgba(var(--violet-rgb),0.08); border:1px solid rgba(var(--violet-rgb),0.2); border-radius:6px; font-size:0.72rem; color:var(--muted); }
.claim-btn { padding:0.6rem; background:rgba(var(--gold-rgb),0.15); border:1px solid var(--accent); border-radius:8px; color:var(--accent); font-weight:800; font-size:0.9rem; cursor:pointer; font-family:inherit; }
.claim-btn:disabled { opacity:0.5; cursor:not-allowed; }
.wait-tip { padding:0.4rem; text-align:center; color:var(--muted); font-size:0.72rem; }
.exp-dispatch { display:flex; flex-direction:column; gap:0.5rem; }
.dispatch-tip { font-size:0.72rem; color:var(--muted); text-align:center; }
.area-grid { display:grid; grid-template-columns:1fr 1fr; gap:0.4rem; }
.area-card { padding:0.5rem; background:var(--bg2); border:1px solid var(--rule); border-radius:8px; cursor:pointer; transition:border-color 0.15s; }
.area-card:hover { border-color:var(--accent2); }
.area-card.picked { border-color:var(--accent); background:rgba(var(--gold-rgb),0.08); }
.area-card.locked { opacity:0.6; }
.area-head { display:flex; justify-content:space-between; align-items:center; }
.area-name { font-weight:700; font-size:0.85rem; color:var(--text); }
.area-risk.low { color:var(--success); font-size:0.65rem; }
.area-risk.mid { color:var(--accent2); font-size:0.65rem; }
.area-risk.high { color:var(--danger); font-size:0.65rem; }
.area-desc { font-size:0.68rem; color:var(--muted); margin-top:0.2rem; }
.area-req { font-size:0.65rem; color:var(--muted); margin-top:0.2rem; }
.req-lock { color:var(--danger); }
.area-reward, .area-drops, .area-boss, .area-loss { font-size:0.65rem; color:var(--muted); margin-top:0.1rem; }
.area-loss { color:var(--danger); }
.duration-row { display:flex; align-items:center; gap:0.3rem; }
.duration-label { font-size:0.72rem; color:var(--muted); }
.dur-btn { padding:0.35rem 0.6rem; background:rgba(var(--panel-rgb),0.5); border:1px solid var(--rule); border-radius:6px; color:var(--muted); cursor:pointer; font-size:0.72rem; }
.dur-btn.picked { border-color:var(--accent); color:var(--accent); background:rgba(var(--gold-rgb),0.1); font-weight:700; }
.dispatch-btn { padding:0.6rem; background:rgba(var(--gold-rgb),0.15); border:1px solid var(--accent); border-radius:8px; color:var(--accent); font-weight:800; font-size:0.85rem; cursor:pointer; }
.dispatch-btn:disabled { opacity:0.5; cursor:not-allowed; }
.report-section { margin-top:0.4rem; }
.report-card { padding:0.5rem; background:var(--bg2); border:1px solid var(--rule); border-radius:8px; font-size:0.72rem; }
.report-head { font-weight:700; color:var(--text); }
.report-time, .report-base { color:var(--muted); margin-top:0.2rem; }
.report-event { display:flex; flex-wrap:wrap; gap:0.4rem; margin-top:0.2rem; padding:0.3rem; background:var(--bg); border-radius:6px; }
.ev-title { font-weight:700; color:var(--text); }
.ev-choice { color:var(--accent2); }
.ev-msg { color:var(--muted); }
.ev-gold.neg { color:var(--danger); }
.ev-gold { color:var(--success); font-family:monospace; }
.ev-loss { color:var(--danger); font-family:monospace; }
.report-boss { margin-top:0.3rem; padding:0.4rem; background:rgba(var(--violet-rgb),0.08); border-radius:6px; }
.report-boss.win { border:1px solid var(--success); }
.boss-rounds { margin-top:0.3rem; }
.boss-round { display:flex; flex-wrap:wrap; gap:0.3rem; margin-top:0.15rem; font-family:monospace; font-size:0.68rem; }
.round-label { font-weight:700; color:var(--accent); }
.action.player { color:var(--success); }
.action.monster { color:var(--danger); }
.report-total { margin-top:0.4rem; font-weight:700; color:var(--accent2); font-family:monospace; }
.history-section, .codex-section { margin-top:0.4rem; }
.history-list { display:flex; flex-direction:column; gap:0.25rem; }
.history-item { display:grid; grid-template-columns:1fr auto auto auto; gap:0.4rem; padding:0.4rem 0.5rem; background:var(--bg2); border:1px solid var(--rule); border-radius:6px; font-size:0.72rem; }
.h-area { color:var(--text); font-weight:600; }
.h-dur { color:var(--muted); font-family:monospace; }
.h-gold { color:var(--accent2); font-family:monospace; }
.h-boss { background:var(--danger); color:#fff; padding:0.1rem 0.3rem; border-radius:4px; font-size:0.6rem; }
.codex-grid { display:grid; grid-template-columns:1fr 1fr; gap:0.3rem; }
.codex-item { padding:0.35rem 0.4rem; background:var(--bg2); border:1px solid var(--rule); border-radius:6px; display:flex; flex-direction:column; gap:0.1rem; }
.codex-name { font-size:0.78rem; font-weight:600; color:var(--text); }
.codex-cnt { font-size:0.65rem; color:var(--muted); font-family:monospace; }
@media (max-width: 480px) { .area-grid { grid-template-columns:1fr; } .choice-grid { grid-template-columns:1fr; } .codex-grid { grid-template-columns:1fr; } }
</style>
