<template>
  <div class="view-container char-view">
    <!-- 顶部：角色信息 + 装备格子 -->
    <div class="char-top">
      <div class="char-info-block">
        <div class="char-avatar">{{ player.name.charAt(0) }}</div>
        <div class="char-meta">
          <div class="char-name">{{ player.name }}</div>
          <div class="char-race">{{ player.race }} · {{ player.job }}</div>
          <div class="char-stage" :style="{ color: player.stage.color }">{{ player.stage.name }}</div>
        </div>
      </div>
      <div class="equip-grid">
        <div v-for="slot in slots" :key="slot.key" class="equip-slot"
          :class="{
            filled: player.equipped[slot.key],
            'enchant-1': player.equipped[slot.key] && (player.equipped[slot.key].enchants || []).length === 1,
            'enchant-2': player.equipped[slot.key] && (player.equipped[slot.key].enchants || []).length === 2,
            'enchant-3': player.equipped[slot.key] && (player.equipped[slot.key].enchants || []).length === 3
          }"
          @click="player.equipped[slot.key] ? showEquipDetail(slot.key) : null">
          <div class="slot-icon"><IconBase :name="slot.iconName" :size="22" /></div>
          <div class="slot-label">{{ slot.label }}</div>
          <div v-if="player.equipped[slot.key]" class="slot-item"
            :style="{ color: qualityColors[player.equipped[slot.key].quality] }">
            {{ player.equipped[slot.key].name }}
          </div>
          <div v-else class="slot-empty">空</div>
          <!-- v2.5：右上角改为强化等级角标（如 +1 ~ +15），0 不显示 -->
          <div v-if="player.equipped[slot.key] && (player.equipped[slot.key].upgradeLevel || 0) > 0" class="slot-upgrade">
            +{{ player.equipped[slot.key].upgradeLevel }}
          </div>
        </div>
      </div>
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

    <!-- 属性面板（v0.7 老逻辑 + v0.8 大尺寸 +/- + 长按三段式） -->
    <div class="attrs-section card" data-tutorial="alloc-wrap">
      <div class="section-header">
        <span>属性</span>
        <span v-if="player.attrPoints > 0" class="pts-badge">可分配 {{ player.attrPoints }}</span>
      </div>
      <div class="attr-list">
        <div v-for="attr in attrList" :key="attr.key" class="attr-row">
          <span class="attr-name">{{ attr.label }}</span>
          <span class="attr-val">{{ player.attributes[attr.key] || 0 }}</span>
          <span v-if="player.totalStats && player.totalStats[attr.totalKey]" class="attr-total">→ {{ player.totalStats[attr.totalKey] }}</span>
          <div class="attr-controls" v-if="player.attrPoints > 0">
            <button
              class="adj-btn minus"
              v-bind="lpMinus[attr.key]"
              @click="adjust(attr.key, -1)"
            >−</button>
            <span v-if="pending[attr.key]" class="pending-val">+{{ pending[attr.key] }}</span>
            <button
              class="adj-btn plus"
              v-bind="lpPlus[attr.key]"
              data-alloc-available
              @click="adjust(attr.key, 1)"
            >+</button>
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
              @click="handleApplyPreset(idx)"
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

    <!-- 职业区块 -->
    <div class="job-section card">
      <div class="section-header" @click="toggleSection('job')">
        <span><IconBase name="star" :size="14" class="section-icon" /> 职业</span>
        <span class="toggle-icon">{{ openSections.job ? '▾' : '▸' }}</span>
      </div>
      <div v-if="openSections.job" class="job-content">
        <template v-if="!player.jobPath">
          <template v-if="player.canChooseJob">
            <p class="sub-tip">达到 Lv.11，请在灵性之海中构建你的职业</p>
            <div class="job-cards">
              <div v-for="job in Object.values(jobTree)" :key="job.id" class="job-card-mini"
                :class="{ selected: selectedJob === job.id }" @click="selectedJob = job.id">
                <div class="job-card-icon">{{ job.icon || jobIcons[job.id] }}</div>
                <div class="job-card-name">{{ job.name }}</div>
                <div class="job-card-desc">{{ job.desc }}</div>
              </div>
            </div>
            <button v-if="selectedJob" class="btn btn-primary confirm-job-btn"
              @click="$emit('chooseJob', selectedJob)">确认选择：{{ jobTree[selectedJob]?.name }}</button>
          </template>
          <div v-else class="job-locked-hint">
            <p>需要达到 Lv.11 才能选择职业方向</p>
            <p class="job-progress">当前等级: Lv.{{ player.level }} / 11</p>
          </div>
        </template>
        <template v-else>
          <div class="job-current">
            <span class="job-path-name">{{ player.jobInfo?.icon }} {{ player.jobInfo?.pathName }}</span>
            <span class="job-current-name">{{ player.job }}</span>
          </div>

          <!-- 成长系数 -->
          <div class="growth-box" v-if="player.jobInfo?.growth">
            <div class="growth-title">成长系数</div>
            <div class="growth-list">
              <span v-for="(val, key) in player.jobInfo.growth" :key="key" class="growth-item">
                {{ growthLabels[key] || key }}: <b>{{ val > 1 ? '×' + val : val > 0 ? '+' + (val*100) + '%' : '—' }}</b>
              </span>
            </div>
          </div>

          <!-- 专属天赋 -->
          <div class="talent-box" v-if="player.jobInfo?.talents">
            <div class="talent-title">专属天赋（常驻）</div>
            <div v-for="(t, i) in player.jobInfo.talents" :key="i" class="talent-item">
              <span class="talent-name">{{ t.name }}</span>
              <span class="talent-desc">{{ t.desc }}</span>
            </div>
          </div>

          <!-- 成长机制 -->
          <div class="mechanic-box" v-if="player.jobInfo?.mechanics">
            <div class="mechanic-title">成长机制</div>
            <div v-for="(m, i) in player.jobInfo.mechanics" :key="i" class="mechanic-item"
              :class="{ unlocked: player.jobInfo.jobStage > i, locked: player.jobInfo.jobStage <= i }">
              <span class="mechanic-stage">{{ i + 1 }}阶</span>
              <span class="mechanic-name">{{ m.name }}</span>
              <span class="mechanic-desc">{{ m.desc }}</span>
              <span class="mechanic-status">{{ player.jobInfo.jobStage > i ? '✓' : '🔒' }}</span>
            </div>
          </div>

          <!-- 进阶路线 -->
          <div class="stages-timeline">
            <div v-for="(stage, i) in player.jobInfo?.stages" :key="i" class="stage-node"
              :class="{ done: player.level >= stage.level, current: player.job === stage.name, future: player.level < stage.level }">
              <div class="stage-dot">{{ i + 1 }}</div>
              <div class="stage-info">
                <div class="stage-name">{{ stage.name }}</div>
                <div class="stage-level">Lv.{{ stage.level }}</div>
                <div class="stage-desc">{{ stage.desc }}</div>
              </div>
            </div>
          </div>
          <div v-if="player.jobInfo?.nextStage" class="next-hint">
            下一阶段: {{ player.jobInfo.nextStage.name }} (Lv.{{ player.jobInfo.nextStage.level }})
          </div>
        </template>
      </div>
    </div>

    <!-- v0.8+：词条摘要已删除（独立「技能」页承担全部词条管理） -->

    <!-- 右侧折叠面板：进阶/任务 -->
    <div class="side-panel" :class="{ expanded: sideOpen }">
      <button class="side-toggle" @click="sideOpen = !sideOpen">
        <span class="side-arrow">{{ sideOpen ? '›' : '‹' }}</span>
      </button>
      <transition name="side-slide">
        <div v-if="sideOpen" class="side-tabs">
          <div class="side-tab-item" @click="$emit('goEvo')">
            <span class="side-tab-icon"><IconBase name="dna" :size="16" class="icon-accent2" /></span>
            <span class="side-tab-label">进阶</span>
            <span v-if="player.canEvolve" class="side-tab-badge">!</span>
          </div>
          <div class="side-tab-item" @click="$emit('goQuest')">
            <span class="side-tab-icon"><IconBase name="scroll" :size="16" class="icon-accent2" /></span>
            <span class="side-tab-label">任务</span>
            <span v-if="questBadge" class="side-tab-badge">{{ questBadge }}</span>
          </div>
          <!-- v0.8+：创世之书入口（仅二转显示；和进阶/任务并列在右侧折叠面板） -->
          <div
            v-if="(player.reincarnation || 0) >= 2"
            class="side-tab-item side-tab-item--genesis"
            @click="$emit('goGenesis')"
          >
            <span class="side-tab-icon"><IconBase name="book" :size="16" class="icon-accent" /></span>
            <span class="side-tab-label">创世</span>
            <span class="side-tab-badge side-tab-badge--gold">!</span>
          </div>
        </div>
      </transition>
    </div>

    <!-- 装备详情弹窗（含附魔） -->
    <EquipDetailModal
      :item="detailItem"
      :slot="detailSlot"
      :qualityColors="qualityColors"
      :qualityLabels="qualityLabels"
      :slotLabels="slotLabels"
      :statLabels="statLabels"
      :enchantsBySlot="player.enchantsBySlot"
      :inventory="player.inventory"
      :playerGold="player.gold"
      @close="detailItem = null"
      @unequip="handleUnequip"
      @enchant="handleEnchant" />
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import IconBase from './icons/IconBase.vue'
import EquipDetailModal from './EquipDetailModal.vue'
import { modalConfirm } from '../ui-bridge.js'
import { useLongPress } from '../composables/useLongPress.js'

