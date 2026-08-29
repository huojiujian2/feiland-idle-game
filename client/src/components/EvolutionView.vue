<template>
  <div class="view-container evo-view">
    <!-- 子标签 -->
    <div class="sub-tabs">
      <button class="sub-tab" :class="{ active: subTab === 'race' }" @click="subTab = 'race'">
        <IconBase name="dna" :size="14" class="btn-icon" />种族进化
      </button>
      <button class="sub-tab" :class="{ active: subTab === 'law' }" @click="subTab = 'law'">
        <IconBase name="scroll" :size="14" class="btn-icon" />法则
      </button>
      <button class="sub-tab" :class="{ active: subTab === 'ascend' }" @click="subTab = 'ascend'">
        <IconBase name="sparkle" :size="14" class="btn-icon" />登神
      </button>
      <button class="sub-tab" :class="{ active: subTab === 'reinc' }" @click="switchReincTab()">
        <IconBase name="dna" :size="14" class="btn-icon" />转生
      </button>
    </div>

    <!-- 各 Tab 内容 -->
    <RaceTab v-if="subTab === 'race'" :player="player" :raceInfo="raceInfo" @evolve="$emit('evolve')" />
    <LawTab v-if="subTab === 'law'" :player="player" :lawBonus="lawBonus" @learnLaw="handleLearnLaw" />
    <AscendTab v-if="subTab === 'ascend'" :player="player" :ascInfo="ascInfo" @ascend="$emit('ascend')" />
    <ReincTab v-if="subTab === 'reinc'" :player="player" :reincInfo="reincInfo"
      :reincEstimatePoints="reincEstimatePoints"
      :reincShop="reincShop"
      :reincLoading="reincLoading"
      :shopBuying="shopBuying"
      :autoReincRunning="autoReincRunning"
      @reincarnate="doReincarnate"
      @autoReincarnate="doAutoReincarnate"
      @goGenesis="$emit('goGenesis')"
      @buyReincItem="handleBuyReincItem" />
  </div>
</template>

<script setup>
// ====== 进化系统主容器 ======
// @file components/EvolutionView
// @module evolution-view
// @description 进化系统：4 个 Tab（种族/法则/登神/转生），每个 Tab 已拆为独立子组件
//
// 本文件结构（已模块化拆分后主文件 ~180 行）：
// 1. Tab 切换 + 状态管理
// 2. 转生数据加载与购买
// 3. 4 个 Tab 子组件：RaceTab / LawTab / AscendTab / ReincTab
import { ref, computed, onMounted, watch } from 'vue';
import IconBase from './icons/IconBase.vue';
import api from '../api.js';
import { toast, modalConfirm } from '../ui-bridge.js';
import RaceTab from './evolution/RaceTab.vue';
import LawTab from './evolution/LawTab.vue';
import AscendTab from './evolution/AscendTab.vue';
import ReincTab from './evolution/ReincTab.vue';

const props = defineProps(['player', 'initialSubTab']);
const emit = defineEmits(['evolve', 'learnLaw', 'ascend', 'reincarnated']);

const subTab = ref(props.initialSubTab || 'race');

// v0.9：从 App 切到 evo 时如果带 initialSubTab=reinc，自动切到转生子 tab
watch(() => props.initialSubTab, (val) => {
  if (val === 'reinc') {
    subTab.value = 'reinc';
    switchReincTab();
  }
});

// 派生数据
const raceInfo = computed(() => props.player.raceInfo || { current: null, next: null });
const lawBonus = computed(() => props.player.lawBonus || {});
const ascInfo = computed(() => props.player.ascensionInfo || { demigod: {}, god: {} });

// 转生
const reincInfo = ref({
  reincarnation: 0, reincPoints: 0,
  permanentBuffs: { expBonus: 0, goldBonus: 0, baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0 },
  nextBuffs: { expBonus: 0, goldBonus: 0, baseAtkBonus: 0, baseDefBonus: 0, baseHpBonus: 0, baseAgiBonus: 0 },
  canReincarnate: false, level: 1,
});
const reincLoading = ref(false);
const reincShop = ref([]);
const shopBuying = ref(false);
const autoReincRunning = ref(false); // 内测：一键转生进行中

