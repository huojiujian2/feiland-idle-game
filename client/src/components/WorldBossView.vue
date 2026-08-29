<!--
  ====== 世界 BOSS 页（v2.9 重构） ======
  - BOSS 数值 = 全服最强玩家 × 10 倍（生命5:攻击3:防御1:敏捷1 分配）
  - 每日 0 点强制死亡结算；当前 BOSS 在次日凌晨自动重生
  - 玩家每日 1 次挑战次数；点一次按钮 → 后端跑 1 次 5 回合战斗 → 返回战报
  - 伤害前三名玩家获得 24h 限时称号（天命弑神者 / 深渊征服者 / 暗影屠戮者）
-->
<template>
  <div class="view-container boss-view">
    <!-- BOSS 卡片 -->
    <div class="card boss-card" v-if="boss">
      <div class="boss-header">
        <div class="boss-portrait">
          <IconBase :name="boss.icon || 'skull'" :size="56" class="boss-icon" />
        </div>
        <div class="boss-info">
          <div class="boss-name">{{ boss.name }}</div>
          <div class="boss-desc">{{ boss.desc }}</div>
          <div class="boss-stats">
            <span class="stat-chip">⚔ {{ boss.atk.toLocaleString() }}</span>
            <span class="stat-chip">🛡 {{ boss.def.toLocaleString() }}</span>
            <span class="stat-chip">⚡ {{ boss.agi.toLocaleString() }}</span>
          </div>
        </div>
      </div>

      <!-- HP 条 -->
      <div class="hp-section">
        <div class="hp-bar">
          <div class="hp-bar-fill" :style="{ width: hpPercent + '%' }"></div>
        </div>
        <div class="hp-text">
          <span class="hp-num">{{ boss.hp.toLocaleString() }} / {{ boss.maxHp.toLocaleString() }}</span>
          <span class="hp-pct">{{ hpPercent.toFixed(1) }}%</span>
        </div>
      </div>

      <!-- 倒计时 -->
      <div class="countdown-row" v-if="remainingLabel">
        <span>⏳ 本次 BOSS 重生于：</span>
        <span class="countdown-text">{{ remainingLabel }}</span>
      </div>

      <!-- 攻击按钮 + 状态提示 -->
      <div class="attack-section">
        <button v-if="!challengedToday" class="btn btn-danger attack-btn" @click="doAttack" :disabled="attacking">
          {{ attacking ? '战斗中…' : '⚔ 挑战世界 BOSS（每日 1 次）' }}
        </button>
        <button v-else class="btn attack-btn attack-btn--done" disabled>
          今日次数已用完 · 等待次日重生
        </button>
      </div>
    </div>

    <div v-else class="card boss-empty">
      <p>当前没有可攻击的世界 BOSS</p>
    </div>

    <!-- 战斗报告 -->
    <div v-if="lastBattle" class="card battle-card">
      <div class="section-header">
        <span><IconBase name="bolt" :size="14" class="section-icon" />本次战斗报告</span>
        <span class="battle-summary">
          <span v-if="lastBattle.result === 'win'" class="summary-win">✓ 5 回合击败</span>
          <span v-else-if="lastBattle.result === 'lose'" class="summary-lose">✗ 落败</span>
          <span v-else class="summary-timeout">⏱ 5 回合结束</span>
        </span>
      </div>
      <div class="battle-stats-row">
        <div class="bs-item"><span class="bs-label">造成伤害</span><span class="bs-val">{{ lastBattle.totalDamage.toLocaleString() }}</span></div>
        <div class="bs-item"><span class="bs-label">剩余 HP</span><span class="bs-val">{{ (props.player?.hp || 0).toLocaleString() }} / {{ (props.player?.maxHp || 0).toLocaleString() }}</span></div>
      </div>
      <div class="battle-rounds">
        <div v-for="r in lastBattle.rounds" :key="r.round" class="round-block">
          <div class="round-title">第 {{ r.round }} 回合</div>
          <div class="round-actions">
            <div v-for="(a, i) in r.actions" :key="i" class="action" :class="`action--${a.actor}`">
              <template v-if="a.actor === 'player'">
                <span v-if="a.dodge" class="ac">⚡ {{ a.skill }}</span>
                <span v-else-if="a.skill && a.damage">⚔ {{ a.skill }} → {{ a.damage.toLocaleString() }}<span v-if="a.crit" class="crit-mark"> 暴击</span></span>
                <span v-else>⚔ {{ a.skill || '行动' }}</span>
              </template>
              <template v-else>
                <span v-if="a.damage">💥 {{ a.skill }} → {{ a.damage.toLocaleString() }}</span>
                <span v-else>💥 {{ a.skill || '行动' }}</span>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 称号获得提示 -->
    <div v-if="titleWinners && titleWinners.length > 0" class="card title-card">
      <div class="section-header"><span>🏅 称号奖励（前 3 名已发 24h 限时称号）</span></div>
      <div class="title-winners">
        <div v-for="w in titleWinners" :key="w.titleKey" class="title-winner">
          <span class="rank-tag" :class="`rank-tag--${w.rank}`">{{ ['🥇','🥈','🥉'][w.rank-1] }}</span>
          <span class="winner-name">{{ w.username }}</span>
          <span class="winner-title">{{ allTitles[w.titleKey]?.name || w.titleKey }}</span>
        </div>
      </div>
    </div>

    <!-- 伤害排行榜 -->
    <div v-if="ranking.length > 0" class="card ranking-card">
      <div class="section-header">
        <span><IconBase name="trophy" :size="14" class="section-icon" />伤害排行榜（Top 10）</span>
        <span class="my-rank" v-if="myRank">我的排名 #{{ myRank.rank }}（{{ myRank.damage.toLocaleString() }} 伤害）</span>
      </div>
      <div class="rank-list">
        <div v-for="(item, i) in ranking" :key="item.username" class="rank-row"
          :class="{ self: item.username === currentUser, top1: i === 0, top2: i === 1, top3: i === 2 }">
          <span class="rank-num">{{ i + 1 }}</span>
          <span class="rank-name">{{ item.username === currentUser ? '你' : item.username }}</span>
          <span class="rank-dmg">{{ item.damage.toLocaleString() }}</span>
        </div>
      </div>
    </div>

    <!-- 奖励预览 -->
    <div v-if="boss && boss.rewards" class="card reward-card">
      <div class="section-header"><span>参与奖励（按伤害占比）</span></div>
      <div class="reward-list">
        <div class="reward-row"><IconBase name="gold" :size="13" class="icon-accent" /> {{ boss.rewards.gold }} 金币</div>
        <div class="reward-row"><IconBase name="scroll" :size="13" class="icon-accent2" /> {{ boss.rewards.exp }} 经验</div>
        <div v-for="m in boss.rewards.materials" :key="m.name" class="reward-row">
          <IconBase name="bag" :size="13" class="icon-accent2" /> {{ m.name }} ×{{ m.count }}
        </div>
      </div>
      <div v-if="boss.finalHitRewards" class="final-hit-reward">
        <div class="final-hit-title">🏆 最后一击额外奖励</div>
        <div class="reward-row"><IconBase name="gold" :size="13" class="icon-accent" /> {{ boss.finalHitRewards.gold }} 金币</div>
        <div v-for="m in boss.finalHitRewards.materials" :key="m.name" class="reward-row">
          <IconBase name="bag" :size="13" class="icon-accent" /> {{ m.name }} ×{{ m.count }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import IconBase from './icons/IconBase.vue'
import api from '../api.js'
import { toast } from '../ui-bridge.js'

const props = defineProps(['player', 'currentUser'])

const boss = ref(null)
const ranking = ref([])
const lastBattle = ref(null)
const titleWinners = ref([])
const allTitles = ref({})
const attackedToday = ref(false)
const remainingMs = ref(0)
const attacking = ref(false)
const expiresAt = ref(0)
let pollTimer = null
let cdTimer = null

const hpPercent = computed(() => boss.value ? Math.max(0, (boss.value.hp / boss.value.maxHp) * 100) : 0)
const myRank = computed(() => ranking.value.find(r => r.username === props.currentUser) || null)
const challengedToday = computed(() => attackedToday.value)

// 倒计时 "HH:MM:SS"
const remainingLabel = computed(() => {
  if (!remainingMs.value || remainingMs.value <= 0) return ''
  const sec = Math.floor(remainingMs.value / 1000);
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
})

async function refresh() {
  try {
    const res = await api.getWorldBoss(props.currentUser)
    if (res.success) {
      boss.value = res.data.boss
      ranking.value = res.data.ranking || []
      attackedToday.value = !!res.data.challengedToday
      remainingMs.value = res.data.remainingMs || 0
      expiresAt.value = res.data.expiresAt || 0
    }
  } catch (e) { /* ignore */ }
}

async function doAttack() {
  if (attacking.value || challengedToday.value) return
  attacking.value = true
  try {
    const res = await api.attackWorldBoss(props.currentUser)
    if (res.success) {
      const data = res.data || res
      lastBattle.value = data.battle || res.battle || null
      const rewards = data.rewards || res.rewards || {}
      titleWinners.value = rewards?.titleWinners || res.rewards?.titleWinners || []
      allTitles.value = rewards?.allTitles || res.rewards?.allTitles || {}
      remainingMs.value = data.remainingMs ?? res.remainingMs ?? 0
      // also sync expiresAt from server data if available
      expiresAt.value = data.expiresAt ?? res.expiresAt ?? expiresAt.value
      attackedToday.value = true
      const killed = data.killed ?? res.killed
      const myDamage = data.myDamage ?? res.myDamage
      toast.success(killed ? '🎉 你击杀了世界 BOSS！' : `造成 ${(myDamage ?? 0).toLocaleString()} 伤害`)
      // 把服务端返回的 player 数据回传给父组件（血量等已被 boss 扣血）
      const playerView = data.player || res.player
      if (playerView && props.player) {
        Object.assign(props.player, playerView)
      }
      // 击杀后 4 秒拉新
      if (killed) setTimeout(refresh, 4000)
      else refresh()
    } else {
      toast.error(res.message)
    }
  } catch (e) {
    toast.error('挑战失败：' + e.message)
  } finally {
    attacking.value = false
  }
}

onMounted(() => {
  refresh()
  // 拉取称号库（用于顶部"称号奖励"展示）
  api.getTitles(props.currentUser).then(r => { if (r.success) allTitles.value = r.data.all || {} }).catch(() => {})
  pollTimer = setInterval(refresh, 10000)
  cdTimer = setInterval(() => {
    if (remainingMs.value > 0) {
      remainingMs.value = Math.max(0, remainingMs.value - 1000)
      if (remainingMs.value === 0) refresh()
    }
  }, 1000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  if (cdTimer) clearInterval(cdTimer)
})
</script>

<style scoped>
.boss-view { display: flex; flex-direction: column; gap: 0.6rem; max-width: 560px; margin: 0 auto; }
.boss-card { padding: 1rem; background: linear-gradient(135deg, rgba(var(--gold-rgb),0.06), rgba(var(--violet-rgb),0.06)); }
.boss-header { display: flex; align-items: flex-start; gap: 0.8rem; }
.boss-portrait {
  width: 80px; height: 80px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, rgba(var(--gold-rgb),0.15), rgba(var(--violet-rgb),0.15));
  border: 1px solid var(--accent); flex-shrink: 0;
}
.boss-icon { color: var(--accent); }
.boss-info { flex: 1; }
.boss-name { font-size: 1.3rem; font-weight: 700; background: linear-gradient(135deg, var(--accent), var(--accent2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.boss-desc { font-size: 0.72rem; color: var(--muted); margin: 0.3rem 0; line-height: 1.4; }
.boss-stats { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.stat-chip { font-size: 0.7rem; color: var(--ink); background: rgba(var(--panel-rgb),0.5); padding: 0.1rem 0.4rem; border-radius: 4px; }
.hp-section { margin-top: 0.8rem; }
.hp-bar { width: 100%; height: 14px; background: rgba(var(--panel-rgb),0.6); border-radius: 7px; overflow: hidden; border: 1px solid var(--rule); }
.hp-bar-fill { height: 100%; background: linear-gradient(90deg, #e0bc6b, #c04545); transition: width 0.3s ease; }
.hp-text { display: flex; justify-content: space-between; margin-top: 0.3rem; font-size: 0.78rem; }
.hp-num { color: var(--ink); font-weight: 600; font-family: monospace; }
.hp-pct { color: var(--accent); font-weight: 700; }
.countdown-row { margin-top: 0.4rem; font-size: 0.72rem; color: var(--muted); display: flex; justify-content: space-between; }
.countdown-text { color: var(--accent2); font-family: monospace; font-weight: 700; }
.attack-section { margin-top: 0.8rem; }
.attack-btn { width: 100%; padding: 0.7rem; font-size: 1rem; font-weight: 700; }
.attack-btn--done { background: rgba(var(--panel-rgb),0.5); color: var(--muted); cursor: not-allowed; }
.boss-empty { text-align: center; padding: 2rem; color: var(--muted); }

/* 战斗报告 */
.battle-card { padding: 0.8rem; }
.battle-summary { font-size: 0.8rem; font-weight: 700; }
.summary-win { color: var(--success); }
.summary-lose { color: var(--danger); }
.summary-timeout { color: var(--accent2); }
.battle-stats-row { display: flex; gap: 0.5rem; margin-top: 0.4rem; }
.bs-item { flex: 1; padding: 0.4rem 0.6rem; background: rgba(var(--panel-rgb),0.5); border-radius: 6px; display: flex; flex-direction: column; gap: 0.1rem; }
.bs-label { font-size: 0.68rem; color: var(--muted); }
.bs-val { font-size: 0.92rem; color: var(--accent); font-weight: 700; font-family: monospace; }
.battle-rounds { margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.35rem; max-height: 300px; overflow-y: auto; }
.round-block { padding: 0.4rem 0.6rem; background: rgba(var(--panel-rgb),0.4); border-radius: 6px; border: 1px solid var(--rule); }
.round-title { font-size: 0.75rem; color: var(--accent); font-weight: 700; margin-bottom: 0.2rem; }
.round-actions { display: flex; flex-direction: column; gap: 0.15rem; }
.action { font-size: 0.72rem; color: var(--ink); }
.action--player { color: var(--accent2); }
.action--monster { color: var(--danger); }
.crit-mark { color: #ff6b35; font-weight: 700; margin-left: 0.2rem; }

/* 称号奖励 */
.title-card { padding: 0.8rem; }
.title-winners { display: flex; flex-direction: column; gap: 0.3rem; margin-top: 0.3rem; }
.title-winner { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0.5rem; background: rgba(var(--panel-rgb),0.5); border-radius: 6px; }
.rank-tag { font-size: 1.1rem; }
.winner-name { flex: 1; font-size: 0.85rem; color: var(--ink); }
.winner-title { font-size: 0.78rem; color: var(--accent); font-weight: 600; }

/* 排行榜 */
.ranking-card { padding: 0.8rem; }
.my-rank { font-size: 0.78rem; color: var(--accent); font-weight: 600; }
.rank-list { display: flex; flex-direction: column; gap: 0.3rem; margin-top: 0.4rem; }
.rank-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.3rem 0.5rem; background: rgba(var(--panel-rgb),0.4); border-radius: 6px; border: 1px solid var(--rule); }
.rank-row.self { border-color: var(--accent); background: rgba(var(--gold-rgb),0.08); }
.rank-row.top1 { border-color: #d4af5e; }
.rank-row.top2 { border-color: #c0c0c0; }
.rank-row.top3 { border-color: #cd7f32; }
.rank-num { font-weight: 700; color: var(--accent); width: 24px; text-align: center; }
.rank-name { flex: 1; font-size: 0.85rem; }
.rank-dmg { font-family: monospace; color: var(--ink); font-weight: 600; }

.reward-card { padding: 0.8rem; }
.reward-list { display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.3rem; }
.reward-row { display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; color: var(--ink); padding: 0.15rem 0; }
.final-hit-reward { margin-top: 0.6rem; padding-top: 0.6rem; border-top: 1px solid rgba(var(--gold-rgb),0.3); }
.final-hit-title { font-size: 0.82rem; color: #d4af5e; font-weight: 700; margin-bottom: 0.3rem; }
</style>