const props = defineProps(['player', 'jobTree'])
const emit = defineEmits(['allocate', 'equip', 'unequip', 'enchant', 'chooseJob', 'goSkill', 'goEvo', 'goQuest', 'goGenesis', 'refresh', 'savePreset', 'applyPresetRatio', 'deletePreset'])

// v0.8+：主"属性"卡片的 +/- 长按三段式加速
//   长按 + ~0.35s 才触发 → 慢速（120ms / +1）→ 1.5s 后冲刺（45ms / +1）
//   长按 − 同样节奏（方向相反），让"加过头"能马上拉开
const longPress4Attr = useLongPress((direction) => {
  // 长按方向切换到一个统一的目标（用 pending 标识即可，因为点击 +/1 -1 同一路径）
  sweepAdjust(direction)
})
// 为 4 个属性各生成一对 (+ / −) 长按事件绑定
const lpPlus = reactive({})
const lpMinus = reactive({})
;(function bind4Attrs() {
  const keys = ['atk', 'def', 'hp', 'agi']
  for (const k of keys) {
    const hPlus = longPress4Attr.bindHandlers('+')
    const hMinus = longPress4Attr.bindHandlers('-')
    // 给长按 + 一套：press 时设"当前焦点维度"= k，每次 tick 都会 sweepAdjust(direction=1)
    // 长按 − 同理
    lpPlus[k] = {
      onPointerdown: (e) => { if (e.cancelable) e.preventDefault?.(); lpAttrFocus.value = k; hPlus.onPointerdown(e) },
      onPointerup: hPlus.onPointerup,
      onPointerleave: hPlus.onPointerup,
      onPointercancel: hPlus.onPointerup,
    }
    lpMinus[k] = {
      onPointerdown: (e) => { if (e.cancelable) e.preventDefault?.(); lpAttrFocus.value = k; hMinus.onPointerdown(e) },
      onPointerup: hMinus.onPointerup,
      onPointerleave: hMinus.onPointerup,
      onPointercancel: hMinus.onPointerup,
    }
  }
})()
const lpAttrFocus = ref('atk')
// 长按"扫尾"算法：把每次 tick 的 +1 / −1 累加到"当前焦点维度"（lpAttrFocus）上
//   焦点维度 = 长按哪个 +/- 按钮对应的那一维
//   如果焦点维度已分配到 attrPoints 上限，try 下一个空的（防止长按出界）
function sweepAdjust(direction) {
  const keys = ['atk', 'def', 'hp', 'agi']
  const focus = lpAttrFocus.value || 'atk'
  const total = props.player.attrPoints || 0
  const used = Object.values(pending.value).reduce((a, b) => a + b, 0)
  const remaining = total - used

  if (direction === 1) {
    // +1 加给焦点维度
    if (used >= total) return // 自由点全部用完
    pending.value[focus] = (pending.value[focus] || 0) + 1
  } else {
    // −1 从焦点维度退回
    if (focus && (pending.value[focus] || 0) > 0) {
      pending.value[focus] -= 1
      return
    }
    // 焦点为空，找其他有 pending 退
    for (const k of keys) {
      if ((pending.value[k] || 0) > 0) {
        pending.value[k] -= 1
        return
      }
    }
    // 没 pending 可退
  }
}

