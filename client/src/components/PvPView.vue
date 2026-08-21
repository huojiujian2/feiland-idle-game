<template>
  <div class="pvp-view">
    <!-- 顶部返回按钮 -->
    <div class="pvp-back">
      <button class="back-btn" @click="$emit('goBack')">‹ 返回地图</button>
    </div>

    <!-- PVP 数据概览 -->
    <div class="pvp-header">
      <div class="pvp-card">
        <div class="pvp-card-icon">⚔️</div>
        <div class="pvp-card-info">
          <div class="pvp-card-label">竞技积分</div>
          <div class="pvp-card-value">{{ myRating }}</div>
        </div>
      </div>
      <div class="pvp-stats-row">
        <div class="pvp-stat"><span class="stat-label">胜</span><span class="stat-val win">{{ myWins }}</span></div>
        <div class="pvp-stat"><span class="stat-label">负</span><span class="stat-val lose">{{ myLosses }}</span></div>
        <div class="pvp-stat"><span class="stat-label">连胜</span><span class="stat-val streak">{{ myStreak }}</span></div>
        <div class="pvp-stat"><span class="stat-label">最高连胜</span><span class="stat-val">{{ myBestStreak }}</span></div>
      </div>
      <div v-if="cdRemaining > 0" class="pvp-cd">
        冷却中: {{ Math.ceil(cdRemaining / 1000) }}s
      </div>
    </div>

    <!-- Tab 切换 -->
    <div class="pvp-tabs">
      <button class="pvp-tab" :class="{ active: tab === 'opponents' }" @click="tab = 'opponents'">对手列表</button>
      <button class="pvp-tab" :class="{ active: tab === 'ranking' }" @click="tab = 'ranking'">竞技排行</button>
      <button class="pvp-tab" :class="{ active: tab === 'records' }" @click="tab = 'records'">战斗记录</button>
    </div>

    <!-- 对手列表 -->
    <div v-if="tab === 'opponents'" class="pvp-content">
      <div v-if="loading" class="pvp-loading">正在寻找对手...</div>
      <div v-else-if="opponents.length === 0" class="pvp-empty">暂无匹配的对手，继续升级解锁更多对手</div>
      <div v-else class="opp-grid">
        <div v-for="opp in opponents" :key="opp.username" class="opp-card" @click="doChallenge(opp)">
          <div class="opp-top">
            <span class="opp-name">{{ opp.name }}</span>
            <span v-if="opp.godhood === 'god'" class="opp-tag god">神灵</span>
            <span v-else-if="opp.godhood === 'demigod'" class="opp-tag demi">半神</span>
          </div>
          <div class="opp-mid">
            <span class="opp-race">{{ opp.race }}</span>
            <span v-if="opp.job !== '无'" class="opp-job">{{ opp.job }}</span>
            <span class="opp-level">Lv.{{ opp.level }}</span>
          </div>
          <div class="opp-bottom">
            <span class="opp-power">战力 {{ opp.power.toLocaleString() }}</span>
            <span class="opp-rating">积分 {{ opp.pvpRating }}</span>
          </div>
          <div class="opp-record">{{ opp.pvpWins }}胜 {{ opp.pvpLosses }}负</div>
        </div>
      </div>
    </div>

    <!-- 竞技排行 -->
    <div v-if="tab === 'ranking'" class="pvp-content">
      <div v-if="loadingRank" class="pvp-loading">加载中...</div>
      <div v-else class="rank-list">
        <div v-for="item in ranking" :key="item.username" class="rank-row"
          :class="{ self: item.username === currentUser }">
          <span class="rank-num">
            <span v-if="item.rank === 1">🥇</span>
            <span v-else-if="item.rank === 2">🥈</span>
            <span v-else-if="item.rank === 3">🥉</span>
            <span v-else>{{ item.rank }}</span>
          </span>
          <div class="rank-info">
            <div class="rank-name">
              {{ item.name }}
              <span v-if="item.username === currentUser" class="self-tag">你</span>
              <span v-if="item.godhood === 'god'" class="opp-tag god">神</span>
              <span v-else-if="item.godhood === 'demigod'" class="opp-tag demi">半神</span>
            </div>
            <div class="rank-sub">Lv.{{ item.level }} {{ item.race }} {{ item.job }}</div>
          </div>
          <div class="rank-stats">
            <div class="rank-rating">{{ item.rating }}</div>
            <div class="rank-wl">{{ item.wins }}胜 {{ item.losses }}负 ({{ item.winRate }}%)</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 战斗记录 -->
    <div v-if="tab === 'records'" class="pvp-content">
      <div v-if="loadingRec" class="pvp-loading">加载中...</div>
      <div v-else-if="records.length === 0" class="pvp-empty">暂无战斗记录</div>
      <div v-else class="rec-list">
        <div v-for="(rec, i) in records" :key="i" class="rec-row" :class="getRecResult(rec)">
          <span class="rec-result">{{ getRecResultText(rec) }}</span>
          <span class="rec-vs">{{ rec.attackerName }} vs {{ rec.defenderName }}</span>
          <span class="rec-change" :class="{ up: rec.ratingChange > 0, down: rec.ratingChange < 0 }">
            {{ rec.ratingChange > 0 ? '+' : '' }}{{ rec.ratingChange }}
          </span>
          <span class="rec-reward">{{ rec.rewards.gold }}金 {{ rec.rewards.exp }}exp</span>
        </div>
      </div>
    </div>

    <!-- 战斗回放弹窗 -->
    <div v-if="battleResult" class="battle-overlay" @click.self="battleResult = null">
      <div class="battle-modal">
        <div class="battle-result-banner" :class="{ win: battleResult.isWin, lose: !battleResult.isWin }">
          {{ battleResult.isWin ? '胜利!' : '失败...' }}
        </div>

        <div class="battle-info">
          <div class="battle-side">
            <div class="bs-name">{{ player.name }}</div>
            <div class="bs-hp">{{ battleResult.battle.myHp }} / {{ battleResult.battle.myMaxHp }}</div>
            <div class="bs-stats">ATK {{ battleResult.battle.myStats.atk }} DEF {{ battleResult.battle.myStats.def }}</div>
          </div>
          <div class="battle-vs">VS</div>
          <div class="battle-side">
            <div class="bs-name">{{ battleResult.battle.enemyName }}</div>
            <div class="bs-hp">{{ battleResult.battle.enemyHp }} / {{ battleResult.battle.enemyMaxHp }}</div>
            <div class="bs-stats">ATK {{ battleResult.battle.enemyStats.atk }} DEF {{ battleResult.battle.enemyStats.def }}</div>
          </div>
        </div>

        <div class="battle-rounds" ref="roundsBody">
          <div v-for="r in battleResult.battle.rounds" :key="r.round" class="round-block">
            <div class="round-header">回合 {{ r.round }}</div>
            <div v-for="(a, idx) in r.actions" :key="idx" class="action-row" :class="a.actor">
              <span class="action-actor">{{ a.actor === 'A' ? player.name : battleResult.battle.enemyName }}</span>
              <span v-if="a.damage" class="action-dmg" :class="{ crit: a.crit }">
                {{ a.skill }} -{{ a.damage }}{{ a.crit ? ' 暴击!' : '' }}
              </span>
              <span v-else-if="a.heal" class="action-heal">{{ a.skill }} +{{ a.heal }}</span>
              <span v-else-if="a.dodge" class="action-dodge">{{ a.skill }}</span>
              <span v-else-if="a.buff" class="action-buff">{{ a.skill }}</span>
              <span v-else-if="a.shield" class="action-shield">{{ a.skill }}</span>
              <span v-else-if="a.revive" class="action-revive">{{ a.skill }}</span>
            </div>
          </div>
        </div>

        <div class="battle-rewards">
          <div class="reward-item">💰 {{ battleResult.rewards.gold }}</div>
          <div class="reward-item">⭐ {{ battleResult.rewards.exp }}</div>
          <div class="reward-item" :class="{ up: battleResult.ratingChange > 0, down: battleResult.ratingChange < 0 }">
            积分 {{ battleResult.ratingChange > 0 ? '+' : '' }}{{ battleResult.ratingChange }}
          </div>
        </div>

        <button class="battle-close" @click="battleResult = null">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import api from '../api.js'

