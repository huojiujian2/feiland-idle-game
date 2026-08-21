<template>
  <div class="pvp-view">
    <!-- 顶部返回按钮 -->
    <div class="pvp-back">
      <button class="back-btn" @click="$emit('goBack')">‹ 返回地图</button>
    </div>

    <!-- PVP 数据概览 -->
    <div class="pvp-header">
      <div class="pvp-card-row">
        <div class="pvp-card">
          <div class="pvp-card-icon">⚔️</div>
          <div class="pvp-card-info">
            <div class="pvp-card-label">竞技积分</div>
            <div class="pvp-card-value">{{ myRating }}</div>
          </div>
        </div>
        <div class="pvp-card">
          <div class="pvp-card-icon">🪙</div>
          <div class="pvp-card-info">
            <div class="pvp-card-label">竞技币</div>
            <div class="pvp-card-value coins">{{ arenaCoins }}</div>
          </div>
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

    <!-- 赛季信息 -->
    <div v-if="season" class="season-bar">
      <span class="season-icon">🏆</span>
      <span class="season-label">赛季 {{ season.currentSeason }}</span>
      <span class="season-info">剩余 {{ season.daysLeft }} 天重置</span>
    </div>

    <!-- Tab 切换 -->
    <div class="pvp-tabs">
      <button class="pvp-tab" :class="{ active: tab === 'opponents' }" @click="switchTab('opponents')">对手</button>
      <button class="pvp-tab" :class="{ active: tab === 'ranking' }" @click="switchTab('ranking')">排行</button>
      <button class="pvp-tab" :class="{ active: tab === 'records' }" @click="switchTab('records')">记录</button>
      <button class="pvp-tab" :class="{ active: tab === 'shop' }" @click="switchTab('shop')">商店</button>
      <button class="pvp-tab" :class="{ active: tab === 'rewards' }" @click="switchTab('rewards')">奖励</button>
    </div>

    <!-- 对手列表 -->
    <div v-if="tab === 'opponents'" class="pvp-content">
      <div v-if="loading" class="pvp-loading">正在寻找对手...</div>
      <div v-else-if="opponents.length === 0" class="pvp-empty">暂无匹配的对手</div>
      <div v-else class="opp-grid">
        <div v-for="opp in opponents" :key="opp.username" class="opp-card" @click="doChallenge(opp)">
          <div class="opp-top">
            <span class="opp-name">{{ opp.name }}</span>
            <span v-if="opp.isBot" class="bot-tag">🤖 BOT</span>
            <span v-if="opp.godhood === 'god'" class="opp-tag god">神灵</span>
            <span v-else-if="opp.godhood === 'demigod'" class="opp-tag demi">半神</span>
          </div>
          <div class="opp-mid">
            <span class="opp-race">{{ opp.race }}</span>
            <span v-if="opp.job !== '无'" class="opp-job">{{ opp.job }}</span>
            <span class="opp-level">Lv.{{ opp.level }}</span>
          </div>
          <div class="opp-bottom">
            <span class="opp-power">战力 {{ opp.power ? opp.power.toLocaleString() : '?' }}</span>
            <span class="opp-rating">积分 {{ opp.pvpRating }}</span>
          </div>
          <div v-if="opp.isBot && opp.activeAffix" class="opp-skill">
            主动技: {{ opp.activeAffix }}
          </div>
          <div v-else-if="opp.isBot" class="opp-skill">
            被动 x{{ opp.passiveCount || 0 }}
          </div>
          <div v-else class="opp-record">{{ opp.pvpWins }}胜 {{ opp.pvpLosses }}负</div>
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
        <div v-if="ranking.length === 0" class="pvp-empty">暂无排行数据</div>
      </div>
    </div>

    <!-- 战斗记录 -->
    <div v-if="tab === 'records'" class="pvp-content">
      <div v-if="loadingRec" class="pvp-loading">加载中...</div>
      <div v-else-if="records.length === 0" class="pvp-empty">暂无战斗记录</div>
      <div v-else class="rec-list">
        <div v-for="(rec, i) in records" :key="i" class="rec-row" :class="getRecResult(rec)">
          <span class="rec-result">{{ getRecResultText(rec) }}</span>
          <span class="rec-vs">
            {{ rec.attackerName }} vs {{ rec.defenderName }}
            <span v-if="rec.isBot" class="bot-tag-small">BOT</span>
          </span>
          <span class="rec-change" :class="{ up: rec.ratingChange > 0, down: rec.ratingChange < 0 }">
            {{ rec.ratingChange > 0 ? '+' : '' }}{{ rec.ratingChange }}
          </span>
          <span v-if="rec.rewards" class="rec-reward">+{{ rec.rewards.coins || 0 }}币</span>
        </div>
      </div>
    </div>

    <!-- 竞技商店 -->
    <div v-if="tab === 'shop'" class="pvp-content">
      <div v-if="loadingShop" class="pvp-loading">加载中...</div>
      <div v-else class="shop-list">
        <div v-for="item in shopItems" :key="item.id" class="shop-card" :class="{ locked: !canBuyItem(item) }">
          <div class="shop-top">
            <span class="shop-name">{{ item.name }}</span>
            <span class="shop-quality legend">传说</span>
          </div>
          <div class="shop-stats">
            <span class="shop-slot">{{ slotLabel(item.slot) }}</span>
            <span class="shop-req">需 Lv.{{ item.reqLevel }}</span>
          </div>
          <div class="shop-bonuses">
            <span v-for="(v, k) in item.stats" :key="k" class="shop-bonus">
              {{ statLabel(k) }} +{{ formatStat(k, v) }}
            </span>
          </div>
          <div class="shop-bottom">
            <span class="shop-price">🪙 {{ item.price }}</span>
            <button class="shop-buy-btn" :disabled="!canBuyItem(item)" @click="doBuy(item)">
              {{ buyBtnText(item) }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 赛季奖励 -->
    <div v-if="tab === 'rewards'" class="pvp-content">
      <div class="reward-period-tabs">
        <button class="period-tab" :class="{ active: rewardPeriod === 'daily' }" @click="rewardPeriod = 'daily'">日结</button>
        <button class="period-tab" :class="{ active: rewardPeriod === 'weekly' }" @click="rewardPeriod = 'weekly'">周结</button>
        <button class="period-tab" :class="{ active: rewardPeriod === 'monthly' }" @click="rewardPeriod = 'monthly'">月结</button>
      </div>

      <div v-if="loadingRewards" class="pvp-loading">加载中...</div>
      <div v-else class="reward-content">
        <!-- 奖励规则 -->
        <div class="reward-rules">
          <div class="reward-rule-title">奖励规则 · 1-100 名按积分快照发奖</div>
          <div class="reward-tier-list">
            <div class="reward-tier S"><span class="t">S</span><span class="r">第 1 名</span><span class="c">{{ rewardConfig[rewardPeriod][0].coins }}币</span></div>
            <div class="reward-tier A"><span class="t">A</span><span class="r">第 2-3 名</span><span class="c">{{ rewardConfig[rewardPeriod][1].coins }}币</span></div>
            <div class="reward-tier B"><span class="t">B</span><span class="r">第 4-10 名</span><span class="c">{{ rewardConfig[rewardPeriod][2].coins }}币</span></div>
            <div class="reward-tier C"><span class="t">C</span><span class="r">第 11-20 名</span><span class="c">{{ rewardConfig[rewardPeriod][3].coins }}币</span></div>
            <div class="reward-tier D"><span class="t">D</span><span class="r">第 21-50 名</span><span class="c">{{ rewardConfig[rewardPeriod][4].coins }}币</span></div>
            <div class="reward-tier E"><span class="t">E</span><span class="r">第 51-100 名</span><span class="c">{{ rewardConfig[rewardPeriod][5].coins }}币</span></div>
          </div>
        </div>

        <!-- 我的当前排名奖励 -->
        <div v-if="rewardData && rewardData.myReward" class="my-reward-box">
          <div class="my-reward-title">你当前可能获得</div>
          <div class="my-reward-row">
            <span class="my-tier" :class="rewardData.myReward.tier">{{ rewardData.myReward.tier }} 级</span>
            <span class="my-rank">当前排名第 {{ rewardData.myReward.rank }} 名</span>
            <span class="my-coins">+{{ rewardData.myReward.coins }} 竞技币</span>
          </div>
        </div>
        <div v-else-if="rewardData && !rewardData.myReward" class="my-reward-box none">
          当前周期排名 100+，无奖励
        </div>

        <!-- 当前周期状态 -->
        <div class="reward-status">
          <span v-if="rewardData && rewardData.settled" class="settled-yes">本周期已结算</span>
          <span v-else class="settled-no">本周期未结算</span>
          <button v-if="!rewardData || !rewardData.settled" class="settle-btn" @click="doSettle">手动结算本周期</button>
        </div>

        <!-- 排行榜（用于了解自己位置） -->
        <div v-if="rewardData && rewardData.ranking.length > 0" class="reward-ranking-mini">
          <div class="ranking-mini-title">当前积分榜 Top {{ Math.min(rewardData.ranking.length, 20) }}</div>
          <div v-for="item in rewardData.ranking.slice(0, 20)" :key="item.username" class="rm-row"
               :class="{ self: item.username === currentUser }">
            <span class="rm-rank">{{ item.rank }}</span>
            <span class="rm-name">{{ item.username === currentUser ? '你' : item.username }}</span>
            <span class="rm-rating">{{ item.rating }}</span>
          </div>
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
            <div class="bs-name">{{ battleResult.targetName }}</div>
            <div class="bs-hp">{{ battleResult.battle.enemyHp }} / {{ battleResult.battle.enemyMaxHp }}</div>
            <div class="bs-stats">ATK {{ battleResult.battle.enemyStats.atk }} DEF {{ battleResult.battle.enemyStats.def }}</div>
          </div>
        </div>

        <div class="battle-rounds" ref="roundsBody">
          <div v-for="r in battleResult.battle.rounds" :key="r.round" class="round-block">
            <div class="round-header">回合 {{ r.round }}</div>
            <div v-for="(a, idx) in r.actions" :key="idx" class="action-row" :class="a.actor">
              <span class="action-actor">{{ a.actor === 'A' ? player.name : battleResult.targetName }}</span>
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
          <div class="reward-item">🪙 {{ battleResult.rewards.coins || 0 }}</div>
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
import { ref, onMounted, nextTick, watch } from 'vue'
import api from '../api.js'

const props = defineProps(['player', 'currentUser'])
const emit = defineEmits(['goBack', 'updatePlayer'])

const tab = ref('opponents')
const loading = ref(false)
const loadingRank = ref(false)
const loadingRec = ref(false)
const loadingShop = ref(false)
const loadingRewards = ref(false)

const opponents = ref([])
const ranking = ref([])
const records = ref([])
const shopItems = ref([])
const battleResult = ref(null)
const season = ref(null)
const rewardData = ref(null)
const rewardPeriod = ref('daily')

const myRating = ref(1000)
const myWins = ref(0)
const myLosses = ref(0)
const myStreak = ref(0)
const myBestStreak = ref(0)
const arenaCoins = ref(0)
const cdRemaining = ref(0)

// 奖励配置（与后端 ARENA_RANK_REWARDS 保持一致）
const rewardConfig = {
  daily: [
    { tier: 'S', coins: 300 },
    { tier: 'A', coins: 200 },
    { tier: 'B', coins: 100 },
    { tier: 'C', coins: 50 },
    { tier: 'D', coins: 30 },
    { tier: 'E', coins: 15 }
  ],
  weekly: [
    { tier: 'S', coins: 1500 },
    { tier: 'A', coins: 1000 },
    { tier: 'B', coins: 500 },
    { tier: 'C', coins: 250 },
    { tier: 'D', coins: 100 },
    { tier: 'E', coins: 50 }
  ],
  monthly: [
    { tier: 'S', coins: 6000 },
    { tier: 'A', coins: 4000 },
    { tier: 'B', coins: 2000 },
    { tier: 'C', coins: 1000 },
    { tier: 'D', coins: 500 },
    { tier: 'E', coins: 200 }
  ]
}

const statLabels = {
  atk: '攻击', def: '防御', hp: 'HP', mp: 'MP', agi: '敏捷',
  str: '力量', con: '体质', spi: '精神',
  crit: '暴击率', critDmg: '暴击伤害', dodge: '闪避率',
  lifesteal: '吸血', thorns: '反伤',
  dmgTaken: '减伤', ignoreDef: '破防', shieldRegen: '护盾回复',
  lowHpAtk: '低血增伤', lowHpDef: '低血减伤', dodgeAtk: '闪避反击',
  killExp: '击杀经验', killGold: '击杀金币', firstTurnAgi: '先手加速',
  stackAtk: '叠加攻击', consumeCut: '消耗降低', weakAtk: '对弱增伤',
  exp: '经验', gold: '金币', mpRegen: '法力回复'
}

function statLabel(key) { return statLabels[key] || key }

function formatStat(key, v) {
  if (typeof v !== 'number') return v
  // 百分比类 stat
  const pctKeys = ['crit', 'dodge', 'lifesteal', 'thorns', 'dmgTaken', 'ignoreDef',
                   'shieldRegen', 'lowHpAtk', 'lowHpDef', 'dodgeAtk', 'killExp',
                   'killGold', 'firstTurnAgi', 'stackAtk', 'consumeCut', 'weakAtk',
                   'exp', 'gold', 'mpRegen', 'critDmg']
  if (pctKeys.includes(key)) {
    return Math.round(v * 100) + '%'
  }
  return v.toLocaleString()
}

const slotLabels = { weapon: '武器', armor: '护甲', accessory: '饰品' }
function slotLabel(s) { return slotLabels[s] || s }

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
      arenaCoins.value = res.data.arenaCoins || 0
      cdRemaining.value = res.data.cdRemaining
      startCdTimer()
    }
  } catch (e) {
    console.error('获取对手失败', e)
  } finally {
    loading.value = false
  }
}

