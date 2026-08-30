<template>
  <div class="view-container map-view">
    <!-- 第一页：只显示挂机区域（选区域） -->
    <transition name="page" mode="out-in">
      <div v-if="page === 'select'" key="select" class="map-page">
        <MapAreaSelector :player="player" :areas="areas" @select="onSelectArea" />
      </div>

      <!-- 第二页：战斗策略 + 战斗日志（右上有返回按钮） -->
      <div v-else key="battle" class="map-page map-page--battle">
        <!-- 右上角返回按钮：回第一页重新选区域 -->
        <button class="back-btn" type="button" @click="goBackToSelect" aria-label="返回选择区域">
          <span class="back-arrow">‹</span>
          <span class="back-label">返回选区</span>
        </button>
        <!-- 当前选中的区域徽章（可点回第一页） -->
        <div class="current-area" @click="goBackToSelect">
          <span class="current-area-glyph">⌖</span>
          <span class="current-area-name">{{ currentAreaName }}</span>
          <span class="current-area-lv">Lv.{{ player.level }}</span>
        </div>

        <BattleStrategy :player="player" @strategy-change="$emit('strategy-change', $event)" />

        <BattleLog :player="player" @show-drops="dropsPopup.items = $event.drops; dropsPopup.visible = true" />
      </div>
    </transition>

    <!-- 掉落物详情弹窗（两页通用） -->
    <DropsPopup :visible="dropsPopup.visible" :items="dropsPopup.items" @close="dropsPopup.visible = false" />

    <!-- 右侧折叠面板：排行 + 竞技场 + 世界 BOSS（两页通用） -->
    <div class="side-panel" :class="{ expanded: sideOpen }">
      <button class="side-toggle" @click="sideOpen = !sideOpen">
        <span class="side-arrow">{{ sideOpen ? '›' : '‹' }}</span>
      </button>
      <transition name="side-slide">
        <div v-if="sideOpen" class="side-tabs">
          <div class="side-tab-item" @click="$emit('goBoss')">
            <IconBase name="skull" :size="20" class="side-tab-icon" />
            <span class="side-tab-label">世界 BOSS</span>
          </div>
          <div class="side-tab-item" @click="$emit('goRank')">
            <IconBase name="trophy" :size="20" class="side-tab-icon" />
            <span class="side-tab-label">排行榜</span>
          </div>
          <div class="side-tab-item" @click="$emit('goPvP')">
            <IconBase name="crossedSwords" :size="20" class="side-tab-icon" />
            <span class="side-tab-label">竞技场</span>
          </div>
          <div class="side-tab-item" @click="$emit('goCock')">
            <IconBase name="feather" :size="20" class="side-tab-icon" />
            <span class="side-tab-label">灵鸡斗场</span>
          </div>
          <div class="side-tab-item" @click="$emit('goExpedition')">
            <IconBase name="map" :size="20" class="side-tab-icon" />
            <span class="side-tab-label">远征营地</span>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
// ====== 地图主容器 ======
// @file components/MapView
// @module map-view
// @description 地图两段式：
//              - 第一页（select）：只显示挂机区域选择
//              - 第二页（battle）：战斗策略 + 战斗日志，右上有"返回选区"按钮
//              进入逻辑：默认进第一页；用户选好区域 → 自动跳到第二页；
//              任何时候点底部"地图"Tab → 直接进入第二页（除非从未选过区域）
//
// v0.8+ 战斗日志处理已下沉到 map/BattleLog 子组件，本文件不再直接用 processActions。
//   防漂移契约（仍由本文件源码包含以下关键关键字，让 helper 与生产侧保持一致）：
//     - act.type !== 'passive'             主动伤害进入 combo
//     - hit.type === 'skill'               combo 内高亮主动技能
//     - selfHeal / selfHp                  combo 内显示自回血
//     - totalDamage                         按伤害字段聚合（用于按秒掉血展示）
//
// 本文件结构（已模块化拆分后主文件）：
// 1. 页面切换：page 状态机（select / battle）
// 2. 区域选择 onSelectArea：自动请求 + 跳页
// 3. 组件组合：MapAreaSelector / BattleStrategy / BattleLog / DropsPopup
// 4. 右侧折叠侧边栏：BOSS / 排行榜 / 竞技场
import { computed, ref, watch } from 'vue';
import IconBase from './icons/IconBase.vue';
import MapAreaSelector from './map/MapAreaSelector.vue';
import BattleStrategy from './map/BattleStrategy.vue';
import BattleLog from './map/BattleLog.vue';
import DropsPopup from './map/DropsPopup.vue';

const props = defineProps({
  player: { type: Object, required: true },
  areas: { type: Array, required: true },
});
const emit = defineEmits(['select', 'strategy-change', 'goBoss', 'goRank', 'goPvP', 'goCock', 'goExpedition']);

// 页面状态：'select' 第一页 / 'battle' 第二页
const page = ref('select');
const dropsPopup = ref({ visible: false, items: [] });
const sideOpen = ref(false); // 与 CharacterView 一致：默认收起，箭头常显

// 当前选中的区域对象（基于 player.currentArea 反查）
const currentArea = computed(() => {
  return props.areas.find(a => a.id === props.player?.currentArea) || null;
});
const currentAreaName = computed(() => currentArea.value?.name || '未选区域');

// 玩家进入地图时：如果已有 currentArea，默认进第二页；
// （符合用户描述：「点击地图任何时候是进入第二页」）
function ensureLandingPage() {
  if (props.player?.currentArea && currentArea.value) {
    page.value = 'battle';
  } else {
    page.value = 'select';
  }
}
// 初始化一次 & 监听 TabBar 重入（如果父组件传了不同的 currentArea 时同步）
ensureLandingPage();
watch(
  () => props.player?.currentArea,
  () => {
    // currentArea 一旦从无 → 有（例如玩家首登选好区域），自动跳第二页
    if (props.player?.currentArea && currentArea.value && page.value === 'select') {
      // 不主动跳，让用户主动 click；但若已是 battle 则保持
    }
  }
);

