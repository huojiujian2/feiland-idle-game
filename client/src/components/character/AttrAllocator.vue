<template>
<!-- 属性面板（v0.7 老逻辑 + v0.8 大尺寸 +/- + 长按三段式） -->
    <div class="attrs-section card" data-tutorial="alloc-wrap">
      <div class="section-header">
        <span>属性</span>
        <span v-if="player.attrPoints > 0" class="pts-badge">可分配 {{ player.attrPoints }}</span>
      </div>
      <div class="attr-list">
        <div v-for="(handler, idx) in attrHandlers" :key="handler.key" class="attr-row">
          <span class="attr-name">{{ attrList[idx].label }}</span>
          <span class="attr-val">{{ player.attributes[handler.key] || 0 }}</span>
          <span v-if="player.totalStats && player.totalStats[attrList[idx].totalKey]" class="attr-total">→ {{ player.totalStats[attrList[idx].totalKey] }}</span>
          <div class="attr-controls" v-if="player.attrPoints > 0">
            <button
              class="adj-btn minus"
              v-bind="handler.minus"
            >−</button>
            <input class="attr-qty-input" type="number" min="0"
              :max="maxPending(handler.key)" :value="pending[handler.key] || 0"
              @input="onPendingInput(handler.key, $event)" aria-label="自定义分配属性点" />
            <button class="adj-btn plus" v-bind="handler.plus" data-alloc-available>+</button>
          </div>
        </div>
      </div>
      <div class="combat-summary" v-if="player.totalStats">
        <span class="cs-item"><IconBase name="sword" :size="12" class="btn-icon" /> {{ player.totalStats.atk }}</span>
        <span class="cs-item"><IconBase name="shield" :size="12" class="btn-icon" /> {{ player.totalStats.def }}</span>
        <span class="cs-item"><IconBase name="bolt" :size="12" class="btn-icon" /> {{ player.totalStats.agi }}</span>
        <span class="cs-item" v-if="player.totalStats.crit"><IconBase name="sparkle" :size="12" class="btn-icon" /> {{ (player.totalStats.crit * 100).toFixed(0) }}%</span>
        <span class="cs-item" v-if="player.totalStats.dodge"><IconBase name="feather" :size="12" class="btn-icon" /> {{ (player.totalStats.dodge * 100).toFixed(0) }}%</span>
      </div>

      <!-- 战斗统计 -->
      <div class="combat-record" v-if="player.combatStats">
        <div class="record-title">📊 战斗统计</div>
        <div class="record-grid">
          <div class="record-item">
            <span class="record-label">总击杀</span>
            <span class="record-value">{{ player.combatStats.totalWins || 0 }}</span>
          </div>
          <div class="record-item">
            <span class="record-label">今日击杀</span>
            <span class="record-value highlight">{{ player.combatStats.todayKills || 0 }}</span>
          </div>
          <div class="record-item">
            <span class="record-label">本月击杀</span>
            <span class="record-value highlight">{{ player.combatStats.monthKills || 0 }}</span>
          </div>
          <div class="record-item">
            <span class="record-label">胜/负/平</span>
            <span class="record-value">
              <span class="win">{{ player.combatStats.totalWins || 0 }}</span>
              /
              <span class="lose">{{ player.combatStats.totalLosses || 0 }}</span>
              /
              <span class="draw">{{ player.combatStats.totalDraws || 0 }}</span>
            </span>
          </div>
          <div class="record-item">
            <span class="record-label">胜率</span>
            <span class="record-value">{{ winRateText }}%</span>
          </div>
        </div>
      </div>
      <div v-if="hasPending" class="confirm-row">
        <button class="btn btn-primary confirm-btn" data-alloc-available @click="confirmAllocate">保存分配（提交给角色）</button>
        <button class="btn btn-sm reset-btn" data-alloc-available @click="resetPending">重置（撤销本次 +/-）</button>
      </div>
    </div>

    <!-- 属性预设（v0.8+ 独立卡片：9 点自由 +/-,3 个方案槽位,独立于上方主属性加点） -->
    <div class="presets-section card">
      <div class="section-header">
        <span>属性预设</span>
        <span :class="['pts-badge', freeRemaining === 0 ? 'pts-badge--zero' : '']">
          自由 {{ freeRemaining }} / {{ FREE_ATTR_MAX }}
        </span>
      </div>

      <!-- 独立的 4 维 +/- 调整面板（每项 0~31 直接调） -->
      <div class="attr-list">
        <div v-for="attr in attrList" :key="'preset-' + attr.key" class="attr-row">
          <span class="attr-name">{{ attr.label }}</span>
          <span class="attr-val">
            <span class="attr-bonus">{{ attrAdjust[attr.key] }}</span>
          </span>
          <div class="attr-controls">
            <button
              class="adj-btn minus"
              :class="{ 'btn-disabled': attrAdjust[attr.key] <= 0 }"
              :disabled="attrAdjust[attr.key] <= 0"
              data-alloc-available
              @click="adjustPreset(attr.key, -1)"
            >−</button>
            <button
              class="adj-btn plus"
              :class="{ 'btn-disabled': attrAdjust[attr.key] >= FREE_ATTR_PER_KEY || freeRemaining <= 0 }"
              :disabled="attrAdjust[attr.key] >= FREE_ATTR_PER_KEY || freeRemaining <= 0"
              data-alloc-available
              @click="adjustPreset(attr.key, 1)"
            >+</button>
          </div>
        </div>
      </div>
      <p class="presets-hint">
        每项属性 0~31 自由调整（总上限 31）· 点对应「保存加点」即固化进方案一/二/三，
        「应用」按比例把角色未来的新属性点加给角色。
      </p>

      <!-- 3 槽位预设 -->
      <div class="preset-list">
        <div
          v-for="(p, idx) in presetSlots"
          :key="p.key"
          class="preset-card"
        >
          <div class="preset-card-top">
            <span class="preset-index">{{ ['一','二','三'][idx] }}</span>
            <span class="preset-name">属性预设 · 方案{{ ['一','二','三'][idx] }}</span>
            <span class="preset-filled" v-if="p.attributes">Lv.{{ p.level }} 已存</span>
            <span class="preset-empty-tag" v-else>空</span>
          </div>
          <div v-if="p.attributes" class="preset-attrs">
            <span class="pa-item atk">攻 {{ p.attributes.atk }}</span>
            <span class="pa-item def">防 {{ p.attributes.def }}</span>
            <span class="pa-item hp">体 {{ p.attributes.hp }}</span>
            <span class="pa-item agi">敏 {{ p.attributes.agi }}</span>
          </div>
          <div v-else class="preset-empty-attrs">
            尚未保存 · 调整上方 +/- 后点下方「保存加点」即写入
          </div>
          <div class="preset-actions">
            <button
              class="btn btn-sm preset-save"
              :class="{ 'btn-disabled': !canSavePreset() }"
              :disabled="!canSavePreset()"
              data-alloc-available
              @click="handleSavePreset(idx)"
            >保存加点</button>
            <button
              class="btn btn-sm btn-primary preset-apply"
              :class="{ 'btn-disabled': !canApplyPreset(p) }"
              :disabled="!canApplyPreset(p)"
              data-alloc-available
              @click="handleApplyPreset({ idx, presetId: p.presetId })"
            >应用</button>
            <button
              v-if="p.attributes"
              class="btn btn-sm preset-del"
              :class="{ 'btn-disabled': false }"
              data-alloc-available
              aria-label="删除此预设"
              title="抹去此预设"
              @click="handleDeletePreset(idx)"
            >删</button>
          </div>
        </div>
      </div>
    </div>
