<template>
  <!-- 顶部状态栏：头像 + 名牌 + 属性chip + 金币 + 按钮 -->
  <header class="game-header">
    <!-- 左侧：头像 + 名牌 -->
    <div class="header-left">
      <div class="header-avatar">
        <span class="header-avatar-icon">{{ avatarIcon }}</span>
      </div>
      <div class="header-id-stack">
        <div class="header-id-card">
          <span class="header-name">{{ player.name }}</span>
          <span class="header-race" v-if="player.race">· {{ player.race }}</span>
          <span v-if="player.currentTitle" class="header-title">· {{ player.currentTitle }}</span>
        </div>
        <div class="header-stats">
          <div class="header-chip" v-if="player.level != null">
            <span class="chip-label">等级</span>
            <span class="chip-val" :style="{ color: player.stage?.color }">{{ player.level }}</span>
          </div>
          <div class="header-chip" v-if="player.job && player.job !== '无'">
            <span class="chip-label">职业</span>
            <span class="chip-val">{{ player.job }}</span>
          </div>
          <div class="header-chip godhood" v-if="player.godhood === 'demigod'">
            <span class="chip-val">半神</span>
          </div>
          <div class="header-chip godhood god" v-if="player.godhood === 'god'">
            <span class="chip-val">神灵</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧：金币 + 按钮 -->
    <div class="header-right">
      <div class="header-gold-chip">
        <IconBase name="gold" :size="14" />
        <span>{{ player.gold }}</span>
      </div>
      <button class="header-icon-btn" :title="'商店'" @click="$emit('open-shop')">
        <IconBase name="shop" :size="18" />
      </button>
      <button class="header-icon-btn" :title="'退出'" @click="$emit('logout')">
        <IconBase name="logout" :size="18" />
      </button>
    </div>
  </header>
</template>

<script setup>
// ====== 顶部状态栏 ======
// @file components/TopBar
// @module top-bar
// @description 游戏主界面顶部：头像 + 名牌 + 属性chip + 金币 + 商店/退出按钮
import { computed } from 'vue';
import IconBase from './icons/IconBase.vue';

const props = defineProps({
  player: { type: Object, required: true },
});
defineEmits(['open-shop', 'logout']);

// 根据种族显示头像 emoji（视觉占位，后续可换 AI 立绘）
const avatarIcon = computed(() => {
  const r = props.player.race;
  if (r?.includes('鹰') || r?.includes('翼')) return '🦅';
  if (r?.includes('天使')) return '😇';
  if (r?.includes('魔')) return '😈';
  if (r?.includes('人')) return '🧝';
  return '🧙';
});
</script>

<style scoped>
/* 顶部栏容器 */
.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  flex-shrink: 0;
  min-height: 64px;
  /* 魔法卷轴纹理（横向平铺）+ 深色兜底 */
  background:
    url('/img/header-bg.png') repeat-x center / auto 100%,
    linear-gradient(180deg, rgba(20,22,42,0.7), rgba(10,11,20,0.85));
  backdrop-filter: blur(12px);
  border-top: none;
  border-bottom: 1px solid rgba(157,140,240,0.1);
  position: relative;
  z-index: 50;
}
/* 顶部不要任何金线/光晕线 */
.game-header::before {
  content: none;
}

/* 左侧：头像 + 名牌 */
.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

/* 头像：52x52 圆角方块 + 金边 */
.header-avatar {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background: linear-gradient(135deg, #2a1c4e, #1c1e36);
  border: 2px solid var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 0 12px rgba(212,175,94,0.4);
  font-size: 26px;
  line-height: 1;
}
.header-avatar-icon {
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
}

/* 名牌区 */
.header-id-stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

/* 名字卡：金边深色背景 */
.header-id-card {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  background: linear-gradient(135deg, rgba(28,30,54,0.85), rgba(20,22,42,0.75));
  border: 1px solid rgba(212,175,94,0.3);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.05em;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.header-name {
  color: var(--ink);
  font-weight: 800;
}
.header-race {
  color: var(--accent2);
  font-size: 11px;
  font-weight: 600;
}
.header-title {
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
}

/* 属性 chip 行 */
.header-stats {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.header-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  background: linear-gradient(135deg, rgba(28,30,54,0.75), rgba(20,22,42,0.65));
  border: 1px solid rgba(157,140,240,0.18);
  border-radius: 6px;
  font-size: 10px;
  line-height: 1.4;
}
.chip-label {
  color: var(--dim);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.chip-val {
  color: var(--accent);
  font-weight: 700;
  font-size: 11px;
  font-family: monospace;
}
.header-chip.godhood {
  border-color: var(--accent2);
  background: rgba(157,140,240,0.15);
}
.header-chip.godhood .chip-val { color: var(--accent2); }
.header-chip.godhood.god {
  border-color: var(--accent);
  background: rgba(212,175,94,0.15);
  box-shadow: 0 0 6px rgba(212,175,94,0.3);
}
.header-chip.godhood.god .chip-val { color: var(--accent); }

/* 右侧 */
.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* 金币chip */
.header-gold-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: linear-gradient(135deg, rgba(28,30,54,0.85), rgba(20,22,42,0.75));
  border: 1px solid rgba(212,175,94,0.3);
  border-radius: 999px;
  color: var(--accent);
  font-weight: 700;
  font-size: 12px;
  font-family: monospace;
}

/* 头部图标按钮 */
.header-icon-btn {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, rgba(28,30,54,0.6), rgba(20,22,42,0.5));
  border: 1px solid rgba(157,140,240,0.2);
  border-radius: 8px;
  color: var(--muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast) var(--ease-out);
}
.header-icon-btn:hover {
  border-color: var(--accent2);
  color: var(--accent2);
  background: rgba(157,140,240,0.15);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(157,140,240,0.2);
}
.header-icon-btn:active { transform: translateY(0) scale(0.95); }

/* 移动端适配 */
@media (max-width: 380px) {
  .header-avatar { width: 44px; height: 44px; font-size: 22px; }
  .header-id-card { font-size: 12px; padding: 2px 8px; }
  .header-chip { padding: 1px 5px; }
  .header-gold-chip { padding: 3px 7px; font-size: 11px; }
  .header-icon-btn { width: 32px; height: 32px; }
}
</style>