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
            @allocate="handleAllocate"
            @applyPresetRatio="handleApplyPresetRatio"
            @savePreset="handleSavePreset"
            @applyPreset="handleApplyPreset"
            @deletePreset="handleDeletePresetBySlot"
            @equip="handleEquip" @unequip="handleUnequip" @enchant="handleEnchant"
            @chooseJob="handleChooseJob"
            @goSkill="activeTab = 'skill'"
            @goEvo="activeTab = 'evo'"
            @goQuest="activeTab = 'quest'"
            @goGenesis="activeTab = 'genesis'" />
          <SkillView v-else-if="activeTab === 'skill'" :player="player"
            @equipAffix="handleEquipAffix" @unequipAffix="handleUnequipAffix" />
          <InventoryView v-else-if="activeTab === 'bag'" :player="player"
            :qualityColors="qualityColors" :materialPrices="materialPrices"
            @use="handleUseItem" @sellMaterial="handleSellMaterial"
            @sellEquip="handleSellEquip" @sellEquipsByLevel="handleSellEquipsByLevel"
            @equip="handleEquip" @enchant="handleEnchant"
            @refresh="player = $event" />
          <MapView v-else-if="activeTab === 'map'" :player="mapPlayer || player" :areas="areas"
            @select="handleAreaChange" @strategy-change="handleStrategyChange"
            @goRank="activeTab = 'rank'" @goPvP="activeTab = 'pvp'" @goBoss="activeTab = 'boss'"
            @goCock="activeTab = 'cock'" @goExpedition="activeTab = 'expedition'" @goGuild="activeTab = 'guild'" />
          <CodexView v-else-if="activeTab === 'codex'" :player="player" />
          <EvolutionView v-else-if="activeTab === 'evo'" :player="player"
            :initialSubTab="reincarnHint ? 'reinc' : undefined"
            @evolve="handleEvolve" @learnLaw="handleLearnLaw" @ascend="handleAscend"
            @reincarnated="player = $event"
            @goGenesis="activeTab = 'genesis'" />
          <LeaderboardView v-else-if="activeTab === 'rank'" :currentUser="currentUserRef" />
          <QuestView v-else-if="activeTab === 'quest'" :player="player" :currentUser="currentUserRef" @refresh="player = $event" @goGenesis="activeTab = 'genesis'" />
          <PvPView v-else-if="activeTab === 'pvp'" :player="player" :currentUser="currentUserRef"
            @goBack="activeTab = 'map'" @updatePlayer="player = $event" />
          <WorldBossView v-else-if="activeTab === 'boss'" :player="player" :currentUser="currentUserRef" />
          <CockfightArena v-else-if="activeTab === 'cock'" :player="player" :currentUser="currentUserRef"
            @goBack="activeTab = 'map'" />
          <ExpeditionView v-else-if="activeTab === 'expedition'" :player="player" :currentUser="currentUserRef"
            @goBack="activeTab = 'map'" />
          <GuildView v-else-if="activeTab === 'guild'" :player="player" :currentUser="currentUserRef"
            @goBack="activeTab = 'map'" />
          <GenesisView v-else-if="activeTab === 'genesis'" :player="player" />
        </div>
      </transition>
    </main>
    <TutorialOverlay v-if="player && typeof player.tutorialStep==='number' && player.tutorialStep<6" :player="player" @next="handleTutorialNext" @skip="handleTutorialSkip" />

    <!-- 底部 TabBar -->
    <TabBar :tabs="mainTabs" :activeTab="activeTab" @tab-click="handleTabClick" />

    <!-- 升级提示 -->
    <LevelUpNotice :level="levelUpNotice" />

    <!-- v0.9：满百级转生提醒弹窗 -->
    <ReincarnHintModal
      v-if="reincarnHint"
      :level="reincarnHint.level"
      @close="closeReincarnHint"
      @goReincarn="goReincarnFromHint"
    />

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
    <!-- v1.05 全服公告大弹窗（手动关闭） -->
    <AnnounceModal :visible="announceModal" :list="announceList" @close="announceModal = false" />

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
import { ref, computed, watch, onMounted, onUnmounted, provide } from 'vue';
import api, { getToken, getUsername, setUnauthorizedHandler, clearAuth } from './api.js';
import { toast, modalAlert, modalConfirm } from './ui-bridge.js';
import UIBridge from './components/UIBridge.vue';
import LoginScreen from './components/LoginScreen.vue';
import TopBar from './components/TopBar.vue';
import TabBar from './components/TabBar.vue';
import LevelUpNotice from './components/LevelUpNotice.vue';
import ReincarnHintModal from './components/ReincarnHintModal.vue';
import OfflineRewardModal from './components/OfflineRewardModal.vue';
import AnnounceModal from './components/AnnounceModal.vue';
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
import CockfightArena from './components/CockfightArena.vue';
import ExpeditionView from './components/ExpeditionView.vue';
import GuildView from './components/GuildView.vue';
import GenesisView from './components/GenesisView.vue';
import RocketCrashView from './components/RocketCrashView.vue'; // v1.09：星际火箭
import TutorialOverlay from './components/TutorialOverlay.vue';