</template>

<script setup>
// ====== 属性分配 + 预设子组件 ======
// @file components/character/AttrAllocator
// @module character-attr-allocator
// @description 4 维属性 +/- 长按三段式加速 + pending 加点提交 + 3 槽位预设（自由点调整 / 保存 / 应用 / 删除）
import { reactive, computed, ref } from 'vue';
import IconBase from '../icons/IconBase.vue';
import { useLongPress } from '../../composables/useLongPress.js';
import {
  attrList,
  FREE_ATTR_MAX,
  FREE_ATTR_PER_KEY,
  PRESET_SLOTS,
} from './labels.js';

const props = defineProps({
  player: { type: Object, required: true },
});
const emit = defineEmits([
  'allocate',
  'savePreset',
  'applyPreset',
  'deletePreset',
]);

// ====== 主"属性"卡片的 +/- 长按三段式加速（v1.06：setup 顶层预生成 handlers 数组） ======
// v1.05.b → v1.06 说明：
//   v1.05 在 for 循环里 reactive({})[k] = ...，模板 v-bind="lpPlus[attr.key]" 第一次
//   render 拿 undefined 就被 Vue 缓存住 → 点击无反应。
//   v1.05.b 改用 computed 包 useLongPress，又会踩到 useLongPress 内部 onBeforeUnmount
//   在 computed 闭包里被重复注册 / 不能卸载的问题。
//   v1.06 改为：setup 顶层一次性构造 handlers 数组（key/plus/minus），模板 v-for 直接用
//   handler.plus / handler.minus，避免 v-bind="对象[动态key]" 在首次渲染拿到 undefined。
// useLongPress 必须在 setup 顶层同步调用、且其内部 onBeforeUnmount 才能正确清理——
// 所以这里用一个 IIFE 在 setup 顶层构造，handler 闭包捕获 adjust。
const attrHandlers = (() => {
  const out = []
  for (const a of attrList) {
    out.push({
      key: a.key,
      plus:  useLongPress((_dir, _step) => adjust(a.key,  1)).bindHandlers('+'),
      minus: useLongPress((_dir, _step) => adjust(a.key, -1)).bindHandlers('-'),
    })
  }
  return out
})()

// pending = ref(原版风格) + adjDelta 也 ref
const pending = ref({})
const adjDelta = ref({})

// 主"属性"卡片：是否有未提交到玩家的 pending 加点
const hasPending = computed(() => Object.values(pending.value).some(v => v > 0))