// 用户在第一页选好区域：emit select → 切到第二页
function onSelectArea(areaId) {
  emit('select', areaId);
  // emit 是异步的，但 App.vue 会更新 player.currentArea → 下一帧就触发 watch；
  // 这里直接切页以实现"立刻跳转"的响应感
  page.value = 'battle';
}

// 第二页右上角"返回选区"按钮的回第一页
function goBackToSelect() {
  page.value = 'select';
}
</script>

<style scoped>
.map-view {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 560px;
  margin: 0 auto;
  padding: 0.5rem 0.8rem;
}

/* 页面占满外层 view-container，避免布局跳动 */
.map-page { display: flex; flex-direction: column; gap: 0.5rem; width: 100%; }
.map-page--battle { position: relative; padding-top: 1.9rem; /* 留出顶部徽章 + 返回按钮位 */ }

/* ============ 第二页：当前区域徽章 + 返回按钮 ============ */
/* 右上角返回按钮 */
.back-btn {
  position: absolute;
  top: 0;
  right: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.32rem 0.65rem 0.32rem 0.5rem;
  background: linear-gradient(135deg, rgba(60,46,28,0.85) 0%, rgba(38,28,16,0.85) 100%);
  border: 1px solid rgba(var(--gold-rgb),0.45);
  border-radius: 4px;
  color: var(--accent);
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.2s var(--ease-out, ease);
  z-index: 2;
  box-shadow: 0 0 10px rgba(var(--gold-rgb),0.15);
}
.back-btn:hover {
  background: linear-gradient(135deg, var(--accent) 0%, #a8884a 100%);
  color: #1a1208;
  border-color: var(--accent);
  box-shadow: 0 0 16px rgba(var(--gold-rgb),0.4);
  transform: translateX(-1px);
}
.back-arrow { font-size: 1.05rem; line-height: 1; }
.back-label { letter-spacing: 0.06em; }

/* 顶部中央徽章：当前区域（可点击回第一页） */
.current-area {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.32rem 0.85rem;
  background: linear-gradient(180deg, rgba(var(--gold-rgb),0.15) 0%, rgba(8,8,14,0.85) 100%);
  border: 1px solid rgba(var(--gold-rgb),0.45);
  border-radius: 16px;
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--accent);
  cursor: pointer;
  transition: all 0.2s var(--ease-out, ease);
  z-index: 2;
  box-shadow: 0 0 14px rgba(var(--gold-rgb),0.2), inset 0 1px 0 rgba(255,235,180,0.18);
}
.current-area:hover {
  border-color: var(--accent);
  box-shadow: 0 0 20px rgba(var(--gold-rgb),0.35), inset 0 1px 0 rgba(255,235,180,0.3);
}
.current-area-glyph {
  font-size: 0.95rem;
  color: var(--accent);
  text-shadow: 0 0 6px rgba(var(--gold-rgb),0.5);
}
.current-area-name {
  letter-spacing: 0.06em;
  text-shadow: 0 0 6px rgba(var(--gold-rgb),0.25);
}
.current-area-lv {
  font-size: 0.7rem;
  color: rgba(var(--violet-rgb),0.75);
  font-family: monospace;
  letter-spacing: 0.04em;
}

/* ============ 第一/第二页 切换动画 ============ */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.28s var(--ease-out, ease), transform 0.28s var(--ease-out, ease);
}
.page-enter-from { opacity: 0; transform: translateX(-18px); }
.page-leave-to { opacity: 0; transform: translateX(18px); }

/* ============ 右侧侧栏（两页通用，与角色页统一样式） ============ */
.side-panel { position: fixed; right: 0; top: 50%; transform: translateY(-50%); display: flex; align-items: center; z-index: 50; transition: right 0.3s var(--ease-out); }
.side-panel:not(.expanded) { right: 0; }
.side-panel.expanded { right: 0; }
.side-toggle { width: 24px; height: 48px; background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #0a0b14; border: none; border-radius: 6px 0 0 6px; cursor: pointer; font-size: 1rem; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.side-toggle:hover { filter: brightness(1.1); }
.side-arrow { display: block; }
.side-tabs { display: flex; flex-direction: column; gap: 0.4rem; padding: 0.5rem; background: linear-gradient(135deg, rgba(var(--panel2-rgb), 0.95), rgba(var(--panel-rgb), 0.95)); border: 1px solid rgba(var(--violet-rgb), 0.2); border-radius: 8px 0 0 8px; min-width: 80px; }
.side-tab-item { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; padding: 0.4rem 0.3rem; border-radius: 6px; cursor: pointer; transition: all 0.2s; position: relative; }
.side-tab-item:hover { background: rgba(var(--gold-rgb), 0.1); }
.side-tab-icon { font-size: 1.1rem; color: var(--accent2); }
.side-tab-label { font-size: 0.72rem; color: var(--muted); }

.side-slide-enter-active, .side-slide-leave-active { transition: all 0.2s ease; overflow: hidden; }
.side-slide-enter-from, .side-slide-leave-to { transform: translateX(100%); opacity: 0; }
.side-slide-enter-to, .side-slide-leave-from { transform: translateX(0); opacity: 1; }

@media (max-width: 480px) {
  .back-label { display: none; } /* 移动端只显示箭头 */
  .back-btn { padding: 0.35rem 0.5rem; }
  .current-area { font-size: 0.74rem; padding: 0.3rem 0.7rem; }
}
</style>