// ====== 状态 ======
const player = ref(null);
const mapPlayer = ref(null); // 地图页专用精简数据（view-map 接口）
const areas = ref([]);
const jobTree = ref({});
const shopItems = ref([]);
const materialPrices = ref({});
const qualityColors = { normal: '#9d9bb8', fine: '#5eda7a', epic: '#9d8cf0', legend: '#d4af5e', mythic: '#ff6738' };

// ====== v1.03：悬浮底栏检测（夸克/UC/百度等地址栏在底部的浏览器）======
// 原理：这类浏览器底栏悬浮在网页上方，不暴露 env(safe-area-inset-bottom)（返回0），
//       但 visualViewport.height 会排除被遮挡部分 → innerHeight 与其差值即底部遮挡高度。
//       检测结果写入 CSS 变量 --browser-bar-h，TabBar 和内容区据此垫高。
//       封顶 60px：避免输入法键盘弹出时（vv.height 大幅缩小）被误判垫得太高。
let vvCleanup = null;
onMounted(() => {
  const vv = window.visualViewport;
  if (!vv) return;
  const update = () => {
    const bottomCovered = window.innerHeight - vv.height - vv.offsetTop;
    const h = bottomCovered > 40 ? Math.min(bottomCovered, 60) : 0;
    document.documentElement.style.setProperty('--browser-bar-h', h + 'px');
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  update();
  vvCleanup = () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };

  // v1.03：注册 401 全局回调 — token 失效时跳回登录页
  setUnauthorizedHandler(() => {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    player.value = null;
    hasHydrated = false;
    currentUser = '';
    currentUserRef.value = '';
    offlineSummary.value = { visible: false, data: null };
    activeTab.value = 'char';
    try { toast('登录已过期，请重新登录'); } catch (_) {}
  });

  // v1.03：自动恢复登录态（localStorage 中的 token + username）
  const savedToken = getToken();
  const savedUser = getUsername();
  if (savedToken && savedUser) {
    currentUser = savedUser;
    currentUserRef.value = savedUser;
    hasHydrated = true;
    // 后台静默拉数据（不阻塞 UI）
    (async () => {
      try {
        const r = await api.getPlayer(savedUser);
        if (r && r.success && r.data && r.data.player) {
          player.value = r.data.player;
          // v1.05 fix：恢复登录态也要加载静态数据（区域/职业树/商店），
          //   否则 areas 为空 → 地图页"挂机区域"列表空白，必须退出重登才恢复
          loadStaticData();
          if (r.data.offlineSummary) offlineSummary.value = { visible: true, data: r.data.offlineSummary };
        } else if (r && !r.success && /登录|token|未登录/.test(r.message || '')) {
          // token 已被服务端拒绝 → 回调已自动清掉 → 回到登录页
        }
      } catch (_) { /* 网络问题，保留 token 让用户重试 */ }
    })();
    // 10s 轮询（v1.03 优化：5s→10s，QPS 减半；getPlayerLight 缓存命中 <1ms）
    pollTimer = setInterval(async () => {
      try {
        const r = await api.getPlayerLight(currentUser);
        if (r && r.success && r.data && r.data.player) {
          player.value = r.data.player;
        }
      } catch (_) {}
    }, 10000);
  }
});
onUnmounted(() => { if (vvCleanup) vvCleanup(); });

