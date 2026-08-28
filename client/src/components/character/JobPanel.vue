<template>
  <!-- 顶部：角色信息块（头像 + 名字 + 称号） -->
  <div class="char-top">
    <div class="char-info-block">
      <div class="char-avatar" :class="{ 'avatar-open': showAvatarPicker }" @click.stop="toggleAvatarPicker" :title="'点击更换头像'">
        {{ avatarDisplay }}
        <span v-if="!avatarDisplay" class="char-avatar-letter">{{ player.name.charAt(0) }}</span>
        <span class="char-avatar-tip">✎</span>
      </div>
      <transition name="avatar-pop">
        <div v-if="showAvatarPicker" class="avatar-picker" @click.stop>
          <div class="avatar-picker-title">选择头像</div>
          <div class="avatar-picker-grid">
            <button
              v-for="opt in AVATAR_OPTIONS"
              :key="opt.key"
              type="button"
              class="avatar-option"
              :class="{ active: opt.key === currentAvatarKey }"
              :title="opt.label"
              @click="pickAvatar(opt.value)"
            >
              <span class="avatar-glyph">{{ opt.glyph }}</span>
              <span class="avatar-label">{{ opt.label }}</span>
            </button>
          </div>
        </div>
      </transition>
      <div class="char-meta">
        <div class="char-name">{{ player.name }}</div>
        <div class="char-race">{{ player.race }} · <span class="title-text" :style="{ color: currentTitleColor }">{{ currentTitleName || player.job }}</span></div>
        <div class="char-stage" :style="{ color: player.stage.color }">{{ player.stage.name }}</div>
      </div>
    </div>
    <slot name="equip-slots" />
  </div>

  <!-- HP/MP/EXP 条 -->
  <div class="bars-section card">
    <div class="bar-row">
      <span class="bar-label">HP</span>
      <div class="bar"><div class="bar-fill hp" :style="{ width: hpPct + '%' }"></div></div>
      <span class="bar-val">{{ player.hp }}/{{ player.maxHp }}</span>
    </div>
    <div class="bar-row">
      <span class="bar-label">MP</span>
      <div class="bar"><div class="bar-fill mp" :style="{ width: mpPct + '%' }"></div></div>
      <span class="bar-val">{{ player.mp }}/{{ player.maxMp }}</span>
    </div>
    <div class="bar-row">
      <span class="bar-label">EXP</span>
      <div class="bar"><div class="bar-fill" :style="{ width: expPct + '%' }"></div></div>
      <span class="bar-val">{{ player.exp }}/{{ player.expNeeded }}</span>
    </div>
  </div>
</template>

<script setup>
// ====== 角色顶部信息 + HP/MP/EXP 条 + 头像选择 ======
// @file components/character/JobPanel
// @module character-job-panel
// @description 头像选择 + 名字/称号/种族 + HP/MP/EXP 条；职业 / 设置 / 右侧折叠 拆到 JobSettingsPanel.vue
import { ref, computed, onMounted, onUnmounted } from 'vue';
import IconBase from '../icons/IconBase.vue';
import { AVATAR_OPTIONS, resolveAvatarDisplay, resolveAvatarKey } from '../../utils/avatars.js';
import api from '../../api.js';
import { toast } from '../../ui-bridge.js';

const props = defineProps({
  player: { type: Object, required: true },
});
const emit = defineEmits(['avatarChanged']);

defineExpose({}); // 显式空 expose，方便未来扩展

// ====== 头像选择器 ======
const showAvatarPicker = ref(false);
const avatarDisplay = computed(() => resolveAvatarDisplay(props.player));
const currentAvatarKey = computed(() => resolveAvatarKey(props.player));
function toggleAvatarPicker() {
  showAvatarPicker.value = !showAvatarPicker.value;
}
async function pickAvatar(avatar) {
  if (!props.player?.username) return;
  try {
    const r = await api.setAvatar(props.player.username, avatar);
    if (r.success) {
      props.player.avatar = r.data.avatar;
      emit('avatarChanged', r.data.avatar);
      toast.success('头像已更新');
      showAvatarPicker.value = false;
    } else {
      toast.error(r.message || '头像更新失败');
    }
  } catch (e) {
    toast.error('头像更新失败：' + e.message);
  }
}
function onDocClick() {
  if (!showAvatarPicker.value) return;
  showAvatarPicker.value = false;
}
onMounted(() => { document.addEventListener('click', onDocClick); });
onUnmounted(() => { document.removeEventListener('click', onDocClick); });

// ====== 称号显示（仅取颜色/名称，不打开弹窗——弹窗在 JobSettingsPanel） ======
import { resolveTitleName, resolveTitleColor } from '../../utils/titles.js';
const _allTitleCache = ref({});
const currentTitleName = computed(() => resolveTitleName(props.player?.currentTitle, props.player, _allTitleCache));
const currentTitleColor = computed(() => resolveTitleColor(props.player?.currentTitle, _allTitleCache));

// ====== 状态条 ======
const hpPct = computed(() => Math.min(100, (props.player.hp / props.player.maxHp) * 100));
const mpPct = computed(() => Math.min(100, (props.player.mp / props.player.maxMp) * 100));
const expPct = computed(() => Math.min(100, (props.player.exp / props.player.expNeeded) * 100));
</script>
