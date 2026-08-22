<template>
  <!-- 顶部状态栏 -->
  <header class="game-header">
    <div class="header-left">
      <span class="header-name">{{ player.name }}</span>
      <span class="header-race">{{ player.race }}</span>
      <span v-if="player.currentTitle" class="header-race" style="color:var(--accent)">{{ player.currentTitle }}</span>
      <span class="header-level" :style="{ color: player.stage.color }">Lv.{{ player.level }}</span>
      <span class="header-job" v-if="player.job !== '无'">{{ player.job }}</span>
      <span class="header-godhood" v-if="player.godhood === 'demigod'">半神</span>
      <span class="header-godhood god" v-if="player.godhood === 'god'">神灵</span>
    </div>
    <div class="header-right">
      <span class="header-gold"><IconBase name="gold" :size="16" class="icon-accent" /> {{ player.gold }}</span>
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
// @description 游戏主界面顶部：角色名/种族/等级/职业 + 金币 + 商店/退出按钮
import IconBase from './icons/IconBase.vue';

defineProps({
  player: { type: Object, required: true },
});
defineEmits(['open-shop', 'logout']);
</script>

<style scoped>
.game-header { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.8rem; background: var(--bg2); border-bottom: 1px solid var(--rule); flex-shrink: 0; }
.header-left { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; font-size: 0.85rem; min-width: 0; flex: 1; }
.header-name { font-weight: 800; color: var(--text); }
.header-race { color: var(--muted); font-size: 0.72rem; }
.header-level { font-weight: 800; color: var(--accent); font-family: monospace; }
.header-job { color: var(--accent2); font-size: 0.72rem; padding: 0.05rem 0.3rem; background: rgba(157,140,240,0.15); border-radius: 3px; }
.header-godhood { font-size: 0.7rem; padding: 0.05rem 0.3rem; background: var(--accent2); color: var(--bg); border-radius: 3px; font-weight: 700; }
.header-godhood.god { background: var(--accent); }
.header-right { display: flex; align-items: center; gap: 0.4rem; }
.header-gold { display: flex; align-items: center; gap: 0.2rem; color: var(--accent); font-weight: 700; font-family: monospace; }
.header-icon-btn { width: 32px; height: 32px; background: transparent; border: 1px solid var(--rule); border-radius: 6px; color: var(--muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
.header-icon-btn:hover { border-color: var(--accent2); color: var(--accent2); background: rgba(157,140,240,0.1); }
</style>
