<template>
  <!-- 服务器设置：智能调节本服经验/金币倍率 + 全服数值上限 -->
  <div>
    <!-- 全服总览（辅助"智能调节"决策） -->
    <div class="card mt16">
      <div class="card-title">全服现状统计</div>
      <div class="metrics-grid" v-if="overview">
        <div class="metric-card">
          <div class="metric-label">注册角色</div>
          <div class="metric-value">{{ overview.playerCount }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">平均等级</div>
          <div class="metric-value">{{ overview.avgLevel }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">最高等级</div>
          <div class="metric-value">{{ overview.maxLevel }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">金币总量</div>
          <div class="metric-value" style="font-size:20px;">{{ fmtGold(overview.totalGold) }}</div>
        </div>
        <div class="metric-card" :class="overview.overLevelCap > 0 ? 'metric-warn' : ''">
          <div class="metric-label">超出等级上限</div>
          <div class="metric-value">{{ overview.overLevelCap }} 人</div>
        </div>
        <div class="metric-card" :class="overview.overGoldCap > 0 ? 'metric-warn' : ''">
          <div class="metric-label">超出金币上限</div>
          <div class="metric-value">{{ overview.overGoldCap }} 人</div>
        </div>
      </div>
      <div v-else class="muted empty-tip">加载中…</div>
    </div>

    <!-- 当前生效配置 + 表单 -->
    <div class="card mt16">
      <div class="card-title">服务器全局设置</div>

      <div class="form-row">
        <div class="form-item">
          <label>经验倍率 <span class="muted">(0.1 ~ 1000)</span></label>
          <input type="number" v-model.number="form.expMultiplier" step="0.1" min="0.1" max="1000" />
          <div class="hint">所有经验产出（挂机/离线/任务/PVP/BOSS/卷轴）按此系数乘算</div>
        </div>
        <div class="form-item">
          <label>金币倍率 <span class="muted">(0.1 ~ 1000)</span></label>
          <input type="number" v-model.number="form.goldMultiplier" step="0.1" min="0.1" max="1000" />
          <div class="hint">所有金币产出按此系数乘算；<0.1 倍时 0 元金币封禁</div>
        </div>
      </div>

      <div class="form-row">
        <div class="form-item">
          <label>全服等级上限 <span class="muted">(0 = 不限，1~100000)</span></label>
          <input type="number" v-model.number="form.maxLevel" step="1" min="0" max="100000" />
          <div class="hint">达到上限后溢出经验清零；存量高等级玩家保留，不强制降级</div>
        </div>
        <div class="form-item">
          <label>金币持有上限 <span class="muted">(0 = 不限)</span></label>
          <input type="number" v-model.number="form.maxGold" step="1000000" min="0" />
          <div class="hint">玩家每次产出后金币钳制到上限以下；上限本身不强制扣减存量</div>
        </div>
      </div>

      <div class="quick-row">
        <span class="muted" style="margin-right:8px;">智能预设：</span>
        <button class="btn btn-sm" @click="applyPreset(1, 1, 0, 0)">默认（×1）</button>
        <button class="btn btn-sm" @click="applyPreset(2, 2, 0, 0)">开服双倍</button>
        <button class="btn btn-sm" @click="applyPreset(0.5, 0.5, 0, 0)">难度上调（半收益）</button>
        <button class="btn btn-sm" @click="applyPreset(1, 1, 5000, 10000000000)">赛季制（Lv≤5000，Gold≤100亿）</button>
        <button class="btn btn-sm" @click="applyPreset(1, 1, 1000, 1000000000)">新手服（Lv≤1000，Gold≤10亿）</button>
      </div>

      <div class="row mt16">
        <button class="btn btn-primary" :disabled="saving" @click="saveConfig">
          {{ saving ? '保存中…' : '保存设置' }}
        </button>
        <button class="btn" :disabled="saving" @click="reload">放弃修改</button>
        <span v-if="lastSaved" class="muted" style="font-size:12px;">
          上次保存于 {{ fmtTime(lastSaved.updatedAt) }} · by {{ lastSaved.updatedBy }}
        </span>
        <span v-if="errMsg" class="msg-error" style="margin-left:8px;">{{ errMsg }}</span>
      </div>
    </div>

    <!-- 说明 -->
    <div class="card mt16">
      <div class="card-title">说明</div>
      <ul class="muted" style="font-size:13px; line-height:1.8; padding-left:20px;">
        <li><b>倍率生效范围</b>：挂机单场/离线批量/任务/成就/活跃/远征/PVP/世界 BOSS/经验卷轴，共 9 个产出点</li>
        <li><b>上限生效范围</b>：玩家每次产出发放后立即钳制（不扣存量，避免误伤）</li>
        <li><b>变更不影响</b>：玩家已累计的等级/金币存量；只对新产出与新经验生效</li>
        <li><b>审计</b>：每次保存会写入审计日志 <code>gm.server.config</code>（含操作人 + 时间戳）</li>
        <li><b>回滚</b>：恢复默认 = 点预设"默认（×1）"再保存</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { adminApi } from '../api';

const overview = ref(null);
const saving = ref(false);
const errMsg = ref('');
const lastSaved = ref(null);
let pollTimer = null;

const form = ref({
  expMultiplier: 1,
  goldMultiplier: 1,
  maxLevel: 0,
  maxGold: 0,
});

function fmtGold(n) {
  if (n == null) return '-';
  const v = Number(n);
  if (!Number.isFinite(v)) return '-';
  if (v >= 1e12) return (v / 1e12).toFixed(2) + ' 万亿';
  if (v >= 1e8) return (v / 1e8).toFixed(2) + ' 亿';
  if (v >= 1e4) return (v / 1e4).toFixed(2) + ' 万';
  return String(Math.floor(v));
}
function fmtTime(ts) {
  if (!ts) return '-';
  const d = new Date(Number(ts));
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

async function loadAll() {
  try {
    const r = await adminApi.getServerConfig();
    if (!r) return;
    if (r.config) {
      form.value = {
        expMultiplier: r.config.expMultiplier ?? 1,
        goldMultiplier: r.config.goldMultiplier ?? 1,
        maxLevel: r.config.maxLevel ?? 0,
        maxGold: r.config.maxGold ?? 0,
      };
      lastSaved.value = r.config.updatedAt ? r.config : null;
    }
    overview.value = r.overview || null;
    errMsg.value = '';
  } catch (e) {
    errMsg.value = e.message || '加载失败';
  }
}

const reload = () => loadAll();

function applyPreset(e, g, lv, gold) {
  form.value.expMultiplier = e;
  form.value.goldMultiplier = g;
  form.value.maxLevel = lv;
  form.value.maxGold = gold;
}

async function saveConfig() {
  if (saving.value) return;
  saving.value = true;
  errMsg.value = '';
  try {
    const r = await adminApi.putServerConfig({
      expMultiplier: form.value.expMultiplier,
      goldMultiplier: form.value.goldMultiplier,
      maxLevel: form.value.maxLevel,
      maxGold: form.value.maxGold,
    });
    if (r && r.config) lastSaved.value = r.config;
    if (r && r.overview) overview.value = r.overview;
  } catch (e) {
    errMsg.value = e.message || '保存失败';
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadAll();
  // 10s 自动刷新总览（辅助智能调节决策）
  pollTimer = setInterval(async () => {
    try {
      const r = await adminApi.getServerConfig();
      if (r && r.overview) overview.value = r.overview;
    } catch (_) {}
  }, 10000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<style scoped>
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}
.metric-card {
  background: var(--bg-soft);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 12px 14px;
}
.metric-card.metric-warn {
  border-color: var(--warning, #e6a23c);
  background: rgba(230, 162, 60, 0.08);
}
.metric-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.metric-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--text);
}
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 8px;
}
.form-item label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: var(--text);
}
.form-item input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  box-sizing: border-box;
}
.form-item .hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
}
.quick-row {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed var(--border-light);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}
.msg-error {
  color: var(--danger, #f56c6c);
  font-size: 13px;
}
code {
  background: var(--bg-soft);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 12px;
}
</style>