const reincEstimatePoints = computed(() => {
  const a = props.player.attributes || {};
  return Math.max(1, Math.floor((a.atk || 0) + (a.def || 0) + (a.hp || 0) + (a.agi || 0)) / 100);
});

async function fetchReincInfo() {
  if (!props.player.username) return;
  try {
    const res = await api.getReincarnationInfo(props.player.username);
    if (res.success) reincInfo.value = res.data;
  } catch (e) { /* ignore */ }
}
async function fetchReincShop() {
  try {
    // v7：传 username 拿到动态价格
    const res = await api.getReincShop(props.player.username);
    if (res.success) reincShop.value = res.data;
  } catch (e) { /* ignore */ }
}
function switchReincTab() {
  subTab.value = 'reinc';
  fetchReincInfo();
  fetchReincShop();
}

async function doReincarnate() {
  if (!await modalConfirm('确认转生？等级、经验、属性点将重置（永久加成保留）')) return;
  reincLoading.value = true;
  try {
    const res = await api.reincarnate(props.player.username);
    if (res.success) {
      emit('reincarnated', res.data);
      await fetchReincInfo();
      toast.success(`转生成功！第 ${res.reincarnation} 轮回，获得 ${res.earnedPoints} 转生点`);
    } else {
      toast.error(res.message || '转生失败');
    }
  } catch (e) {
    toast.error('转生失败：' + (e.message || '网络错误'));
  } finally {
    reincLoading.value = false;
  }
}

// 内测：一键转生（金币按高级经验卷轴购买力速升等级后连续转生）
async function doAutoReincarnate({ times, targetLevel }) {
  const n = Math.floor(Number(times) || 0);
  const lv = Math.floor(Number(targetLevel) || 0);
  if (n < 1) return toast.error('转生次数至少为 1');
  if (lv < 100) return toast.error('目标等级不能低于 100');
  if (!await modalConfirm(`一键转生：连转 ${n} 次（目标 Lv.${lv}），金币不够会停在断点，继续？`)) return;
  autoReincRunning.value = true;
  try {
    const res = await api.autoReincarnate(props.player.username, n, lv);
    if (res.success) {
      emit('reincarnated', res.data);
      await fetchReincInfo();
      await fetchReincShop();
      toast.success(res.message || `一键转生完成 ${res.completed} 轮`);
    } else {
      toast.error(res.message || '一键转生失败');
    }
  } catch (e) {
    toast.error('一键转生失败：' + (e.message || '网络错误'));
  } finally {
    autoReincRunning.value = false;
  }
}

async function handleBuyReincItem(item, option) {
  if (!await modalConfirm(`兑换「${item.name}」将消耗 ${item.cost} 转生点，继续？`)) return;
  shopBuying.value = true;
  try {
    const res = await api.buyReincShopItem(props.player.username, item.id, option);
    if (res.success) {
      // 通知 App 更新父 player（含 permanentBuffs / reincPoints）
      emit('reincarnated', res.data);
      // v8：实时拉取新 shop 列表（cost/boughtCount 都已更新）
      await fetchReincShop();
      // 同步刷新转生点信息（reincPoints 扣减等）
      await fetchReincInfo();
      toast.success(res.message || '兑换成功');
    } else {
      toast.error(res.message || '兑换失败');
    }
  } catch (e) {
    toast.error('兑换失败：' + (e.message || '网络错误'));
  } finally {
    shopBuying.value = false;
  }
}

function handleLearnLaw(lawId) { emit('learnLaw', lawId); }

onMounted(() => {
  fetchReincInfo();
  fetchReincShop();
});
</script>

<style scoped>
.evo-view { display: flex; flex-direction: column; gap: 0.6rem; max-width: 560px; margin: 0 auto; }
.sub-tabs { display: flex; gap: 0.3rem; }
.sub-tab { flex: 1; padding: 0.5rem; border: 1px solid var(--rule); border-radius: 8px; background: rgba(var(--panel-rgb),0.4); color: var(--muted); font-size: 0.8rem; cursor: pointer; transition: all var(--duration-normal) var(--ease-out); font-family: inherit; }
.sub-tab.active { background: rgba(var(--gold-rgb),0.08); border-color: var(--accent); color: var(--accent); box-shadow: 0 0 12px rgba(var(--gold-rgb),0.1); }
</style>
