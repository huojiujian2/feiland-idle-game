<template>
  <!-- 登录/注册/创建角色界面 -->
  <LoginScreen ref="loginScreenRef" v-if="!player" :player="player"
    @login="handleLogin"
    @register="handleRegister"
    @create="handleCreateChar" />

  <!-- 游戏主界面 -->
  <div v-else class="game-screen">
    <!-- 顶部状态栏 -->
    <TopBar :player="player" @open-shop="showShop = true" @logout="logout" />

    <!-- 主内容区 -->
    <main class="game-body">
      <transition :name="transitionName" mode="out-in">
        <div :key="activeTab" class="page-slide">
          <CharacterView v-if="activeTab === 'char'" :player="player" :jobTree="jobTree"
            @allocate="handleAllocate" @autoAllocate="handleAutoAllocate"
            @savePreset="handleSavePreset" @applyPreset="handleApplyPreset" @deletePreset="handleDeletePreset"
            @equip="handleEquip" @unequip="handleUnequip" @enchant="handleEnchant"
            @chooseJob="handleChooseJob"
            @goSkill="activeTab = 'skill'" @goEvo="activeTab = 'evo'" @goQuest="activeTab = 'quest'" />
          <SkillView v-else-if="activeTab === 'skill'" :player="player"
            @equipAffix="handleEquipAffix" @unequipAffix="handleUnequipAffix" />
          <InventoryView v-else-if="activeTab === 'bag'" :player="player"
            :qualityColors="qualityColors" :materialPrices="materialPrices"
            @use="handleUseItem" @sellMaterial="handleSellMaterial"
            @sellEquip="handleSellEquip" @sellEquipsByLevel="handleSellEquipsByLevel"
            @equip="handleEquip" @enchant="handleEnchant"
            @refresh="player = $event" />
          <MapView v-else-if="activeTab === 'map'" :player="player" :areas="areas"
            @select="handleAreaChange" @strategy-change="handleStrategyChange"
            @goRank="activeTab = 'rank'" @goPvP="activeTab = 'pvp'" @goBoss="activeTab = 'boss'" />
          <CodexView v-else-if="activeTab === 'codex'" />
          <EvolutionView v-else-if="activeTab === 'evo'" :player="player"
            @evolve="handleEvolve" @learnLaw="handleLearnLaw" @ascend="handleAscend"
            @reincarnated="player = $event" />
          <LeaderboardView v-else-if="activeTab === 'rank'" :currentUser="currentUserRef" />
          <QuestView v-else-if="activeTab === 'quest'" :player="player" :currentUser="currentUserRef" @refresh="player = $event" />
          <PvPView v-else-if="activeTab === 'pvp'" :player="player" :currentUser="currentUserRef"
            @goBack="activeTab = 'map'" @updatePlayer="player = $event" />
          <WorldBossView v-else-if="activeTab === 'boss'" :player="player" :currentUser="currentUserRef" />
        </div>
      </transition>
    </main>
    <TutorialOverlay v-if="player && typeof player.tutorialStep==='number' && player.tutorialStep<6" :player="player" @next="handleTutorialNext" @skip="handleTutorialSkip" />

    <!-- 底部 TabBar -->
    <TabBar :tabs="mainTabs" :activeTab="activeTab" @tab-click="handleTabClick" />

    <!-- 升级提示 -->
    <LevelUpNotice :level="levelUpNotice" />

    <!-- 离线收益弹窗 -->
    <OfflineRewardModal
      :visible="offlineSummary.visible"
      :offlineSeconds="offlineSummary.data?.offlineSeconds || 0"
      :expGained="offlineSummary.data?.expGained || 0"
      :goldGained="offlineSummary.data?.goldGained || 0"
      :killCount="offlineSummary.data?.killCount || 0"
      :levelUps="offlineSummary.data?.levelUps || 0"
      :bossKills="offlineSummary.data?.bossKills || 0"
      @close="offlineSummary.visible = false" />

    <!-- 商店弹窗 -->
    <ShopModal
      :visible="showShop"
      :items="shopItems"
      :playerGold="player.gold"
      @close="closeShop"
      @buy="handleBuy" />

    <!-- 全局 Toast + Modal（取代 alert/confirm） -->
    <UIBridge />
  </div>