const pending = ref({})
const detailItem = ref(null)
const detailSlot = ref(null)
const selectedJob = ref(null)
const sideOpen = ref(false)
// v0.8+：职业区块默认收起
const openSections = reactive({ job: false })
const showPresets = ref(false)

// v0.8+ 新版属性系统：在「属性预设」独立卡片内生效（与上方主属性 +/- 互不干扰）
//   上方主属性面板继续用老的 pending / attrPoints / 确认分配逻辑；
//   下方属性预设面板用 31 点自由 attrAdjust（每项单独 0-31），配 3 槽位预设
const FREE_ATTR_MAX = 31;
// 每项单独上限
const FREE_ATTR_PER_KEY = 31;
// "属性预设"面板的基础值固定用新生创造角色的初始值（atk5 def4 hp5 agi=8），每项属性从 0 开始自由加减
const attrBasePreset = computed(() => ({ atk: 5, def: 4, hp: 5, agi: 8 }));
const attrAdjust = ref({ atk: 0, def: 0, hp: 0, agi: 0 });
// 总剩余 = 31 - max(4 维中最大值)，保证每项独立可拉到上限但互相不超 31
const attrAdjustMax = computed(() =>
  Math.max(attrAdjust.value.atk, attrAdjust.value.def, attrAdjust.value.hp, attrAdjust.value.agi)
);
const freeRemaining = computed(() => FREE_ATTR_MAX - attrAdjustMax.value);

// v0.8+：3 个固定"方案一/二/三"槽位（独立于主属性加点）
const PRESET_SLOT_COUNT = 3;
const presetSlots = computed(() => {
  const list = Array.isArray(props.player?.attrPresets) ? props.player.attrPresets : [];
  const out = [];
  for (let i = 0; i < PRESET_SLOT_COUNT; i++) {
    const p = list[i];
    out.push(p ? { key: i, attributes: p.attributes, level: p.level, name: p.name } : { key: i, attributes: null });
  }
  return out;
});

function canSavePreset() {
  // 只要任何一项被 +/- 过（>0）才能保存（attrAdjust 直接是 0~31 的独立值，不再限总和 9）
  return attrAdjust.value.atk > 0 || attrAdjust.value.def > 0 ||
         attrAdjust.value.hp > 0 || attrAdjust.value.agi > 0;
}
function canApplyPreset(slot) {
  if (!slot.attributes) return false;
  const a = slot.attributes;
  return (a.atk + a.def + a.hp + a.agi) > 0;
}