// v2.2：全服玩家名册 { username: name } —— 用于把"造物主标签"里的账号解析成真名
const playerNameMap = ref({});
async function refreshPlayerNameMap() {
  const r = await api.getPlayerNames();
  if (r && r.success && r.data) playerNameMap.value = r.data;
}
provide('playerNameMap', playerNameMap);
provide('refreshPlayerNameMap', refreshPlayerNameMap);

const levelUpNotice = ref(null);
// v0.9：满百级转生一次性提醒（弹窗）
const reincarnHint = ref(null);  // { level }  | null = 不弹
const loginScreenRef = ref(null); // 登录界面引用：登录后无角色时切换到创建角色步骤
const offlineSummary = ref({ visible: false, data: null });
const announceModal = ref(false); // v1.05 全服公告大弹窗
const announceList = ref([]); // 公告列表（新→旧，最多 10 条）
const activeTab = ref('char');
const showShop = ref(false);

const transitionName = ref('slide-left');
const tabOrder = ['char', 'skill', 'bag', 'map', 'codex', 'evo', 'rank', 'quest', 'pvp', 'boss', 'cock', 'expedition', 'guild', 'genesis', 'rocket'];

let pollTimer = null;
let mapPollTimer = null; // 地图页专用轮询
let lastAnnounceId = 0; // 已读公告 id（对比 latestId 检测新公告）
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
  // v1.05 地图页独立轻量数据源：进入拉一次 view-map 并轮询，离开即停
  if (newTab === 'map') startMapPolling();
  else stopMapPolling();
});

// ====== v1.05 地图页专属轻视图数据源 ======
// 地图页只用 logs / currentArea / level / maxHp / strategies，独立用 view-map 轻接口，
//   避免拉取全量 view（laws / 词条 / 背包 / 远征等）。mapPlayer 为空时 MapView 回退到 player。
async function loadMapView() {
  if (!currentUser) return;
  try {
    const r = await api.getPlayerMap(currentUser);
    if (r && r.success && r.data && r.data.player) {
      mapPlayer.value = r.data.player;
    }
  } catch (_) {}
}
function startMapPolling() {
  if (mapPollTimer) return;
  loadMapView();
  mapPollTimer = setInterval(loadMapView, 10000);
}
function stopMapPolling() {
  if (mapPollTimer) { clearInterval(mapPollTimer); mapPollTimer = null; }
}

// ====== 登录/注册/创建角色 ======
async function handleLogin({ username, password }) {
  const res = await api.login(username, password);
  if (!res.success) {
    // v0.9：把后端消息格式化得更有"卷轴味"
    const raw = res.message || '';
    let msg = raw;
    if (raw.includes('账号不存在')) msg = '此真名未曾被星图记录';
    else if (raw.includes('密码错误')) msg = '秘钥不契合，请再默念你的誓约';
    else if (raw.includes('请输入')) msg = '请输入真名与秘钥';
    toast.error(msg);
    // 把失败结果传给 LoginScreen，让它在输入框下显示 inline 错误
    loginScreenRef.value?.setLoginError?.(msg);
    return res;
  }
  // 成功：清掉之前的 inline 错误
  loginScreenRef.value?.setLoginError?.(null);
  currentUser = username;
  currentUserRef.value = username;
  if (res.hasCharacter) {
    const payload = res.data;
    const p = (payload && payload.player) ? payload.player : payload;
    player.value = p;
    prevLevel = p?.level || 0;
    const off = (payload && payload.offlineSummary) || res.offlineSummary;
    if (off && off.offlineSeconds > 0) {
      offlineSummary.value = { visible: true, data: off };
    }
    hasHydrated = true;
    loadStaticData();
    startPolling();
    // v0.9：登录后立即检测（不等轮询）— 已 Lv.100 老玩家上线就弹
    maybeShowReincarnHint(p);
    // v2.2：登录后拉取全服名册，方便图鉴/造物库显示别人造物的真名
    refreshPlayerNameMap();
  } else {
    // 账号还没有角色：切换登录界面到"创建角色"步骤
    loginScreenRef.value?.setStep('create');
  }
  return res;
}

