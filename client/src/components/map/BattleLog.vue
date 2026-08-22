<template>
  <div class="log-section card" data-tutorial="log">
    <div class="log-header">
      <span><IconBase name="crossedSwords" :size="14" class="section-icon" />战斗日志</span>
      <span class="countdown-timer">
        <span class="hourglass" :class="{ running: countdown > 0 }"><IconBase name="scroll" :size="13" /></span>
        <span class="countdown">{{ countdown }}s</span>
      </span>
    </div>

    <DamageLayer :damageItems="damageItems" />

    <div class="log-body" ref="logBody">
      <div v-if="!player.logs.length" class="log-empty">正在寻找猎物...</div>

      <template v-for="(log, i) in player.logs" :key="i">
        <!-- 战斗日志 -->
        <div v-if="log.type === 'battle'" class="log-entry fade-in battle" @click="toggleExpand(i)">
          <div class="battle-card">
            <div class="battle-top">
              <span class="log-time">{{ formatTime(log.time) }}</span>
              <span class="battle-result" :class="log.result">{{ resultText(log.result) }}</span>
              <span class="battle-vs">vs <span class="monster">{{ log.monster.name }}</span></span>
              <span class="battle-rounds">{{ log.rounds }}回合</span>
              <span class="rating-badge" :class="ratingClass(log)">{{ ratingLetter(log) }}</span>
            </div>

            <div class="battle-summary-row">
              <span v-if="log.exp" class="reward-exp"><IconBase name="scroll" :size="12" class="btn-icon icon-accent2" /> +{{ log.exp }}</span>
              <span v-if="log.gold" class="reward-gold"><IconBase name="gold" :size="12" class="btn-icon icon-accent" /> +{{ log.gold }}</span>
              <span v-if="log.drops.length" class="reward-drops clickable" @click.stop="$emit('show-drops', log)">
                <IconBase name="bag" :size="12" class="btn-icon icon-accent2" /> {{ log.drops.length }}件
              </span>
              <span class="expand-hint">{{ expandedLogs.has(i) ? '收起' : '展开详情' }}</span>
            </div>

            <transition name="expand">
              <BattleLogDetail v-if="expandedLogs.has(i)" :log="log" :maxHp="player.maxHp" />
            </transition>
          </div>
        </div>

        <!-- 升级日志 -->
        <div v-else-if="log.type === 'levelup'" class="log-entry levelup">
          <span class="log-time">{{ formatTime(log.time) }}</span>
          <span class="log-text levelup-text">{{ log.text }}</span>
        </div>
        <!-- 职业日志 -->
        <div v-else-if="log.type === 'job'" class="log-entry job">
          <span class="log-time">{{ formatTime(log.time) }}</span>
          <span class="log-text job-text">{{ log.text }}</span>
        </div>
        <!-- 技能日志 -->
        <div v-else-if="log.type === 'skill'" class="log-entry skill">
          <span class="log-time">{{ formatTime(log.time) }}</span>
          <span class="log-text skill-text">🔮 {{ log.text }}</span>
        </div>
        <!-- 进化日志 -->
        <div v-else-if="log.type === 'evolve'" class="log-entry evolve">
          <span class="log-time">{{ formatTime(log.time) }}</span>
          <span class="log-text evolve-text">🧬 {{ log.text }}</span>
        </div>
        <!-- 其他日志 -->
        <div v-else class="log-entry">
          <span class="log-time">{{ formatTime(log.time) }}</span>
          <span class="log-text">{{ log.text || JSON.stringify(log) }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
// ====== 战斗日志区 ======
// @file components/map/BattleLog
// @module battle-log
// @description 下半屏：完整战斗日志（含飘字层、点击展开详情）
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import IconBase from '../icons/IconBase.vue';
import DamageLayer from './DamageLayer.vue';
import BattleLogDetail from './BattleLogDetail.vue';
import { resultText, ratingLetter, ratingClass } from './battleLogUtils';

const props = defineProps({
  player: { type: Object, required: true },
});
defineEmits(['show-drops']);

const logBody = ref(null);
const expandedLogs = ref(new Set());
const damageItems = ref([]);
const lastBattleTime = ref(null);
let dmgSeq = 0;
const dmgTimers = new Set();

function spawnDamageFromLog(log) {
  if (!log || log.type !== 'battle' || !Array.isArray(log.detail)) return;
  if (lastBattleTime.value === log.time) return;
  lastBattleTime.value = log.time;
  const actions = [];
  for (const r of log.detail) {
    for (const a of (r.actions || [])) {
      if (a.damage !== undefined) actions.push(a);
      else if (a.heal !== undefined) actions.push(a);
      else if (a.dodge) actions.push(a);
    }
  }
  const slice = actions.slice(-12);
  slice.forEach((a, idx) => {
    const id = Date.now() + '_' + (dmgSeq++);
    let kind = 'player-dmg';
    let value = a.damage;
    let crit = !!a.crit;
    let isSkill = a.type === 'skill';
    let skillName = isSkill ? a.skill : '';
    if (a.heal !== undefined) { kind = 'heal'; value = a.heal; }
    else if (a.dodge) { kind = 'miss'; value = 0; }
    else if (a.actor === 'monster') { kind = 'monster-dmg'; }
    else { kind = 'player-dmg'; }
    const item = { id, kind, value, crit, isSkill, skillName, x: 20 + Math.random() * 60, y: 18 + Math.random() * 42 };
    const delay = idx * 80;
    const t = setTimeout(() => {
      dmgTimers.delete(t);
      damageItems.value.push(item);
      if (damageItems.value.length > 12) damageItems.value = damageItems.value.slice(-12);
      const rm = setTimeout(() => {
        dmgTimers.delete(rm);
        damageItems.value = damageItems.value.filter(x => x.id !== id);
      }, 1650);
      dmgTimers.add(rm);
    }, delay);
    dmgTimers.add(t);
  });
}

function findLatestBattle(logs) {
  if (!logs || !logs.length) return null;
  return logs.find(l => l.type === 'battle') || null;
}

// 首次挂载不飘旧日志
{
  const latestBattle = findLatestBattle(props.player.logs);
  if (latestBattle) lastBattleTime.value = latestBattle.time;
}
watch(() => props.player.logs, (logs) => {
  if (!logs || !logs.length) return;
  const latestBattle = findLatestBattle(logs);
  if (latestBattle) spawnDamageFromLog(latestBattle);
});

const countdown = ref(5);
let countdownTimer = null;
watch(() => props.player.logs, () => {
  countdown.value = 5;
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    countdown.value = countdown.value > 0 ? countdown.value - 1 : 5;
  }, 1000);
}, { deep: true });
onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer);
  dmgTimers.forEach(t => clearTimeout(t));
  dmgTimers.clear();
});