const winRateText = computed(() => {
  const cs = props.player.combatStats || {}
  const wins = cs.totalWins || 0
  const losses = cs.totalLosses || 0
  const draws = cs.totalDraws || 0
  const total = wins + losses + draws
  if (total === 0) return '0'
  return Math.round((wins / total) * 100)
})

const qualityColors = { normal: '#9d9bb8', fine: '#5eda7a', epic: '#9d8cf0', legend: '#d4af5e', mythic: '#ff6738' }
const qualityLabels = { normal: '普通', fine: '精良', epic: '史诗', legend: '传说', mythic: '神话' }
const slotLabels = { weapon: '武器', armor: '护甲', accessory: '饰品' }
const statLabels = { atk: '攻击', def: '防御', hp: 'HP', mp: 'MP', str: '力量', con: '体质', spi: '精神', agi: '敏捷', cha: '魅力', exp: '经验', gold: '金币' }
const jobIcons = { thunder: '⚡', light: '✨', wind: '🌪', knight: '🛡', alchemy: '⚗' }
const growthLabels = { hp: 'HP', atk: 'ATK', def: 'DEF', agi: 'AGI', exp: 'EXP', gold: 'GOLD' }

const slots = [
  { key: 'weapon', label: '武器', iconName: 'sword' },
  { key: 'armor', label: '护甲', iconName: 'shield' },
  { key: 'accessory', label: '饰品', iconName: 'gem' }
]

const attrList = [
  { key: 'atk', label: '攻击', totalKey: 'atk' },
  { key: 'def', label: '防御', totalKey: 'def' },
  { key: 'hp', label: '体力', totalKey: 'hp' },
  { key: 'agi', label: '敏捷', totalKey: 'agi' }
]

const hpPct = computed(() => Math.round(props.player.hp / props.player.maxHp * 100))
const mpPct = computed(() => Math.round(props.player.mp / props.player.maxMp * 100))
const expPct = computed(() => Math.round(props.player.exp / props.player.expNeeded * 100))
// v0.7 老逻辑保留：上方"属性"卡片用 pending / hasPending
const hasPending = computed(() => Object.values(pending.value).some(v => v > 0))

const questBadge = computed(() => {
  const q = props.player?.questView
  if (!q) return null
  const daily = q.dailyQuests?.filter(x => x.done && !x.claimed).length || 0
  const ach = q.achievements?.filter(x => x.unlocked && !x.claimed).length || 0
  const chest = q.chest?.canClaim ? 1 : 0
  const total = daily + ach + chest
  return total > 0 ? total : null
})

function toggleSection(key) {
  openSections[key] = !openSections[key]
}

// v0.7 老逻辑：上方"属性"卡片用 adjust / confirmAllocate
function adjust(key, amount) {
  const newVal = (pending.value[key] || 0) + amount
  const total = Object.values(pending.value).reduce((a, b) => a + b, 0) + amount
  if (total > props.player.attrPoints) return
  if (newVal < 0) return
  pending.value[key] = newVal
}

function confirmAllocate() {
  emit('allocate', { ...pending.value })
  pending.value = {}
}
function resetPending() {
  // 只清本次 +/-（保留 player.attributes 不变）
  pending.value = {}
}

// v0.8+ 新版：下方"属性预设"卡片用 adjustPreset（独立 31 点，每项单独 0-31，总数=max(4 维)）
function adjustPreset(key, amount) {
  const cur = attrAdjust.value[key] || 0
  const next = cur + amount
  // 单项不能为负，不能超 31
  if (next < 0) return
  if (next > FREE_ATTR_PER_KEY) return
  // 总 max 不能超 31：4 维里最大那项 ≤ 31
  const probe = { ...attrAdjust.value, [key]: next }
  const newMax = Math.max(probe.atk, probe.def, probe.hp, probe.agi)
  if (newMax > FREE_ATTR_MAX) return
  attrAdjust.value[key] = next
}

function autoAllocate() {
  // v0.8+：一键加点（按职业权重）已删除 —— 改用下方"属性预设方案"的 4 个模板
}

// v0.8+：方案一/二/三（3 槽位，独立于主属性加点）。
// 「保存加点」：把"基础 + 当前 attrAdjust"快照写入 attrPresets[i]（不动 player.attributes）
// 「应用」：按 attrPresets[i] 的比例，把 player.attrPoints（升级送的点）加到 player.attributes
function handleSavePreset(slotIdx) {
  if (attrAdjust.value.atk + attrAdjust.value.def + attrAdjust.value.hp + attrAdjust.value.agi <= 0) return;
  // attrAdjust 直接是 0~31 的"目标值"，保存 = 把这 4 维数字写到 attrPresets[i]
  const savedAttributes = {
    atk: attrAdjust.value.atk,
    def: attrAdjust.value.def,
    hp: attrAdjust.value.hp,
    agi: attrAdjust.value.agi,
  };
  emit('savePreset', {
    slot: slotIdx,
    name: ['属性预设·方案一', '属性预设·方案二', '属性预设·方案三'][slotIdx] || '方案',
    attributes: savedAttributes,
  });
  // 本地归零 + 重置自由点
  attrAdjust.value = { atk: 0, def: 0, hp: 0, agi: 0 };
}
function handleApplyPreset(slotIdx) {
  const slot = presetSlots.value[slotIdx];
  if (!slot.attributes) return;
  // 应用 = 按方案的比例分配 player.attrPoints（需 player.attrPoints > 0）
  emit('applyPresetRatio', {
    atk: slot.attributes.atk,
    def: slot.attributes.def,
    hp: slot.attributes.hp,
    agi: slot.attributes.agi,
  });
}