async function handleRegister({ username, password }) {
  const res = await api.register(username, password);
  if (!res.success) {
    // v0.9：把后端消息格式化得更有"卷轴味"，并保留原始 message 方便排查
    const msg = (res.message || '').includes('已存在')
      ? '此真名已被另一个灵魂烙印'
      : (res.message || '契约未成，星空未接受');
    toast.error(msg);
    // v2.8 fix：emit 不回传本函数返回值，改用 ref 方法把结果告知 LoginScreen（失败不翻页）
    loginScreenRef.value?.setRegisterResult(false, res.message || msg);
    return res;
  }
  // v2.7 fix：注册成功只 toast "契约成立"，不催玩家"请登录"
  //   LoginScreen 会自动切到神谕面板 → 2.4s 后切回登录页让玩家输入账号密码
  toast.success('契约成立');
  loginScreenRef.value?.setRegisterResult(true);
  return res;
}

async function handleCreateChar({ charName }) {
  if (!currentUser) {
    // 当前没有登录态（LoginScreen 直接 create 流程），先注册
    toast.warn('请先注册或登录账号');
    return;
  }
  const res = await api.createCharacter(currentUser, charName);
  if (!res.success) { toast.error(res.message); return; }
  const payload = res.data;
  const p = (payload && payload.player) ? payload.player : payload;
  player.value = p;
  prevLevel = p?.level || 0;
  currentUserRef.value = currentUser;
  hasHydrated = true;
  loadStaticData();
  startPolling();
}

// ====== 数据加载 ======
async function loadStaticData() {
  const [areasRes, jobsRes] = await Promise.all([api.getAreas(), api.getJobs()]);
  if (areasRes.success) areas.value = areasRes.data;
  if (jobsRes.success) jobTree.value = jobsRes.data;
  await refreshShop();
}

// 商店数据：消耗品/装备全量；材料全部展示并按等级标记锁定（升级后刷新可看到新解锁）
async function refreshShop() {
  const shopRes = await api.getShop(currentUser);
  if (!shopRes.success) return;
  const d = shopRes.data || {};
  const lv = player.value?.level || 1;
  const materials = (d.allMaterials || d.materials || []).map(m => ({
    ...m, type: 'material', locked: lv < m.requiredLevel,
  }));
  shopItems.value = [...(d.consumables || []), ...(d.equips || []), ...materials];
}

