<template>
  <div class="pvp-content">
    <!-- 周期切换 -->
    <div class="reward-period-tabs">
      <button class="period-tab" :class="{ active: rewardPeriod === 'daily' }" @click="$emit('update:period', 'daily')">日结</button>
      <button class="period-tab" :class="{ active: rewardPeriod === 'weekly' }" @click="$emit('update:period', 'weekly')">周结</button>
      <button class="period-tab" :class="{ active: rewardPeriod === 'monthly' }" @click="$emit('update:period', 'monthly')">月结</button>
    </div>

    <div v-if="loading" class="pvp-loading">加载中...</div>
    <div v-else class="reward-content">
      <!-- 奖励规则 -->
      <div class="reward-rules">
        <div class="reward-rule-title">奖励规则 · 1-100 名按积分快照发奖</div>
        <div class="reward-tier-list">
          <div v-for="tier in currentRule" :key="tier.tier" class="reward-tier" :class="tier.tier">
            <span class="t">{{ tier.tier }}</span>
            <span class="r">{{ tier.range }}</span>
            <span class="c">{{ tier.coins }}币</span>
          </div>
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
</template>

<script setup>
// ====== PvP 赛季奖励 Tab ======
// @file components/pvp/PvPRewards
// @module pvp-rewards
// @description 展示日/周/月结算奖励规则和当前可获奖金
import { computed } from 'vue';

const props = defineProps({
  loading: { type: Boolean, default: false },
  rewardData: { type: Object, default: null },
  rewardPeriod: { type: String, default: 'daily' },
  currentUser: { type: String, default: '' },
});
defineEmits(['update:period']);

// 奖励规则（与后端 ARENA_RANK_REWARDS 保持一致）
const rules = {
  daily: [
    { tier: 'S', range: '第 1 名',     coins: 300 },
    { tier: 'A', range: '第 2-3 名',   coins: 200 },
    { tier: 'B', range: '第 4-10 名',  coins: 100 },
    { tier: 'C', range: '第 11-20 名', coins: 50 },
    { tier: 'D', range: '第 21-50 名', coins: 30 },
    { tier: 'E', range: '第 51-100 名', coins: 15 },
  ],
  weekly: [
    { tier: 'S', range: '第 1 名',     coins: 1500 },
    { tier: 'A', range: '第 2-3 名',   coins: 1000 },
    { tier: 'B', range: '第 4-10 名',  coins: 500 },
    { tier: 'C', range: '第 11-20 名', coins: 250 },
    { tier: 'D', range: '第 21-50 名', coins: 100 },
    { tier: 'E', range: '第 51-100 名', coins: 50 },
  ],
  monthly: [
    { tier: 'S', range: '第 1 名',     coins: 6000 },
    { tier: 'A', range: '第 2-3 名',   coins: 4000 },
    { tier: 'B', range: '第 4-10 名',  coins: 2000 },
    { tier: 'C', range: '第 11-20 名', coins: 1000 },
    { tier: 'D', range: '第 21-50 名', coins: 500 },
    { tier: 'E', range: '第 51-100 名', coins: 200 },
  ],
};
const currentRule = computed(() => rules[props.rewardPeriod] || rules.daily);
</script>

<style scoped>
.pvp-content { padding: 0.6rem 0.8rem; }
.pvp-loading { text-align: center; color: var(--dim); padding: 1.5rem; font-style: italic; }

.reward-period-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.3rem; margin-bottom: 0.6rem; }
.period-tab { padding: 0.4rem; background: rgba(var(--panel-rgb),0.5); border: 1px solid var(--rule); border-radius: 6px; color: var(--muted); cursor: pointer; font-family: inherit; font-size: 0.78rem; }
.period-tab.active { background: rgba(var(--gold-rgb),0.15); border-color: var(--accent); color: var(--accent); font-weight: 700; }

.reward-rules { padding: 0.5rem; background: rgba(var(--panel-rgb),0.4); border-radius: 6px; margin-bottom: 0.6rem; }
.reward-rule-title { font-size: 0.78rem; font-weight: 700; color: var(--accent2); margin-bottom: 0.4rem; }
.reward-tier-list { display: flex; flex-direction: column; gap: 0.2rem; }
.reward-tier { display: grid; grid-template-columns: 1.5rem 1fr auto; align-items: center; gap: 0.4rem; padding: 0.25rem 0.5rem; background: rgba(var(--panel-rgb),0.5); border-radius: 4px; font-size: 0.72rem; }
.reward-tier .t { font-weight: 800; text-align: center; padding: 0.05rem 0.2rem; border-radius: 3px; }
.reward-tier.S .t { background: var(--accent); color: var(--bg); }
.reward-tier.A .t { background: #ffd700; color: var(--bg); }
.reward-tier.B .t { background: var(--accent2); color: var(--bg); }
.reward-tier.C .t { background: var(--success); color: var(--bg); }
.reward-tier.D .t { background: #5eda7a; color: var(--bg); }
.reward-tier.E .t { background: var(--muted); color: var(--bg); }
.reward-tier .r { color: var(--text); }
.reward-tier .c { color: var(--accent); font-family: monospace; font-weight: 700; }

.my-reward-box { padding: 0.6rem; background: rgba(var(--gold-rgb),0.1); border: 1px solid var(--accent); border-radius: 6px; margin-bottom: 0.6rem; }
.my-reward-box.none { background: rgba(var(--panel-rgb),0.5); border-color: var(--rule); text-align: center; color: var(--dim); font-size: 0.8rem; }
.my-reward-title { font-size: 0.78rem; font-weight: 700; color: var(--accent); margin-bottom: 0.3rem; }
.my-reward-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.my-tier { font-size: 1.2rem; font-weight: 800; padding: 0.1rem 0.5rem; border-radius: 4px; color: var(--bg); }
.my-tier.S { background: var(--accent); }
.my-tier.A { background: #ffd700; }
.my-tier.B { background: var(--accent2); }
.my-tier.C { background: var(--success); }
.my-tier.D { background: #5eda7a; }
.my-tier.E { background: var(--muted); color: var(--text); }
.my-rank { font-size: 0.8rem; color: var(--text); font-weight: 600; }
.my-coins { font-size: 0.85rem; color: var(--accent); font-weight: 800; margin-left: auto; }

.reward-ranking-mini { padding: 0.5rem; background: rgba(var(--panel-rgb),0.4); border-radius: 6px; }
.ranking-mini-title { font-size: 0.78rem; font-weight: 700; color: var(--accent2); margin-bottom: 0.3rem; }
.rm-row { display: grid; grid-template-columns: 2.5rem 1fr auto; gap: 0.4rem; padding: 0.2rem 0.5rem; font-size: 0.72rem; border-radius: 3px; }
.rm-row.self { background: rgba(var(--gold-rgb),0.1); }
.rm-rank { font-family: monospace; color: var(--muted); }
.rm-name { color: var(--text); }
.rm-row.self .rm-name { color: var(--accent); font-weight: 700; }
.rm-rating { font-family: monospace; color: var(--accent2); font-weight: 700; }
</style>
