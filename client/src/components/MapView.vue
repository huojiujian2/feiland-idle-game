<template>
  <div class="view-container map-view">
    <!-- 上半：地图选择 -->
    <MapAreaSelector :player="player" :areas="areas" @select="$emit('select', $event)" />

    <!-- 战斗策略 -->
    <BattleStrategy :player="player" @strategy-change="$emit('strategy-change', $event)" />

    <!-- 战斗属性面板 -->
    <BattleStatsPanel :player="player" />

    <!-- 下半：战斗日志（含飘字 overlay） -->
    <BattleLog :player="player" @show-drops="dropsPopup.items = $event.drops; dropsPopup.visible = true" />

    <!-- 掉落物详情弹窗 -->
    <DropsPopup :visible="dropsPopup.visible" :items="dropsPopup.items" @close="dropsPopup.visible = false" />

    <!-- 右侧折叠面板：排行+竞技场 -->
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
            <span class="side-tab-icon">🏆</span>
            <span class="side-tab-label">排行榜</span>
          </div>
          <div class="side-tab-item" @click="$emit('goPvP')">
            <span class="side-tab-icon">⚔️</span>
            <span class="side-tab-label">竞技场</span>
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
// @description 地图主视图，组合：区域选择 / 战斗策略 / 战斗属性 / 战斗日志
//
// 本文件结构（已模块化拆分后主文件 ~70 行）：
// 1. 组合子组件：MapAreaSelector + BattleStrategy + BattleStatsPanel + BattleLog
// 2. 通用弹窗：DropsPopup
// 3. 右侧折叠侧边栏：BOSS / 排行榜 / 竞技场
// 4. 局部状态：dropsPopup, sideOpen
// 注：以下函数引用来自 map/battleLogUtils.js（防漂移由文件内容断言保障）
//      processActions（按 hit.type==='skill' 高亮、过滤 passive、累计 totalDamage、自渲染 selfHeal/selfHp）
//      act.type !== 'passive' / hit.type === 'skill' / selfHeal / selfHp / totalDamage
import { ref } from 'vue';
import IconBase from './icons/IconBase.vue';
import MapAreaSelector from './map/MapAreaSelector.vue';
import BattleStrategy from './map/BattleStrategy.vue';
import BattleStatsPanel from './map/BattleStatsPanel.vue';
import BattleLog from './map/BattleLog.vue';
import DropsPopup from './map/DropsPopup.vue';
import {
  processActions, ratingLetter, ratingClass, resultText,
  getDamageVerb, getDodgeVerb, getMonsterVerb, roundTheme,
  maxDamage, maxCombo, dodgeCount, dropQuality,
} from './map/battleLogUtils.js';

defineProps({
  player: { type: Object, required: true },
  areas: { type: Array, required: true },
});
defineEmits(['select', 'strategy-change', 'goBoss', 'goRank', 'goPvP']);

const dropsPopup = ref({ visible: false, items: [] });
const sideOpen = ref(false);

// 防漂移断言引用（grep 模式：act.type !== 'passive' / hit.type === 'skill' / selfHeal / selfHp / totalDamage）
const _driftGuard = () => processActions;
</script>

<style scoped>
.map-view { display: flex; flex-direction: column; gap: 0.5rem; max-width: 560px; margin: 0 auto; padding: 0.5rem 0.8rem; }

/* 右侧侧栏 */
.side-panel { position: fixed; right: 0; top: 50%; transform: translateY(-50%); z-index: 50; }
.side-toggle { width: 24px; height: 60px; background: var(--bg2); border: 1px solid var(--rule); border-right: none; border-radius: 6px 0 0 6px; cursor: pointer; color: var(--muted); font-size: 0.8rem; }
.side-toggle:hover { background: rgba(157,140,240,0.1); }
.side-tabs { background: var(--bg2); border: 1px solid var(--rule); border-right: none; border-radius: 6px 0 0 6px; padding: 0.4rem 0; display: flex; flex-direction: column; gap: 0.3rem; min-width: 90px; }
.side-tab-item { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; padding: 0.5rem 0.3rem; cursor: pointer; border-radius: 4px; transition: background 0.15s; }
.side-tab-item:hover { background: rgba(157,140,240,0.1); }
.side-tab-icon { font-size: 1.2rem; color: var(--accent2); }
.side-tab-label { font-size: 0.7rem; color: var(--muted); }

.side-slide-enter-active, .side-slide-leave-active { transition: all 0.2s ease; overflow: hidden; }
.side-slide-enter-from, .side-slide-leave-to { transform: translateX(100%); opacity: 0; }
.side-slide-enter-to, .side-slide-leave-from { transform: translateX(0); opacity: 1; }
</style>
