<template>
  <div class="pvp-view">
    <!-- 头部（数据概览 + 赛季 + Tabs） -->
    <PvPHeader
      :myRating="myRating" :arenaCoins="arenaCoins"
      :myWins="myWins" :myLosses="myLosses"
      :myStreak="myStreak" :myBestStreak="myBestStreak"
      :cdRemaining="cdRemaining"
      :season="season"
      :tab="tab"
      @goBack="$emit('goBack')"
      @tab="switchTab"
    />

    <!-- 各 Tab 内容 -->
    <PvPOpponents v-if="tab === 'opponents'" :loading="loading" :opponents="opponents" @challenge="doChallenge" />
    <PvPRanking v-if="tab === 'ranking'" :loading="loadingRank" :ranking="ranking" :currentUser="currentUser" />
    <PvPRecords v-if="tab === 'records'" :loading="loadingRec" :records="records" />
    <PvPShop v-if="tab === 'shop'" :loading="loadingShop" :shopItems="shopItems" :shopTitles="shopTitles"
      :playerLevel="player.level" :arenaCoins="arenaCoins" @buy="doBuy" />
    <PvPRewards v-if="tab === 'rewards'" :loading="loadingRewards"
      :rewardData="rewardData" :rewardPeriod="rewardPeriod" :currentUser="currentUser"
      @update:period="rewardPeriod = $event" />

    <!-- 战斗回放弹窗 -->
    <PvPBattleReplay :battleResult="battleResult" :playerName="player.name" @close="battleResult = null" />
  </div>
</template>

<script setup>
// ====== PvP 主容器 ======
// @file components/PvPView
// @module pvp-view
// @description PvP 视图主文件，组合 PvPHeader + 5 个 Tab + 战斗回放弹窗
//
// 本文件结构（已模块化拆分后主文件 ~170 行）：
// 1. 头部（PvPHeader）
// 2. 5 个 Tab（对手 / 排行 / 记录 / 商店 / 奖励）
// 3. 战斗回放弹窗（PvPBattleReplay）
// 4. 数据加载与状态管理
import { ref, onMounted } from 'vue';
import api from '../api.js';
import { toast, modalConfirm } from '../ui-bridge.js';
import PvPHeader from './pvp/PvPHeader.vue';
import PvPOpponents from './pvp/PvPOpponents.vue';
import PvPRanking from './pvp/PvPRanking.vue';
import PvPRecords from './pvp/PvPRecords.vue';
import PvPShop from './pvp/PvPShop.vue';
import PvPRewards from './pvp/PvPRewards.vue';
import PvPBattleReplay from './pvp/PvPBattleReplay.vue';

const props = defineProps(['player', 'currentUser']);
defineEmits(['goBack', 'updatePlayer']);

const tab = ref('opponents');
const loading = ref(false);
const loadingRank = ref(false);
const loadingRec = ref(false);
const loadingShop = ref(false);
const loadingRewards = ref(false);

const opponents = ref([]);
const ranking = ref([]);
const records = ref([]);
const shopItems = ref([]);
const shopTitles = ref([]);
const battleResult = ref(null);
const season = ref(null);
const rewardData = ref(null);
const rewardPeriod = ref('daily');

const myRating = ref(1000);
const myWins = ref(0);
const myLosses = ref(0);
const myStreak = ref(0);
const myBestStreak = ref(0);
const arenaCoins = ref(0);
const cdRemaining = ref(0);
const pendingRequestId = ref(null);
function genRequestId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function switchTab(t) {
  tab.value = t;
  if (t === 'opponents') loadOpponents();
  else if (t === 'ranking') loadRanking();
  else if (t === 'records') loadRecords();
  else if (t === 'shop') loadShop();
  else if (t === 'rewards') loadRewards();
}

async function loadOpponents() {
  loading.value = true;
  try {
    const res = await api.getOpponents(props.currentUser);
    if (res.success) {
      opponents.value = res.data.opponents || [];
      myRating.value = res.data.myRating || 1000;
      myWins.value = res.data.myWins || 0;
      myLosses.value = res.data.myLosses || 0;
      myStreak.value = res.data.myStreak || 0;
      myBestStreak.value = res.data.myBestStreak || 0;
      arenaCoins.value = res.data.arenaCoins || 0;
      cdRemaining.value = res.data.cdRemaining || 0;
    }
  } finally { loading.value = false; }
}

