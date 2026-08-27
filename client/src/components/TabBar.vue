<template>
  <!-- 底部 TabBar：5 个大圆头像 + 文字标签 + 角标 -->
  <nav class="tabbar">
    <div v-for="tab in tabs" :key="tab.id" class="tabbar-item"
      :class="{
        active: activeTab === tab.id,
        'tabbar-center': tab.id === 'map',
        'has-badge': tab.badge
      }"
      :data-tab="tab.id" @click="$emit('tab-click', tab.id)">
      <div class="tabbar-icon-wrap">
        <IconBase :name="tab.icon" :size="28" class="tabbar-icon" />
      </div>
      <span class="tabbar-text">{{ tab.label }}</span>
      <span v-if="tab.badge" class="tabbar-badge">{{ tab.badge }}</span>
    </div>
  </nav>
</template>

<script setup>
// ====== 底部 TabBar ======
// @file components/TabBar
// @module tab-bar
// @description 主界面底部固定 5 Tab，每个 Tab 配大圆头像 + 文字标签 + 红点角标
import IconBase from './icons/IconBase.vue';

defineProps({
  tabs: { type: Array, required: true },
  activeTab: { type: String, required: true },
});
defineEmits(['tab-click']);
</script>

<style scoped>
.tabbar {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  padding: 6px 4px 8px;
  flex-shrink: 0;
  position: relative;
  min-height: var(--tabbar-h);
}

.tabbar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 2px 4px 4px;
  cursor: pointer;
  color: var(--muted);
  transition: all var(--duration-normal) var(--ease-spring);
  position: relative;
  flex: 1;
  min-width: 0;
}

/* 图标容器：纯透明，无圆形边框 */
.tabbar-icon-wrap {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--duration-normal) var(--ease-spring);
  flex-shrink: 0;
}

.tabbar-icon {
  font-size: 22px;
  line-height: 1;
  transition: filter var(--duration-normal) var(--ease-out);
}

/* hover 态：图标轻微上浮（仅 transform，不再改边框/背景） */
.tabbar-item:hover {
  color: var(--ink);
}
.tabbar-item:hover .tabbar-icon-wrap {
  transform: translateY(-2px);
}

/* 激活态：仅文字金色 + 图标上浮（无边框/背景） */
.tabbar-item.active {
  color: var(--accent);
}
.tabbar-item.active .tabbar-icon-wrap {
  transform: translateY(-2px);
}

/* 中间地图 Tab 图标略大 */
.tabbar-item.tabbar-center {
  z-index: 2;
}
.tabbar-item.tabbar-center .tabbar-icon-wrap {
  width: 38px;
  height: 38px;
}
.tabbar-item.tabbar-center .tabbar-icon {
  font-size: 26px;
}

/* 标签文字 */
.tabbar-text {
  font-size: 10px;
  letter-spacing: 0.05em;
  font-weight: 600;
  margin-top: 1px;
}

/* 角标（红点） */
.tabbar-badge {
  position: absolute;
  top: -2px;
  right: calc(50% - 22px);
  min-width: 16px;
  height: 16px;
  padding: 0 5px;
  background: var(--danger);
  color: #fff;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  box-shadow: 0 0 8px rgba(224,88,88,0.6);
  animation: tabbar-badge-pulse 2s ease-in-out infinite;
  z-index: 3;
}

@keyframes tabbar-badge-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.12); box-shadow: 0 0 12px rgba(224,88,88,0.8); }
}
</style>