watch(() => props.player.logs, () => {
  nextTick(() => { if (logBody.value) logBody.value.scrollTop = 0 });
});

function toggleExpand(index) {
  const s = new Set(expandedLogs.value);
  if (s.has(index)) s.delete(index);
  else s.add(index);
  expandedLogs.value = s;
}

function formatTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}
</script>

<style scoped>
.log-section { flex: 1; display: flex; flex-direction: column; min-height: 200px; padding: 0.6rem 0.8rem; position: relative; }
.log-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; font-size: 0.85rem; color: var(--muted); }
.countdown-timer { display: flex; align-items: center; gap: 0.3rem; }
.hourglass { display: inline-block; font-size: 0.75rem; }
.hourglass.running { animation: spin 2s linear infinite; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.countdown { font-family: monospace; font-weight: 600; font-size: 0.75rem; color: var(--accent); }
.log-body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.3rem; }
.log-empty { text-align: center; color: var(--dim); padding: 1.5rem; font-style: italic; }

.log-entry { padding: 0.3rem 0.4rem; border-radius: 6px; font-size: 0.75rem; border-left: 2px solid transparent; }
.log-entry.battle { border-left-color: var(--accent2); background: rgba(20,22,42,0.4); cursor: pointer; transition: background var(--duration-fast) var(--ease-out); }
.log-entry.battle:hover { background: rgba(20,22,42,0.6); }
.log-entry.levelup { background: rgba(212,175,94,0.08); border-left-color: var(--accent); }
.log-entry.job { background: rgba(157,140,240,0.08); border-left-color: var(--accent2); }
.log-entry.skill { background: rgba(94,218,122,0.08); border-left-color: var(--success); }
.log-entry.evolve { background: rgba(212,175,94,0.08); border-left-color: var(--accent); }
.log-time { font-size: 0.65rem; color: var(--dim); margin-right: 0.4rem; font-family: monospace; }
.log-text { color: var(--text); }
.levelup-text { color: var(--accent); font-weight: 700; }
.job-text { color: var(--accent2); }
.skill-text { color: var(--success); }
.evolve-text { color: var(--accent); font-weight: 600; }

.battle-card { display: flex; flex-direction: column; gap: 0.3rem; }
.battle-top { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.battle-result { font-weight: 700; font-size: 0.78rem; padding: 0.05rem 0.35rem; border-radius: 4px; }
.battle-result.win { background: rgba(94,218,122,0.2); color: var(--success); }
.battle-result.lose { background: rgba(224,88,88,0.2); color: var(--danger); }
.battle-result.timeout { background: rgba(212,175,94,0.2); color: var(--accent); }
.battle-vs { color: var(--muted); font-size: 0.72rem; }
.monster { color: var(--text); font-weight: 600; }
.battle-rounds { font-size: 0.68rem; color: var(--dim); }
.rating-badge { font-size: 0.7rem; font-weight: 800; padding: 0.05rem 0.35rem; border-radius: 4px; background: var(--bg2); }
.rating-badge.rating-s { color: var(--accent); border: 1px solid var(--accent); }
.rating-badge.rating-a { color: var(--accent2); border: 1px solid var(--accent2); }
.rating-badge.rating-b { color: var(--success); }
.rating-badge.rating-c { color: var(--dim); }

.battle-summary-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; font-size: 0.7rem; }
.reward-exp, .reward-gold { font-weight: 600; }
.reward-drops { cursor: pointer; transition: transform 0.15s; color: var(--success); }
.reward-drops.clickable:hover { transform: scale(1.1); }
.expand-hint { font-size: 0.62rem; color: var(--dim); margin-left: auto; }
.expand-enter-active, .expand-leave-active { transition: all 0.3s ease; overflow: hidden; }
.expand-enter-from, .expand-leave-to { max-height: 0; opacity: 0; }
.expand-enter-to, .expand-leave-from { max-height: 2000px; opacity: 1; }
</style>
