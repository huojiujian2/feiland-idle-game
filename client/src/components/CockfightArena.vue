<template>
  <div class="cock-view">
    <!-- 头部：返回 + 标题 -->
    <div class="cock-header">
      <button class="back-btn" type="button" @click="$emit('goBack')">‹ 返回地图</button>
      <div class="cock-title-row">
        <span class="cock-title-icon">🐔</span>
        <span class="cock-title-text">灵鸡斗场</span>
      </div>
      <div class="cock-sub">完全独立的免费玩法 · 不消耗任何主游戏资源</div>
    </div>

    <!-- 数据概览 -->
    <div class="cock-stats">
      <div class="cock-stat">
        <span class="stat-label">今日剩余</span>
        <span class="stat-val accent">{{ status.todayLeft }} / {{ status.dailyLimit }} 次</span>
      </div>
      <div class="cock-stat">
        <span class="stat-label">当前积分</span>
        <span class="stat-val gold">{{ status.points }} 分</span>
      </div>
      <div class="cock-stat">
        <span class="stat-label">累计胜场</span>
        <span class="stat-val success">{{ status.wins }} 胜</span>
      </div>
      <div class="cock-stat">
        <span class="stat-label">连胜</span>
        <span class="stat-val">{{ status.streak }} 局</span>
      </div>
      <div class="cock-stat wide">
        <span class="stat-label">累计参与</span>
        <span class="stat-val">{{ status.played }} / {{ status.target }} 局（目标：斗鸡狂魔）</span>
      </div>
    </div>

    <!-- Tab 切换 -->
    <div class="cock-tabs">
      <button class="cock-tab" :class="{ active: tab === 'arena' }" @click="switchTab('arena')">斗场</button>
      <button class="cock-tab" :class="{ active: tab === 'shop' }" @click="switchTab('shop')">兑换称号</button>
      <button class="cock-tab" :class="{ active: tab === 'records' }" @click="switchTab('records')">查看记录</button>
    </div>

    <!-- ===== 斗场 ===== -->
    <div v-if="tab === 'arena'" class="cock-arena">
      <!-- 空闲：入口按钮 -->
      <template v-if="phase === 'idle'">
        <button class="enter-btn" type="button" :disabled="loading" @click="enterArena">
          {{ loading ? '进入中…' : '进入斗场' }}
        </button>
        <div v-if="status.todayLeft <= 0" class="empty-tip">今日参赛次数已用完，北京时间 0:00 重置</div>
      </template>

      <!-- 押注阶段：6 只灵鸡 -->
      <template v-else-if="phase === 'betting'">
        <div class="bet-tip">凭线索押注 1~6 号（纯免费，不消耗金币）</div>
        <div class="chicken-grid">
          <div
            v-for="c in chickens" :key="c.no"
            class="chicken-card" :class="{ picked: betNo === c.no }"
            @click="betNo = c.no"
          >
            <div class="chicken-no">{{ c.no }} 号</div>
            <div class="chicken-name">{{ c.name }}</div>
            <ul class="chicken-clues">
              <li v-for="(clue, i) in c.clues" :key="i">{{ clue }}</li>
            </ul>
          </div>
        </div>

        <!-- 干预菜单（选好押注后出现） -->
        <div v-if="betNo" class="intervention-box">
          <div class="intervention-title">临场干预（可选 1 项，或跳过）</div>
          <div class="intervention-list">
            <div
              v-for="it in INTERVENTIONS" :key="it.id"
              class="intervention-item" :class="{ picked: intervention === it.id }"
              @click="intervention = intervention === it.id ? null : it.id"
            >
              <div class="intervention-label">{{ it.label }}</div>
              <div class="intervention-desc">{{ it.desc }}</div>
            </div>
          </div>
          <button class="fight-btn" type="button" :disabled="loading" @click="fight">
            {{ loading ? '比赛中…' : `开赛（押 ${betNo} 号）` }}
          </button>
        </div>
      </template>

      <!-- 战斗阶段：逐行战报 -->
      <template v-else-if="phase === 'battling'">
        <div class="report-box">
          <div v-for="(line, i) in visibleLines" :key="i" class="report-line">{{ line }}</div>
          <div v-if="visibleLines.length < reportLines.length" class="report-waiting">…</div>
        </div>
      </template>

      <!-- 结算阶段 -->
      <template v-else-if="phase === 'result' && lastResult">
        <div class="result-banner" :class="lastResult.win ? 'win' : 'lose'">
          <div class="result-main">{{ lastResult.win ? '押中了！' : '押错了…' }}</div>
          <div class="result-champion">本局冠军：{{ lastResult.champion }}</div>
          <div v-if="lastResult.win" class="result-points">积分 +{{ lastResult.pointsDelta }}</div>
          <div v-else class="result-points">积分不变</div>
        </div>
        <!-- 完整战报 -->
        <div class="report-box small">
          <div v-for="(line, i) in reportLines" :key="i" class="report-line">{{ line }}</div>
        </div>
        <div v-if="lastResult.interventionApplied && lastResult.interventionApplied.length" class="applied-box">
          <div class="applied-title">干预生效</div>
          <div v-for="(a, i) in lastResult.interventionApplied" :key="i" class="applied-item">
            {{ chickenName(a.chicken) }} {{ a.stat }} {{ a.from.toFixed(1) }} → {{ a.to.toFixed(1) }}
          </div>
          <div v-if="lastResult.interventionDiscovered" class="applied-caught">撒铁蒺藜被发现，你的鸡也被减速了！</div>
        </div>
        <div v-if="lastResult.luckMessage" class="luck-msg">{{ lastResult.luckMessage }}</div>
        <div class="result-actions">
          <button v-if="status.todayLeft > 0" class="again-btn" type="button" @click="enterArena">再来一局</button>
          <button class="close-btn" type="button" @click="phase = 'idle'">返回</button>
        </div>
      </template>
    </div>

    <!-- ===== 兑换称号 ===== -->
    <div v-else-if="tab === 'shop'" class="cock-shop">
      <div class="shop-tip">斗鸡积分仅可兑换外观称号，不加任何属性 · 当前 {{ status.points }} 分</div>
      <div class="title-grid">
        <div v-for="t in status.shop" :key="t.key" class="title-card" :class="{ owned: t.owned, hidden: t.hidden && !t.owned }">
          <div class="title-name">{{ t.hidden && !t.owned ? '👑 ？？？（隐藏）' : t.name }}</div>
          <div class="title-desc">{{ t.desc }}</div>
          <div class="title-cost">
            <template v-if="t.achievement">成就 · 累计参与 {{ status.target }} 局自动获得</template>
            <template v-else>{{ t.cost }} 积分</template>
          </div>
          <button
            v-if="!t.achievement"
            class="buy-btn" type="button"
            :disabled="t.owned || status.points < t.cost || exchanging"
            @click="exchange(t)"
          >{{ t.owned ? '已拥有' : '兑换' }}</button>
          <div v-else class="ach-state" :class="{ done: t.owned }">{{ t.owned ? '已点亮' : '未达成' }}</div>
        </div>
      </div>
    </div>

    <!-- ===== 查看记录 ===== -->
    <div v-else-if="tab === 'records'" class="cock-records">
      <div v-if="!status.history || status.history.length === 0" class="empty-tip">暂无对局记录</div>
      <div v-else class="record-list">
        <div v-for="(h, i) in status.history" :key="i" class="record-item" :class="{ win: h.win }">
          <span class="record-result">{{ h.win ? '胜' : '负' }}</span>
          <span class="record-bet">押 {{ h.bet }} 号 {{ h.betName }}</span>
          <span class="record-champ">冠军 {{ h.champion }}</span>
          <span class="record-pts" :class="{ plus: h.pointsDelta > 0 }">{{ h.pointsDelta > 0 ? `+${h.pointsDelta}` : '+0' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// ====== 灵鸡斗场：完全独立玩法 ======
// @file components/CockfightArena
// @module cockfight-arena
// @description 不消耗主游戏任何资源，唯一产出斗鸡积分（仅换外观称号）
//   流程：进入斗场（6 只灵鸡）→ 押注 1~6 → 临场干预（可跳过）→ 擂台赛战报 → 结算
import { ref, onMounted, onBeforeUnmount } from 'vue';
import api from '../api.js';
import { toast } from '../ui-bridge.js';

const props = defineProps(['player', 'currentUser']);
defineEmits(['goBack']);

// 临场干预（与 server/data/cockfight.js 保持一致）
const INTERVENTIONS = [
  { id: 'feed',     label: '🍗 投喂仙豆', desc: '你押的鸡 攻击力 ×1.3（无风险）' },
  { id: 'caltrops', label: '🧊 撒铁蒺藜', desc: '随机一只对手鸡 速度 ×0.6（30% 被发现：你的鸡速度 ×0.6）' },
  { id: 'provoke',  label: '🩸 激将法',   desc: '你押的鸡 暴击率 +50%（若本局输了，下局强制换掉这只鸡）' },
];

const tab = ref('arena');
const phase = ref('idle');          // idle / betting / battling / result
const loading = ref(false);
const exchanging = ref(false);
const status = ref({ points: 0, wins: 0, streak: 0, played: 0, todayLeft: 20, dailyLimit: 20, target: 250, shop: [], history: [] });
const chickens = ref([]);
const betNo = ref(null);
const intervention = ref(null);
const reportLines = ref([]);
const visibleLines = ref([]);
const lastResult = ref(null);
let lineTimer = null;

function chickenName(id) {
  const found = chickens.value.find(x => x.id === id) || chickens.value.find(x => x.no === id);
  return found ? found.name : '灵鸡';
}

async function loadStatus() {
  try {
    const res = await api.getCockfight(props.currentUser);
    if (res.success) status.value = { ...status.value, ...res.data };
  } catch { /* 静默 */ }
}

function switchTab(t) {
  tab.value = t;
  if (t === 'arena' && phase.value === 'battling') phase.value = 'idle';
}

async function enterArena() {
  if (loading.value) return;
  loading.value = true;
  try {
    const res = await api.enterCockArena(props.currentUser);
    if (res.success) {
      chickens.value = res.data.chickens || [];
      betNo.value = null;
      intervention.value = null;
      reportLines.value = [];
      visibleLines.value = [];
      lastResult.value = null;
      phase.value = 'betting';
      status.value.todayLeft = res.data.todayLeft;
    } else {
      toast.error(res.message || '进入斗场失败');
    }
  } finally {
    loading.value = false;
  }
}

async function fight() {
  if (loading.value || !betNo.value) return;
  loading.value = true;
  try {
    const res = await api.resolveCockRound(props.currentUser, betNo.value, intervention.value);
    if (!res.success) {
      toast.error(res.message || '结算失败');
      phase.value = 'idle';
      return;
    }
    const d = res.data;
    lastResult.value = d;
    reportLines.value = d.report || [];
    visibleLines.value = [];
    phase.value = 'battling';
    // 逐行输出战报（每 260ms 一行）
    let idx = 0;
    lineTimer = setInterval(() => {
      visibleLines.value.push(reportLines.value[idx]);
      idx += 1;
      if (idx >= reportLines.value.length) {
        clearInterval(lineTimer);
        lineTimer = null;
        phase.value = 'result';
        // 战报播完后更新状态数据
        loadStatus();
        if (d.newTitle) toast.success(`获得称号「${d.newTitle}」！`);
      }
    }, 260);
  } finally {
    loading.value = false;
  }
}

async function exchange(t) {
  if (exchanging.value || t.owned) return;
  exchanging.value = true;
  try {
    const res = await api.exchangeCockfightTitle(props.currentUser, t.key);
    if (res.success) {
      toast.success(`兑换成功：${t.name}`);
      loadStatus();
    } else {
      toast.error(res.message || '兑换失败');
    }
  } finally {
    exchanging.value = false;
  }
}

onMounted(loadStatus);
onBeforeUnmount(() => { if (lineTimer) clearInterval(lineTimer); });
</script>

<style scoped>
/* v1.03：底部预留 fixed TabBar 高度（含 iOS 安全区 + 悬浮底栏检测值） */
.cock-view { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.6rem 0.8rem; padding-bottom: calc(var(--tabbar-h) + var(--safe-bottom) + var(--browser-bar-h, 0px) + 0.75rem); }

/* 头部 */
.cock-header { display: flex; flex-direction: column; gap: 0.2rem; }
.back-btn { align-self: flex-start; padding: 0.3rem 0.7rem; background: rgba(var(--violet-rgb),0.1); border: 1px solid var(--rule); border-radius: 6px; color: var(--muted); cursor: pointer; font-size: 0.75rem; }
.back-btn:hover { background: rgba(var(--violet-rgb),0.2); color: var(--text); }
.cock-title-row { display: flex; align-items: center; gap: 0.4rem; }
.cock-title-icon { font-size: 1.4rem; }
.cock-title-text { font-size: 1.1rem; font-weight: 800; color: var(--accent); }
.cock-sub { font-size: 0.7rem; color: var(--muted); }

/* 数据概览 */
.cock-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.3rem; }
.cock-stat { display: flex; flex-direction: column; align-items: center; gap: 0.1rem; padding: 0.4rem 0.3rem; background: var(--bg2); border: 1px solid var(--rule); border-radius: 6px; }
.cock-stat.wide { grid-column: span 4; flex-direction: row; justify-content: center; gap: 0.5rem; }
.stat-label { font-size: 0.65rem; color: var(--muted); }
.stat-val { font-weight: 700; font-family: monospace; font-size: 0.85rem; }
.stat-val.accent { color: var(--accent); }
.stat-val.gold { color: var(--accent2); }
.stat-val.success { color: var(--success); }

/* Tabs */
.cock-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.2rem; }
.cock-tab { padding: 0.4rem; background: rgba(var(--panel-rgb),0.5); border: 1px solid var(--rule); border-radius: 6px; color: var(--muted); cursor: pointer; font-size: 0.78rem; font-family: inherit; transition: all 0.15s; }
.cock-tab:hover { border-color: var(--accent2); }
.cock-tab.active { background: rgba(var(--gold-rgb),0.15); border-color: var(--accent); color: var(--accent); font-weight: 700; }

