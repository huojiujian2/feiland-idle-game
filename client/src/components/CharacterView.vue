<template>
  <div class="view-container char-view">
    <!-- 1. 顶部：角色信息 + 装备格子 + HP/MP/EXP -->
    <JobPanel :player="player" @avatar-changed="(a) => $emit('avatarChanged', a)">
      <template #equip-slots>
        <EquipSlots :player="player" @unequip="(s) => $emit('unequip', s)" @enchant="(u, r) => $emit('enchant', u, r)" />
      </template>
    </JobPanel>

    <!-- 2. 属性分配 + 属性预设 -->
    <AttrAllocator
      :player="player"
      @allocate="(d) => $emit('allocate', d)"
      @save-preset="(p) => $emit('savePreset', p)"
      @apply-preset="(p) => $emit('applyPreset', p)"
      @delete-preset="(i) => $emit('deletePreset', i)"
    />

    <!-- 3. 职业 + 设置栏 + 右侧折叠面板 -->
    <JobSettingsPanel
      :player="player"
      :job-tree="jobTree"
      @choose-job="(p) => $emit('chooseJob', p)"
      @go-evo="$emit('goEvo')"
      @go-quest="$emit('goQuest')"
      @go-genesis="$emit('goGenesis')"
    />
  </div>
</template>

<script setup>
// ====== 角色页（模块化重定向壳） ======
// @file components/CharacterView
// @module character-view
// @description 3 子组件容器（按 DOM 顺序：顶部信息+HUD → 属性+预设 → 职业+设置）。
//              本文件仅负责 props/emit 透传。
import JobPanel from './character/JobPanel.vue';
import JobSettingsPanel from './character/JobSettingsPanel.vue';
import AttrAllocator from './character/AttrAllocator.vue';
import EquipSlots from './character/EquipSlots.vue';

defineProps(['player', 'jobTree']);
defineEmits([
  'allocate',
  'equip',
  'unequip',
  'enchant',
  'chooseJob',
  'goEvo',
  'goQuest',
  'goGenesis',
  'refresh',
  'savePreset',
  'applyPreset',
  'deletePreset',
  'avatarChanged',
]);
</script>

<style scoped>
/* ============ 子组件样式透传（:deep()） ============
   3 个子组件（JobPanel / AttrAllocator / EquipSlots）都使用 .card / .section-header /
   .btn / .char-* / .bar-* / .attr-* / .combat-* / .preset-* / .equip-* / .side-* / .theme-* 等 class。
   scoped 样式只对当前组件模板生效，必须用 :deep() 让子组件内部 class 命中。*/

/* ===== 容器 ===== */
/* v1.03：此处曾 padding-bottom:1rem 覆盖掉 .view-container 的 TabBar 底部预留
   （scoped 选择器优先级更高），导致设置栏被垫高后的 TabBar 挡住 —— 改为叠加预留 */
.char-view { padding-bottom: calc(var(--tabbar-h) + var(--safe-bottom) + var(--browser-bar-h, 0px) + 1.75rem); }
/* char-top 在 JobPanel 子组件根元素上，需 :deep() 透传 */
:deep(.char-top) { display: flex; gap: 0.8rem; margin-bottom: 0.6rem; }

/* ===== 角色信息块 + 头像（JobPanel 子组件） ===== */
:deep(.char-info-block) { display: flex; gap: 0.6rem; flex: 1; align-items: center; }
:deep(.char-avatar) {
  width: 56px; height: 56px; border-radius: 12px;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  display: flex; align-items: center; justify-content: center;
  font-size: 1.6rem; font-weight: 700; color: #0a0b14;
  position: relative; cursor: pointer;
  transition: transform 0.15s var(--ease-out), box-shadow 0.15s var(--ease-out);
}
:deep(.char-avatar:hover) { transform: scale(1.05); box-shadow: 0 0 12px rgba(var(--gold-rgb), 0.5); }
:deep(.char-avatar.avatar-open) { box-shadow: 0 0 16px rgba(var(--gold-rgb), 0.7); }
:deep(.char-avatar-letter) { font-size: 1.4rem; line-height: 1; }
:deep(.char-avatar-tip) {
  position: absolute; right: -3px; bottom: -3px;
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--accent); color: #0a0b14; font-size: 0.65rem;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid rgba(var(--panel-rgb), 1);
  box-shadow: 0 1px 4px rgba(0,0,0,0.4); pointer-events: none;
}

