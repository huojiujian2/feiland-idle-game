<!--
  ====== 星际火箭 v1.09 · Crash Game ======
  - 左侧 canvas：火箭从左下角飞向右上方，倍数实时增长
  - 右侧控制：难度 + 投注额 + 开始/停止 + 当前状态
  - 底部：本局历史曲线 + 累计统计
  - 服务端权威炸点（前端看不到），前端反算时间戳上报给服务端
-->
<template>
  <div class="view-container rocket-view">
    <!-- 顶部说明 -->
    <div class="card rocket-banner">
      <div class="banner-title">🚀 星际火箭 · Crash Game</div>
      <div class="banner-desc">
        下注金币 → 按下「发射」 → 火箭起飞 → 倍数实时增长 →
        在你满意的倍数按下「收手」拿钱；火箭飞炸则全输。
      </div>
      <div class="banner-hint">
        免费 <strong>{{ freeLeft }}</strong> / {{ freePerDay }} 次 / 天 · 当前金币
        <strong>{{ formatGold(currentGold) }}</strong>
      </div>
    </div>

    <!-- 主画面（左右两栏） -->
    <div class="rocket-grid">
      <!-- 左：画布 -->
      <div class="canvas-wrap">
        <canvas ref="canvasRef" :width="canvasW" :height="canvasH" class="rocket-canvas"></canvas>
        <div class="mult-readout">
          <div class="mult-num" :class="{ crashed: status === 'crashed', won: status === 'won' || status === 'cashed', cashed: status === 'cashed' }">
            {{ currentMult.toFixed(2) }}<span class="x">x</span>
          </div>
          <div class="mult-status">
            <template v-if="status === 'idle'">点击「发射」开始</template>
            <template v-else-if="status === 'flying'">飞行中…{{ isFree ? '免费局' : `投注 ${formatGold(bet)}` }}</template>
            <template v-else-if="status === 'cashed'">✓ 已收手 {{ cashedMult.toFixed(2) }}x · +{{ formatGold(lastResult.payout) }}（看它能飞多高）</template>
            <template v-else-if="status === 'won'">✓ 收手成功 · +{{ formatGold(lastResult.payout) }}</template>
            <template v-else-if="status === 'crashed'">✗ 火箭炸了 · 输了 {{ formatGold(bet) }} <span v-if="lastResult.mult">（炸点 {{ lastResult.mult.toFixed(2) }}x）</span></template>
          </div>
        </div>
        <div class="canvas-axis">
          <span>1.00x</span>
          <span>{{ maxMult }}x</span>
        </div>
      </div>

      <!-- 右：控制面板 -->
      <div class="control-wrap">
        <!-- 难度选择 -->
        <div class="section">
          <div class="section-title">难度</div>
          <div class="difficulty-list">
            <button v-for="d in difficulties" :key="d.id"
              class="diff-btn diff-btn--single active"
              :style="{ borderColor: d.color }">
              <span class="diff-name" :style="{ color: d.color }">{{ d.name }}</span>
              <span class="diff-max">封顶 {{ d.maxMultiplier }}x</span>
              <span class="diff-range">{{ d.maxDuration }}s · 抽水 {{Math.round(d.houseEdge * 100)}}%</span>
              <span class="diff-bet">{{ formatGold(d.baseBetMin) }} ~ {{ formatGold(d.baseBetMax) }}</span>
            </button>
          </div>
        </div>

        <!-- 投注额 -->
        <div class="section">
          <div class="section-title">投注额</div>
          <div class="bet-row">
            <button class="chip-btn" :disabled="status !== 'idle'" @click="quickAdd(-1)">-1万</button>
            <button class="chip-btn" :disabled="status !== 'idle'" @click="quickAdd(-2)">-10万</button>
            <input class="bet-input" type="number" v-model.number="betInput" :disabled="status !== 'idle'" min="0" />
            <button class="chip-btn" :disabled="status !== 'idle'" @click="quickAdd(1)">+1万</button>
            <button class="chip-btn" :disabled="status !== 'idle'" @click="quickAdd(2)">+10万</button>
          </div>
          <div class="bet-presets">
            <button class="preset-btn" :disabled="status !== 'idle'" @click="betInput = diffCfg.baseBetMin">最小</button>
            <button class="preset-btn" :disabled="status !== 'idle'" @click="betInput = Math.floor(currentGold * 0.1)">10%</button>
            <button class="preset-btn" :disabled="status !== 'idle'" @click="betInput = Math.floor(currentGold * 0.25)">25%</button>
            <button class="preset-btn" :disabled="status !== 'idle'" @click="betInput = Math.floor(currentGold * 0.5)">50%</button>
            <button class="preset-btn" :disabled="status !== 'idle'" @click="betInput = Math.floor(currentGold * 0.75)">75%</button>
            <button class="preset-btn" :disabled="status !== 'idle'" @click="betInput = Math.floor(currentGold)">梭哈</button>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="section action-row">
          <button v-if="status === 'idle' || status === 'won' || status === 'crashed' || status === 'cashed'" class="btn-launch"
            :disabled="!canLaunch" @click="doLaunch">
            🚀 发射（投注 {{ formatGold(bet) }}）
          </button>
          <button v-else-if="status === 'flying'" class="btn-cashout" @click="doCashout">
            💰 收手（{{ currentMult.toFixed(2) }}x · +{{ formatGold(Math.floor(bet * currentMult * (1 - diffCfg.houseEdge))) }}）
          </button>
        </div>

        <!-- 免费局提示 -->
        <div class="section free-section" v-if="freeLeft > 0 && status === 'idle'">
          <button class="btn-free" @click="doLaunchFree">🎁 免费起飞（剩 {{ freeLeft }} 次）</button>
        </div>
      </div>
    </div>

    <!-- 净亏提示 -->
    <div class="card rocket-loss-card" v-if="netLoss >= netLossLimit * 0.8">
      <span class="loss-icon">⚠️</span>
      <span>今日净亏已达 {{ formatGold(netLoss) }} / {{ formatGold(netLossLimit) }}，建议暂停一下，去挂会儿机再来！</span>
    </div>

    <!-- 累计统计 -->
    <div class="card rocket-stats">
      <div class="stats-title">📊 累计统计</div>
      <div class="stats-grid">
        <div class="stat-cell"><span class="stat-label">已局</span><span class="stat-val">{{ stats.played || 0 }}</span></div>
        <div class="stat-cell"><span class="stat-label">胜</span><span class="stat-val text-win">{{ stats.won || 0 }}</span></div>
        <div class="stat-cell"><span class="stat-label">负</span><span class="stat-val text-lose">{{ stats.lost || 0 }}</span></div>
        <div class="stat-cell"><span class="stat-label">最高倍数</span><span class="stat-val">{{ (stats.biggestMult || 0).toFixed(2) }}x</span></div>
        <div class="stat-cell"><span class="stat-label">累计赢</span><span class="stat-val text-win">{{ formatGold(stats.totalWon || 0) }}</span></div>
        <div class="stat-cell"><span class="stat-label">累计输</span><span class="stat-val text-lose">{{ formatGold(stats.totalLost || 0) }}</span></div>
      </div>
    </div>

    <!-- 历史 -->
    <div class="card rocket-history" v-if="history.length > 0">
      <div class="history-title">📜 最近 20 局</div>
      <div class="history-grid">
        <div v-for="(h, i) in history.slice(-20).reverse()" :key="i" class="history-cell"
          :class="{ win: h.result === 'win', lose: h.result !== 'win' }">
          <span class="history-mult">{{ h.mult.toFixed(2) }}x</span>
          <span class="history-payout">{{ h.result === 'win' ? '+' : '-' }}{{ formatGold(h.result === 'win' ? h.payout : h.bet) }}</span>
          <span class="history-tag">{{ h.isFree ? '免费' : '付费' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import api from '../api.js';
import { toast } from '../ui-bridge.js';

const props = defineProps({
  player: { type: Object, required: true },
  currentUser: { type: String, required: true },
});
defineEmits(['goBack', 'updatePlayer']);

const canvasRef = ref(null);
const canvasW = 480;
const canvasH = 280;

// 配置
const difficulties = ref([]);
const freePerDay = ref(3);
const freeLeft = ref(0);
const currentGold = ref(0);
const netLoss = ref(0);
const netLossLimit = ref(5000);

const difficulty = ref('normal');
const diffCfg = computed(() => difficulties.value.find(d => d.id === difficulty.value) || difficulties.value[1] || {});
const betInput = ref(0);
const bet = computed(() => Math.floor(Math.max(0, Number(betInput.value) || 0)));

const status = ref('idle'); // idle | flying | won | crashed
const maxMult = ref(15);
const maxDuration = ref(18);
const isFree = ref(false);

const currentMult = ref(1.0);
const cashedMult = ref(1.0); // 用户收手时的倍数（用来在火箭继续飞时回显）
let startAt = 0;
let crashAt = 0;
let rafId = null;
let autoExploded = false; // 防止 autoexplode 重复触发

const lastResult = ref({ payout: 0, mult: 0 });
const stats = ref({ played: 0, won: 0, lost: 0, biggestMult: 0, totalWon: 0, totalLost: 0 });
const history = ref([]);

const canLaunch = computed(() => {
  if (!diffCfg.value) return false;
  // v1.10 修复：flying 时禁用发射按钮（火箭正在飞，不能开新局）
  if (status.value === 'flying') return false;
  if (bet.value < diffCfg.value.baseBetMin) return false;
  if (bet.value > (diffCfg.value.baseBetMax || 0)) return false;
  if (bet.value > currentGold.value) return false;
  if (netLoss.value >= netLossLimit.value) return false;
  return true;
});

function formatGold(n) {
  n = Math.floor(Number(n) || 0);
  if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿';
  if (n >= 1e4) return (n / 1e4).toFixed(2) + '万';
  return n.toLocaleString();
}

function onSelectDifficulty(id) {
  if (status.value !== 'idle') return;
  difficulty.value = id;
  const cfg = difficulties.value.find(d => d.id === id);
  if (cfg) {
    maxMult.value = cfg.maxMultiplier;
    maxDuration.value = cfg.maxDuration;
    if (betInput.value < cfg.baseBetMin || betInput.value > cfg.baseBetMax) {
      betInput.value = cfg.baseBetMin;
    }
  }
}

function quickAdd(level) {
  const step = level >= 0 ? (level === 1 ? 1e4 : 1e5) : (level === -1 ? -1e4 : -1e5);
  betInput.value = Math.max(0, betInput.value + step);
}

// ============ 动画循环 ============
function tick() {
  if (status.value !== 'flying' && status.value !== 'cashed') return;
  const now = Date.now();
  const elapsedMs = now - startAt;
  const elapsedSec = elapsedMs / 1000;
  // 客户端自渲染倍数（与服务端公式一致）—— cashed 状态也继续跑动画到炸点
  if (elapsedSec <= maxDuration.value) {
    const m = 1.0 + elapsedSec * (maxMult.value - 1.0) / maxDuration.value;
    currentMult.value = Number(m.toFixed(2));
  }
  drawCanvas(elapsedSec);
  // 火箭炸了：触发 autoexplode（收手后也会继续炸，只是禁用收手按钮）
  if (!autoExploded && now >= crashAt) {
    autoExploded = true;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    doAutoexplode();
    return;
  }
  rafId = requestAnimationFrame(tick);
}

async function doAutoexplode() {
  // v1.10 加超时兜底：8s 内没回也强制回 idle（防止服务端 hang 死永远卡住）
  const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 8000));
  let r = null;
  try {
    r = await Promise.race([
      api.gambleAutoexplode(props.currentUser),
      timeoutPromise,
    ]);
  } catch (_) { r = null; }
  // 即使接口失败，本地也要走完动画（防止永远卡在 flying/cashed）
  const data = r && r.success ? r.data : null;
  if (data) {
    lastResult.value = data;
    currentGold.value = data.currentGold || currentGold.value;
  }
  const crashedAt = data && data.mult ? data.mult : currentMult.value;
  // 区分两种情况：
  //   1. cashed（用户已收手）：炸了只是动画收尾，金币已入账，不弹"输了"
  //   2. flying（用户没动）：等炸了，钱才真输
  if (status.value === 'cashed') {
    // 用户已经赢了 → 只展示炸点作为对比信息
    status.value = 'crashed';
    const diff = (crashedAt - cashedMult.value).toFixed(2);
    if (parseFloat(diff) > 0) {
      toast(`看，早走一步！炸点 ${crashedAt.toFixed(2)}x（你收在 ${cashedMult.value.toFixed(2)}x，多赚 ${diff}x）`, 'info');
    } else {
      toast(`炸点 ${crashedAt.toFixed(2)}x（你收在 ${cashedMult.value.toFixed(2)}x，险胜）`, 'info');
    }
  } else {
    status.value = 'crashed';
    toast.error(`火箭炸了！炸点 ${crashedAt.toFixed(2)}x · 输了 ${formatGold(bet.value)}`);
  }
  await Promise.all([loadHistory(), loadConfig()]);
  if (props.currentUser) {
    const rp = await api.getPlayerLight(props.currentUser);
    if (rp && rp.success && rp.data && rp.data.player) {
      props.player.gold = rp.data.player.gold;
    }
  }
  // 3 秒后回 idle
  setTimeout(() => {
    status.value = 'idle';
    autoExploded = false;
    clearCanvas();
  }, 3000);
}