// v0.8+：抹去一个方案槽位（按 slot 索引删除，调用后端 deleteAttrPreset）
async function handleDeletePreset(slotIdx) {
  const slot = presetSlots.value[slotIdx];
  if (!slot.attributes) return;
  const name = ['属性预设·方案一', '属性预设·方案二', '属性预设·方案三'][slotIdx] || `方案${slotIdx + 1}`;
  if (!await modalConfirm(`确定要抹去「${name}」吗？此操作无法撤销。`)) return;
  emit('deletePreset', { slot: slotIdx, name });
}

function showEquipDetail(slotKey) {
  detailItem.value = props.player.equipped[slotKey]
  detailSlot.value = slotKey
}

function handleUnequip() {
  emit('unequip', detailSlot.value)
  detailItem.value = null
}
</script>

<style scoped>
.char-view { display: flex; flex-direction: column; gap: 0.6rem; max-width: 560px; margin: 0 auto; }

/* 顶部 */
.char-top { display: flex; gap: 0.8rem; }
.char-info-block { display: flex; gap: 0.6rem; align-items: center; flex: 1; }
.char-avatar { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--accent2)); display: flex; align-items: center; justify-content: center; font-size: 1.3rem; font-weight: 700; color: #0e0f1c; flex-shrink: 0; }
.char-name { font-weight: 600; font-size: 1rem; }
.char-race { font-size: 0.75rem; color: var(--muted); }
.char-stage { font-size: 0.78rem; font-weight: 600; }