function maxPending(key) {
  const available = Number(props.player.attrPoints) || 0
  const allocatedToOthers = Object.entries(pending.value)
    .reduce((sum, [attrKey, value]) => attrKey === key ? sum : sum + (Number(value) || 0), 0)
  return Math.max(0, available - allocatedToOthers)
}
// pending 的语义：这一项要分配多少点（相对于 player.attributes 的增量）。
// adjDelta 任何时刻都从 pending 直接推导，避免 +/- 路径与输入框路径双计算。
function recomputeAdjDelta() {
  const out = {}
  for (const [k, v] of Object.entries(pending.value)) {
    const n = Number(v) || 0
    if (n > 0) out[k] = n
  }
  adjDelta.value = out
}

function onPendingInput(key, event) {
  const raw = Number.parseInt(event.target.value, 10)
  const max = maxPending(key)
  const next = Number.isFinite(raw) ? Math.max(0, Math.min(max, raw)) : 0
  if (next > 0) pending.value[key] = next
  else delete pending.value[key]
  recomputeAdjDelta()
  event.target.value = String(next)
}

function adjust(key, delta) {
  const cur = pending.value[key] || 0
  const newVal = cur + delta
  if (newVal < 0) return
  // 全部 pending 之和不能超过 attrPoints
  const others = Object.entries(pending.value)
    .reduce((sum, [attrKey, value]) => attrKey === key ? sum : sum + (Number(value) || 0), 0)
  if (others + newVal > props.player.attrPoints) return
  if (newVal > 0) pending.value[key] = newVal
  else delete pending.value[key]
  recomputeAdjDelta()
}
function confirmAllocate() {
  // 只提交真正有正增量的项
  const payload = {}
  for (const [k, v] of Object.entries(adjDelta.value)) {
    const n = Number(v) || 0
    if (n > 0) payload[k] = n
  }
  if (Object.keys(payload).length === 0) return
  emit('allocate', payload)
  pending.value = {}
  adjDelta.value = {}
}
function resetPending() {
  pending.value = {}
  adjDelta.value = {}
}

// 胜率显示
const winRateText = computed(() => {
  const cs = props.player?.combatStats || {}
  const w = cs.totalWins || 0
  const l = cs.totalLosses || 0
  const d = cs.totalDraws || 0
  const total = w + l + d
  if (total === 0) return '0.0'
  return ((w / total) * 100).toFixed(1)
})

// ====== 属性预设（v0.8+，v1.02 30 点上限 + 可折叠） ======
const openSections = reactive({ presets: false })
function toggleSection(key) { openSections[key] = !openSections[key] }

// attrAdjust：4 个独立滑块；约束：每项 ≤ FREE_ATTR_MAX（不互锁，用 max(4 维) 判断）
const attrAdjust = ref({ atk: 0, def: 0, hp: 0, agi: 0 })
const attrAdjustMax = computed(() =>
  Math.max(attrAdjust.value.atk, attrAdjust.value.def, attrAdjust.value.hp, attrAdjust.value.agi)
)
const freeRemaining = computed(() => FREE_ATTR_MAX - attrAdjustMax.value)

function adjustPreset(key, delta) {
  const cur = attrAdjust.value[key] || 0
  if (delta > 0) {
    if (cur >= FREE_ATTR_PER_KEY) return
    if (freeRemaining.value <= 0) return
  }
  if (delta < 0 && cur <= 0) return
  attrAdjust.value[key] = Math.max(0, Math.min(FREE_ATTR_PER_KEY, cur + delta))
}

const presetSlots = computed(() => {
  const saved = props.player?.attrPresets || []
  const out = []
  for (let i = 0; i < PRESET_SLOTS; i++) {
    const p = saved[i] || null
    out.push({
      key: `slot-${i}`,
      // v1.02：保存后端返回的 presetId（后端在 attrPresets[i].id 上），没有 id 就是空槽
      presetId: p?.id || null,
      attributes: p?.attributes || null,
      level: p?.level || null,
    })
  }
  return out
})

function canSavePreset() {
  return freeRemaining.value < FREE_ATTR_MAX  // 至少要调过 1 点
}
function canApplyPreset(p) {
  return !!(p && p.attributes)
}

function handleSavePreset(idx) {
  if (!canSavePreset()) return
  // 保存的是"自由调整面板的快照"（attrAdjust：0~30 的微调值），不立刻加点。
  // 真正加点走 confirmAllocate / handleApplyPreset 路径。
  emit('savePreset', {
    slot: idx,
    name: `方案${['一','二','三'][idx]}`,
    attributes: { ...attrAdjust.value },
  })
}
function handleApplyPreset(payload) {
  // payload = { idx, presetId } —— 优先用 presetId（后端真正索引），没有时回退 idx
  const idx = Number(payload?.idx ?? payload)
  const presetId = payload?.presetId
  emit('applyPreset', { idx, presetId })
}
function handleDeletePreset(idx) { emit('deletePreset', idx) }
</script>