function currentMultiplierAt(t) {
  if (t < 0) t = 0;
  if (t > maxDuration.value) t = maxDuration.value;
  return 1.0 + t * (maxMult.value - 1.0) / maxDuration.value;
}

function drawCanvas(elapsedSec) {
  const c = canvasRef.value;
  if (!c) return;
  const ctx = c.getContext('2d');
  // 背景：星空
  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(0, 0, c.width, c.height);
  // 星星
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let i = 0; i < 60; i++) {
    const sx = (i * 73 + (elapsedSec * 30) % c.width) % c.width;
    const sy = (i * 47) % c.height;
    const sz = (i % 3) + 1;
    ctx.fillRect(sx, sy, sz, sz);
  }
  // 网格
  ctx.strokeStyle = 'rgba(80,80,120,0.3)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= c.width; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, c.height); ctx.stroke();
  }
  for (let y = 0; y <= c.height; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke();
  }
  // 火箭轨迹
  const startX = 30;
  const startY = c.height - 30;
  const endX = c.width - 30;
  const endY = 30;
  const t = Math.min(elapsedSec / maxDuration.value, 1.0);
  const px = startX + (endX - startX) * t;
  const py = startY + (endY - startY) * t;
  // 火焰轨迹
  if (status.value === 'flying') {
    const grad = ctx.createLinearGradient(startX, startY, px, py);
    grad.addColorStop(0, 'rgba(255,140,0,0.6)');
    grad.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(px, py);
    ctx.stroke();
  }
  // 火箭
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(20, 0);
  ctx.lineTo(0, 10);
  ctx.lineTo(-4, 0);
  ctx.closePath();
  ctx.fill();
  // 火焰
  if (status.value === 'flying') {
    ctx.fillStyle = '#ff5722';
    ctx.beginPath();
    ctx.moveTo(-4, -3);
    ctx.lineTo(-12, 0);
    ctx.lineTo(-4, 3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // 爆炸（crashed 时）
  if (status.value === 'crashed') {
    ctx.fillStyle = 'rgba(255,80,40,0.6)';
    ctx.beginPath();
    ctx.arc(px, py, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffeb3b';
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      ctx.fillRect(px + Math.cos(ang) * 20 - 2, py + Math.sin(ang) * 20 - 2, 4, 4);
    }
  }
}

function clearCanvas() {
  const c = canvasRef.value;
  if (!c) return;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  drawCanvas(0);
}

// ============ 网络 ============
async function loadConfig() {
  const r = await api.gambleConfig(props.currentUser);
  if (r && r.success && r.data) {
    difficulties.value = r.data.difficulties || [];
    freePerDay.value = r.data.freeRoundsPerDay || 3;
    freeLeft.value = r.data.freeRoundsLeft || 0;
    currentGold.value = r.data.currentGold || 0;
    netLoss.value = r.data.netLossToday || 0;
    netLossLimit.value = r.data.netLossLimit || 5000;
    const d = difficulties.value.find(d => d.id === difficulty.value) || difficulties.value[0];
    if (d) {
      maxMult.value = d.maxMultiplier;
      maxDuration.value = d.maxDuration;
      if (!betInput.value) betInput.value = d.baseBetMin;
    }
  }
}

async function loadHistory() {
  const r = await api.gambleHistory(props.currentUser);
  if (r && r.success && r.data) {
    history.value = r.data.history || [];
    stats.value = r.data.stats || {};
  }
}

async function doLaunch() {
  if (!canLaunch.value) {
    toast.error('当前无法发射：检查金币 / 投注额 / 难度');
    return;
  }
  // v1.10 修复：开新局前兜底清服务端缓存（防止 autoexplode 已失败导致缓存残留）
  await api.gambleAutoexplode(props.currentUser).catch(() => {});
  const r = await api.gambleBet(props.currentUser, { difficulty: difficulty.value, isFree: false, bet: bet.value });
  if (!r || !r.success) {
    toast.error(r && r.message ? r.message : '发射失败');
    return;
  }
  isFree.value = false;
  startAt = r.data.startAt;
  crashAt = r.data.crashAt;
  maxMult.value = r.data.maxMultiplier;
  maxDuration.value = r.data.maxDuration;
  autoExploded = false;
  status.value = 'flying';
  currentMult.value = 1.0;
  await nextTick();
  drawCanvas(0);
  rafId = requestAnimationFrame(tick);
}

async function doLaunchFree() {
  if (freeLeft.value <= 0) {
    toast.error('今日免费机会已用完');
    return;
  }
  // 同样兜底
  await api.gambleAutoexplode(props.currentUser).catch(() => {});
  const r = await api.gambleBet(props.currentUser, { difficulty: difficulty.value, isFree: true, bet: 0 });
  if (!r || !r.success) {
    toast.error(r && r.message ? r.message : '免费发射失败');
    return;
  }
  isFree.value = true;
  startAt = r.data.startAt;
  crashAt = r.data.crashAt;
  maxMult.value = r.data.maxMultiplier;
  maxDuration.value = r.data.maxDuration;
  autoExploded = false;
  status.value = 'flying';
  currentMult.value = 1.0;
  await nextTick();
  drawCanvas(0);
  rafId = requestAnimationFrame(tick);
}

async function doCashout() {
  if (status.value !== 'flying') return;
  // 锁定收手时的倍数（动画继续用 currentMult 渲染，但显示用 cashedMult）
  cashedMult.value = currentMult.value;
  // 不取消 rAF —— 让动画继续飞到炸点（搏一搏经典体验：看它能飞多高）
  const r = await api.gambleCashout(props.currentUser, currentMult.value);
  if (!r || !r.success) {
    toast.error(r && r.message ? r.message : '收手失败');
    return;
  }
  const data = r.data;
  lastResult.value = data;
  if (data.result === 'win') {
    status.value = 'cashed'; // 进入 cashed 态：金币已入账，火箭继续飞
    currentGold.value = data.currentGold || currentGold.value;
    toast.success(`收手成功！${data.mult.toFixed(2)}x · +${formatGold(data.payout)}`);
  } else {
    // 服务端判定为输（按晚了）：直接走 crashed
    status.value = 'crashed';
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    toast.error(`按晚了！炸点 ${data.mult.toFixed(2)}x · 输了 ${formatGold(bet.value)}`);
  }
  // 刷新历史 + 配置（更新金币/净亏/免费次数）
  await Promise.all([loadHistory(), loadConfig()]);
  // 通知父组件刷新 player（轻接口）
  if (props.currentUser) {
    const rp = await api.getPlayerLight(props.currentUser);
    if (rp && rp.success && rp.data && rp.data.player) {
      props.player.gold = rp.data.player.gold;
    }
  }
  // cashed 状态下：等 autoexplode 把动画跑完才会回 idle（在 doAutoexplode 末尾）
}

function syncStart() {
  if (!startAt) return;
  const elapsedSec = (Date.now() - startAt) / 1000;
  drawCanvas(elapsedSec);
}

onMounted(async () => {
  await Promise.all([loadConfig(), loadHistory()]);
  await nextTick();
  clearCanvas();
});
onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId);
});

