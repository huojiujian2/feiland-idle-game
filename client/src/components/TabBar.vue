<template>
  <!-- 底部 TabBar（固定 5 个，中间地图凸起圆形） -->
  <nav class="tabbar">
    <div v-for="tab in tabs" :key="tab.id" class="tabbar-item"
      :class="{ active: activeTab === tab.id, 'tabbar-center': tab.id === 'map' }"
      :data-tab="tab.id" @click="$emit('tab-click', tab.id)">
      <IconBase :name="tab.icon" :size="tab.id === 'map' ? 24 : 20" class="tabbar-icon" />
      <span class="tabbar-text">{{ tab.label }}</span>
      <span v-if="tab.badge" class="tabbar-badge">{{ tab.badge }}</span>
    </div>
  </nav>
</template>

<script setup>
// ====== 底部 TabBar ======
// @file components/TabBar
// @module tab-bar
// @description 主界面底部固定 5 Tab（角色/技能/地图/背包/图鉴），中间地图 Tab 凸起圆形
import IconBase from './icons/IconBase.vue';

defineProps({
  tabs: { type: Array, required: true },
  activeTab: { type: String, required: true },
});
defineEmits(['tab-click']);
</script>

<style scoped>
.tabbar { display: flex; justify-content: space-around; align-items: center; padding: 0.4rem 0.5rem 0.5rem; background: var(--bg2); border-top: 1px solid var(--rule); position: relative; flex-shrink: 0; }
.tabbar-item { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; padding: 0.3rem 0.6rem; cursor: pointer; color: var(--muted); transition: all 0.15s; position: relative; min-width: 56px; }
.tabbar-item:hover { color: var(--accent2); }
.tabbar-item.active { color: var(--accent); }
.tabbar-item.active .tabbar-icon { transform: scale(1.1); }
.tabbar-item.tabbar-center { margin-top: -1.4rem; z-index: 2; }
.tabbar-item.tabbar-center .tabbar-icon { width: 48px; height: 48px; line-height: 48px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), #c4a04e); color: var(--bg); font-size: 1.4rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(212,175,94,0.4), 0 0 0 4px var(--bg2); }
.tabbar-item.tabbar-center.active .tabbar-icon { background: linear-gradient(135deg, var(--accent), #e8c45e); }
.tabbar-icon { transition: transform 0.15s; }
.tabbar-text { font-size: 0.7rem; }
.tabbar-badge { position: absolute; top: -2px; right: 4px; min-width: 1.1rem; height: 1.1rem; padding: 0 0.25rem; background: var(--danger); color: white; border-radius: 50%; font-size: 0.65rem; font-weight: 700; display: flex; align-items: center; justify-content: center; line-height: 1; }
</style>