/* 斗场 */
.enter-btn { padding: 0.7rem; background: rgba(var(--gold-rgb),0.15); border: 1px solid var(--accent); border-radius: 8px; color: var(--accent); font-weight: 800; font-size: 0.9rem; cursor: pointer; font-family: inherit; }
.enter-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.empty-tip { padding: 0.6rem; text-align: center; color: var(--muted); font-size: 0.75rem; }

.bet-tip { padding: 0.3rem; color: var(--muted); font-size: 0.75rem; text-align: center; }
.chicken-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.4rem; }
.chicken-card { padding: 0.5rem; background: var(--bg2); border: 1px solid var(--rule); border-radius: 8px; cursor: pointer; transition: border-color 0.15s; }
.chicken-card:hover { border-color: var(--accent2); }
.chicken-card.picked { border-color: var(--accent); background: rgba(var(--gold-rgb),0.1); }
.chicken-no { font-size: 0.65rem; color: var(--muted); font-family: monospace; }
.chicken-name { font-weight: 700; font-size: 0.85rem; color: var(--text); }
.chicken-clues { margin: 0.3rem 0 0; padding-left: 1rem; font-size: 0.7rem; color: var(--muted); }
.chicken-clues li { margin: 0.1rem 0; }

/* 干预菜单 */
.intervention-box { display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.5rem; }
.intervention-title { font-size: 0.75rem; font-weight: 700; color: var(--accent); }
.intervention-list { display: flex; flex-direction: column; gap: 0.3rem; }
.intervention-item { padding: 0.4rem 0.5rem; background: var(--bg2); border: 1px solid var(--rule); border-radius: 6px; cursor: pointer; }
.intervention-item:hover { border-color: var(--accent2); }
.intervention-item.picked { border-color: var(--accent); background: rgba(var(--gold-rgb),0.1); }
.intervention-label { font-size: 0.8rem; font-weight: 700; color: var(--text); }
.intervention-desc { font-size: 0.68rem; color: var(--muted); }
.fight-btn { padding: 0.6rem; background: rgba(var(--gold-rgb),0.15); border: 1px solid var(--accent); border-radius: 8px; color: var(--accent); font-weight: 800; font-size: 0.85rem; cursor: pointer; font-family: inherit; }
.fight-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* 战报 */
.report-box { display: flex; flex-direction: column; gap: 0.15rem; padding: 0.5rem; background: var(--bg2); border: 1px solid var(--rule); border-radius: 8px; min-height: 6rem; font-size: 0.72rem; font-family: monospace; color: var(--text); }
.report-box.small { max-height: 14rem; overflow-y: auto; }
.report-line { line-height: 1.5; }
.report-waiting { color: var(--muted); }