async function loadRanking() {
  loadingRank.value = true;
  try {
    const res = await api.getArenaRanking();
    if (res.success) ranking.value = res.data.list || [];
  } finally { loadingRank.value = false; }
}

async function loadRecords() {
  loadingRec.value = true;
  try {
    const res = await api.getArenaRecords(props.currentUser);
    if (res.success) records.value = res.data.records || [];
  } finally { loadingRec.value = false; }
}

async function loadShop() {
  loadingShop.value = true;
  try {
    const res = await api.getArenaShop(props.currentUser);
    if (res.success) {
      shopItems.value = res.data.items || [];
      shopTitles.value = res.data.titles || [];
    }
  } finally { loadingShop.value = false; }
}

async function loadRewards() {
  loadingRewards.value = true;
  try {
    const res = await api.getArenaRewards(rewardPeriod.value, props.currentUser);
    if (res.success) rewardData.value = res.data;
  } finally { loadingRewards.value = false; }
}

async function loadSeason() {
  try {
    const res = await api.getArenaSeason(props.currentUser);
    if (res.success) season.value = res.data;
  } catch (e) { /* ignore */ }
}

async function doChallenge(opp) {
  if (cdRemaining.value > 0) return toast.warn(`冷却中，还需 ${Math.ceil(cdRemaining.value / 1000)}s`);
  if (!await modalConfirm(`挑战 ${opp.name}？`)) return;
  // idempotency: hold pendingRequestId until success, retry reuses same id
  const reqId = pendingRequestId.value || (pendingRequestId.value = genRequestId());
  try {
    const res = await api.challenge(props.currentUser, opp.username, !!opp.isBot, reqId);
    if (res.success) {
      pendingRequestId.value = null;
      const payload = res.data || res;
      battleResult.value = payload;
      // 更新玩家数据
      if (payload.player) props.player && Object.assign(props.player, payload.player);
      myRating.value = payload.newRating || myRating.value;
      arenaCoins.value = payload.arenaCoins || arenaCoins.value;
      cdRemaining.value = 60000; // 1 分钟冷却（与后端 PVP_CD_MS 同步简化）
      // 刷新数据
      loadOpponents();
      props.player && (props.player.arenaCoins = payload.arenaCoins);
      props.player && (props.player.pvpStats = payload.player?.pvpStats);
    } else {
      // network/server error message — keep pendingRequestId for retry if network-ish
      // only clear on business 409 etc? Keep for retry on network failure; clear on explicit business reject?
      // spec says retry should reuse same pendingRequestId until success, so keep it unless success
      toast.error(res.message || '挑战失败');
    }
  } catch (e) {
    // network exception — keep pendingRequestId for next retry
    toast.error('挑战出错：' + (e.message || '网络错误'));
  }
}

async function doBuy(item) {
  if (!await modalConfirm(`购买 ${item.name} 需 ${item.price} 竞技币？`)) return;
  try {
    const res = await api.buyArenaItem(props.currentUser, item.id);
    if (res.success) {
      arenaCoins.value = res.data.arenaCoins || arenaCoins.value;
      toast.success(`购买成功！获得 ${item.name}`);
      // 通知父组件更新 player
      props.player && (props.player.arenaCoins = res.data.arenaCoins);
      if (res.data.player) props.player && Object.assign(props.player, res.data.player);
      // 刷新商店（称号 owned 状态实时更新）
      if (item.type === 'title') loadShop();
    } else {
      toast.error(res.message || '购买失败');
    }
  } catch (e) { toast.error('购买出错：' + (e.message || '网络错误')); }
}

onMounted(async () => {
  await loadSeason();
  await loadOpponents();
});
</script>

<style scoped>
/* v1.03：底部预留 fixed TabBar 高度（含 iOS 安全区 + 悬浮底栏检测值） */
.pvp-view { display: flex; flex-direction: column; gap: 0.5rem; max-width: 560px; margin: 0 auto; padding: 0.5rem 0.8rem; padding-bottom: calc(var(--tabbar-h) + var(--safe-bottom) + var(--browser-bar-h, 0px) + 0.75rem); }
</style>