</template>

<script setup>
// ====== 游戏主应用 ======
// @file client/src/App
// @module app
// @description 游戏主应用：登录界面 + 主界面（顶部状态栏 + 内容区 + 底部 TabBar + 各种弹窗）
//
// 本文件结构（模块化拆分后主文件 ~370 行）：
// 1. 状态管理：玩家、地区、职业、商品、Tab、轮询
// 2. 登录流程：登录/注册/创建角色
// 3. 数据加载：静态数据 + 5 秒轮询
// 4. 教程引导：T-050 步骤更新
// 5. 业务事件：加点、装备、商店、登神、转生、竞技场等
// 6. 组合 10+ 子组件：LoginScreen / TopBar / TabBar / 9 个业务页 / 3 个弹窗
import { ref, computed, watch, onUnmounted } from 'vue';
import api from './api.js';
import { toast, modalAlert, modalConfirm } from './ui-bridge.js';
import UIBridge from './components/UIBridge.vue';
import LoginScreen from './components/LoginScreen.vue';
import TopBar from './components/TopBar.vue';
import TabBar from './components/TabBar.vue';
import LevelUpNotice from './components/LevelUpNotice.vue';
import OfflineRewardModal from './components/OfflineRewardModal.vue';
import ShopModal from './components/ShopModal.vue';
import CharacterView from './components/CharacterView.vue';
import SkillView from './components/SkillView.vue';
import InventoryView from './components/InventoryView.vue';
import MapView from './components/MapView.vue';
import CodexView from './components/CodexView.vue';
import EvolutionView from './components/EvolutionView.vue';
import LeaderboardView from './components/LeaderboardView.vue';
import QuestView from './components/QuestView.vue';
import PvPView from './components/PvPView.vue';
import WorldBossView from './components/WorldBossView.vue';
import TutorialOverlay from './components/TutorialOverlay.vue';

// ====== 状态 ======
const player = ref(null);
const areas = ref([]);
const jobTree = ref({});
const shopItems = ref([]);
const materialPrices = ref({});
const qualityColors = { normal: '#9d9bb8', fine: '#5eda7a', epic: '#9d8cf0', legend: '#d4af5e' };

const levelUpNotice = ref(null);
const loginScreenRef = ref(null); // 登录界面引用：登录后无角色时切换到创建角色步骤
const offlineSummary = ref({ visible: false, data: null });
const activeTab = ref('char');
const showShop = ref(false);

const transitionName = ref('slide-left');
const tabOrder = ['char', 'skill', 'bag', 'map', 'codex', 'evo', 'rank', 'quest', 'pvp'];

let pollTimer = null;
let prevLevel = 0;
let currentUser = '';
let hasHydrated = false;
const currentUserRef = ref('');

const mainTabs = computed(() => [
  { id: 'char', label: '角色', icon: 'user', badge: player.value?.attrPoints > 0 ? player.value.attrPoints : null },
  { id: 'skill', label: '技能', icon: 'skill', badge: null },
  { id: 'map', label: '地图', icon: 'map', badge: null },
  { id: 'bag', label: '背包', icon: 'bag', badge: null },
  { id: 'codex', label: '图鉴', icon: 'book', badge: null },
]);

watch(activeTab, (newTab, oldTab) => {
  const newIdx = tabOrder.indexOf(newTab);
  const oldIdx = tabOrder.indexOf(oldTab);
  transitionName.value = newIdx >= oldIdx ? 'slide-left' : 'slide-right';
});

