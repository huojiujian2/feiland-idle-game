<template>
  <div class="view-container skill-view">
    <!-- 子标签：主动/被动 -->
    <div class="sub-tabs">
      <button class="sub-tab" :class="{ active: subTab === 'active' }" @click="subTab = 'active'; page = 1">
        <IconBase name="sword" :size="14" class="btn-icon" /> 主动
      </button>
      <button class="sub-tab" :class="{ active: subTab === 'passive' }" @click="subTab = 'passive'; page = 1">
        <IconBase name="shield" :size="14" class="btn-icon" /> 被动
      </button>
    </div>

    <!-- 已装备概览 -->
    <div class="card section equipped-section">
      <div class="section-header">
        <span>插槽</span>
        <span class="slot-summary">{{ equippedCount }}/{{ totalSlots }}</span>
      </div>
      <div v-if="!player.jobPath" class="empty-hint">选择职业后解锁词条系统</div>
      <template v-else>
        <!-- 主动槽 -->
        <div class="slot-row">
          <span class="slot-label">主动</span>
          <div class="slot-box" :class="{ filled: player.equippedAffixes?.active }"
            @click="subTab = 'active'; page = 1">
            <template v-if="player.equippedAffixes?.active">
              <span class="slot-name active">{{ player.equippedAffixes.active.name }}</span>
              <span class="slot-desc">{{ player.equippedAffixes.active.desc }}</span>
            </template>
            <span v-else class="slot-empty">点击装备</span>
          </div>
          <button v-if="player.equippedAffixes?.active" class="btn btn-sm unequip-btn"
            @click.stop="$emit('unequipAffix', player.equippedAffixes.active.id)">卸下</button>
        </div>
        <!-- 被动槽 -->
        <div class="slot-row">
          <span class="slot-label">被动</span>
          <div class="passive-grid">
            <div v-for="i in player.passiveSlots" :key="i" class="slot-box mini"
              :class="{ filled: player.equippedAffixes?.passive?.[i - 1] }"
              @click="subTab = 'passive'; page = 1">
              <template v-if="player.equippedAffixes?.passive?.[i - 1]">
                <span class="slot-name">{{ player.equippedAffixes.passive[i - 1].name }}</span>
              </template>
              <span v-else class="slot-empty">+</span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 等级筛选 -->
    <div class="level-filter">
      <button v-for="lv in levelOptions" :key="lv.key" class="level-btn"
        :class="{ active: activeLevel === lv.key }"
        @click="activeLevel = lv.key; page = 1">
        <template v-if="renderLevelIcon(lv.icon).type === 'icon'">
          <IconBase :name="lv.icon" :size="14" class="btn-icon" />
        </template>
        <template v-else>
          <span class="btn-icon">{{ renderLevelIcon(lv.icon).text }}</span>
        </template>
        {{ lv.label }}
      </button>
    </div>

    <!-- 词条网格 -->
    <div class="card section">
      <div class="section-header">
        <span>
          <IconBase :name="subTab === 'active' ? 'sword' : 'shield'" :size="14" class="section-icon" />
          {{ subTab === 'active' ? '主动词条' : '被动词条' }} ({{ filteredAffixes.length }})
        </span>
      </div>
      <div v-if="filteredAffixes.length === 0" class="empty-hint">暂无词条</div>
      <div v-else class="item-grid">
        <div v-for="affix in pagedAffixes" :key="affix.id" class="grid-cell"
          :class="{ equipped: isEquipped(affix.id) }"
          :style="{ borderColor: isEquipped(affix.id) ? 'var(--accent)' : undefined }"
          @click="showDetail(affix)">
          <div class="cell-icon">
            <IconBase v-if="renderLevelIcon(getAffixIcon(affix)).type === 'icon'" :name="getAffixIcon(affix)" :size="22" class="icon-accent2" />
            <span v-else class="raw-emoji">{{ getAffixIcon(affix) }}</span>
          </div>
          <div class="cell-name">{{ affix.name }}</div>
          <div class="cell-cat">{{ affix.category || affix.group || '' }}</div>
          <span v-if="isEquipped(affix.id)" class="cell-badge">✓</span>
          <span class="cell-level">{{ affix._levelName }}</span>
        </div>
      </div>
      <div v-if="totalPages > 1" class="pager">
        <button class="pager-btn" :disabled="page === 1" @click="page--">‹</button>
        <span class="pager-info">{{ page }}/{{ totalPages }}</span>
        <button class="pager-btn" :disabled="page === totalPages" @click="page++">›</button>
      </div>
    </div>

    <!-- 词条详情弹窗 -->
    <div v-if="detailAffix" class="modal-overlay" @click.self="detailAffix = null">
      <div class="modal-box">
        <div class="modal-title">
          <IconBase v-if="renderLevelIcon(getAffixIcon(detailAffix)).type === 'icon'" :name="getAffixIcon(detailAffix)" :size="22" class="icon-accent2" />
          <span v-else class="raw-emoji">{{ getAffixIcon(detailAffix) }}</span>
          {{ detailAffix.name }}
          <span class="modal-level-tag">
            <IconBase v-if="renderLevelIcon(detailAffix._levelIcon).type === 'icon'" :name="detailAffix._levelIcon" :size="14" />
            <span v-else class="raw-emoji">{{ detailAffix._levelIcon }}</span>
            {{ detailAffix._levelName }}
          </span>
        </div>
        <div class="modal-row"><span class="ml">类型</span><span class="mv">{{ subTab === 'active' ? '主动词条' : '被动词条' }}</span></div>
        <div class="modal-row" v-if="detailAffix.category || detailAffix.group"><span class="ml">分类</span><span class="mv">{{ detailAffix.category || detailAffix.group }}</span></div>
        <div class="modal-row"><span class="ml">状态</span><span class="mv" :style="{ color: isEquipped(detailAffix.id) ? 'var(--accent)' : 'var(--muted)' }">{{ isEquipped(detailAffix.id) ? '已装备' : '未装备' }}</span></div>
        <div class="modal-desc">{{ detailAffix.desc }}</div>
        <div class="modal-stats" v-if="detailAffix.bonus">
          <div v-for="(val, key) in detailAffix.bonus" :key="key" class="stat-chip">
            {{ statLabels[key] || key }} {{ val > 0 && val < 1 ? '+' + (val * 100).toFixed(0) + '%' : '+' + val }}
          </div>
        </div>
        <div class="modal-actions">
          <button v-if="!isEquipped(detailAffix.id)" class="btn btn-primary btn-sm"
            @click="handleEquip">装备</button>
          <button v-else class="btn btn-danger btn-sm"
            @click="handleUnequip">卸下</button>
          <button class="btn btn-sm" @click="detailAffix = null">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import IconBase from './icons/IconBase.vue'