async function startPolling() {
  if (pollTimer) return; // 防重入：已有轮询在跑时不再叠加新定时器
  loadAnnouncements(); // v1.05：登录后立即查一次公告，不等首个 10s 周期
  pollTimer = setInterval(async () => {
    if (!player.value) return;
    // v1.03 杠杆 2：用 getPlayerLight 替代 getPlayer（跳过 withTransaction + 缓存命中 <1ms）
    const res = await api.getPlayerLight(currentUser);
    if (res.success) {
      const payload = res.data;
      const p = (payload && payload.player) ? payload.player : payload;
      const off = (payload && payload.offlineSummary) || res.offlineSummary;
      if (p && typeof p.level === 'number' && p.level > prevLevel) {
        levelUpNotice.value = p.level;
        prevLevel = p.level;
        setTimeout(() => { levelUpNotice.value = null; }, 2500);
        refreshShop(); // 升级可能解锁新的商店材料
      }
      player.value = p;
      // handle offlineSummary if server sends it (compat)
      if (off && off.offlineSeconds > 0 && !hasHydrated) {
        offlineSummary.value = { visible: true, data: off };
        hasHydrated = true;
      } else if (off) {
        hasHydrated = true;
      }
      // v0.9：首次达到 Lv.100 且未转生 → 弹转生提醒弹窗（一次性）
      maybeShowReincarnHint(p);
    }
    loadAnnouncements(); // v1.05：与 light 轮询同拍检查全服公告（对比 lastAnnounceId）
  }, 10000); // v1.03 优化：5s→10s，QPS 减半
}

// ====== v1.05 全服公告 ======
// 轮询 /api/announce，发现 id 大于 lastAnnounceId 的新公告就弹出大弹窗（可手动关闭）。
// 公告列表维护在 announceList（新→旧，最多 10 条）；服务器重启导致 id 回退时重置基线。
async function loadAnnouncements() {
  try {
    const r = await api.getAnnouncements();
    if (r && r.success && r.data && Array.isArray(r.data.list) && r.data.list.length > 0) {
      const list = r.data.list;
      const latest = list[list.length - 1];
      if (!latest || typeof latest.id !== 'number') return;
      if (latest.id > lastAnnounceId) {
        const newOnes = list.filter((a) => a.id > lastAnnounceId).reverse(); // 新→旧
        lastAnnounceId = latest.id;
        const seen = new Set(announceList.value.map((a) => a.id));
        for (const a of newOnes) {
          if (!seen.has(a.id)) announceList.value.push(a);
        }
        if (announceList.value.length > 10) announceList.value = announceList.value.slice(0, 10);
        announceModal.value = true; // 弹出大弹窗（替代原 toast）
      } else if (latest.id < lastAnnounceId) {
        // 服务器重启后公告清空、id 从 1 重新计数：重置基线，避免以后永远不弹
        lastAnnounceId = latest.id;
      }
    }
  } catch (_) {}
}

// v0.9：检测是否需要弹出"满百级转生提醒"
//  - level >= 100
//  - reincarnation === 0（首次转生）
//  - reincarnHintShown === false（之前没弹过）
//  - reincarnHint.value === null（当前没在弹）
function maybeShowReincarnHint(p) {
  if (!p) return;
  if (reincarnHint.value) return;     // 已经在弹
  if (p.reincarnation > 0) return;   // 已经转生过
  if (p.reincarnHintShown) return;   // 已弹过（前端标记）
  if (p.level < 100) return;         // 没满级
  reincarnHint.value = { level: p.level };
}

async function closeReincarnHint() {
  if (!reincarnHint.value) return;
  // 标记"已弹"，后端持久化（避免每次启动都弹）
  if (player.value && !player.value.reincarnHintShown) {
    try {
      const r = await api.markReincarnHintShown(currentUser);
      if (r && r.success) player.value = r.data;
    } catch (e) { /* 静默失败 */ }
  }
  reincarnHint.value = null;
}

