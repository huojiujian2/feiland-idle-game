<template>
  <!-- 升级提示 -->
  <transition name="levelup">
    <div v-if="level" class="levelup-notice">
      <span>等级提升！Lv.{{ level }}</span>
    </div>
  </transition>
</template>

<script setup>
// ====== 升级提示 ======
// @file components/LevelUpNotice
// @module level-up-notice
// @description 主界面顶部淡入淡出的升级提示横幅
defineProps({
  level: { type: Number, default: null },
});
</script>

<style scoped>
.levelup-notice { position: fixed; top: 4rem; left: 50%; transform: translateX(-50%); padding: 0.5rem 1.2rem; background: linear-gradient(135deg, var(--accent), #c4a04e); color: var(--bg); border-radius: 20px; font-weight: 700; font-size: 0.95rem; box-shadow: 0 4px 20px rgba(212,175,94,0.5); z-index: 100; }
.levelup-enter-active, .levelup-leave-active { transition: all 0.5s ease; }
.levelup-enter-from { opacity: 0; transform: translate(-50%, -20px); }
.levelup-leave-to { opacity: 0; transform: translate(-50%, -20px); }
</style>