/* 装备格子 */
.equip-grid { display: flex; gap: 0.4rem; }
.equip-slot { width: 64px; padding: 0.4rem; border: 1px solid rgba(157,140,240,0.1); border-radius: 8px; text-align: center; cursor: pointer; background: rgba(20,22,42,0.5); transition: all var(--duration-normal) var(--ease-out); position: relative; }
.equip-slot:hover { border-color: var(--accent2); transform: translateY(-2px); }
.equip-slot.filled { border-color: rgba(157,140,240,0.25); }
/* v2.5：根据附魔数量染色边框（0=默认紫，1=史诗紫，2=传说金，3=神话橙） */
.equip-slot.filled.enchant-1 { border-color: #9d8cf0; box-shadow: 0 0 6px rgba(157,140,240,0.35); }
.equip-slot.filled.enchant-2 { border-color: #d4af5e; box-shadow: 0 0 6px rgba(212,175,94,0.4); }
.equip-slot.filled.enchant-3 { border-color: #ff6738; box-shadow: 0 0 8px rgba(255,103,56,0.55); }
.slot-icon { font-size: 1rem; }
.slot-label { font-size: 0.65rem; color: var(--muted); margin: 0.1rem 0; }
.slot-item { font-size: 0.68rem; font-weight: 600; word-break: break-all; line-height: 1.2; }
.slot-empty { font-size: 0.68rem; color: var(--dim); }
/* v2.5：强化等级角标（右上角） */
.slot-upgrade {
  position: absolute;
  top: 1px;
  right: 2px;
  font-size: 0.62rem;
  font-weight: 700;
  font-family: monospace;
  color: #fff;
  background: rgba(20,22,42,0.7);
  border: 1px solid rgba(212,175,94,0.4);
  border-radius: 6px;
  padding: 0 4px;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

/* 进度条 */
.bars-section { display: flex; flex-direction: column; gap: 0.35rem; }
.bar-row { display: flex; align-items: center; gap: 0.4rem; }
.bar-label { font-size: 0.68rem; color: var(--muted); width: 24px; flex-shrink: 0; font-weight: 600; }
.bar-row .bar { flex: 1; }
.bar-val { font-size: 0.68rem; color: var(--dim); width: 80px; text-align: right; flex-shrink: 0; }

/* 属性 */
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; font-size: 0.82rem; color: var(--muted); }
.header-badge { display: flex; align-items: center; gap: 0.4rem; }
.toggle-icon { font-size: 0.7rem; color: var(--dim); }
.pts-badge {
  color: var(--accent);
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.1rem 0.4rem;
  border: 1px solid rgba(212,175,94,0.35);
  border-radius: 4px;
  background: rgba(212,175,94,0.06);
  font-family: monospace;
  letter-spacing: 0.04em;
}
.pts-badge--zero {
  color: var(--muted);
  border-color: var(--rule);
  background: transparent;
}
.attr-list { display: flex; flex-direction: column; gap: 0.25rem; }
.attr-row { display: flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0; border-bottom: 1px dashed rgba(212,175,94,0.1); }
.attr-row:last-child { border-bottom: 0; }
.attr-name { font-size: 0.82rem; width: 36px; }
.attr-val { font-size: 0.85rem; font-weight: 600; min-width: 36px; }
.attr-base { color: var(--muted); font-family: monospace; }
.attr-bonus { color: var(--success); font-family: monospace; margin-left: 0.2rem; font-weight: 700; }
.attr-bonus--neg { color: var(--danger); }
.attr-total { font-size: 0.72rem; color: var(--accent2); font-family: monospace; }
.attr-controls { margin-left: auto; display: flex; align-items: center; gap: 0.3rem; }
/* v0.8+：+/- 加大到 36x36 方便点击，长按更稳 */
.adj-btn {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: 1px solid;
  cursor: pointer;
  font-size: 1.25rem;
  line-height: 1;
  font-family: inherit;
  font-weight: 700;
  transition: all 0.15s;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation; /* 阻止双击放大 */
}
.adj-btn:active:not(:disabled) {
  transform: scale(0.92);
  box-shadow: 0 0 14px rgba(212,175,94,0.5);
}
.adj-btn.plus {
  border-color: var(--accent2);
  background: rgba(157,140,240,0.16);
  color: var(--accent2);
}
.adj-btn.plus:hover:not(:disabled) { background: var(--accent2); color: #0e0f1c; }
.adj-btn.minus {
  border-color: var(--danger);
  background: rgba(224,88,88,0.16);
  color: var(--danger);
}
.adj-btn.minus:hover:not(:disabled) { background: var(--danger); color: #fff; }
.adj-btn:disabled { opacity: 0.35; cursor: not-allowed; pointer-events: none; filter: grayscale(0.5); }
.attr-hint {
  font-size: 0.72rem;
  color: var(--accent);
  font-style: italic;
  margin-top: 0.4rem;
  padding: 0.3rem 0.5rem;
  background: rgba(212,175,94,0.06);
  border: 1px dashed rgba(212,175,94,0.3);
  border-radius: 4px;
  text-align: center;
}
/* v0.8+：分配确认行（保存 + 重置并排） */
.confirm-row { display: flex; gap: 0.4rem; margin-top: 0.5rem; }
.confirm-row .confirm-btn { flex: 2; }
.confirm-row .reset-btn {
  flex: 1;
  background: transparent;
  border: 1px solid var(--rule);
  color: var(--muted);
}
.confirm-row .reset-btn:hover { border-color: var(--danger); color: var(--danger); background: rgba(224,88,88,0.06); }

.confirm-btn { width: 100%; margin-top: 0.5rem; padding: 0.5rem; }
.reset-btn { padding: 0.5rem; font-size: 0.82rem; }
.auto-btn { width: 100%; padding: 0.5rem; background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #0e0f1c; font-weight: 700; border: none; }
.auto-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(212,175,94,0.4); }

/* 属性预设（v0.8+：4 槽位方案一/二/三/四） */
.attr-presets { margin-top: 0.6rem; padding-top: 0.5rem; border-top: 1px solid var(--rule); }
.presets-header { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; color: var(--muted); cursor: pointer; padding: 0.3rem 0; user-select: none; }
.presets-header:hover { color: var(--accent2); }
.toggle-icon { margin-left: auto; font-size: 0.8rem; }
.presets-body { padding: 0.4rem 0; display: flex; flex-direction: column; gap: 0.5rem; }
.presets-hint {
  font-size: 0.7rem;
  color: rgba(212,175,94,0.55);
  font-style: italic;
  margin: 0;
  padding: 0.05rem 0.1rem;
}
.presets-hint b { color: var(--accent); font-weight: 600; }
.preset-list { display: flex; flex-direction: column; gap: 0.4rem; }
.preset-card {
  padding: 0.5rem 0.6rem;
  background: rgba(20,22,42,0.5);
  border: 1px solid var(--rule);
  border-radius: 6px;
}
.preset-card-top {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.3rem;
}
.preset-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px; height: 22px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  color: #0e0f1c;
  font-size: 0.78rem;
  font-weight: 700;
  flex-shrink: 0;
}
.preset-name {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--accent);
  font-family: var(--font-display, 'Cinzel', serif);
  letter-spacing: 0.08em;
  flex: 1;
}
.preset-filled {
  font-size: 0.65rem;
  color: var(--muted);
  font-family: monospace;
}
.preset-empty-tag {
  font-size: 0.65rem;
  color: var(--dim);
  background: rgba(8,8,14,0.5);
  border: 1px solid var(--rule);
  border-radius: 3px;
  padding: 0.05rem 0.4rem;
}
.preset-attrs {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  margin-bottom: 0.4rem;
}
.pa-item { font-size: 0.7rem; padding: 0.1rem 0.35rem; border-radius: 4px; background: rgba(157,140,240,0.1); font-family: monospace; }
.pa-item.atk { color: var(--danger); }
.pa-item.def { color: var(--accent2); }
.pa-item.hp { color: var(--success); }
.pa-item.agi { color: var(--accent); }
.preset-empty-attrs {
  font-size: 0.7rem;
  color: var(--dim);
  font-style: italic;
  margin-bottom: 0.4rem;
  padding: 0.3rem;
  background: rgba(8,8,14,0.3);
  border-radius: 4px;
  text-align: center;
}
.preset-actions {
  display: flex;
  gap: 0.3rem;
}
.preset-actions .btn { flex: 1; padding: 0.3rem; font-size: 0.72rem; }
/* 删除按钮：紧凑、红色描边，占 1/3 宽度（不放 flex 1 让它窄一点） */
.preset-del {
  flex: 0 0 32px !important;
  background: transparent;
  border: 1px solid rgba(224,88,88,0.4);
  color: rgba(224,88,88,0.85);
  font-weight: 600;
  padding: 0.3rem 0 !important;
}
.preset-del:hover {
  background: rgba(224,88,88,0.15);
  border-color: var(--danger);
  color: var(--danger);
}
.preset-save { background: rgba(157,140,240,0.06); }
.combat-summary { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.4rem; padding-top: 0.4rem; border-top: 1px solid var(--rule); }
.cs-item { font-size: 0.72rem; color: var(--accent2); background: rgba(157,140,240,0.08); padding: 0.1rem 0.4rem; border-radius: 4px; }

/* 战斗统计 */
.combat-record { margin-top: 0.6rem; padding-top: 0.5rem; border-top: 1px solid var(--rule); }
.record-title { font-size: 0.8rem; color: var(--accent2); font-weight: 700; margin-bottom: 0.4rem; }
.record-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.3rem; }
.record-item { display: flex; justify-content: space-between; align-items: center; padding: 0.3rem 0.5rem; background: rgba(20,22,42,0.5); border-radius: 5px; font-size: 0.72rem; }
.record-label { color: var(--muted); }
.record-value { font-weight: 700; color: var(--text); font-family: monospace; }
.record-value.highlight { color: var(--accent); font-size: 0.85rem; }
.record-value .win { color: var(--success); }
.record-value .lose { color: var(--danger); }
.record-value .draw { color: var(--accent2); }

/* 职业区块 */
.job-content { padding-top: 0.3rem; }
.sub-tip { font-size: 0.75rem; color: var(--muted); margin-bottom: 0.4rem; }
.job-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 0.4rem; }
.job-card-mini { padding: 0.5rem; border: 1px solid var(--rule); border-radius: 6px; cursor: pointer; transition: all 0.2s; background: rgba(24,26,46,0.5); text-align: center; }
.job-card-mini:hover { border-color: var(--accent2); }
.job-card-mini.selected { border-color: var(--accent); background: rgba(212,175,94,0.1); }
.job-card-icon { font-size: 1.3rem; }
.job-card-name { font-weight: 600; font-size: 0.82rem; color: var(--accent); margin: 0.15rem 0; }
.job-card-desc { font-size: 0.65rem; color: var(--muted); line-height: 1.3; }
.confirm-job-btn { margin-top: 0.5rem; width: 100%; padding: 0.5rem; }
.job-locked-hint { text-align: center; padding: 1rem; }
.job-locked-hint p { color: var(--muted); font-size: 0.8rem; }
.job-progress { color: var(--accent); font-weight: 600; margin-top: 0.3rem; }

.job-current { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.job-path-name { font-size: 0.72rem; color: var(--muted); }
.job-current-name { font-size: 1rem; font-weight: 600; color: var(--accent); }

/* 成长系数 */
.growth-box { margin-bottom: 0.5rem; padding: 0.4rem 0.6rem; background: rgba(20,22,42,0.5); border-radius: 6px; }
.growth-title { font-size: 0.7rem; color: var(--muted); margin-bottom: 0.2rem; }
.growth-list { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.growth-item { font-size: 0.68rem; color: var(--accent2); }
.growth-item b { color: var(--accent); }

/* 天赋 */
.talent-box { margin-bottom: 0.5rem; padding: 0.4rem 0.6rem; background: rgba(212,175,94,0.05); border: 1px solid rgba(212,175,94,0.15); border-radius: 6px; }
.talent-title { font-size: 0.7rem; color: var(--accent); margin-bottom: 0.2rem; font-weight: 600; }
.talent-item { display: flex; flex-direction: column; gap: 0.05rem; margin-bottom: 0.25rem; }
.talent-name { font-size: 0.75rem; color: var(--accent); font-weight: 600; }
.talent-desc { font-size: 0.68rem; color: var(--muted); }

/* 机制 */
.mechanic-box { margin-bottom: 0.5rem; padding: 0.4rem 0.6rem; background: rgba(157,140,240,0.05); border: 1px solid rgba(157,140,240,0.12); border-radius: 6px; }
.mechanic-title { font-size: 0.7rem; color: var(--accent2); margin-bottom: 0.2rem; font-weight: 600; }
.mechanic-item { display: flex; align-items: center; gap: 0.4rem; padding: 0.15rem 0; font-size: 0.72rem; }
.mechanic-item.unlocked { color: var(--accent2); }
.mechanic-item.locked { color: var(--dim); opacity: 0.6; }
.mechanic-stage { font-size: 0.65rem; background: rgba(157,140,240,0.15); padding: 0.05rem 0.3rem; border-radius: 3px; }
.mechanic-name { font-weight: 600; }
.mechanic-desc { color: var(--muted); flex: 1; }
.mechanic-status { font-size: 0.75rem; }

/* 进阶路线 */
.stages-timeline { display: flex; flex-direction: column; }
.stage-node { display: flex; gap: 0.5rem; padding: 0.3rem 0; position: relative; }
.stage-node:not(:last-child)::before { content: ''; position: absolute; left: 10px; top: 24px; bottom: -4px; width: 2px; background: var(--rule); }
.stage-node.done:not(:last-child)::before { background: var(--accent2); }
.stage-dot { width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 0.62rem; font-weight: 700; z-index: 1; background: var(--bg3); border: 2px solid var(--rule); color: var(--dim); }
.stage-node.done .stage-dot { background: var(--accent2); border-color: var(--accent2); color: #0e0f1c; }
.stage-node.current .stage-dot { background: var(--accent); border-color: var(--accent); color: #0e0f1c; box-shadow: 0 0 8px rgba(212,175,94,0.4); }
.stage-name { font-size: 0.78rem; font-weight: 600; }
.stage-node.done .stage-name { color: var(--accent2); }
.stage-node.current .stage-name { color: var(--accent); }
.stage-node.future .stage-name { color: var(--dim); }
.stage-level { font-size: 0.65rem; color: var(--muted); }
.stage-desc { font-size: 0.68rem; color: var(--dim); margin-top: 0.05rem; }
.next-hint { margin-top: 0.5rem; padding: 0.4rem 0.6rem; background: rgba(212,175,94,0.08); border: 1px solid rgba(212,175,94,0.2); border-radius: 6px; font-size: 0.75rem; color: var(--accent); }

/* v0.8+：词条摘要样式已删除（独立「技能」页承担全部词条管理） */

/* 装备详情弹窗样式见 EquipDetailModal.vue */

/* 右侧折叠面板 */
.side-panel {
  position: fixed; right: 0; top: 50%; transform: translateY(-50%);
  z-index: 50; display: flex; align-items: center;
}
.side-toggle {
  width: 24px; height: 44px; border: 1px solid var(--rule, #2a2b42);
  border-right: none; border-radius: 8px 0 0 8px;
  background: var(--bg2, #14162a); color: var(--muted, #9d9bb8);
  cursor: pointer; font-size: 1rem; padding: 0;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s ease;
}
.side-toggle:hover { color: var(--accent, #d4af5e); border-color: var(--accent, #d4af5e); }
.side-tabs {
  background: var(--bg2, #14162a); border: 1px solid var(--rule, #2a2b42);
  border-right: none; border-radius: 10px 0 0 10px;
  padding: 0.35rem; display: flex; flex-direction: column; gap: 0.25rem;
  box-shadow: -4px 0 12px rgba(0,0,0,0.3);
}
.side-tab-item {
  display: flex; align-items: center; gap: 0.35rem; padding: 0.4rem 0.7rem;
  border-radius: 8px; cursor: pointer; white-space: nowrap;
  transition: all 0.15s ease; color: var(--muted, #9d9bb8);
}
.side-tab-item:hover { background: rgba(157,140,240,0.08); color: var(--ink, #ece9f5); }
.side-tab-icon { font-size: 1rem; }
.side-tab-label { font-size: 0.72rem; font-weight: 600; }
.side-tab-badge {
  background: var(--danger, #e85d75); color: #fff; font-size: 0.58rem;
  min-width: 14px; height: 14px; line-height: 14px; text-align: center;
  border-radius: 7px; padding: 0 3px; margin-left: auto;
}
.side-tab-badge--gold { background: var(--accent, #d4af5e); box-shadow: 0 0 8px rgba(212,175,94,0.4); }
/* v0.8+ 创世之书专属样式：金边 + 微光，区别于普通任务侧栏 */
.side-tab-item--genesis {
  border: 1px solid rgba(212,175,94,0.45);
  background: linear-gradient(135deg, rgba(212,175,94,0.10) 0%, rgba(28,30,54,0.7) 100%);
  margin-top: 0.4rem;
  box-shadow: 0 0 12px rgba(212,175,94,0.18);
}
.side-tab-item--genesis:hover {
  background: linear-gradient(135deg, rgba(212,175,94,0.18) 0%, rgba(28,30,54,0.85) 100%);
  border-color: var(--accent, #d4af5e);
  box-shadow: 0 0 18px rgba(212,175,94,0.35);
}
.side-slide-enter-active, .side-slide-leave-active {
  transition: all var(--duration-fast, 150ms) var(--ease-out, ease);
}
.side-slide-enter-from, .side-slide-leave-to { opacity: 0; transform: translateX(15px); }
</style>