const props = defineProps(['player'])
const emit = defineEmits(['equipAffix', 'unequipAffix'])

const subTab = ref('active')
const activeLevel = ref('all')
const page = ref(1)
const pageSize = 12
const detailAffix = ref(null)

const statLabels = {
  atk: '攻击', def: '防御', hp: 'HP', mp: 'MP', agi: '敏捷',
  crit: '暴击', dodge: '闪避', regen: '回血', lifesteal: '吸血',
  expBonus: '经验', goldBonus: '金币'
}

const levelOptions = computed(() => {
  const opts = [{ key: 'all', label: '全部', icon: 'skill' }]
  const data = props.player.affixData || {}
  Object.values(data).forEach(lv => {
    if (lv.config) {
      // config.icon 可能是后端 emoji（保留原样显示）或 icon name（命中 IconBase）
      opts.push({
        key: String(lv.config.level || lv.config.name),
        label: lv.config.name,
        icon: lv.config.icon || 'skill'
      })
    }
  })
  return opts
})

function renderLevelIcon(name) {
  // 已知的 icon 名交给 IconBase，其他当成原始字符（emoji）渲染
  const known = ['skill', 'sword', 'shield', 'bolt', 'sparkle', 'heart', 'skull', 'scroll', 'gold', 'star', 'flag', 'trophy', 'crossedSwords', 'user', 'plus', 'minus', 'gem', 'confirm', 'close', 'feather', 'bag', 'map', 'book', 'dna', 'logout', 'shop', 'chevronRight']
  if (known.includes(name)) return { type: 'icon', name }
  return { type: 'raw', text: name }
}