// ====== 登录/注册/创建角色 ======
async function handleLogin({ username, password }) {
  const res = await api.login(username, password);
  if (!res.success) { toast.error(res.message); return; }
  currentUser = username;
  currentUserRef.value = username;
  if (res.hasCharacter) {
    player.value = res.data;
    prevLevel = res.data.level;
    if (res.offlineSummary && res.offlineSummary.offlineSeconds > 0) {
      offlineSummary.value = { visible: true, data: res.offlineSummary };
    }
    loadStaticData();
    startPolling();
  } else {
    // 账号还没有角色：切换登录界面到"创建角色"步骤
    loginScreenRef.value?.setStep('create');
  }
}

async function handleRegister({ username, password }) {
  const res = await api.register(username, password);
  if (!res.success) { toast.error(res.message); return; }
  toast.success('注册成功！请登录');
}

async function handleCreateChar({ charName }) {
  if (!currentUser) {
    // 当前没有登录态（LoginScreen 直接 create 流程），先注册
    toast.warn('请先注册或登录账号');
    return;
  }
  const res = await api.createCharacter(currentUser, charName);
  if (!res.success) { toast.error(res.message); return; }
  player.value = res.data;
  prevLevel = res.data.level;
  currentUserRef.value = currentUser;
  loadStaticData();
  startPolling();
}

// ====== 数据加载 ======
async function loadStaticData() {
  const [areasRes, jobsRes, shopRes] = await Promise.all([api.getAreas(), api.getJobs(), api.getShop()]);
  if (areasRes.success) areas.value = areasRes.data;
  if (jobsRes.success) jobTree.value = jobsRes.data;
  if (shopRes.success) shopItems.value = shopRes.data;
}

async function startPolling() {
  if (pollTimer) return; // 防重入：已有轮询在跑时不再叠加新定时器
  pollTimer = setInterval(async () => {
    if (!player.value) return;
    const res = await api.getPlayer(currentUser);
    if (res.success) {
      if (res.data.level > prevLevel) {
        levelUpNotice.value = res.data.level;
        prevLevel = res.data.level;
        setTimeout(() => { levelUpNotice.value = null; }, 2500);
      }
      player.value = res.data;
    }
  }, 5000);
}

// ====== 引导（T-050） ======
let tutorialRetrying = false;
async function updateTutorial(nextStep) {
  if (!player.value) return;
  if (tutorialRetrying) return;
  tutorialRetrying = true;
  try {
    const res = await api.updateTutorial(currentUser, nextStep);
    if (res && res.success) player.value = res.data;
  } catch (e) {
    // 网络异常，保留当前步，依赖轮询补偿
  } finally {
    tutorialRetrying = false;
  }
}
function handleTabClick(tabId) {
  activeTab.value = tabId;
  const step = player.value?.tutorialStep;
  if (step === 1 && tabId === 'char') updateTutorial(2);
  else if (step === 3 && tabId === 'map') updateTutorial(4);
  else if (step === 4 && tabId === 'bag') {
    if ((player.value?.level ?? 0) >= 5) updateTutorial(5);
  } else if (step === 5 && tabId === 'skill') {
    if (player.value?.jobPath) updateTutorial(6);
  }
}
function handleTutorialNext() {
  const cur = player.value?.tutorialStep ?? 0;
  updateTutorial(cur + 1);
}
function handleTutorialSkip() { updateTutorial(6); }