const props = defineProps(['player', 'currentUser'])
const emit = defineEmits(['goBack', 'updatePlayer'])

const tab = ref('opponents')
const loading = ref(false)
const loadingRank = ref(false)
const loadingRec = ref(false)
const opponents = ref([])
const ranking = ref([])
const records = ref([])
const battleResult = ref(null)

const myRating = ref(1000)
const myWins = ref(0)
const myLosses = ref(0)
const myStreak = ref(0)
const myBestStreak = ref(0)
const cdRemaining = ref(0)

let cdTimer = null

async function fetchOpponents() {
  loading.value = true
  try {
    const res = await api.getOpponents(props.currentUser)
    if (res.success) {
      opponents.value = res.data.opponents
      myRating.value = res.data.myRating
      myWins.value = res.data.myWins
      myLosses.value = res.data.myLosses
      myStreak.value = res.data.myStreak
      myBestStreak.value = res.data.myBestStreak
      cdRemaining.value = res.data.cdRemaining
      startCdTimer()
    }
  } catch (e) {
    console.error('获取对手失败', e)
  } finally {
    loading.value = false
  }
}

function startCdTimer() {
  if (cdTimer) clearInterval(cdTimer)
  if (cdRemaining.value <= 0) return
  cdTimer = setInterval(() => {
    cdRemaining.value -= 1000
    if (cdRemaining.value <= 0) {
      cdRemaining.value = 0
      clearInterval(cdTimer)
      cdTimer = null
    }
  }, 1000)
}