/* 头像选择气泡 */
:deep(.avatar-picker) {
  position: absolute; top: 64px; left: 0; z-index: 120;
  width: 240px; padding: 0.7rem 0.7rem 0.6rem;
  border-radius: 12px;
  background: linear-gradient(160deg, rgba(var(--panel2-rgb), 0.97), rgba(var(--panel-rgb), 0.97));
  border: 1px solid rgba(var(--violet-rgb), 0.3);
  box-shadow: 0 12px 36px rgba(0,0,0,0.5), 0 0 18px rgba(var(--gold-rgb), 0.18);
}
:deep(.avatar-picker-title) { font-size: 0.78rem; color: var(--accent); font-weight: 700; letter-spacing: 0.06em; text-align: center; margin-bottom: 0.45rem; }
:deep(.avatar-picker-grid) { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.3rem; }
:deep(.avatar-option) {
  display: flex; flex-direction: column; align-items: center; gap: 0.15rem;
  padding: 0.4rem 0.1rem;
  background: rgba(var(--panel-rgb), 0.5);
  border: 1px solid rgba(var(--violet-rgb), 0.18);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s var(--ease-out);
  font-family: inherit;
  color: var(--ink);
}
:deep(.avatar-option:hover) { border-color: var(--accent); background: rgba(var(--gold-rgb), 0.08); transform: translateY(-1px); }
:deep(.avatar-option.active) { border-color: var(--accent); background: linear-gradient(135deg, rgba(var(--gold-rgb), 0.18), rgba(var(--panel2-rgb), 0.6)); box-shadow: 0 0 8px rgba(var(--gold-rgb), 0.4); }
:deep(.avatar-glyph) { font-size: 1.5rem; line-height: 1; }
:deep(.avatar-label) { font-size: 0.6rem; color: var(--muted); }
:deep(.avatar-pop-enter-active), :deep(.avatar-pop-leave-active) { transition: opacity 0.15s var(--ease-out), transform 0.15s var(--ease-out); transform-origin: top left; }
:deep(.avatar-pop-enter-from), :deep(.avatar-pop-leave-to) { opacity: 0; transform: scale(0.92); }

:deep(.char-meta) { flex: 1; }
:deep(.char-name) { font-size: 1.1rem; font-weight: 700; }
:deep(.char-race) { font-size: 0.78rem; color: var(--muted); margin-top: 0.2rem; }
:deep(.title-text) { font-weight: 600; }
:deep(.char-stage) { font-size: 0.72rem; font-weight: 700; margin-top: 0.15rem; }

