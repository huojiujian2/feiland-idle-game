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
            <span class="stat-chip">⚔ {{ boss.atk }}</span>
            <span class="stat-chip">🛡 {{ boss.def }}</span>
            <span class="stat-chip">⚡ {{ boss.agi }}</span>
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

      <!-- 攻击按钮 + 上次伤害 -->
      <div class="attack-section">
        <button class="btn btn-danger attack-btn" :class="{ 'btn-disabled': attackCdLeft > 0 }"
          @click="doAttack" :disabled="attackCdLeft > 0">
          {{ attackCdLeft > 0 ? `冷却中 ${attackCdLeft}s` : '⚔ 攻击 BOSS' }}
        </button>
        <div v-if="lastDamage" class="last-damage" :class="{ crit: lastIsCrit, kill: lastKilled }">
          {{ lastKilled ? '🎉 最后一击！' : (lastIsCrit ? '💥 暴击' : '✦ 命中') }}
          造成 {{ lastDamage.toLocaleString() }} 伤害
        </div>
      </div>
    </div>

    <div v-else class="card boss-empty">
      <p>当前没有可攻击的世界 BOSS</p>
      <button class="btn btn-sm" @click="forceSpawn">强制刷新（调试）</button>
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

const props = defineProps(['player', 'currentUser'])

const boss = ref(null)
const ranking = ref([])
const lastDamage = ref(0)
const lastIsCrit = ref(false)
const lastKilled = ref(false)
const attackCdLeft = ref(0)
let pollTimer = null
let cdTimer = null

const hpPercent = computed(() => boss.value ? Math.max(0, (boss.value.hp / boss.value.maxHp) * 100) : 0)
const myRank = computed(() => ranking.value.find(r => r.username === props.currentUser) || null)

async function refresh() {
  try {
    const res = await api.getWorldBoss()
    if (res.success) {
      boss.value = res.data.boss
      ranking.value = res.data.ranking || []
    }
  } catch (e) { /* ignore */ }
}

async function doAttack() {
  if (attackCdLeft.value > 0) return
  try {
    const res = await api.attackWorldBoss(props.currentUser)
    if (res.success) {
      lastDamage.value = res.damage
      lastIsCrit.value = res.isCrit
      lastKilled.value = res.killed
      attackCdLeft.value = 5
      cdTimer = setInterval(() => {
        if (attackCdLeft.value > 0) attackCdLeft.value--
        else clearInterval(cdTimer)
      }, 1000)
      // 1.5s 后清掉"命中"提示
      setTimeout(() => { if (!lastKilled.value) lastDamage.value = 0 }, 1800)
      if (res.killed) {
        // 击杀后 4s 自动拉新 BOSS
        setTimeout(refresh, 4000)
      } else {
        await refresh()
      }
    } else {
      alert(res.message)
    }
  } catch (e) {
    alert('攻击失败：' + e.message)
  }
}

async function forceSpawn() {
  await fetch('/api/worldboss/spawn', { method: 'POST' })
  await refresh()
}

onMounted(() => {
  refresh()
  pollTimer = setInterval(refresh, 5000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  if (cdTimer) clearInterval(cdTimer)
})
</script>

<style scoped>
.boss-view { display: flex; flex-direction: column; gap: 0.6rem; max-width: 560px; margin: 0 auto; }
.boss-card { padding: 1rem; background: linear-gradient(135deg, rgba(212,175,94,0.06), rgba(157,140,240,0.06)); }
.boss-header { display: flex; align-items: flex-start; gap: 0.8rem; }
.boss-portrait {
  width: 80px; height: 80px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, rgba(212,175,94,0.15), rgba(157,140,240,0.15));
  border: 1px solid var(--accent); flex-shrink: 0;
}
.boss-icon { color: var(--accent); }
.boss-info { flex: 1; }
.boss-name { font-size: 1.3rem; font-weight: 700; background: linear-gradient(135deg, var(--accent), var(--accent2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.boss-desc { font-size: 0.72rem; color: var(--muted); margin: 0.3rem 0; line-height: 1.4; }
.boss-stats { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.stat-chip { font-size: 0.7rem; color: var(--ink); background: rgba(20,22,42,0.5); padding: 0.1rem 0.4rem; border-radius: 4px; }
.hp-section { margin-top: 0.8rem; }
.hp-bar { width: 100%; height: 14px; background: rgba(20,22,42,0.6); border-radius: 7px; overflow: hidden; border: 1px solid var(--rule); }
.hp-bar-fill { height: 100%; background: linear-gradient(90deg, #e0bc6b, #c04545); transition: width 0.3s ease; }
.hp-text { display: flex; justify-content: space-between; margin-top: 0.3rem; font-size: 0.78rem; }
.hp-num { color: var(--ink); font-weight: 600; font-family: monospace; }
.hp-pct { color: var(--accent); font-weight: 700; }
.attack-section { margin-top: 0.8rem; }
.attack-btn { width: 100%; padding: 0.7rem; font-size: 1rem; font-weight: 700; }
.last-damage { margin-top: 0.4rem; text-align: center; padding: 0.3rem; font-size: 0.82rem; color: var(--success); background: rgba(94,218,122,0.1); border-radius: 6px; font-weight: 600; }
.last-damage.crit { color: var(--dmg-crit, #d4af5e); background: rgba(212,175,94,0.15); }
.last-damage.kill { color: #ff6b35; background: rgba(255,107,53,0.15); }
.boss-empty { text-align: center; padding: 2rem; color: var(--muted); }
.ranking-card { padding: 0.8rem; }
.my-rank { font-size: 0.78rem; color: var(--accent); font-weight: 600; }
.rank-list { display: flex; flex-direction: column; gap: 0.3rem; margin-top: 0.4rem; }
.rank-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.3rem 0.5rem; background: rgba(20,22,42,0.4); border-radius: 6px; border: 1px solid var(--rule); }
.rank-row.self { border-color: var(--accent); background: rgba(212,175,94,0.08); }
.rank-row.top1 { border-color: #d4af5e; }
.rank-row.top2 { border-color: #c0c0c0; }
.rank-row.top3 { border-color: #cd7f32; }
.rank-num { font-weight: 700; color: var(--accent); width: 24px; text-align: center; }
.rank-name { flex: 1; font-size: 0.85rem; }
.rank-dmg { font-family: monospace; color: var(--ink); font-weight: 600; }
.reward-card { padding: 0.8rem; }
.reward-list { display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.3rem; }
.reward-row { display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; color: var(--ink); padding: 0.15rem 0; }
.final-hit-reward { margin-top: 0.6rem; padding-top: 0.6rem; border-top: 1px solid rgba(212,175,94,0.3); }
.final-hit-title { font-size: 0.82rem; color: #d4af5e; font-weight: 700; margin-bottom: 0.3rem; }
</style>