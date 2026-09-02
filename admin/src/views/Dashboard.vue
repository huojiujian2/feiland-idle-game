<template>
  <div>
    <!-- 顶部状态条 -->
    <div class="card between">
      <div class="row">
        <span>服务器状态</span>
        <span class="tag" :class="ok ? 'tag-success' : 'tag-danger'">{{ ok ? '正常' : '异常' }}</span>
        <span class="muted" style="font-size:12px;">{{ lastUpdated }}</span>
      </div>
      <div class="row">
        <span class="muted" style="font-size:12px;">每 5 秒自动刷新</span>
        <button class="btn" :disabled="loading" @click="refresh">刷新</button>
      </div>
    </div>

    <!-- 指标卡 -->
    <div class="metric-grid mt16">
      <MetricCard label="在线玩家" :value="d.players.online" sub="登录后 5 分钟内有活动（操作/挂机）为在线" tone="success" />
      <MetricCard label="注册角色" :value="d.players.total" sub="全部角色数" />
      <MetricCard
        label="内存占用"
        :value="d.memory.heapUsedMB"
        unit="MB"
        :bar="d.memory.heapPct"
        :bar-tone="heapTone"
        :sub="`Heap ${d.memory.heapUsedMB}MB / 上限 ${d.memory.heapLimitMB || '?'}MB（${d.memory.heapPct}%）`"
      />
      <MetricCard
        label="进程内存（RSS）"
        :value="d.memory.rssMB"
        unit="MB"
        :bar="d.memory.rssPct"
        :bar-tone="rssTone"
        :sub="`占系统内存 ${d.memory.rssPct}% · 系统共 ${gb(d.memory.sysTotalMB)}GB / 可用 ${d.memory.sysFreeMB}MB`"
      />
      <MetricCard label="存档体积" :value="d.store.dbSizeMB" unit="MB" sub="SQLite 数据库大小" />
      <MetricCard label="请求量" :value="d.requests.perMinute" unit="次/分" :sub="`累计 ${fmt(d.requests.total)} 次`" />
    </div>

    <!-- 错误率 -->
    <div class="card mt16">
      <div class="card-title">请求质量</div>
      <div class="row">
        <span class="tag" :class="d.requests.error4xxPct > 5 ? 'tag-warning' : 'tag-primary'">4xx {{ d.requests.error4xxPct }}%</span>
        <span class="tag" :class="d.requests.error5xxPct > 0 ? 'tag-danger' : 'tag-success'">5xx {{ d.requests.error5xxPct }}%</span>
        <span class="muted" style="font-size:12px;">4xx {{ d.requests.bad4xx }} 次 / 5xx {{ d.requests.bad5xx }} 次 / 成功 {{ d.requests.ok }} 次</span>
      </div>
    </div>

    <!-- 曲线区 -->
    <div class="cols mt16">
      <div class="card">
        <div class="card-title">挂机结算循环耗时（每 5 秒一轮）</div>
        <Sparkline :data="idleSeries" color="var(--primary)" unit=" ms" :height="110" />
        <div class="kv mt16">
          <dt>最近一轮</dt><dd>{{ d.idle.lastMs }} ms</dd>
          <dt>平均耗时</dt><dd>{{ d.idle.avgMs }} ms</dd>
          <dt>峰值耗时</dt><dd>{{ d.idle.maxMs }} ms</dd>
          <dt>健康参考</dt><dd><span class="tag" :class="idleToneClass">{{ idleHealth }}</span></dd>
        </div>
      </div>
      <div class="card">
        <div class="card-title">服务器信息</div>
        <div class="kv">
          <dt>运行时长</dt><dd>{{ uptimeText }}</dd>
          <dt>启动时间</dt><dd>{{ startedAtText }}</dd>
          <dt>Node 版本</dt><dd>{{ d.server.nodeVersion }}</dd>
          <dt>进程 PID</dt><dd>{{ d.server.pid }}</dd>
          <dt>在线窗口</dt><dd>{{ Math.round(d.players.onlineWindowMs / 60000) }} 分钟</dd>
          <dt>归档日志</dt><dd>server/audit.log</dd>
        </div>
        <div class="card-title mt16">缓存状态</div>
        <div class="kv">
          <template v-if="cacheRows.length">
            <template v-for="c in cacheRows" :key="c.name">
              <dt>{{ c.name }}</dt><dd>{{ c.desc }}</dd>
            </template>
          </template>
          <template v-else>
            <dt>—</dt><dd>暂无缓存统计</dd>
          </template>
        </div>
      </div>
    </div>

    <!-- 请求趋势 -->
    <div class="card mt16">
      <div class="card-title">请求趋势（每分钟）</div>
      <Sparkline :data="reqSeries" color="var(--success)" unit=" 次/分" :height="100" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { adminApi } from '../api';