async function fetchSeason() {
  try {
    const res = await api.getArenaSeason(props.currentUser)
    if (res.success) season.value = res.data
  } catch (e) {
    console.error('获取赛季失败', e)
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
    const res = await api.challenge(props.currentUser, opp.username, !!opp.isBot)
    if (res.success) {
      battleResult.value = res.data
      cdRemaining.value = 3 * 60 * 1000
      startCdTimer()
      myRating.value = res.data.newRating
      arenaCoins.value = res.data.arenaCoins
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
      // 刷新记录（如果有 Bot 模式）
      if (opp.isBot) fetchRecords()
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

async function fetchShop() {
  loadingShop.value = true
  try {
    const res = await api.getArenaShop()
    if (res.success) shopItems.value = res.data.items
  } catch (e) {
    console.error('获取商店失败', e)
  } finally {
    loadingShop.value = false
  }
}

async function fetchRewards() {
  loadingRewards.value = true
  try {
    const res = await api.getArenaRewards(rewardPeriod.value, props.currentUser)
    if (res.success) rewardData.value = res.data
  } catch (e) {
    console.error('获取奖励失败', e)
  } finally {
    loadingRewards.value = false
  }
}

async function doSettle() {
  if (!confirm('确认手动结算本周期奖励？每周期只能结算一次')) return
  loadingRewards.value = true
  try {
    const res = await api.settleArena(rewardPeriod.value)
    if (res.success) {
      alert(res.data.already ? '本周期已结算' : `结算完成，奖励了 ${res.data.creditedCount || 0} 人`)
      await fetchRewards()
      await fetchOpponents() // 刷新竞技币
    } else {
      alert(res.message)
    }
  } catch (e) {
    alert('结算失败: ' + e.message)
  } finally {
    loadingRewards.value = false
  }
}

function canBuyItem(item) {
  const lv = props.player?.level || 1
  return lv >= item.reqLevel && arenaCoins.value >= item.price
}

function buyBtnText(item) {
  const lv = props.player?.level || 1
  if (lv < item.reqLevel) return `需 Lv.${item.reqLevel}`
  if (arenaCoins.value < item.price) return '竞技币不足'
  return '购买'
}

async function doBuy(item) {
  if (!canBuyItem(item)) return
  if (!confirm(`确认使用 ${item.price} 竞技币购买 ${item.name}？`)) return
  try {
    const res = await api.buyArenaItem(props.currentUser, item.id)
    if (res.success) {
      arenaCoins.value = res.data.arenaCoins
      alert(`购买成功: ${item.name} 已加入背包`)
      emit('updatePlayer', res.data.player)
    } else {
      alert(res.message)
    }
  } catch (e) {
    alert('购买失败: ' + e.message)
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

function switchTab(t) {
  tab.value = t
  if (t === 'opponents') fetchOpponents()
  else if (t === 'ranking') fetchRanking()
  else if (t === 'records') fetchRecords()
  else if (t === 'shop') fetchShop()
  else if (t === 'rewards') fetchRewards()
}

onMounted(() => {
  fetchOpponents()
  fetchSeason()
})

watch(rewardPeriod, () => {
  if (tab.value === 'rewards') fetchRewards()
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
  padding: 12px; margin-bottom: 8px;
}
.pvp-card-row {
  display: flex; gap: 8px; margin-bottom: 10px;
}
.pvp-card {
  flex: 1; display: flex; align-items: center; gap: 8px;
  background: var(--bg3); padding: 8px 12px; border-radius: var(--radius-sm);
}
.pvp-card-icon { font-size: 1.4rem; }
.pvp-card-label { color: var(--muted); font-size: 0.7rem; }
.pvp-card-value { font-size: 1.2rem; font-weight: 800; color: var(--accent); }
.pvp-card-value.coins { color: var(--success); }

.pvp-stats-row {
  display: flex; justify-content: space-around;
  border-top: 1px solid var(--rule); padding-top: 8px;
}
.pvp-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.stat-label { color: var(--muted); font-size: 0.7rem; }
.stat-val { font-size: 0.95rem; font-weight: 700; color: var(--ink); }
.stat-val.win { color: var(--success); }
.stat-val.lose { color: var(--danger); }
.stat-val.streak { color: var(--accent2); }

.pvp-cd { margin-top: 6px; color: var(--danger); font-size: 0.8rem; text-align: center; }

.season-bar {
  background: linear-gradient(135deg, rgba(212,175,94,0.15), rgba(157,140,240,0.15));
  padding: 6px 12px; border-radius: var(--radius-sm);
  display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
  font-size: 0.8rem;
}
.season-icon { font-size: 1rem; }
.season-label { color: var(--accent); font-weight: 700; }
.season-info { color: var(--muted); margin-left: auto; }

.pvp-tabs {
  display: flex; gap: 3px; margin-bottom: 10px;
  background: var(--bg2); border-radius: var(--radius-sm); padding: 3px;
}
.pvp-tab {
  flex: 1; background: transparent; border: none;
  color: var(--muted); padding: 7px 2px; border-radius: var(--radius-sm);
  font-size: 0.78rem; cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}
.pvp-tab.active {
  background: var(--bg3); color: var(--accent); font-weight: 600;
}

.pvp-loading, .pvp-empty {
  text-align: center; color: var(--muted); padding: 40px 0; font-size: 0.9rem;
}

/* 对手 */
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
.opp-top { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap; }
.opp-name { font-weight: 700; color: var(--ink); font-size: 0.88rem; }
.bot-tag {
  font-size: 0.65rem; padding: 1px 5px; border-radius: 8px;
  background: rgba(157,140,240,0.2); color: var(--accent2);
}
.bot-tag-small {
  font-size: 0.6rem; padding: 0 4px; border-radius: 6px;
  background: rgba(157,140,240,0.2); color: var(--accent2);
  margin-left: 4px;
}
.opp-tag { font-size: 0.65rem; padding: 1px 5px; border-radius: 8px; }
.opp-tag.god { background: rgba(212,175,94,0.15); color: var(--accent); }
.opp-tag.demi { background: rgba(157,140,240,0.15); color: var(--accent2); }
.opp-mid { display: flex; gap: 6px; font-size: 0.74rem; color: var(--muted); margin-bottom: 4px; }
.opp-bottom { display: flex; justify-content: space-between; font-size: 0.72rem; }
.opp-power { color: var(--accent2); }
.opp-rating { color: var(--accent); }
.opp-record, .opp-skill { font-size: 0.7rem; color: var(--dim); margin-top: 2px; }

/* 排行 */
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
.rank-name { font-weight: 600; color: var(--ink); font-size: 0.85rem; }
.rank-sub { color: var(--muted); font-size: 0.72rem; }
.self-tag { font-size: 0.65rem; color: var(--accent2); }
.rank-stats { text-align: right; }
.rank-rating { font-weight: 700; color: var(--accent); }
.rank-wl { font-size: 0.7rem; color: var(--muted); }

/* 记录 */
.rec-list { display: flex; flex-direction: column; gap: 4px; }
.rec-row {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg2); border-radius: var(--radius-sm);
  padding: 8px 10px; font-size: 0.8rem;
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
.rec-reward { color: var(--success); font-size: 0.72rem; }

/* 商店 */
.shop-list { display: flex; flex-direction: column; gap: 8px; }
.shop-card {
  background: var(--bg2); border-radius: var(--radius-sm);
  padding: 10px 12px; border-left: 3px solid var(--accent);
}
.shop-card.locked { border-left-color: var(--dim); opacity: 0.7; }
.shop-top { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.shop-name { font-weight: 700; color: var(--accent); font-size: 0.92rem; }
.shop-quality.legend {
  font-size: 0.65rem; padding: 1px 6px; border-radius: 8px;
  background: rgba(212,175,94,0.15); color: var(--accent);
}
.shop-stats { display: flex; gap: 8px; font-size: 0.72rem; color: var(--muted); margin-bottom: 6px; }
.shop-bonuses { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.shop-bonus {
  background: var(--bg3); padding: 2px 6px; border-radius: 4px;
  font-size: 0.72rem; color: var(--success);
}
.shop-bottom { display: flex; justify-content: space-between; align-items: center; }
.shop-price { color: var(--success); font-weight: 700; font-size: 0.95rem; }
.shop-buy-btn {
  background: var(--accent); color: var(--bg);
  border: none; padding: 5px 12px; border-radius: var(--radius-sm);
  font-weight: 600; cursor: pointer; font-size: 0.82rem;
  transition: background var(--duration-fast) var(--ease-out);
}
.shop-buy-btn:disabled {
  background: var(--bg3); color: var(--muted); cursor: not-allowed;
}
.shop-buy-btn:hover:not(:disabled) { background: var(--accent-dim); }

/* 奖励 */
.reward-period-tabs {
  display: flex; gap: 3px; margin-bottom: 12px;
  background: var(--bg2); border-radius: var(--radius-sm); padding: 3px;
}
.period-tab {
  flex: 1; background: transparent; border: none;
  color: var(--muted); padding: 7px; border-radius: var(--radius-sm);
  font-size: 0.82rem; cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}
.period-tab.active { background: var(--bg3); color: var(--accent); font-weight: 600; }

.reward-rules {
  background: var(--bg2); border-radius: var(--radius-sm);
  padding: 10px; margin-bottom: 10px;
}
.reward-rule-title {
  font-size: 0.78rem; color: var(--muted); margin-bottom: 8px;
}
.reward-tier-list { display: flex; flex-direction: column; gap: 4px; }
.reward-tier {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg3); padding: 5px 10px; border-radius: var(--radius-sm);
  font-size: 0.78rem;
}
.reward-tier .t {
  width: 24px; text-align: center; font-weight: 800; font-size: 0.95rem;
}
.reward-tier .r { flex: 1; }
.reward-tier .c { color: var(--success); font-weight: 700; }
.reward-tier.S .t { color: var(--accent); }
.reward-tier.A .t { color: #b88aff; }
.reward-tier.B .t { color: var(--accent2); }
.reward-tier.C .t { color: #6dc3ff; }
.reward-tier.D .t { color: var(--muted); }
.reward-tier.E .t { color: var(--dim); }

.my-reward-box {
  background: linear-gradient(135deg, rgba(94,218,122,0.12), rgba(212,175,94,0.12));
  border-radius: var(--radius-sm); padding: 12px; margin-bottom: 10px;
  border: 1px solid var(--success);
}
.my-reward-box.none {
  background: var(--bg2); border-color: var(--rule);
  text-align: center; color: var(--muted); font-size: 0.85rem;
}
.my-reward-title { font-size: 0.75rem; color: var(--muted); margin-bottom: 6px; }
.my-reward-row { display: flex; align-items: center; gap: 10px; }
.my-tier {
  font-weight: 800; font-size: 1.1rem;
  padding: 2px 10px; border-radius: 8px; background: rgba(212,175,94,0.15); color: var(--accent);
}
.my-tier.A { background: rgba(184,138,255,0.15); color: #b88aff; }
.my-tier.B { background: rgba(157,140,240,0.15); color: var(--accent2); }
.my-tier.C { background: rgba(109,195,255,0.15); color: #6dc3ff; }
.my-tier.D { background: rgba(157,155,184,0.15); color: var(--muted); }
.my-tier.E { background: rgba(109,107,138,0.15); color: var(--dim); }
.my-rank { flex: 1; font-size: 0.85rem; color: var(--ink); }
.my-coins { color: var(--success); font-weight: 700; font-size: 0.95rem; }

.reward-status {
  display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
  padding: 6px 10px; background: var(--bg2); border-radius: var(--radius-sm);
  font-size: 0.8rem;
}
.settled-yes { color: var(--success); flex: 1; }
.settled-no { color: var(--accent); flex: 1; }
.settle-btn {
  background: var(--accent); color: var(--bg);
  border: none; padding: 4px 10px; border-radius: var(--radius-sm);
  font-weight: 600; cursor: pointer; font-size: 0.78rem;
}
.settle-btn:hover { background: var(--accent-dim); }

.reward-ranking-mini {
  background: var(--bg2); border-radius: var(--radius-sm); padding: 8px;
}
.ranking-mini-title { font-size: 0.78rem; color: var(--muted); margin-bottom: 6px; }
.rm-row {
  display: flex; gap: 8px; padding: 4px 6px; font-size: 0.78rem;
  border-bottom: 1px solid var(--rule);
}
.rm-row.self { background: rgba(157,140,240,0.1); }
.rm-row:last-child { border-bottom: none; }
.rm-rank { width: 28px; color: var(--muted); }
.rm-name { flex: 1; color: var(--ink); }
.rm-rating { color: var(--accent); font-weight: 600; }

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
  padding: 12px;
}
.battle-result-banner.win { background: rgba(94,218,122,0.12); color: var(--success); }
.battle-result-banner.lose { background: rgba(224,88,88,0.12); color: var(--danger); }

.battle-info {
  display: flex; justify-content: space-around; align-items: center;
  padding: 10px; border-bottom: 1px solid var(--rule);
}
.battle-side { text-align: center; }
.bs-name { font-weight: 700; color: var(--ink); font-size: 0.88rem; }
.bs-hp { color: var(--muted); font-size: 0.78rem; }
.bs-stats { color: var(--dim); font-size: 0.7rem; }
.battle-vs { color: var(--accent); font-weight: 800; font-size: 1rem; }

.battle-rounds { flex: 1; overflow-y: auto; padding: 6px 10px; }
.round-block { margin-bottom: 6px; }
.round-header {
  color: var(--accent); font-size: 0.76rem; font-weight: 600;
  border-bottom: 1px solid var(--rule); padding-bottom: 2px; margin-bottom: 3px;
}
.action-row { display: flex; gap: 6px; padding: 2px 0; font-size: 0.8rem; }
.action-row.A { color: var(--accent2); }
.action-row.B { color: var(--danger); }
.action-actor { font-weight: 600; min-width: 50px; font-size: 0.75rem; }
.action-dmg { color: var(--danger); }
.action-dmg.crit { color: var(--accent); font-weight: 700; }
.action-heal { color: var(--success); }
.action-dodge { color: var(--muted); font-style: italic; }
.action-buff { color: var(--accent2); }
.action-shield { color: var(--accent); }
.action-revive { color: var(--success); font-weight: 600; }

.battle-rewards {
  display: flex; justify-content: space-around;
  padding: 8px; border-top: 1px solid var(--rule);
  background: var(--bg2); font-size: 0.82rem;
}
.reward-item { color: var(--ink); }
.reward-item.up { color: var(--success); }
.reward-item.down { color: var(--danger); }

.battle-close {
  margin: 8px auto 12px; display: block;
  background: var(--bg3); border: 1px solid var(--rule);
  color: var(--ink); padding: 6px 20px; border-radius: var(--radius-sm);
  cursor: pointer; font-size: 0.85rem;
  transition: background var(--duration-fast) var(--ease-out);
}
.battle-close:hover { background: var(--rule); }
</style>