function goReincarnFromHint() {
  // 跳到进化 Tab，再切到转生 Tab
  activeTab.value = 'evo';
  reincarnHint.value = null;
  if (player.value) player.value.reincarnHintShown = true;
  // 标记已弹（异步）
  api.markReincarnHintShown(currentUser).then(r => {
    if (r && r.success) player.value = r.data;
  }).catch(() => {});
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
  if (r.success) {
    player.value = r.data;
  } else {
    toast.error(r.message);
  }
}
// v0.8+：按 4 维比例加点（4 个固定方案槽）
async function handleApplyPresetRatio(ratio) {
  const r = await api.applyPresetRatio(currentUser, ratio);
  if (r.success) {
    player.value = r.data;
    const a = r.allocated || {};
    toast.success(`按比例加点：攻+${a.atk || 0} 防+${a.def || 0} 体+${a.hp || 0} 敏+${a.agi || 0}`);
  } else {
    toast.error(r.message || '按比例加点失败');
  }
}
// v0.8+：保存方案（payload 兼容旧版 name 字符串）
async function handleSavePreset(payload) {
  // payload = { slot, name, attributes, delta? } | string（旧版只发 name）
  // 修复：v2.x 起默认不传 delta —— 保存预设只快照模板，不立刻加点
  let body;
  if (typeof payload === 'string') {
    body = { name: payload };
  } else {
    body = {
      name: (payload.name || '').trim().slice(0, 24) || '属性预设',
      slot: payload.slot,
      attributes: payload.attributes || null,
    };
    // 仅在显式 delta 时附带（兼容老调用方），不附带时后端不加点
    if (payload.delta && typeof payload.delta === 'object') {
      body.delta = payload.delta;
    }
  }
  const r = await api.saveAttrPreset(currentUser, body);
  if (r.success) {
    player.value = r.data;
    const slotName = ['方案一', '方案二', '方案三'][body.slot ?? 0] || '方案';
    toast.success(`已保存加点到 ${slotName}`);
  } else {
    toast.error(r.message || '保存失败');
  }
}
// v1.02：应用预设（按 presetId 优先，回退 idx）
async function handleApplyPreset(payload) {
  const idx = Number(payload?.idx ?? payload);
  const presetId = payload?.presetId;
  const target = presetId || idx; // 没有 presetId 时回退到 slot（后端 applyAttrPreset 需要 id）
  if (!target) {
    toast.error('未选择预设');
    return;
  }
  const r = await api.applyAttrPreset(currentUser, target);
  if (r.success) {
    player.value = r.data;
    const slotName = ['方案一', '方案二', '方案三'][idx] || '方案';
    const a = r.allocated || {};
    toast.success(`已应用 ${slotName}：攻+${a.atk || 0} 防+${a.def || 0} 体+${a.hp || 0} 敏+${a.agi || 0}`);
  } else {
    toast.error(r.message || '应用预设失败');
  }
}
// v0.8+：删除方案（按 slot 索引）
async function handleDeletePresetBySlot(payload) {
  const slot = Number(payload?.slot ?? payload);
  if (Number.isNaN(slot)) return;
  const slotName = ['方案一', '方案二', '方案三'][slot] || '方案';
  const r = await api.deleteAttrPresetBySlot(currentUser, slot);
  if (r.success) {
    player.value = r.data;
    toast.success(`已删除 ${slotName}`);
  } else {
    toast.error(r.message || '删除失败');
  }
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
// v1.02：背包整理——后端持久化（POST /inventory/sort）
//   旧逻辑（前端只排不持久化）已删除，所有"加装备"入口都走 addEquipToSortedPosition
//   此函数已无 caller，但保留以防旧前端缓存引用报错（实际 InventoryView 改为 emit 'refresh'）
function handleInventorySort(sortedEquips) {
  if (player.value && Array.isArray(sortedEquips)) {
    player.value.equips = sortedEquips;
    toast.success('背包已按类别+属性整理');
  }
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
  if (r.success) { player.value = r.data; loadMapView(); } else toast.error(r.message);
}
async function handleStrategyChange(strategy) {
  const r = await api.setStrategy(currentUser, strategy);
  if (r.success || r.data) { player.value = r.data; loadMapView(); }
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
  mapPlayer.value = null;
  stopMapPolling();
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  hasHydrated = false;
  currentUser = '';
  currentUserRef.value = '';
  offlineSummary.value = { visible: false, data: null };
  levelUpNotice.value = null;
  activeTab.value = 'char';
  // v1.03：清除持久化 token + username
  try { clearAuth(); } catch (_) {}
}

onUnmounted(() => { if (pollTimer) clearInterval(pollTimer); stopMapPolling(); });
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