// ====== 业务事件 ======
async function handleAllocate(allocation) {
  const r = await api.allocateAttributes(currentUser, allocation);
  if (r.success) player.value = r.data; else toast.error(r.message);
}
async function handleAutoAllocate() {
  const r = await api.autoAllocate(currentUser);
  if (r.success && r.data?.player) player.value = r.data.player; else toast.error(r.message || '一键加点失败');
}
async function handleSavePreset(name) {
  const r = await api.saveAttrPreset(currentUser, name);
  if (r.success) player.value = r.data; else toast.error(r.message);
}
async function handleApplyPreset(presetId) {
  const r = await api.applyAttrPreset(currentUser, presetId);
  if (r.success) player.value = r.data; else toast.error(r.message);
}
async function handleDeletePreset(presetId) {
  const r = await api.deleteAttrPreset(currentUser, presetId);
  if (r.success) player.value = r.data; else toast.error(r.message);
}
async function handleEquip(itemUid) {
  const r = await api.equip(currentUser, itemUid);
  if (r.success) player.value = r.data; else toast.error(r.message);
}
async function handleUnequip(slot) {
  const r = await api.unequip(currentUser, slot);
  if (r.success) player.value = r.data; else toast.error(r.message);
}
async function handleEnchant(itemUid, recipeId) {
  const r = await api.enchant(currentUser, itemUid, recipeId);
  if (r.success) player.value = r.data; else toast.error(r.message);
}
async function handleChooseJob(jobPath) {
  const r = await api.chooseJob(currentUser, jobPath);
  if (r.success) player.value = r.data; else toast.error(r.message);
}
async function handleEquipAffix(affixId, slot) {
  const r = await api.equipAffix(currentUser, affixId, slot);
  if (r.success) player.value = r.data; else toast.error(r.message);
}
async function handleUnequipAffix(affixId) {
  const r = await api.unequipAffix(currentUser, affixId);
  if (r.success) player.value = r.data; else toast.error(r.message);
}
async function handleUseItem(itemId, count) {
  const r = await api.useItem(currentUser, itemId, count);
  if (r.success) player.value = r.data; else toast.error(r.message);
}
async function handleSellMaterial(name, count) {
  const r = await api.sellMaterial(currentUser, name, count);
  if (r.success) player.value = r.data; else toast.error(r.message);
}
async function handleSellEquip(itemUid) {
  const r = await api.sellEquip(currentUser, itemUid);
  if (r.success) player.value = r.data; else toast.error(r.message);
}
async function handleSellEquipsByLevel(maxLevel) {
  const r = await api.sellEquipsByLevel(currentUser, maxLevel);
  if (r.success) {
    player.value = r.data;
    toast.success(`批量出售 ${r.sold} 件，获得 ${r.gold} 金币，剩余 ${r.remaining} 件`);
  } else {
    toast.error(r.message || '批量出售失败');
  }
}
async function handleAreaChange(areaId) {
  const r = await api.changeArea(currentUser, areaId);
  if (r.success) player.value = r.data; else toast.error(r.message);
}
async function handleStrategyChange(strategy) {
  const r = await api.setStrategy(currentUser, strategy);
  if (r.success || r.data) player.value = r.data;
  if (!r.success) toast.error(r.message);
}
async function handleEvolve() {
  const r = await api.evolve(currentUser);
  if (r.success) player.value = r.data; else toast.error(r.message);
}
async function handleLearnLaw(lawId) {
  const r = await api.learnLaw(currentUser, lawId);
  if (r.success) player.value = r.data; else toast.error(r.message);
}
async function handleAscend() {
  const r = await api.ascend(currentUser);
  if (r.success) player.value = r.data; else toast.error(r.message);
}
async function handleBuy(itemId, count) {
  const r = await api.buy(currentUser, itemId, count);
  if (r.success) player.value = r.data; else toast.error(r.message || '购买失败');
}

function closeShop() { showShop.value = false; }

function logout() {
  player.value = null;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  hasHydrated = false;
  currentUser = '';
  currentUserRef.value = '';
  offlineSummary.value = { visible: false, data: null };
  levelUpNotice.value = null;
  activeTab.value = 'char';
}

onUnmounted(() => { if (pollTimer) clearInterval(pollTimer); });
</script>

<style scoped>
.game-screen { height: 100vh; display: flex; flex-direction: column; }
.game-body { flex: 1; overflow: hidden; position: relative; }
.page-slide { height: 100%; overflow-y: auto; }

.slide-left-enter-active, .slide-left-leave-active,
.slide-right-enter-active, .slide-right-leave-active {
  transition: transform 0.28s var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)), opacity 0.28s ease;
}
.slide-left-enter-from { transform: translateX(30%); opacity: 0; }
.slide-left-leave-to { transform: translateX(-15%); opacity: 0; }
.slide-right-enter-from { transform: translateX(-15%); opacity: 0; }
.slide-right-leave-to { transform: translateX(30%); opacity: 0; }
</style>