/* ===== 装备格子 ===== */
:deep(.equip-grid) { display: flex; gap: 0.3rem; flex-wrap: wrap; align-items: flex-start; }
:deep(.equip-slot) {
  width: 64px; padding: 0.4rem;
  border: 1px solid rgba(var(--violet-rgb), 0.1); border-radius: 8px;
  text-align: center; cursor: pointer;
  background: rgba(var(--panel-rgb), 0.5);
  position: relative;
}
:deep(.equip-slot.filled) { border-color: rgba(var(--gold-rgb), 0.4); }
:deep(.equip-slot.enchant-1) { border-color: #9d8cf0; box-shadow: 0 0 6px rgba(157,140,240,0.45); }
:deep(.equip-slot.enchant-2) { border-color: #d4af5e; box-shadow: 0 0 6px rgba(212,175,94,0.45); }
:deep(.equip-slot.enchant-3) { border-color: #ff6738; box-shadow: 0 0 8px rgba(255,103,56,0.55); }
:deep(.slot-icon) { display: flex; justify-content: center; }
:deep(.slot-label) { font-size: 0.65rem; color: var(--muted); margin-top: 0.15rem; }
:deep(.slot-item) { font-size: 0.62rem; margin-top: 0.15rem; font-weight: 600; word-break: break-all; line-height: 1.15; }
:deep(.slot-empty) { font-size: 0.62rem; color: var(--dim); margin-top: 0.15rem; }
:deep(.slot-upgrade) {
  position: absolute; top: 1px; right: 3px;
  font-size: 0.55rem; color: #d4af5e; font-weight: 700;
  text-shadow: 0 0 4px rgba(0,0,0,0.6);
}

/* ===== 通用卡片 + 区段头 ===== */
:deep(.card) {
  padding: 0.6rem 0.8rem; margin-bottom: 0.4rem;
  background: linear-gradient(135deg, rgba(var(--panel2-rgb),0.65), rgba(var(--panel-rgb),0.55));
  border-radius: 10px;
  border: 1px solid rgba(var(--violet-rgb),0.1);
}
:deep(.section-header) {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 0.4rem; font-size: 0.85rem; color: var(--muted);
  cursor: pointer; user-select: none;
}
:deep(.section-icon) { display: inline-flex; vertical-align: middle; }
:deep(.toggle-icon) { font-size: 0.85rem; color: var(--accent); }

/* ===== HP/MP/EXP 条 ===== */
:deep(.bars-section) { display: flex; flex-direction: column; gap: 0.25rem; }
:deep(.bar-row) { display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; }
:deep(.bar-label) { width: 36px; color: var(--muted); font-weight: 600; }
:deep(.bar) { flex: 1; height: 8px; background: rgba(var(--panel-rgb), 0.6); border-radius: 4px; overflow: hidden; }
:deep(.bar-fill) { height: 100%; transition: width 0.3s; border-radius: 4px; }
:deep(.bar-fill.hp) { background: linear-gradient(90deg, #ff8080, #d63a3a); }
:deep(.bar-fill.mp) { background: linear-gradient(90deg, #80c8ff, #4090d0); }
:deep(.bar-val) { font-family: monospace; font-size: 0.7rem; color: var(--muted); min-width: 96px; text-align: right; }

/* ===== 属性分配卡片 ===== */
:deep(.attr-list) { display: flex; flex-direction: column; gap: 0.3rem; }
:deep(.attr-row) { display: flex; align-items: center; gap: 0.5rem; padding: 0.2rem 0.4rem; background: rgba(var(--panel-rgb), 0.4); border-radius: 6px; }
:deep(.attr-name) { width: 56px; color: var(--ink); font-size: 0.82rem; }
:deep(.attr-val) { font-family: monospace; font-weight: 700; color: var(--accent); min-width: 40px; text-align: center; }
:deep(.attr-total) { font-size: 0.72rem; color: var(--accent2); }
:deep(.pts-badge) { font-size: 0.72rem; color: var(--accent); font-weight: 700; }
:deep(.pts-badge--zero) { color: var(--dim); }
:deep(.attr-controls) { display: flex; align-items: center; gap: 0.3rem; margin-left: auto; }
:deep(.adj-btn) {
  width: 26px; height: 26px; border-radius: 50%;
  border: 1px solid var(--accent);
  background: rgba(var(--gold-rgb), 0.1);
  color: var(--accent); font-size: 1rem; cursor: pointer;
}
:deep(.adj-btn.btn-disabled) { opacity: 0.4; cursor: not-allowed; }
:deep(.attr-qty-input) {
  width: 3.2rem; min-width: 0; height: 26px; box-sizing: border-box;
  padding: 0.1rem 0.15rem; text-align: center;
  color: var(--accent2); background: var(--bg);
  border: 1px solid var(--accent); border-radius: 4px;
  font-family: monospace; font-size: 0.78rem; font-weight: 600;
  overflow: hidden; text-overflow: clip;
}
:deep(.attr-qty-input:focus) { outline: 2px solid rgba(var(--accent-rgb), 0.35); outline-offset: 1px; }
:deep(.attr-qty-input::-webkit-inner-spin-button),
:deep(.attr-qty-input::-webkit-outer-spin-button) { -webkit-appearance: none; margin: 0; }
:deep(.attr-qty-input) { -moz-appearance: textfield; }

/* ===== 战斗统计 ===== */
:deep(.combat-summary) {
  display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0.4rem 0;
  font-size: 0.72rem; color: var(--muted);
  border-top: 1px dashed rgba(var(--violet-rgb), 0.15);
  margin-top: 0.3rem;
}
:deep(.cs-item) { display: inline-flex; align-items: center; gap: 0.2rem; }
:deep(.combat-record) { margin-top: 0.3rem; padding: 0.4rem 0.5rem; background: rgba(var(--panel-rgb), 0.5); border-radius: 6px; }
:deep(.record-title) { font-size: 0.72rem; color: var(--muted); margin-bottom: 0.3rem; }
:deep(.record-grid) { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.2rem 0.6rem; }
:deep(.record-item) { display: flex; justify-content: space-between; align-items: center; font-size: 0.7rem; }
:deep(.record-label) { color: var(--muted); }
:deep(.record-value) { color: var(--ink); font-family: monospace; }
:deep(.record-value.highlight) { color: var(--accent); font-weight: 600; }
:deep(.win) { color: var(--success); }
:deep(.lose) { color: var(--danger); }
:deep(.draw) { color: var(--accent2); }

/* ===== 主属性提交按钮 ===== */
:deep(.confirm-row) { display: flex; gap: 0.4rem; margin-top: 0.4rem; }
:deep(.confirm-btn) { flex: 1; }
:deep(.reset-btn) { padding: 0.3rem 0.7rem; }

/* ===== 属性预设卡片 ===== */
:deep(.presets-section) { margin-top: 0.6rem; }
:deep(.presets-content) { margin-top: 0.3rem; }
:deep(.presets-meta) { margin-bottom: 0.3rem; }
:deep(.presets-hint) { font-size: 0.7rem; color: var(--muted); padding: 0.3rem 0; line-height: 1.5; }
:deep(.attr-bonus) { font-family: monospace; color: var(--accent); }
:deep(.preset-list) { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.4rem; margin-top: 0.4rem; }
:deep(.preset-card) { padding: 0.5rem 0.6rem; background: rgba(var(--panel2-rgb), 0.55); border: 1px solid rgba(var(--violet-rgb), 0.18); border-radius: 6px; }
:deep(.preset-card-top) { display: flex; align-items: center; gap: 0.3rem; margin-bottom: 0.3rem; }
:deep(.preset-index) { font-size: 0.72rem; color: var(--accent); font-weight: 700; min-width: 18px; text-align: center; }
:deep(.preset-name) { font-size: 0.75rem; font-weight: 600; color: var(--ink); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
:deep(.preset-filled) { font-size: 0.65rem; color: var(--success); font-family: monospace; }
:deep(.preset-empty-tag) { font-size: 0.65rem; color: var(--dim); }
:deep(.preset-attrs) { display: flex; flex-wrap: wrap; gap: 0.25rem; margin: 0.3rem 0; }
:deep(.pa-item) { font-size: 0.7rem; padding: 1px 6px; background: rgba(var(--violet-rgb), 0.1); border-radius: 4px; font-family: monospace; }
:deep(.pa-item.atk) { color: var(--danger); }
:deep(.pa-item.def) { color: var(--accent2); }
:deep(.pa-item.hp) { color: var(--success); }
:deep(.pa-item.agi) { color: var(--accent); }
:deep(.preset-empty-attrs) { font-size: 0.68rem; color: var(--dim); font-style: italic; padding: 0.3rem 0; line-height: 1.4; }
:deep(.preset-actions) { display: flex; gap: 0.25rem; }
:deep(.preset-actions .btn) { flex: 1; padding: 0.25rem 0.4rem; font-size: 0.72rem; }
:deep(.preset-save) { color: var(--accent2); border-color: rgba(var(--violet-rgb), 0.3); }
:deep(.preset-apply) { background: linear-gradient(135deg, var(--accent), #c49a4a); color: #0a0b14; border: none; }
:deep(.preset-del) { color: var(--danger); border-color: rgba(224,88,88,0.3); }

/* ===== 职业卡片 ===== */
:deep(.job-cards) { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.4rem; margin-top: 0.4rem; }
:deep(.job-card-mini) { padding: 0.5rem; border: 1px solid rgba(var(--violet-rgb),0.1); border-radius: 8px; cursor: pointer; background: rgba(var(--panel-rgb),0.5); transition: all 0.2s; }
:deep(.job-card-mini.selected) { border-color: var(--accent); background: rgba(var(--gold-rgb),0.08); }
:deep(.job-card-icon) { font-size: 1.3rem; }
:deep(.job-card-name) { font-size: 0.85rem; font-weight: 600; margin-top: 0.2rem; color: var(--accent); }
:deep(.job-card-desc) { font-size: 0.7rem; color: var(--muted); margin-top: 0.15rem; line-height: 1.3; }
:deep(.confirm-job-btn) { margin-top: 0.5rem; width: 100%; padding: 0.5rem; }
:deep(.job-locked-hint) { text-align: center; padding: 1rem; }
:deep(.job-locked-hint p) { color: var(--muted); font-size: 0.8rem; }
:deep(.job-progress) { color: var(--accent); font-weight: 600; margin-top: 0.3rem; }
:deep(.job-current) { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
:deep(.job-path-name) { font-size: 0.72rem; color: var(--muted); }
:deep(.job-current-name) { font-size: 1rem; font-weight: 600; color: var(--accent); }

/* ===== 设置栏 ===== */
:deep(.settings-section) { margin-top: 0.6rem; }
:deep(.theme-setting-btn) {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; padding: 0.55rem 0.8rem;
  border-radius: var(--radius-sm, 6px);
  border: 1px solid rgba(var(--violet-rgb), 0.18);
  background: rgba(var(--panel-rgb), 0.5);
  color: var(--ink); cursor: pointer; font-size: 0.82rem;
  font-family: inherit;
  transition: all var(--duration-normal, 200ms) var(--ease-out, ease);
}
:deep(.theme-setting-btn:hover) { border-color: rgba(var(--gold-rgb), 0.45); background: rgba(var(--panel2-rgb), 0.7); }
:deep(.theme-setting-label) { color: var(--muted); }
:deep(.theme-setting-current) { color: var(--accent); font-weight: 600; }

/* ===== 右侧折叠面板 ===== */
:deep(.side-panel) {
  position: fixed; right: 0; top: 50%; transform: translateY(-50%);
  display: flex; align-items: center; z-index: 50;
  transition: right 0.3s var(--ease-out);
}
:deep(.side-toggle) {
  width: 24px; height: 48px;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  color: #0a0b14; border: none; border-radius: 6px 0 0 6px;
  cursor: pointer; font-size: 1rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
:deep(.side-toggle:hover) { filter: brightness(1.1); }
:deep(.side-arrow) { display: block; }
:deep(.side-tabs) {
  display: flex; flex-direction: column; gap: 0.4rem; padding: 0.5rem;
  background: linear-gradient(135deg, rgba(var(--panel2-rgb), 0.95), rgba(var(--panel-rgb), 0.95));
  border: 1px solid rgba(var(--violet-rgb), 0.2);
  border-radius: 8px 0 0 8px; min-width: 80px;
}
:deep(.side-tab-item) {
  display: flex; flex-direction: column; align-items: center; gap: 0.15rem;
  padding: 0.4rem 0.3rem; border-radius: 6px;
  cursor: pointer; transition: all 0.2s; position: relative;
}
:deep(.side-tab-item:hover) { background: rgba(var(--gold-rgb), 0.1); }
:deep(.side-tab-item--genesis) { background: linear-gradient(135deg, rgba(var(--gold-rgb), 0.08), rgba(var(--violet-rgb), 0.08)); }
:deep(.side-tab-icon) { display: flex; justify-content: center; }
:deep(.side-tab-label) { font-size: 0.72rem; color: var(--muted); }
:deep(.side-tab-badge) {
  position: absolute; top: 0; right: 0;
  background: var(--accent); color: #0a0b14;
  font-size: 0.6rem; padding: 1px 5px; border-radius: 8px; font-weight: 700;
}
:deep(.side-tab-badge--gold) { background: linear-gradient(135deg, var(--accent), #ffd700); }
:deep(.side-slide-enter-active), :deep(.side-slide-leave-active) { transition: all 0.2s; }
:deep(.side-slide-enter-from), :deep(.side-slide-leave-to) { opacity: 0; transform: translateX(20px); }

/* ===== 成长 / 天赋 / 机制 / 进阶路线 ===== */
:deep(.growth-box) { margin-bottom: 0.5rem; padding: 0.4rem 0.6rem; background: rgba(var(--panel-rgb),0.5); border-radius: 6px; }
:deep(.growth-title) { font-size: 0.7rem; color: var(--muted); margin-bottom: 0.2rem; }
:deep(.growth-list) { display: flex; flex-wrap: wrap; gap: 0.3rem; }
:deep(.growth-item) { font-size: 0.68rem; color: var(--accent2); }
:deep(.talent-box) { margin-bottom: 0.5rem; padding: 0.4rem 0.6rem; background: rgba(var(--violet-rgb),0.06); border-radius: 6px; }
:deep(.talent-title) { font-size: 0.7rem; color: var(--accent); font-weight: 600; margin-bottom: 0.2rem; }
:deep(.talent-item) { display: flex; flex-direction: column; gap: 0.1rem; margin-bottom: 0.2rem; }
:deep(.talent-name) { font-size: 0.72rem; color: var(--accent); font-weight: 600; }
:deep(.talent-desc) { font-size: 0.66rem; color: var(--muted); }
:deep(.mechanic-box) { margin-bottom: 0.5rem; padding: 0.4rem 0.6rem; background: rgba(var(--gold-rgb),0.06); border-radius: 6px; }
:deep(.mechanic-title) { font-size: 0.7rem; color: var(--accent); font-weight: 600; margin-bottom: 0.2rem; }
:deep(.mechanic-item) {
  display: grid; grid-template-columns: 32px 1fr auto 24px;
  align-items: center; gap: 0.3rem; padding: 0.2rem 0; font-size: 0.72rem;
}
:deep(.mechanic-item.unlocked .mechanic-name) { color: var(--accent); }
:deep(.mechanic-item.locked) { opacity: 0.6; }
:deep(.mechanic-stage) { color: var(--accent2); font-family: monospace; }
:deep(.mechanic-name) { font-weight: 600; }
:deep(.mechanic-desc) { grid-column: 2 / 3; grid-row: 2; font-size: 0.66rem; color: var(--muted); }
:deep(.mechanic-status) { text-align: center; }
:deep(.stages-timeline) { display: flex; flex-direction: column; gap: 0.3rem; margin-top: 0.4rem; }
:deep(.stage-node) { display: flex; gap: 0.6rem; padding: 0.4rem; border: 1px solid rgba(var(--rule), 0.4); border-radius: 8px; }
:deep(.stage-node.done) { border-color: rgba(var(--success), 0.4); }
:deep(.stage-node.current) { border-color: var(--accent); background: rgba(var(--gold-rgb), 0.06); }
:deep(.stage-node.future) { opacity: 0.55; }
:deep(.stage-dot) {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--rule);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700;
}
:deep(.stage-node.current .stage-dot) { background: var(--accent); color: #0a0b14; }
:deep(.stage-node.done .stage-dot) { background: var(--success); color: #0a0b14; }
:deep(.stage-info) { flex: 1; }
:deep(.stage-name) { font-weight: 600; font-size: 0.85rem; }
:deep(.stage-level) { font-size: 0.7rem; color: var(--muted); }
:deep(.stage-desc) { font-size: 0.7rem; color: var(--muted); margin-top: 0.15rem; line-height: 1.3; }
:deep(.next-hint) { font-size: 0.78rem; color: var(--accent); text-align: center; margin-top: 0.4rem; font-weight: 600; }

/* ===== 通用按钮 ===== */
:deep(.btn) {
  padding: 0.4rem 0.8rem; border-radius: 6px;
  border: 1px solid rgba(var(--violet-rgb), 0.2);
  background: rgba(var(--violet-rgb), 0.08);
  color: var(--ink); cursor: pointer; font-size: 0.82rem;
  font-family: inherit;
  transition: all 0.2s;
}
:deep(.btn:hover) { border-color: rgba(var(--gold-rgb), 0.4); }
:deep(.btn-primary) {
  background: linear-gradient(135deg, var(--accent), #c49a4a);
  border: none; color: #0a0b14; font-weight: 600;
}
:deep(.btn-secondary) { background: rgba(var(--violet-rgb), 0.15); }
:deep(.btn-sm) { padding: 0.2rem 0.5rem; font-size: 0.72rem; }
:deep(.btn-disabled) { opacity: 0.4; cursor: not-allowed; }
</style>
