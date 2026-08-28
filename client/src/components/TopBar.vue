<template>
  <header class="game-header">
    <div class="header-left">
      <div class="header-avatar">
        <span class="header-avatar-icon">{{ avatarIcon }}</span>
      </div>
      <div class="header-id-stack">
        <div class="header-id-card">
          <span class="header-name">{{ player.name }}</span>
          <span class="header-race" v-if="player.race">· {{ player.race }}</span>
        </div>
        <div class="header-stats">
          <div class="header-chip" v-if="player.level != null">
            <span class="chip-label">等级</span>
            <span class="chip-val" :style="{ color: player.stage?.color }">{{ player.level }}</span>
          </div>
          <div class="header-chip" v-if="currentTitleName">
            <span class="chip-label">称号</span>
            <span class="chip-val" :style="{ color: currentTitleColor }">{{ currentTitleName }}</span>
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
import { computed, ref, watch, onMounted } from "vue";
import IconBase from "./icons/IconBase.vue";
import { resolveAvatarDisplay } from "../utils/avatars";
import { resolveTitleName, resolveTitleColor } from "../utils/titles";
import api from "../api.js";

const props = defineProps({
  player: { type: Object, required: true },
});
defineEmits(["open-shop", "logout"]);

// 种族 emoji 用 String.fromCodePoint 构造（避免写入工具截断 emoji）
function raceIcon(race) {
  if (!race) return "��";
  if (race.indexOf("鹰") >= 0 || race.indexOf("翼") >= 0) return String.fromCodePoint(0x1F985);
  if (race.indexOf("天使") >= 0) return String.fromCodePoint(0x1F607);
  if (race.indexOf("魔") >= 0) return String.fromCodePoint(0x1F608);
  if (race.indexOf("人") >= 0) return String.fromCodePoint(0x1F9DD);
  return "��";
}

// v1.02：自定义头像优先（player.avatar），否则按种族自动 emoji
const avatarIcon = computed(() => {
  const custom = resolveAvatarDisplay(props.player);
  if (custom && custom.length) return custom;
  return raceIcon(props.player.race);
});

// ====== 顶部 chip 的「称号」跟随 player.currentTitle 实时变化（v1.07） ======
// 之前 chip 显示的是 player.job（职业），导致切换职业阶段称号 / 限时称号后顶部不变。
// 这里复用 utils/titles.js 的解析逻辑；用本地 cache 装 api.getTitles 返回的 all 字典，
// 保证 jobInfo.stages 之外的 key（职业阶段、限时）也能解析出正确 name/color。
const _allTitleCache = ref({});
const currentTitleName = computed(() => resolveTitleName(props.player?.currentTitle, props.player, _allTitleCache));
const currentTitleColor = computed(() => resolveTitleColor(props.player?.currentTitle, _allTitleCache));

async function refreshTitleCache() {
  const uname = props.player?.username;
  if (!uname) return;
  try {
    const res = await api.getTitles(uname);
    if (res?.success) _allTitleCache.value = res.data?.all || {};
  } catch (_) { /* ignore */ }
}
// 初始化 + 监听 currentTitle / username 变化时刷新缓存（避免职业切换后 chip 显示旧名）
onMounted(refreshTitleCache);
watch(() => [props.player?.username, props.player?.currentTitle], refreshTitleCache);
</script>

<style scoped>
.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  flex-shrink: 0;
  min-height: 64px;
  background:
    url("/img/header-bg.png") repeat-x center / auto 100%,
    linear-gradient(180deg, rgba(var(--panel-rgb),0.7), rgba(10,11,20,0.85));
  backdrop-filter: blur(12px);
  border-top: none;
  border-bottom: 1px solid rgba(var(--violet-rgb),0.1);
  position: relative;
  z-index: 50;
}
.game-header::before { content: none; }

.header-left { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }

.header-avatar {
  width: 52px; height: 52px; border-radius: 12px;
  background: linear-gradient(135deg, #2a1c4e, #1c1e36);
  border: 2px solid var(--accent);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; box-shadow: 0 0 12px rgba(var(--gold-rgb),0.4);
  font-size: 26px; line-height: 1;
}
.header-avatar-icon { filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5)); }

.header-id-stack { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }

.header-id-card {
  display: inline-flex; align-items: center; align-self: flex-start; gap: 6px;
  padding: 3px 10px;
  background: linear-gradient(135deg, rgba(var(--panel2-rgb),0.85), rgba(var(--panel-rgb),0.75));
  border: 1px solid rgba(var(--gold-rgb),0.3);
  border-radius: 8px; font-size: 13px; font-weight: 700; letter-spacing: 0.05em;
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.header-name { color: var(--ink); font-weight: 800; }
.header-race { color: var(--accent2); font-size: 11px; font-weight: 600; }
.header-title { color: var(--accent); font-size: 11px; font-weight: 600; }

.header-stats { display: flex; gap: 4px; flex-wrap: wrap; }
.header-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 7px;
  background: linear-gradient(135deg, rgba(var(--panel2-rgb),0.75), rgba(var(--panel-rgb),0.65));
  border: 1px solid rgba(var(--violet-rgb),0.18);
  border-radius: 6px; font-size: 10px; line-height: 1.4;
}
.chip-label { color: var(--dim); font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; }
.chip-val { color: var(--accent); font-weight: 700; font-size: 11px; font-family: monospace; }
.header-chip.godhood { border-color: var(--accent2); background: rgba(var(--violet-rgb),0.15); }
.header-chip.godhood .chip-val { color: var(--accent2); }
.header-chip.godhood.god { border-color: var(--accent); background: rgba(var(--gold-rgb),0.15); box-shadow: 0 0 6px rgba(var(--gold-rgb),0.3); }
.header-chip.godhood.god .chip-val { color: var(--accent); }

.header-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

.header-gold-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px;
  background: linear-gradient(135deg, rgba(var(--panel2-rgb),0.85), rgba(var(--panel-rgb),0.75));
  border: 1px solid rgba(var(--gold-rgb),0.3);
  border-radius: 999px; color: var(--accent); font-weight: 700; font-size: 12px; font-family: monospace;
}

.header-icon-btn {
  width: 36px; height: 36px;
  background: linear-gradient(135deg, rgba(var(--panel2-rgb),0.6), rgba(var(--panel-rgb),0.5));
  border: 1px solid rgba(var(--violet-rgb),0.2);
  border-radius: 8px; color: var(--muted); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--duration-fast) var(--ease-out);
}
.header-icon-btn:hover {
  border-color: var(--accent2); color: var(--accent2);
  background: rgba(var(--violet-rgb),0.15);
  transform: translateY(-1px); box-shadow: 0 2px 8px rgba(var(--violet-rgb),0.2);
}
.header-icon-btn:active { transform: translateY(0) scale(0.95); }

@media (max-width: 600px) {
  .game-header {
    align-items: flex-start;
    gap: 5px 8px;
    padding: 6px 8px;
    min-height: 64px;
  }
  /* 手机端右侧操作保持在顶部，左侧信息为其预留宽度 */
  .header-left {
    flex: 1 1 auto;
    width: calc(100% - 166px);
    max-width: calc(100% - 166px);
    gap: 8px;
  }
  .header-avatar { width: 44px; height: 44px; font-size: 22px; border-radius: 10px; }
  .header-id-stack { gap: 3px; }
  .header-id-card { max-width: 100%; padding: 3px 7px; font-size: 12px; }
  .header-stats { gap: 3px; flex-wrap: nowrap; overflow: hidden; }
  .header-chip { min-width: 0; padding: 2px 5px; white-space: nowrap; }
  .header-chip .chip-label { font-size: 8px; }
  .header-chip .chip-val { font-size: 10px; }
  .header-right {
    position: absolute;
    top: 50%;
    right: 8px;
    transform: translateY(-50%);
    gap: 5px;
  }
  .header-gold-chip { max-width: 7rem; padding: 3px 8px; font-size: 11px; overflow: hidden; white-space: nowrap; }
  .header-icon-btn { width: 32px; height: 32px; }
}

@media (max-width: 380px) {
  .header-avatar { width: 40px; height: 40px; font-size: 20px; }
  .header-id-card { font-size: 11px; padding: 2px 6px; }
  .header-chip { padding: 1px 4px; }
  .header-left { width: calc(100% - 150px); max-width: calc(100% - 150px); }
  .header-right { right: 6px; gap: 3px; }
  .header-gold-chip { max-width: 5.5rem; padding-left: 5px; padding-right: 5px; font-size: 10px; }
  .header-icon-btn { width: 29px; height: 29px; }
}
</style>