async function doChallenge(opp) {
  if (cdRemaining.value > 0) return
  loading.value = true
  try {
    const res = await api.challenge(props.currentUser, opp.username)
    if (res.success) {
      battleResult.value = res.data
      cdRemaining.value = 3 * 60 * 1000
      startCdTimer()
      myRating.value = res.data.newRating
      if (res.data.isWin) {
        myWins.value++
        myStreak.value++
      } else {
        myLosses.value++
        myStreak.value = 0
      }
      emit('updatePlayer', res.data.player)
      await nextTick()
      scrollRoundsToBottom()
    } else {
      alert(res.message)
    }
  } catch (e) {
    alert('挑战失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

function scrollRoundsToBottom() {
  const el = document.querySelector('.battle-rounds')
  if (el) el.scrollTop = el.scrollHeight
}

async function fetchRanking() {
  loadingRank.value = true
  try {
    const res = await api.getArenaRanking()
    if (res.success) ranking.value = res.data.list
  } catch (e) {
    console.error('获取排行失败', e)
  } finally {
    loadingRank.value = false
  }
}

async function fetchRecords() {
  loadingRec.value = true
  try {
    const res = await api.getArenaRecords(props.currentUser)
    if (res.success) records.value = res.data.records
  } catch (e) {
    console.error('获取记录失败', e)
  } finally {
    loadingRec.value = false
  }
}

function getRecResult(rec) {
  const isAttacker = rec.attacker === props.currentUser
  const won = isAttacker ? rec.result === 'win' : rec.result === 'lose'
  return won ? 'win' : 'lose'
}

function getRecResultText(rec) {
  const isAttacker = rec.attacker === props.currentUser
  const won = isAttacker ? rec.result === 'win' : rec.result === 'lose'
  return won ? '胜' : '负'
}

onMounted(() => {
  fetchOpponents()
})
</script>

<style scoped>
.pvp-view { padding: 12px; padding-bottom: calc(var(--tabbar-h) + 20px); }

.pvp-back { margin-bottom: 8px; }
.back-btn {
  background: var(--bg3); border: none; color: var(--accent);
  padding: 6px 14px; border-radius: var(--radius-sm);
  font-size: 0.85rem; cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out);
}
.back-btn:hover { background: var(--bg2); }

.pvp-header {
  background: var(--bg2); border-radius: var(--radius);
  padding: 16px; margin-bottom: 12px; text-align: center;
}
.pvp-card {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  margin-bottom: 12px;
}
.pvp-card-icon { font-size: 2rem; }
.pvp-card-label { color: var(--muted); font-size: 0.8rem; }
.pvp-card-value { font-size: 1.8rem; font-weight: 800; color: var(--accent); }

.pvp-stats-row {
  display: flex; justify-content: space-around;
  border-top: 1px solid var(--rule); padding-top: 10px;
}
.pvp-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.stat-label { color: var(--muted); font-size: 0.75rem; }
.stat-val { font-size: 1.1rem; font-weight: 700; color: var(--ink); }
.stat-val.win { color: var(--success); }
.stat-val.lose { color: var(--danger); }
.stat-val.streak { color: var(--accent2); }

.pvp-cd {
  margin-top: 8px; color: var(--danger); font-size: 0.85rem;
}

.pvp-tabs {
  display: flex; gap: 4px; margin-bottom: 12px;
  background: var(--bg2); border-radius: var(--radius-sm); padding: 3px;
}
.pvp-tab {
  flex: 1; background: transparent; border: none;
  color: var(--muted); padding: 8px; border-radius: var(--radius-sm);
  font-size: 0.85rem; cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}
.pvp-tab.active {
  background: var(--bg3); color: var(--accent); font-weight: 600;
}

.pvp-loading, .pvp-empty {
  text-align: center; color: var(--muted); padding: 40px 0; font-size: 0.9rem;
}

.opp-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.opp-card {
  background: var(--bg2); border-radius: var(--radius-sm);
  padding: 10px; cursor: pointer; border: 1px solid var(--rule);
  transition: all var(--duration-fast) var(--ease-out);
}
.opp-card:hover {
  border-color: var(--accent); transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.opp-top { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.opp-name { font-weight: 700; color: var(--ink); font-size: 0.9rem; }
.opp-tag { font-size: 0.65rem; padding: 1px 5px; border-radius: 8px; }
.opp-tag.god { background: rgba(212,175,94,0.15); color: var(--accent); }
.opp-tag.demi { background: rgba(157,140,240,0.15); color: var(--accent2); }
.opp-mid { display: flex; gap: 6px; font-size: 0.78rem; color: var(--muted); margin-bottom: 4px; }
.opp-bottom { display: flex; justify-content: space-between; font-size: 0.75rem; }
.opp-power { color: var(--accent2); }
.opp-rating { color: var(--accent); }
.opp-record { font-size: 0.7rem; color: var(--dim); margin-top: 2px; }

.rank-list { display: flex; flex-direction: column; gap: 4px; }
.rank-row {
  display: flex; align-items: center; gap: 10px;
  background: var(--lb-row-bg, rgba(20,22,42,0.4));
  border-radius: var(--radius-sm); padding: 10px;
  transition: background var(--duration-fast) var(--ease-out);
}
.rank-row:hover { background: var(--lb-row-hover, rgba(20,22,42,0.6)); }
.rank-row.self { box-shadow: 0 0 0 1px var(--accent2) inset; }
.rank-num { width: 28px; text-align: center; font-size: 1rem; }
.rank-info { flex: 1; }
.rank-name { font-weight: 600; color: var(--ink); font-size: 0.88rem; }
.rank-sub { color: var(--muted); font-size: 0.75rem; }
.self-tag { font-size: 0.7rem; color: var(--accent2); }
.rank-stats { text-align: right; }
.rank-rating { font-weight: 700; color: var(--accent); }
.rank-wl { font-size: 0.72rem; color: var(--muted); }

.rec-list { display: flex; flex-direction: column; gap: 4px; }
.rec-row {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg2); border-radius: var(--radius-sm);
  padding: 8px 10px; font-size: 0.82rem;
  border-left: 3px solid transparent;
}
.rec-row.win { border-left-color: var(--success); }
.rec-row.lose { border-left-color: var(--danger); }
.rec-result { font-weight: 700; width: 24px; }
.rec-result.win { color: var(--success); }
.rec-result.lose { color: var(--danger); }
.rec-vs { flex: 1; color: var(--ink); }
.rec-change { font-weight: 600; }
.rec-change.up { color: var(--success); }
.rec-change.down { color: var(--danger); }
.rec-reward { color: var(--muted); font-size: 0.75rem; }

/* 战斗回放弹窗 */
.battle-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.8);
  z-index: 100; display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
.battle-modal {
  background: var(--bg); border-radius: var(--radius);
  max-width: 480px; width: 100%; max-height: 85vh; overflow: hidden;
  display: flex; flex-direction: column;
  border: 1px solid var(--rule);
}
.battle-result-banner {
  text-align: center; font-size: 1.5rem; font-weight: 800;
  padding: 14px; border-radius: var(--radius) var(--radius) 0 0;
}
.battle-result-banner.win { background: rgba(94,218,122,0.12); color: var(--success); }
.battle-result-banner.lose { background: rgba(224,88,88,0.12); color: var(--danger); }

.battle-info {
  display: flex; justify-content: space-around; align-items: center;
  padding: 12px; border-bottom: 1px solid var(--rule);
}
.battle-side { text-align: center; }
.bs-name { font-weight: 700; color: var(--ink); font-size: 0.9rem; }
.bs-hp { color: var(--muted); font-size: 0.8rem; }
.bs-stats { color: var(--dim); font-size: 0.72rem; }
.battle-vs { color: var(--accent); font-weight: 800; font-size: 1rem; }

.battle-rounds {
  flex: 1; overflow-y: auto; padding: 8px 12px;
}
.round-block { margin-bottom: 8px; }
.round-header {
  color: var(--accent); font-size: 0.78rem; font-weight: 600;
  border-bottom: 1px solid var(--rule); padding-bottom: 2px; margin-bottom: 4px;
}
.action-row {
  display: flex; gap: 8px; padding: 3px 0;
  font-size: 0.82rem;
}
.action-row.A { color: var(--accent2); }
.action-row.B { color: var(--danger); }
.action-actor { font-weight: 600; min-width: 60px; }
.action-dmg { color: var(--danger); }
.action-dmg.crit { color: var(--accent); font-weight: 700; }
.action-heal { color: var(--success); }
.action-dodge { color: var(--muted); font-style: italic; }
.action-buff { color: var(--accent2); }
.action-shield { color: var(--accent); }
.action-revive { color: var(--success); font-weight: 600; }

.battle-rewards {
  display: flex; justify-content: space-around;
  padding: 10px; border-top: 1px solid var(--rule);
  background: var(--bg2);
}
.reward-item { font-size: 0.88rem; color: var(--ink); }
.reward-item.up { color: var(--success); }
.reward-item.down { color: var(--danger); }

.battle-close {
  margin: 10px auto 14px; display: block;
  background: var(--bg3); border: 1px solid var(--rule);
  color: var(--ink); padding: 8px 24px; border-radius: var(--radius-sm);
  cursor: pointer; font-size: 0.88rem;
  transition: background var(--duration-fast) var(--ease-out);
}
.battle-close:hover { background: var(--rule); }
</style>