const allAffixes = computed(() => {
  const result = []
  const data = props.player.affixData || {}
  Object.values(data).forEach(lv => {
    const levelName = lv.config?.name || ''
    const levelIcon = lv.config?.icon || '🔹'
    const levelKey = String(lv.config?.level || lv.config?.name || '')
    const list = subTab.value === 'active' ? lv.active : lv.passive
    if (list) {
      list.forEach(a => {
        result.push({ ...a, _levelName: levelName, _levelIcon: levelIcon, _levelKey: levelKey })
      })
    }
  })
  return result
})

const filteredAffixes = computed(() => {
  if (activeLevel.value === 'all') return allAffixes.value
  return allAffixes.value.filter(a => a._levelKey === activeLevel.value)
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredAffixes.value.length / pageSize)))
const pagedAffixes = computed(() => filteredAffixes.value.slice((page.value - 1) * pageSize, page.value * pageSize))

watch(totalPages, () => { if (page.value > totalPages.value) page.value = 1 })

const totalSlots = computed(() => 1 + (props.player.passiveSlots || 0))
const equippedCount = computed(() => {
  let n = props.player.equippedAffixes?.active ? 1 : 0
  n += props.player.equippedAffixes?.passive?.length || 0
  return n
})

function isEquipped(affixId) {
  if (props.player.affixes?.active === affixId) return true
  return props.player.affixes?.passive?.includes(affixId) || false
}

function getAffixIcon(affix) {
  if (affix._levelIcon) return affix._levelIcon
  const cat = affix.category || affix.group || ''
  if (cat.includes('攻') || cat.includes('ATK')) return 'sword'
  if (cat.includes('防') || cat.includes('DEF')) return 'shield'
  if (cat.includes('速') || cat.includes('AGI')) return 'bolt'
  if (cat.includes('暴') || cat.includes('crit')) return 'sparkle'
  if (cat.includes('回') || cat.includes('regen')) return 'heart'
  if (cat.includes('吸') || cat.includes('lifesteal')) return 'skull'
  if (cat.includes('经') || cat.includes('exp')) return 'scroll'
  if (cat.includes('金') || cat.includes('gold')) return 'gold'
  return subTab.value === 'active' ? 'sword' : 'shield'
}

function showDetail(affix) {
  detailAffix.value = affix
}

function handleEquip() {
  emit('equipAffix', detailAffix.value.id, detailAffix.value.slot || subTab.value)
  detailAffix.value = null
}

function handleUnequip() {
  emit('unequipAffix', detailAffix.value.id)
  detailAffix.value = null
}
</script>

<style scoped>
.skill-view { display: flex; flex-direction: column; gap: 0.6rem; max-width: 560px; margin: 0 auto; }

.sub-tabs { display: flex; gap: 0.3rem; }
.sub-tab { flex: 1; padding: 0.5rem; border: 1px solid rgba(157,140,240,0.1); border-radius: 8px; background: rgba(20,22,42,0.4); color: var(--muted); font-size: 0.85rem; cursor: pointer; transition: all var(--duration-normal) var(--ease-out); font-family: inherit; }
.sub-tab.active { background: rgba(212,175,94,0.08); border-color: var(--accent); color: var(--accent); box-shadow: 0 0 12px rgba(212,175,94,0.1); }

.section { padding: 0.6rem 0.8rem; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; font-size: 0.85rem; color: var(--muted); }
.slot-summary { color: var(--accent); font-weight: 600; font-size: 0.78rem; }
.empty-hint { text-align: center; padding: 1rem; color: var(--dim); font-size: 0.82rem; }

