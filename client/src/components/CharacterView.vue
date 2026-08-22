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
          :class="{ filled: player.equipped[slot.key] }"
          @click="player.equipped[slot.key] ? showEquipDetail(slot.key) : null">
          <div class="slot-icon"><IconBase :name="slot.iconName" :size="22" /></div>
          <div class="slot-label">{{ slot.label }}</div>
          <div v-if="player.equipped[slot.key]" class="slot-item"
            :style="{ color: qualityColors[player.equipped[slot.key].quality] }">
            {{ player.equipped[slot.key].name }}
          </div>
          <div v-else class="slot-empty">空</div>
          <div v-if="player.equipped[slot.key] && player.equipped[slot.key].enchants && player.equipped[slot.key].enchants.length > 0" class="slot-enchants">
            ✦{{ player.equipped[slot.key].enchants.length }}
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

    <!-- 属性面板 -->
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
            <button class="adj-btn minus" v-if="pending[attr.key]" @click="adjust(attr.key, -1)">−</button>
            <span v-if="pending[attr.key]" class="pending-val">+{{ pending[attr.key] }}</span>
            <button class="adj-btn plus" data-alloc-available @click="adjust(attr.key, 1)">+</button>
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
      <button v-if="hasPending" class="btn btn-primary confirm-btn" data-alloc-available @click="confirmAllocate">确认分配</button>
      <div v-else-if="player.attrPoints > 0" class="auto-alloc-row" data-alloc-available>
        <button class="btn btn-secondary auto-btn" @click="autoAllocate"><IconBase name="sparkle" :size="14" class="btn-icon" /> 一键加点（按职业权重）</button>
      </div>

      <!-- 属性预设方案 -->
      <div class="attr-presets">
        <div class="presets-header" @click="showPresets = !showPresets">
          <IconBase name="dna" :size="13" class="section-icon" />
          <span>属性预设方案 ({{ (player.attrPresets || []).length }}/5）</span>
          <span class="toggle-icon">{{ showPresets ? '▾' : '▸' }}</span>
        </div>
        <div v-if="showPresets" class="presets-body">
          <div class="preset-save-row">
            <input v-model="newPresetName" class="preset-name-input" placeholder="预设名（最多 12 字）" maxlength="12" />
            <button class="btn btn-sm btn-primary" :class="{ 'btn-disabled': !newPresetName.trim() }" @click="handleSavePreset">保存当前加点为预设</button>
          </div>
          <div v-if="(player.attrPresets || []).length === 0" class="preset-empty">暂无预设，先调整属性并保存</div>
          <div v-else class="preset-list">
            <div v-for="p in player.attrPresets" :key="p.id" class="preset-card">
              <div class="preset-card-top">
                <span class="preset-name">{{ p.name }}</span>
                <span class="preset-lv">Lv.{{ p.level }} 保存</span>
              </div>
              <div class="preset-attrs">
                <span class="pa-item atk">攻 {{ p.attributes.atk }}</span>
                <span class="pa-item def">防 {{ p.attributes.def }}</span>
                <span class="pa-item hp">体 {{ p.attributes.hp }}</span>
                <span class="pa-item agi">敏 {{ p.attributes.agi }}</span>
              </div>
              <div class="preset-actions">
                <button class="btn btn-sm btn-primary" :class="{ 'btn-disabled': player.attrPoints <= 0 }"
                  @click="handleApplyPreset(p.id)">按比例加点</button>
                <button class="btn btn-sm btn-danger" @click="handleDeletePreset(p.id)">删除</button>
              </div>
            </div>
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

    <!-- 词条摘要（完整管理请到「技能」页） -->
    <div class="affix-summary-card card" @click="$emit('goSkill')">
      <div class="section-header">
        <span><IconBase name="sparkle" :size="14" class="section-icon" /> 词条系统</span>
        <span class="toggle-icon">前往管理 ›</span>
      </div>
      <div v-if="!player.jobPath" class="no-job-hint">
        <p>选择职业后解锁词条系统</p>
      </div>
      <template v-else>
        <div class="affix-mini-row">
          <span class="affix-mini-label">主动</span>
          <span v-if="player.equippedAffixes?.active" class="affix-mini-name active">{{ player.equippedAffixes.active.name }}</span>
          <span v-else class="affix-mini-empty">未装备</span>
        </div>
        <div class="affix-mini-row">
          <span class="affix-mini-label">被动</span>
          <span class="affix-mini-names">
            <span v-for="(p, i) in (player.equippedAffixes?.passive || [])" :key="i" class="affix-mini-name">{{ p.name }}</span>
            <span v-if="!player.equippedAffixes?.passive?.length" class="affix-mini-empty">{{ player.equippedAffixes?.passive?.length || 0 }}/{{ player.passiveSlots }}</span>
            <span v-else class="affix-mini-count">{{ player.equippedAffixes?.passive?.length || 0 }}/{{ player.passiveSlots }}</span>
          </span>
        </div>
      </template>
    </div>

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

const props = defineProps(['player', 'jobTree'])
const emit = defineEmits(['allocate', 'autoAllocate', 'equip', 'unequip', 'enchant', 'chooseJob', 'goSkill', 'goEvo', 'goQuest', 'refresh'])

const pending = ref({})
const detailItem = ref(null)
const detailSlot = ref(null)
const selectedJob = ref(null)
const sideOpen = ref(false)
const openSections = reactive({ job: true })
const showPresets = ref(false)
const newPresetName = ref('')

const winRateText = computed(() => {
  const cs = props.player.combatStats || {}
  const wins = cs.totalWins || 0
  const losses = cs.totalLosses || 0
  const draws = cs.totalDraws || 0
  const total = wins + losses + draws
  if (total === 0) return '0'
  return Math.round((wins / total) * 100)
})

const qualityColors = { normal: '#9d9bb8', fine: '#5eda7a', epic: '#9d8cf0', legend: '#d4af5e' }
const qualityLabels = { normal: '普通', fine: '精良', epic: '史诗', legend: '传说' }
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

function autoAllocate() {
  if (props.player.attrPoints <= 0) return
  emit('autoAllocate')
}

async function handleSavePreset() {
  const name = newPresetName.value.trim()
  if (!name) return
  emit('savePreset', name)
  newPresetName.value = ''
}
function handleApplyPreset(presetId) {
  emit('applyPreset', presetId)
}
async function handleDeletePreset(presetId) {
  if (!await modalConfirm('确认删除该预设？')) return
  emit('deletePreset', presetId)
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
.slot-icon { font-size: 1rem; }
.slot-label { font-size: 0.65rem; color: var(--muted); margin: 0.1rem 0; }
.slot-item { font-size: 0.68rem; font-weight: 600; word-break: break-all; line-height: 1.2; }
.slot-empty { font-size: 0.68rem; color: var(--dim); }
.slot-enchants { position: absolute; top: 2px; right: 2px; font-size: 0.6rem; color: var(--accent); }

/* 进度条 */
.bars-section { display: flex; flex-direction: column; gap: 0.35rem; }
.bar-row { display: flex; align-items: center; gap: 0.4rem; }
.bar-label { font-size: 0.68rem; color: var(--muted); width: 24px; flex-shrink: 0; font-weight: 600; }
.bar-row .bar { flex: 1; }
.bar-val { font-size: 0.68rem; color: var(--dim); width: 80px; text-align: right; flex-shrink: 0; }

/* 属性 */
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; font-size: 0.82rem; color: var(--muted); cursor: pointer; }
.header-badge { display: flex; align-items: center; gap: 0.4rem; }
.toggle-icon { font-size: 0.7rem; color: var(--dim); }
.pts-badge { color: var(--accent); font-size: 0.75rem; font-weight: 600; }
.attr-list { display: flex; flex-direction: column; gap: 0.25rem; }
.attr-row { display: flex; align-items: center; gap: 0.4rem; padding: 0.2rem 0; }
.attr-name { font-size: 0.82rem; width: 36px; }
.attr-val { font-size: 0.85rem; font-weight: 600; color: var(--accent); min-width: 28px; }
.attr-total { font-size: 0.72rem; color: var(--accent2); }
.attr-controls { margin-left: auto; display: flex; align-items: center; gap: 0.3rem; }
.adj-btn { width: 22px; height: 22px; border-radius: 5px; border: 1px solid; cursor: pointer; font-size: 0.85rem; line-height: 1; font-family: inherit; transition: all 0.15s; }
.adj-btn.plus { border-color: var(--accent2); background: rgba(157,140,240,0.1); color: var(--accent2); }
.adj-btn.plus:hover { background: var(--accent2); color: #0e0f1c; }
.adj-btn.minus { border-color: var(--danger); background: rgba(224,88,88,0.1); color: var(--danger); }
.adj-btn.minus:hover { background: var(--danger); color: #fff; }
.pending-val { font-size: 0.78rem; color: var(--success); font-weight: 600; min-width: 20px; text-align: center; }
.confirm-btn { width: 100%; margin-top: 0.5rem; padding: 0.5rem; }
.auto-alloc-row { margin-top: 0.5rem; }
.auto-btn { width: 100%; padding: 0.5rem; background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #0e0f1c; font-weight: 700; border: none; }
.auto-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(212,175,94,0.4); }

/* 属性预设 */
.attr-presets { margin-top: 0.6rem; padding-top: 0.5rem; border-top: 1px solid var(--rule); }
.presets-header { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; color: var(--muted); cursor: pointer; padding: 0.3rem 0; user-select: none; }
.presets-header:hover { color: var(--accent2); }
.toggle-icon { margin-left: auto; font-size: 0.8rem; }
.presets-body { padding: 0.4rem 0; display: flex; flex-direction: column; gap: 0.5rem; }
.preset-save-row { display: flex; gap: 0.3rem; align-items: center; }
.preset-name-input { flex: 1; padding: 0.3rem 0.5rem; background: rgba(20,22,42,0.6); border: 1px solid var(--rule); border-radius: 5px; color: var(--text); font-size: 0.78rem; font-family: inherit; outline: none; }
.preset-name-input:focus { border-color: var(--accent2); }
.preset-empty { font-size: 0.75rem; color: var(--dim); text-align: center; padding: 0.4rem; font-style: italic; }
.preset-list { display: flex; flex-direction: column; gap: 0.4rem; }
.preset-card { padding: 0.5rem; background: rgba(20,22,42,0.5); border: 1px solid var(--rule); border-radius: 6px; }
.preset-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; }
.preset-name { font-size: 0.82rem; font-weight: 700; color: var(--accent); }
.preset-lv { font-size: 0.65rem; color: var(--dim); }
.preset-attrs { display: flex; gap: 0.3rem; flex-wrap: wrap; margin-bottom: 0.4rem; }
.pa-item { font-size: 0.7rem; padding: 0.1rem 0.35rem; border-radius: 4px; background: rgba(157,140,240,0.1); }
.pa-item.atk { color: var(--danger); }
.pa-item.def { color: var(--accent2); }
.pa-item.hp { color: var(--success); }
.pa-item.agi { color: var(--accent); }
.preset-actions { display: flex; gap: 0.3rem; }
.preset-actions .btn { flex: 1; padding: 0.3rem; font-size: 0.72rem; }
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

/* 词条摘要 */
.affix-summary-card { cursor: pointer; transition: all var(--duration-normal) var(--ease-out); }
.affix-summary-card:hover { border-color: var(--accent2); }
.no-job-hint { text-align: center; padding: 0.8rem; color: var(--dim); font-size: 0.8rem; }
.affix-mini-row { display: flex; align-items: center; gap: 0.4rem; padding: 0.15rem 0; }
.affix-mini-label { font-size: 0.72rem; color: var(--muted); width: 32px; flex-shrink: 0; font-weight: 600; }
.affix-mini-name { font-size: 0.78rem; font-weight: 600; color: var(--accent2); }
.affix-mini-name.active { color: var(--accent); }
.affix-mini-empty { font-size: 0.72rem; color: var(--dim); }
.affix-mini-count { font-size: 0.68rem; color: var(--dim); margin-left: 0.3rem; }
.affix-mini-names { display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; }

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
.side-slide-enter-active, .side-slide-leave-active {
  transition: all var(--duration-fast, 150ms) var(--ease-out, ease);
}
.side-slide-enter-from, .side-slide-leave-to { opacity: 0; transform: translateX(15px); }
</style>