watch(() => props.player?.gold, (v) => {
  if (typeof v === 'number') currentGold.value = v;
});
</script>

<style scoped>
.rocket-view { max-width: 880px; margin: 0 auto; padding: 0.8rem; display: flex; flex-direction: column; gap: 0.8rem; }

.card {
  background: linear-gradient(135deg, rgba(var(--panel2-rgb),0.85), rgba(var(--panel-rgb),0.85));
  border: 1px solid rgba(var(--violet-rgb),0.25);
  border-radius: 8px;
  padding: 0.8rem 1rem;
}

.rocket-banner { display: flex; flex-direction: column; gap: 0.3rem; }
.banner-title { font-family: var(--font-display, 'Cinzel', serif); font-size: 1.1rem; color: var(--accent); font-weight: 700; }
.banner-desc { font-size: 0.85rem; color: var(--muted); line-height: 1.5; }
.banner-hint { font-size: 0.85rem; color: var(--ink); }
.banner-hint strong { color: var(--accent2); margin: 0 0.15rem; }

.rocket-grid { display: grid; grid-template-columns: 1fr 320px; gap: 0.8rem; }
@media (max-width: 768px) {
  .rocket-grid { grid-template-columns: 1fr; }
}

.canvas-wrap {
  position: relative;
  background: #0a0e1a;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(var(--gold-rgb),0.4);
  box-shadow: 0 0 20px rgba(var(--gold-rgb),0.15);
}
.rocket-canvas { display: block; width: 100%; height: auto; }
.mult-readout {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  display: flex; flex-direction: column; align-items: center; gap: 0.3rem;
  pointer-events: none;
  text-shadow: 0 0 12px rgba(0,0,0,0.8);
}
.mult-num { font-family: var(--font-display); font-size: 3.5rem; font-weight: 800; color: #fff; line-height: 1; }
.mult-num.crashed { color: #ff5252; }
 .mult-num.won { color: #69f0ae; }
 .mult-num.cashed { color: #ffb300; opacity: 0.85; }
.mult-num .x { font-size: 1.6rem; opacity: 0.7; margin-left: 0.1rem; }
.mult-status { font-size: 0.85rem; color: rgba(255,255,255,0.85); }
.canvas-axis {
  position: absolute; bottom: 0.3rem; left: 0; right: 0;
  display: flex; justify-content: space-between; padding: 0 0.6rem;
  font-size: 0.7rem; color: rgba(255,255,255,0.5);
}

.control-wrap { display: flex; flex-direction: column; gap: 0.8rem; }
.section { display: flex; flex-direction: column; gap: 0.3rem; }
.section-title { font-size: 0.8rem; color: var(--muted); letter-spacing: 0.04em; font-weight: 600; }

.difficulty-list { display: grid; grid-template-columns: 1fr; gap: 0.3rem; }
.difficulty-list .diff-btn--single { border-width: 2px; background: rgba(var(--gold-rgb),0.08); }
.diff-btn {
  display: flex; flex-direction: column; gap: 0.1rem;
  padding: 0.4rem 0.5rem; border: 1px solid rgba(var(--violet-rgb),0.2); border-radius: 6px;
  background: rgba(var(--panel-rgb),0.5); cursor: pointer;
  font-family: inherit; text-align: left;
  transition: all 0.18s;
}
.diff-btn:hover:not(:disabled) { background: rgba(var(--gold-rgb),0.1); }
.diff-btn.active { background: rgba(var(--gold-rgb),0.15); border-width: 2px; }
.diff-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.diff-name { font-size: 0.85rem; font-weight: 700; }
.diff-max { font-size: 0.72rem; color: var(--muted); }
.diff-range { font-size: 0.68rem; color: var(--muted); }
.diff-bet { font-size: 0.68rem; color: var(--muted); }

.bet-row { display: grid; grid-template-columns: auto auto 1fr auto auto; gap: 0.3rem; align-items: center; }
.chip-btn {
  padding: 0.35rem 0.5rem; border: 1px solid rgba(var(--violet-rgb),0.3); border-radius: 4px;
  background: rgba(var(--panel-rgb),0.6); color: var(--ink); cursor: pointer; font-size: 0.75rem;
}
.chip-btn:hover:not(:disabled) { background: rgba(var(--gold-rgb),0.15); }
.chip-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.bet-input {
  padding: 0.4rem; border: 1px solid rgba(var(--violet-rgb),0.3); border-radius: 4px;
  background: rgba(0,0,0,0.3); color: var(--ink); font-size: 0.9rem; text-align: center;
}
.bet-input:disabled { opacity: 0.4; }

.bet-presets { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.25rem; margin-top: 0.3rem; }
.preset-btn {
  padding: 0.3rem; border: 1px solid rgba(var(--violet-rgb),0.2); border-radius: 4px;
  background: transparent; color: var(--muted); cursor: pointer; font-size: 0.72rem;
}
.preset-btn:hover:not(:disabled) { color: var(--ink); background: rgba(var(--gold-rgb),0.1); }
.preset-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.action-row { margin-top: 0.4rem; }
.btn-launch, .btn-cashout, .btn-free {
  width: 100%; padding: 0.7rem 0.5rem; border: none; border-radius: 6px;
  font-size: 1rem; font-weight: 700; cursor: pointer;
  font-family: var(--font-display, 'Cinzel', serif);
  transition: all 0.2s;
}
.btn-launch { background: linear-gradient(135deg, #ff5722, #ff7043); color: #fff; box-shadow: 0 0 14px rgba(255,87,0,0.5); }
.btn-launch:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
.btn-launch:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
.btn-cashout { background: linear-gradient(135deg, #00c853, #69f0ae); color: #003d00; box-shadow: 0 0 14px rgba(0,200,83,0.5); animation: cashout-pulse 0.6s ease-in-out infinite; }
.btn-cashout:hover { filter: brightness(1.1); transform: translateY(-1px); }
@keyframes cashout-pulse { 0%,100% { box-shadow: 0 0 14px rgba(0,200,83,0.5); } 50% { box-shadow: 0 0 22px rgba(0,200,83,0.9); } }
.btn-free { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #0a0e1a; }
.btn-free:hover { filter: brightness(1.1); }

.free-section { margin-top: 0.3rem; }

.rocket-loss-card {
  display: flex; align-items: center; gap: 0.5rem;
  background: rgba(255,87,34,0.15); border-color: rgba(255,87,34,0.5); color: #ff8a65;
}
.loss-icon { font-size: 1.2rem; }

.rocket-stats { display: flex; flex-direction: column; gap: 0.4rem; }
.stats-title { font-size: 0.9rem; font-weight: 700; color: var(--accent); }
.stats-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.5rem; }
@media (max-width: 768px) { .stats-grid { grid-template-columns: repeat(3, 1fr); } }
.stat-cell { display: flex; flex-direction: column; align-items: center; gap: 0.1rem; padding: 0.3rem; background: rgba(0,0,0,0.2); border-radius: 4px; }
.stat-label { font-size: 0.72rem; color: var(--muted); }
.stat-val { font-size: 0.95rem; font-weight: 700; color: var(--ink); font-family: var(--font-display); }
.text-win { color: #69f0ae; }
.text-lose { color: #ff8a65; }

.rocket-history { display: flex; flex-direction: column; gap: 0.4rem; }
.history-title { font-size: 0.9rem; font-weight: 700; color: var(--accent); }
.history-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 0.3rem; }
.history-cell {
  display: flex; flex-direction: column; align-items: center; gap: 0.1rem;
  padding: 0.35rem 0.4rem; border-radius: 4px;
  background: rgba(0,0,0,0.2);
}
.history-cell.win { border-left: 3px solid #69f0ae; }
.history-cell.lose { border-left: 3px solid #ff5252; }
.history-mult { font-size: 0.95rem; font-weight: 700; color: var(--ink); font-family: var(--font-display); }
.history-payout { font-size: 0.78rem; font-weight: 600; }
.history-cell.win .history-payout { color: #69f0ae; }
.history-cell.lose .history-payout { color: #ff8a65; }
.history-tag { font-size: 0.65rem; color: var(--muted); }
</style>