/* 已装备概览 */
.slot-row { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.4rem; }
.slot-row:last-child { margin-bottom: 0; }
.slot-label { font-size: 0.72rem; color: var(--muted); width: 32px; flex-shrink: 0; text-align: center; font-weight: 600; }
.slot-box { flex: 1; padding: 0.4rem 0.5rem; border: 1px solid var(--rule); border-radius: 8px; cursor: pointer; transition: all 0.2s; background: rgba(24,26,46,0.4); min-height: 44px; display: flex; flex-direction: column; gap: 0.1rem; justify-content: center; }
.slot-box:hover { border-color: var(--accent2); }
.slot-box.filled { border-color: rgba(212,175,94,0.25); background: rgba(212,175,94,0.05); }
.slot-box.mini { min-height: 36px; align-items: center; justify-content: center; text-align: center; }
.slot-name { font-size: 0.78rem; font-weight: 600; color: var(--accent2); }
.slot-name.active { color: var(--accent); }
.slot-desc { font-size: 0.65rem; color: var(--muted); }
.slot-empty { font-size: 0.72rem; color: var(--dim); text-align: center; }
.unequip-btn { flex-shrink: 0; }
.passive-grid { flex: 1; display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 0.3rem; }

/* 等级筛选 */
.level-filter { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.level-btn { padding: 0.25rem 0.6rem; border: 1px solid var(--rule); border-radius: 6px; background: rgba(20,22,42,0.4); color: var(--muted); font-size: 0.72rem; cursor: pointer; transition: all 0.15s; font-family: inherit; }
.level-btn:hover { border-color: var(--accent2); }
.level-btn.active { background: rgba(157,140,240,0.12); border-color: var(--accent2); color: var(--accent2); }

/* 网格 */
.item-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem; }
.grid-cell { display: flex; flex-direction: column; align-items: center; gap: 0.1rem; padding: 0.4rem 0.2rem; border: 1px solid var(--rule); border-radius: 8px; cursor: pointer; transition: all 0.15s; background: rgba(24,26,46,0.4); position: relative; text-align: center; }
.grid-cell:hover { border-color: var(--accent2); transform: translateY(-2px); background: rgba(157,140,240,0.06); }
.grid-cell.equipped { background: rgba(212,175,94,0.08); }
.cell-icon { font-size: 1.3rem; display: flex; align-items: center; justify-content: center; min-height: 28px; min-width: 28px; }
.cell-name { font-size: 0.65rem; font-weight: 600; word-break: break-all; line-height: 1.2; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; }
.cell-cat { font-size: 0.55rem; color: var(--dim); }
.cell-badge { position: absolute; top: 1px; right: 3px; font-size: 0.6rem; color: var(--accent); font-weight: 700; }
.cell-level { position: absolute; bottom: 1px; left: 3px; font-size: 0.5rem; color: var(--dim); }

/* 分页器 */
.pager { display: flex; justify-content: center; align-items: center; gap: 0.5rem; padding: 0.3rem 0 0.1rem; }
.pager-btn { padding: 0.2rem 0.6rem; border: 1px solid var(--rule); border-radius: 6px; background: rgba(20,22,42,0.5); color: var(--ink); font-size: 0.75rem; cursor: pointer; transition: all 0.2s; }
.pager-btn:hover:not(:disabled) { border-color: var(--accent2); }
.pager-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.pager-info { font-size: 0.72rem; color: var(--muted); font-family: monospace; }

/* 弹窗 */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1100; padding: 1rem; }
.modal-box { background: var(--bg2); border: 1px solid var(--rule); border-radius: 12px; padding: 1.2rem; max-width: 340px; width: 100%; max-height: 85vh; overflow-y: auto; }
.modal-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; }
.modal-level-tag { font-size: 0.68rem; color: var(--accent2); background: rgba(157,140,240,0.12); padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: 400; }
.modal-row { display: flex; justify-content: space-between; align-items: center; padding: 0.2rem 0; font-size: 0.82rem; }
.ml { color: var(--muted); }
.mv { color: var(--accent); font-weight: 600; }
.modal-desc { font-size: 0.78rem; color: var(--dim); margin: 0.4rem 0; padding: 0.4rem 0.5rem; background: rgba(157,140,240,0.05); border-radius: 6px; line-height: 1.5; }
.modal-stats { display: flex; flex-wrap: wrap; gap: 0.25rem; margin: 0.4rem 0; }
.stat-chip { font-size: 0.72rem; color: var(--accent2); background: rgba(157,140,240,0.1); padding: 0.15rem 0.4rem; border-radius: 4px; }
.modal-actions { display: flex; gap: 0.3rem; margin-top: 0.5rem; }
.modal-actions .btn { flex: 1; }
</style>