/* 结算 */
.result-banner { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; padding: 0.7rem; border-radius: 8px; margin-top: 0.5rem; }
.result-banner.win { background: rgba(80,200,120,0.12); border: 1px solid var(--success); }
.result-banner.lose { background: rgba(224,88,88,0.1); border: 1px solid var(--danger); }
.result-main { font-size: 1.1rem; font-weight: 800; }
.result-banner.win .result-main { color: var(--success); }
.result-banner.lose .result-main { color: var(--danger); }
.result-champion { font-size: 0.8rem; color: var(--muted); }
.result-points { font-size: 0.85rem; font-weight: 700; color: var(--accent2); font-family: monospace; }

.applied-box { margin-top: 0.4rem; padding: 0.4rem 0.5rem; background: var(--bg2); border: 1px solid var(--rule); border-radius: 6px; font-size: 0.72rem; }
.applied-title { font-weight: 700; color: var(--accent); margin-bottom: 0.2rem; }
.applied-item { color: var(--muted); }
.applied-caught { margin-top: 0.2rem; color: var(--danger); }
.luck-msg { margin-top: 0.4rem; padding: 0.4rem; text-align: center; background: rgba(var(--violet-rgb),0.1); border-radius: 6px; color: var(--text); font-size: 0.78rem; }
.result-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; margin-top: 0.5rem; }
.again-btn { padding: 0.5rem; background: rgba(var(--gold-rgb),0.15); border: 1px solid var(--accent); border-radius: 8px; color: var(--accent); font-weight: 700; cursor: pointer; font-family: inherit; }
.close-btn { padding: 0.5rem; background: var(--bg2); border: 1px solid var(--rule); border-radius: 8px; color: var(--muted); cursor: pointer; font-family: inherit; }

