<template>
  <div>
    <!-- 功能切换 -->
    <div class="card between">
      <div class="row">
        <button class="btn" :class="tab === 'announce' ? 'btn-primary' : ''" @click="tab = 'announce'">全服公告</button>
        <button class="btn" :class="tab === 'search' ? 'btn-primary' : ''" @click="tab = 'search'">玩家检索</button>
        <button class="btn" :class="tab === 'boss' ? 'btn-primary' : ''" @click="tab = 'boss'">世界 BOSS</button>
      </div>
      <span class="muted" style="font-size:12px;">GM 操作均记录审计日志</span>
    </div>

    <!-- ====== 全服公告 ====== -->
    <template v-if="tab === 'announce'">
      <div class="card mt16">
        <div class="card-title">发送全服公告</div>
        <textarea v-model="announceText" class="announce-input" rows="3"
          maxlength="500" placeholder="输入要广播给所有在线玩家的消息，最多 500 字"></textarea>
        <div class="row mt16">
          <button class="btn btn-primary" :disabled="sending || !announceText.trim()" @click="sendAnnounce">
            {{ sending ? '发送中...' : '发送公告' }}
          </button>
          <span v-if="announceMsg" class="muted" style="font-size:12px;">{{ announceMsg }}</span>
        </div>
      </div>

      <div class="card mt16">
        <div class="card-title">公告历史（最近 {{ announces.length }} 条）</div>
        <div v-if="announces.length === 0" class="muted empty-tip">暂无公告</div>
        <div v-for="a in announces" :key="a.id" class="announce-item">
          <div class="row">
            <span class="tag tag-primary">#{{ a.id }}</span>
            <span class="muted" style="font-size:12px;">{{ fmtTime(a.ts) }}</span>
          </div>
          <div class="announce-content">{{ a.content }}</div>
        </div>
      </div>
    </template>

    <!-- ====== 玩家检索 ====== -->
    <template v-else-if="tab === 'search'">
      <div class="card mt16">
        <div class="card-title">搜索玩家</div>
        <div class="row">
          <input v-model="keyword" class="search-input" type="text" placeholder="输入用户名或角色名（模糊匹配）"
            @keyup.enter="doSearch" />
          <button class="btn btn-primary" :disabled="searching" @click="doSearch">
            {{ searching ? '搜索中...' : '搜索' }}
          </button>
        </div>
        <div v-if="searchMsg" class="muted mt16" style="font-size:12px;">{{ searchMsg }}</div>

        <div v-if="results.length > 0" class="mt16">
          <table class="table">
            <thead>
              <tr>
                <th>用户名</th>
                <th>角色名</th>
                <th style="width:60px;">等级</th>
                <th>区域</th>
                <th style="width:70px;">状态</th>
                <th style="width:80px;">最后活动</th>
                <th style="width:90px;">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in results" :key="r.username">
                <td>{{ r.username }}</td>
                <td>{{ r.name }}</td>
                <td>{{ r.level }}</td>
                <td>{{ r.areaName || r.currentArea || '-' }}</td>
                <td>
                  <span class="tag" :class="r.online ? 'tag-success' : 'tag-primary'">{{ r.online ? '在线' : '离线' }}</span>
                </td>
                <td>{{ timeAgo(r.lastTick) }}</td>
                <td>
                  <button class="btn" :disabled="detailLoading === r.username" @click="openDetail(r)">
                    {{ detailLoading === r.username ? '...' : '档案' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- ====== 世界 BOSS ====== -->
    <template v-else>
      <div class="card mt16">
        <div class="card-title">世界 BOSS · 强制召唤</div>
        <div class="muted" style="line-height:1.9;">
          重置当前世界 BOSS 并立即召唤一只新的（属性按全服玩家水平生成）。<br/>
          原 BOSS 的剩余血量与挑战进度会全部清空，请确认没有玩家正在攻略时再操作。
        </div>
        <div class="row mt16">
          <button class="btn btn-danger" :disabled="bossBusy" @click="spawnBoss">
            {{ bossBusy ? '召唤中...' : '重新召唤世界 BOSS' }}
          </button>
          <span v-if="bossMsg" style="font-size:12px;" :class="bossErr ? 'danger-text' : 'muted'">{{ bossMsg }}</span>
        </div>
      </div>
    </template>

    <!-- ====== 玩家档案弹窗 ====== -->
    <div v-if="detail" class="overlay" @click.self="detail = null">
      <div class="modal">
        <div class="card-title row between">
          <span>玩家档案 · {{ detail.username }}</span>
          <button class="btn" @click="detail = null">关闭</button>
        </div>

        <div class="kv">
          <dt>角色名</dt><dd>{{ detail.name || '-' }}</dd>
          <dt>等级</dt><dd>{{ detail.level ?? '-' }}</dd>
          <dt>职业</dt><dd>{{ detail.jobName || (detail.view && detail.view.jobPath) || '无' }}</dd>
          <dt>挂机区域</dt><dd>{{ detail.areaName || detail.currentArea || '-' }}</dd>
          <dt>金币</dt><dd>{{ formatNum((detail.view && detail.view.gold)) }}</dd>
          <dt>状态</dt><dd>
            <span class="tag" :class="detail.online ? 'tag-success' : 'tag-primary'">{{ detail.online ? '在线' : '离线' }}</span>
          </dd>
          <dt>最后活动</dt><dd>{{ fmtTime(detail.lastTick) }}</dd>
          <dt>装备数</dt><dd>{{ (detail.view && detail.view.equips && detail.view.equips.length) ?? '-' }}</dd>
          <dt>背包物品</dt><dd>{{ (detail.view && detail.view.inventory && detail.view.inventory.length) ?? '-' }}</dd>
          <dt>法则数</dt><dd>{{ (detail.view && detail.view.laws && detail.view.laws.length) ?? '-' }}</dd>
          <dt>基础属性</dt>
          <dd>
            <span v-if="detail.view && detail.view.attributes">{{ summarizeAttrs(detail.view.attributes) }}</span>
            <span v-else>-</span>
          </dd>
        </div>

        <div v-if="detail.view && detail.view.logs && detail.view.logs.length" class="mt16">
          <div class="muted" style="font-size:12px;">最近战斗记录</div>
          <div v-for="(log, i) in detail.view.logs.slice(0, 5)" :key="i" class="log-line">
            {{ logText(log) }}
          </div>
        </div>

        <!-- GM 操作 -->
        <div class="gm-box">
          <div class="card-title">GM 操作 · 发放资源</div>
          <div class="row mt8">
            <input v-model="gmGold" type="number" min="1" step="1" class="search-input gm-input"
              placeholder="金币数量（1 ~ 100000亿）" />
            <button class="btn btn-primary" :disabled="gmBusy" @click="grantGold">发金币</button>
          </div>
          <div class="row mt8">
            <input v-model="gmExp" type="number" min="1" step="1" class="search-input gm-input"
              placeholder="经验数量（1 ~ 1000万）" />
            <button class="btn btn-primary" :disabled="gmBusy" @click="grantExp">发经验</button>
          </div>
          <div v-if="gmMsg" class="mt8" style="font-size:12px;" :class="gmErr ? 'danger-text' : 'muted'">{{ gmMsg }}</div>
          <div class="muted mt8" style="font-size:11px;">发放成功后将自动刷新档案。升级会按正常规则加属性点、触发职业进阶。</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { adminApi } from '../api.js';

// ====== 全服公告 ======
const tab = ref('announce');
const announceText = ref('');
const announces = ref([]);
const sending = ref(false);
const announceMsg = ref('');

async function loadAnnounces() {
  try {
    const d = await adminApi.announceList();
    announces.value = (d && d.list) || [];
  } catch (e) {
    announceMsg.value = e.message;
  }
}

async function sendAnnounce() {
  const text = announceText.value.trim();
  if (!text) return;
  sending.value = true;
  announceMsg.value = '';
  try {
    const d = await adminApi.announce(text);
    announces.value = (d && d.list) || [];
    announceText.value = '';
    announceMsg.value = '已发送 ✓';
    setTimeout(() => { announceMsg.value = ''; }, 3000);
  } catch (e) {
    announceMsg.value = '发送失败：' + e.message;
  } finally {
    sending.value = false;
  }
}

// ====== 玩家检索 ======
const keyword = ref('');
const results = ref([]);
const searching = ref(false);
const searchMsg = ref('');
const detail = ref(null);
const detailLoading = ref('');

async function doSearch() {
  const kw = keyword.value.trim();
  if (!kw) { searchMsg.value = '请输入关键词'; return; }
  searching.value = true;
  searchMsg.value = '';
  try {
    const d = await adminApi.searchPlayers(kw);
    results.value = (d && d.list) || [];
    searchMsg.value = `共匹配 ${(d && d.total) || 0} 人（最多显示 20 条）`;
  } catch (e) {
    searchMsg.value = '搜索失败：' + e.message;
    results.value = [];
  } finally {
    searching.value = false;
  }
}

async function openDetail(r) {
  detailLoading.value = r.username;
  try {
    const d = await adminApi.getPlayer(r.username);
    detail.value = d;
    gmMsg.value = '';
  } catch (e) {
    alert('加载档案失败：' + e.message);
  } finally {
    detailLoading.value = '';
  }
}

// ====== GM 资源发放 ======
const gmGold = ref('');
const gmExp = ref('');
const gmBusy = ref(false);
const gmMsg = ref('');
const gmErr = ref(false);

async function reloadDetail() {
  try {
    detail.value = await adminApi.getPlayer(detail.value.username);
  } catch (_) {}
}

async function grantGold() {
  const n = Math.floor(Number(gmGold.value));
  if (!n || n <= 0 || n > 1e13) { gmMsg.value = '请输入 1 ~ 100000亿 之间的数量'; gmErr.value = true; return; }
  await runGm(() => adminApi.gmGold(detail.value.username, n));
}

async function grantExp() {
  const n = Math.floor(Number(gmExp.value));
  if (!n || n <= 0 || n > 1e7) { gmMsg.value = '请输入 1 ~ 1000万 之间的数量'; gmErr.value = true; return; }
  await runGm(() => adminApi.gmExp(detail.value.username, n));
}

async function runGm(fn) {
  gmBusy.value = true;
  gmErr.value = false;
  gmMsg.value = '';
  try {
    await fn();
    gmMsg.value = '发放成功 ✓ 已刷新档案';
    gmGold.value = '';
    gmExp.value = '';
    await reloadDetail();
  } catch (e) {
    gmErr.value = true;
    gmMsg.value = '操作失败：' + e.message;
  } finally {
    gmBusy.value = false;
  }
}

// ====== 世界 BOSS ======
const bossBusy = ref(false);
const bossMsg = ref('');
const bossErr = ref(false);

async function spawnBoss() {
  if (!confirm('将清空当前世界 BOSS 的血量与挑战进度，确认重新召唤？')) return;
  bossBusy.value = true;
  bossErr.value = false;
  bossMsg.value = '';
  try {
    const d = await adminApi.spawnWorldBoss();
    bossMsg.value = `已召唤：${d.name} · HP ${formatNum(d.maxHp)}`;
    setTimeout(() => { bossMsg.value = ''; }, 6000);
  } catch (e) {
    bossErr.value = true;
    bossMsg.value = '召唤失败：' + e.message;
  } finally {
    bossBusy.value = false;
  }
}

// ====== 工具函数 ======
function fmtTime(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function timeAgo(ts) {
  if (!ts) return '-';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s} 秒前`;
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  return `${Math.floor(s / 86400)} 天前`;
}
function formatNum(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '-';
  const abs = Math.abs(n);
  if (abs >= 1e8) return (n / 1e8).toFixed(1) + '亿';
  if (abs >= 1e4) return (n / 1e4).toFixed(1) + '万';
  return String(Math.round(n));
}
// 属性中文标签（attributes: { atk, def, hp, agi }）
const ATTR_LABELS = { atk: '攻击', def: '防御', hp: '生命', agi: '敏捷', mp: '魔力', str: '力量', vit: '体质', int: '智力', spd: '速度' };
function summarizeAttrs(attrs) {
  if (!attrs || typeof attrs !== 'object') return '-';
  const entries = Object.entries(attrs).filter(([k, v]) => v !== undefined && v !== null && typeof v !== 'object');
  if (entries.length === 0) return '-';
  return entries.map(([k, v]) => `${ATTR_LABELS[k] || k}: ${typeof v === 'number' ? formatNum(v) : v}`).join(' · ');
}
// 日志类型中文标签
const LOG_TYPE_LABELS = { battle: '战斗', levelup: '升级', drop: '掉落', chest: '宝箱', boss: 'BOSS', pvp: 'PVP', expedition: '远征', quest: '任务' };
const LOG_RESULT_LABELS = { w: '胜利', win: '胜利', l: '失败', lose: '失败', t: '平局', draw: '平局' };
function logText(log) {
  if (!log) return '-';
  if (typeof log === 'string') return log;
  if (log.text) return log.text; // levelup 等自带友好文本（"等级提升！Lv.X ..."）
  if (log.type === 'battle') {
    const res = LOG_RESULT_LABELS[log.result] || log.result || '';
    const monster = (log.monster && log.monster.name) || '';
    return `战斗 · ${res} vs ${monster}${log.rounds ? '（' + log.rounds + ' 回合）' : ''}`;
  }
  return LOG_TYPE_LABELS[log.type] || log.type || '-';
}

onMounted(loadAnnounces);
</script>

<style scoped>
.announce-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--fill);
  color: var(--text-1);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
}
.announce-input:focus { outline: none; border-color: var(--primary); }
.announce-item {
  padding: 10px 0;
  border-bottom: 1px solid var(--border-light);
}
.announce-item:last-child { border-bottom: none; }
.announce-content {
  margin-top: 6px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-all;
  white-space: pre-wrap;
}
.search-input {
  flex: 1;
  max-width: 320px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--fill);
  color: var(--text-1);
  font-family: inherit;
  font-size: 14px;
}
.search-input:focus { outline: none; border-color: var(--primary); }
.empty-tip { padding: 12px 0; }
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 16px;
  z-index: 100;
  overflow: auto;
}
.modal {
  width: 100%;
  max-width: 520px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: var(--shadow-drop);
}
.log-line {
  padding: 4px 0;
  font-size: 13px;
  color: var(--text-3);
  border-bottom: 1px dashed var(--border-light);
  word-break: break-all;
}
.log-line:last-child { border-bottom: none; }
.gm-box {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}
.gm-input {
  flex: 1;
  max-width: 240px;
}
.mt8 { margin-top: 8px; }
.danger-text { color: var(--danger); }
</style>