import MetricCard from '../components/MetricCard.vue';
import Sparkline from '../components/Sparkline.vue';

const d = ref(empty());
const err = ref('');
const loading = ref(false);
const lastUpdated = ref('');
let timer = null;

function empty() {
  return {
    server: { startedAt: 0, uptimeSeconds: 0, nodeVersion: '-', pid: '-' },
    memory: { heapUsedMB: 0, heapTotalMB: 0, rssMB: 0, heapPct: 0, heapLimitMB: 0, sysTotalMB: 0, sysFreeMB: 0, rssPct: 0 },
    players: { total: 0, online: 0, onlineWindowMs: 300000 },
    store: { dbSizeMB: 0, viewCache: null, arenaBotsCache: null },
    idle: { lastMs: 0, avgMs: 0, maxMs: 0, samples: [] },
    requests: { total: 0, ok: 0, bad4xx: 0, bad5xx: 0, error4xxPct: 0, error5xxPct: 0, perMinute: 0, samples: [] },
    ts: 0,
  };
}

async function refresh() {
  loading.value = true;
  err.value = '';
  try {
    d.value = await adminApi.overview();
    lastUpdated.value = `更新于 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`;
  } catch (e) {
    err.value = e.message;
  } finally {
    loading.value = false;
  }
}

const ok = computed(() => !!d.value && d.value.ts > 0);
const heapTone = computed(() => (d.value.memory.heapPct >= 80 ? 'is-danger' : d.value.memory.heapPct >= 60 ? 'is-warning' : ''));
// RSS 占系统内存比例：≥70% 危险、≥50% 关注
const rssTone = computed(() => {
  const pct = d.value.memory.rssPct || 0;
  if (pct >= 70) return 'is-danger';
  if (pct >= 50) return 'is-warning';
  return '';
});
const idleSeries = computed(() => (d.value.idle.samples || []).map((s) => ({ ts: s.ts, value: s.ms })));
const reqSeries = computed(() => (d.value.requests.samples || []).map((s) => ({ ts: s.ts, value: s.perMinute })));

const idleHealth = computed(() => {
  const ms = d.value.idle.avgMs || 0;
  if (ms <= 500) return '健康（<0.5s）';
  if (ms <= 3000) return '偏慢（建议关注）';
  return '阻塞风险（接近 5s 周期）';
});
const idleToneClass = computed(() => {
  const ms = d.value.idle.avgMs || 0;
  if (ms <= 500) return 'tag-success';
  if (ms <= 3000) return 'tag-warning';
  return 'tag-danger';
});

const uptimeText = computed(() => {
  const s = d.value.server.uptimeSeconds || 0;
  const day = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (day > 0) return `${day} 天 ${h} 小时 ${m} 分`;
  if (h > 0) return `${h} 小时 ${m} 分`;
  return `${m} 分 ${s % 60} 秒`;
});

const startedAtText = computed(() => {
  const t = d.value.server.startedAt;
  if (!t) return '-';
  return new Date(t).toLocaleString('zh-CN', { hour12: false });
});

const cacheRows = computed(() => {
  const rows = [];
  const vc = d.value.store.viewCache;
  if (vc && typeof vc === 'object') {
    const size = vc.size ?? vc.count ?? Object.keys(vc).length ?? 0;
    const hit = typeof vc.hitRate === 'number' ? `命中 ${vc.hitRate}%` : '';
    rows.push({ name: 'View 缓存', desc: `${size} 条 ${hit}` });
  }
  const ab = d.value.store.arenaBotsCache;
  if (ab && typeof ab === 'object') {
    const size = ab.size ?? ab.count ?? Object.keys(ab).length ?? 0;
    rows.push({ name: '竞技场机器人', desc: `${size} 个` });
  }
  return rows;
});

function fmt(n) {
  if (typeof n !== 'number') return n;
  if (n >= 100000000) return (n / 100000000).toFixed(2) + '亿';
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  return String(n);
}

function gb(mb) {
  return mb > 0 ? (mb / 1024).toFixed(1) : '?';
}

onMounted(() => {
  refresh();
  timer = setInterval(refresh, 5000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>