/* 商店 */
.shop-tip { padding: 0.3rem; font-size: 0.72rem; color: var(--muted); text-align: center; }
.title-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.4rem; }
.title-card { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.5rem; background: var(--bg2); border: 1px solid var(--rule); border-radius: 8px; }
.title-card.owned { border-color: var(--success); }
.title-card.hidden { opacity: 0.75; }
.title-name { font-weight: 800; font-size: 0.85rem; color: var(--text); }
.title-desc { font-size: 0.65rem; color: var(--muted); }
.title-cost { font-size: 0.72rem; color: var(--accent2); font-family: monospace; }
.buy-btn { padding: 0.35rem; background: rgba(var(--gold-rgb),0.15); border: 1px solid var(--accent); border-radius: 6px; color: var(--accent); font-weight: 700; cursor: pointer; font-size: 0.75rem; font-family: inherit; }
.buy-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.ach-state { text-align: center; font-size: 0.75rem; color: var(--muted); padding: 0.35rem 0; }
.ach-state.done { color: var(--success); font-weight: 700; }

/* 记录 */
.record-list { display: flex; flex-direction: column; gap: 0.25rem; }
.record-item { display: grid; grid-template-columns: 2rem 1fr auto 2.5rem; align-items: center; gap: 0.4rem; padding: 0.4rem 0.5rem; background: var(--bg2); border: 1px solid var(--rule); border-radius: 6px; font-size: 0.72rem; }
.record-result { font-weight: 800; color: var(--danger); }
.record-item.win .record-result { color: var(--success); }
.record-bet { color: var(--text); }
.record-champ { color: var(--muted); }
.record-pts { text-align: right; font-family: monospace; color: var(--muted); }
.record-pts.plus { color: var(--accent2); font-weight: 700; }
</style>
