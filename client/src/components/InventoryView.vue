<template>
  <div class="view-container bag-view">
      <!-- 装备网格 -->
      <div class="card section">
        <div class="section-header">
          <span><IconBase name="sword" :size="14" class="section-icon" />装备 ({{ player.equips.length }})</span>
        </div>
        <div v-if="player.equips.length === 0" class="empty-hint">空空如也...去打怪掉装备吧！</div>
        <div v-else class="item-grid">
          <div v-for="item in pagedEquips" :key="item.uid" class="grid-cell"
            :style="{ borderColor: qualityColors[item.quality] + '40' }"
            @click="showEquipDetail(item)">
            <div class="cell-icon">
              <IconBase :name="equipSlotIcons[item.slot] || 'bag'" :size="22" class="icon-accent2" />
            </div>
            <div class="cell-name" :style="{ color: qualityColors[item.quality] }">{{ item.name }}</div>
            <div class="cell-stat">{{ mainStat(item) }}</div>
            <span v-if="item.enchants && item.enchants.length > 0" class="cell-badge">✦{{ item.enchants.length }}</span>
            <span v-if="player.level < item.reqLevel" class="cell-lock"><IconBase name="close" :size="10" /></span>
          </div>
        </div>
        <div v-if="equipTotalPages > 1" class="pager">
          <button class="pager-btn" :disabled="equipPage === 1" @click="equipPage--">‹</button>
          <span class="pager-info">{{ equipPage }}/{{ equipTotalPages }}</span>
          <button class="pager-btn" :disabled="equipPage === equipTotalPages" @click="equipPage++">›</button>
        </div>
      </div>

      <!-- 物品网格 -->
      <div class="card section">
        <div class="section-header">
          <span><IconBase name="bag" :size="14" class="section-icon" />物品 ({{ player.inventory.length }})</span>
        </div>
        <div v-if="player.inventory.length === 0" class="empty-hint">暂无物品</div>
        <div v-else class="item-grid">
          <div v-for="item in pagedMats" :key="item.name" class="grid-cell"
            @click="showItemDetail(item)">
            <div class="cell-icon">
              <IconBase :name="getItemIcon(item)" :size="22" class="icon-accent2" />
            </div>
            <div class="cell-name">{{ item.name }}</div>
            <div class="cell-count">×{{ item.count }}</div>
          </div>
        </div>
        <div v-if="matTotalPages > 1" class="pager">
          <button class="pager-btn" :disabled="matPage === 1" @click="matPage--">‹</button>
          <span class="pager-info">{{ matPage }}/{{ matTotalPages }}</span>
          <button class="pager-btn" :disabled="matPage === matTotalPages" @click="matPage++">›</button>
        </div>
      </div>

    <!-- 装备详情弹窗（含附魔） -->
    <div v-if="detailItem" class="equip-detail-overlay" @click.self="detailItem = null">
      <div class="equip-detail-box">
        <div class="detail-name" :style="{ color: qualityColors[detailItem.quality] }">{{ detailItem.name }}</div>
        <div class="detail-quality" :style="{ color: qualityColors[detailItem.quality] }">
          {{ qualityLabels[detailItem.quality] }} · {{ slotLabels[detailItem.slot] }}
          <span v-if="detailItem.reqLevel"> · 需Lv.{{ detailItem.reqLevel }}</span>
        </div>
        <div class="detail-stats">
          <div v-for="(val, key) in detailItem.stats" :key="key" class="detail-stat">
            {{ statLabels[key] || key }} +{{ val }}{{ ['exp','gold'].includes(key) ? '%' : '' }}
          </div>
        </div>
        <div v-if="detailItem.enchants && detailItem.enchants.length > 0" class="enchanted-list">
          <div class="enchant-header">已附魔（{{ detailItem.enchants.length }}/3）</div>
          <div v-for="enchId in detailItem.enchants" :key="enchId" class="enchant-item">
            <span class="enchant-name">{{ getEnchantName(enchId) }}</span>
            <span class="enchant-desc">{{ getEnchantDesc(enchId) }}</span>
          </div>
        </div>
        <!-- 锻造 / 升级 -->
        <div class="forge-section">
          <div class="forge-header">锻造升级（+{{ detailItem.upgradeLevel || 0 }}/10）</div>
          <div class="forge-cost">
            下次升级：{{ getUpgradeCost() }} 金币 + {{ detailItem.upgradeLevel ? (detailItem.upgradeLevel + 1) : 1 }} 个
            {{ getUpgradeMaterial() }}
          </div>
          <button class="btn btn-primary btn-sm forge-btn"
            :class="{ 'btn-disabled': !canUpgrade() }"
            @click="handleUpgrade">强化 +{{ (detailItem.upgradeLevel || 0) + 1 }}</button>
        </div>
        <!-- 合成：加入合成槽 -->
        <div class="forge-section">
          <div class="forge-header">合成（3 件同品质 → 1 件更高品质）</div>
          <button class="btn btn-sm"
            :class="{ 'btn-primary': !inMergeSlots(detailItem.uid), 'btn-disabled': inMergeSlots(detailItem.uid) || (detailItem.upgradeLevel || 0) > 0 }"
            @click="toggleMergeSlot(detailItem.uid)">
            {{ inMergeSlots(detailItem.uid) ? '已加入合成槽' : '加入合成槽' }}
          </button>
          <button class="btn btn-sm btn-primary" style="margin-left: 0.3rem;"
            :class="{ 'btn-disabled': mergeSlots.length !== 3 }"
            @click="handleMerge">立即合成（已选 {{ mergeSlots.length }}/3）</button>
          <div v-if="(detailItem.upgradeLevel || 0) > 0" class="forge-tip">⚠ 已强化装备合成后强化等级会丢失</div>
        </div>
        <!-- 重铸 -->
        <div class="forge-section">
          <div class="forge-header">重铸词条</div>
          <div class="forge-cost">消耗 1000 金币，随机生成新的被动词条</div>
          <button class="btn btn-sm" :class="{ 'btn-disabled': player.gold < 1000 }"
            @click="handleReforge">消耗1000金 重铸</button>
        </div>
        <div v-if="availableEnchants.length > 0 && (!detailItem.enchants || detailItem.enchants.length < 3)" class="enchant-section">
          <div class="enchant-header">可用附魔</div>
          <div v-for="recipe in availableEnchants" :key="recipe.id" class="enchant-recipe"
            :class="{ disabled: isEnchantDisabled(recipe) }">
            <div class="recipe-info">
              <span class="recipe-name">{{ recipe.name }}</span>
              <span class="recipe-desc">{{ recipe.desc }}</span>
              <span class="recipe-cost">{{ recipe.cost }}金 + {{ formatMaterials(recipe.materials) }}</span>
            </div>
            <button class="btn btn-sm btn-primary" :class="{ 'btn-disabled': isEnchantDisabled(recipe) }"
              @click="handleEnchant(recipe.id)">附魔</button>
          </div>
        </div>
        <div class="detail-actions">
          <button class="btn btn-primary btn-sm" :class="{ 'btn-disabled': player.level < detailItem.reqLevel }"
            @click="$emit('equip', detailItem.uid); detailItem = null">穿戴</button>
          <button class="btn btn-danger btn-sm" @click="$emit('sellEquip', detailItem.uid); detailItem = null">出售</button>
          <button class="btn btn-sm" @click="detailItem = null">关闭</button>
        </div>
      </div>
    </div>

    <!-- 物品详情弹窗 -->
    <div v-if="itemDetail" class="modal-overlay" @click.self="itemDetail = null">
      <div class="modal-box">
        <div class="modal-title">
          <IconBase :name="getItemIcon(itemDetail)" :size="16" class="btn-icon icon-accent2" />
          {{ itemDetail.name }}
        </div>
        <div class="modal-row"><span class="ml">数量</span><span class="mv">×{{ itemDetail.count }}</span></div>
        <div v-if="materialPrices[itemDetail.name]" class="modal-row">
          <span class="ml">单件售价</span>
          <span class="mv"><IconBase name="gold" :size="13" class="icon-accent" /> {{ materialPrices[itemDetail.name] }}</span>
        </div>
        <div v-if="itemDetail.type === 'consumable'" class="modal-section">
          <div class="modal-section-title">批量使用</div>
          <div class="qty-controls">
            <button class="qty-btn" @click="changeUseQty(itemDetail.name, -1, itemDetail.count)">−</button>
            <span class="qty-val">{{ useQty[itemDetail.name] || 1 }}</span>
            <button class="qty-btn" @click="changeUseQty(itemDetail.name, 1, itemDetail.count)">+</button>
            <button class="btn btn-sm quick-btn" @click="setUseQty(itemDetail.name, 10, itemDetail.count)">×10</button>
            <button class="btn btn-sm quick-btn" v-if="itemDetail.count > 1" @click="setUseQty(itemDetail.name, itemDetail.count, itemDetail.count)">全部</button>
          </div>
          <button class="btn btn-primary btn-sm modal-action-btn"
            @click="$emit('use', itemDetail.itemId, useQty[itemDetail.name] || 1)">使用 {{ useQty[itemDetail.name] || 1 }} 个</button>
        </div>
        <div class="modal-actions">
          <button class="btn btn-danger btn-sm" @click="$emit('sellMaterial', itemDetail.name, 1); itemDetail = null">售1个</button>
          <button v-if="itemDetail.count > 1" class="btn btn-danger btn-sm" @click="$emit('sellMaterial', itemDetail.name, itemDetail.count); itemDetail = null">全售</button>
          <button class="btn btn-sm" @click="itemDetail = null">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import IconBase from './icons/IconBase.vue'
import api from '../api.js'

const props = defineProps(['player', 'qualityColors', 'materialPrices'])
const emit = defineEmits(['use', 'sellMaterial', 'sellEquip', 'equip', 'enchant', 'refresh'])

const detailItem = ref(null)
const itemDetail = ref(null)
const useQty = ref({})
// 合成槽（最多 3 件同品质装备）
const mergeSlots = ref([])

// 锻造相关（与后端常量保持一致）
const UPGRADE_LEVEL_MAX = 10
const UPGRADE_BASE_GOLD = 200
const QUALITY_GOLD_MULT = { normal: 1, fine: 1.5, epic: 2.5, legend: 4 }
const UPGRADE_MATERIAL_BY_QUALITY = {
  normal: '青铜矿', fine: '铁矿', epic: '飞龙鳞片', legend: '龙鳞'
}

function getUpgradeCost() {
  if (!detailItem.value) return 0
  const cur = detailItem.value.upgradeLevel || 0
  const q = detailItem.value.quality
  return Math.floor(UPGRADE_BASE_GOLD * Math.pow(1.5, cur) * (QUALITY_GOLD_MULT[q] || 1))
}
function getUpgradeMaterial() {
  return UPGRADE_MATERIAL_BY_QUALITY[detailItem.value?.quality] || '青铜矿'
}
function canUpgrade() {
  if (!detailItem.value) return false
  const cur = detailItem.value.upgradeLevel || 0
  if (cur >= UPGRADE_LEVEL_MAX) return false
  if ((props.player.gold || 0) < getUpgradeCost()) return false
  const matName = getUpgradeMaterial()
  const matCount = cur + 1
  const inv = (props.player.inventory || []).find(i => i.name === matName)
  return inv && inv.count >= matCount
}
async function handleUpgrade() {
  if (!detailItem.value) return
  if (!confirm(`确认消耗 ${getUpgradeCost()} 金币 + ${(detailItem.value.upgradeLevel||0)+1} 个 ${getUpgradeMaterial()} 强化到 +${(detailItem.value.upgradeLevel||0)+1}？`)) return
  try {
    const res = await api.upgradeEquipment(props.player.username, detailItem.value.uid)
    if (res.success) {
      emit('refresh', res.data)
      detailItem.value = res.data.equips.find(e => e.uid === detailItem.value.uid)
        || Object.values(res.data.equipped || {}).find(e => e && e.uid === detailItem.value.uid)
        || detailItem.value
      alert('强化成功！')
    } else alert(res.message || '强化失败')
  } catch (e) { alert('强化失败：' + e.message) }
}
function inMergeSlots(uid) { return mergeSlots.value.includes(uid) }
function toggleMergeSlot(uid) {
  if (mergeSlots.value.includes(uid)) {
    mergeSlots.value = mergeSlots.value.filter(x => x !== uid)
  } else {
    if (mergeSlots.value.length >= 3) return
    mergeSlots.value = [...mergeSlots.value, uid]
  }
}
async function handleMerge() {
  if (mergeSlots.value.length !== 3) return alert('需选择 3 件装备')
  if (!confirm('3 件装备将消失，合成 1 件更高品质装备（强化等级会丢失）。继续？')) return
  try {
    const res = await api.mergeEquipment(props.player.username, mergeSlots.value)
    if (res.success) {
      emit('refresh', res.data)
      alert(`合成成功！获得「${res.newItem.name}」`)
      mergeSlots.value = []
      detailItem.value = null
    } else alert(res.message || '合成失败')
  } catch (e) { alert('合成失败：' + e.message) }
}
async function handleReforge() {
  if (!detailItem.value) return
  if (!confirm('消耗 1000 金币重洗这件装备的词条。继续？')) return
  try {
    const res = await api.reforgeEquipment(props.player.username, detailItem.value.uid)
    if (res.success) {
      emit('refresh', res.data)
      detailItem.value = res.data.equips.find(e => e.uid === detailItem.value.uid)
        || Object.values(res.data.equipped || {}).find(e => e && e.uid === detailItem.value.uid)
        || detailItem.value
      alert('重铸完成！')
    } else alert(res.message || '重铸失败')
  } catch (e) { alert('重铸失败：' + e.message) }
}

const equipPage = ref(1)
const matPage = ref(1)
const pageSize = 12

const qualityLabels = { normal: '普通', fine: '精良', epic: '史诗', legend: '传说' }
const slotLabels = { weapon: '武器', armor: '护甲', accessory: '饰品' }
const statLabels = { atk: '攻击', def: '防御', hp: 'HP', mp: 'MP', str: '力量', con: '体质', spi: '精神', agi: '敏捷', cha: '魅力', exp: '经验', gold: '金币' }
const equipSlotIcons = { weapon: 'sword', armor: 'shield', accessory: 'gem' }

const equipTotalPages = computed(() => Math.max(1, Math.ceil(props.player.equips.length / pageSize)))
const pagedEquips = computed(() => props.player.equips.slice((equipPage.value - 1) * pageSize, equipPage.value * pageSize))

const matTotalPages = computed(() => Math.max(1, Math.ceil(props.player.inventory.length / pageSize)))
const pagedMats = computed(() => props.player.inventory.slice((matPage.value - 1) * pageSize, matPage.value * pageSize))

watch(() => props.player.equips.length, () => { if (equipPage.value > equipTotalPages.value) equipPage.value = 1 })
watch(() => props.player.inventory.length, () => { if (matPage.value > matTotalPages.value) matPage.value = 1 })

function mainStat(item) {
  if (!item.stats) return ''
  const keys = Object.keys(item.stats)
  if (!keys.length) return ''
  return `${statLabels[keys[0]] || keys[0]}+${item.stats[keys[0]]}`
}

function getItemIcon(item) {
  if (item.type === 'consumable') {
    if (item.itemId && item.itemId.includes('hp')) return 'heart'
    if (item.itemId && item.itemId.includes('mp')) return 'sparkle'
    if (item.itemId && item.itemId.includes('exp')) return 'scroll'
    return 'bag'
  }
  return 'bag'
}

function changeUseQty(name, delta, max) {
  const cur = useQty.value[name] || 1
  const next = Math.max(1, Math.min(max, cur + delta))
  useQty.value = { ...useQty.value, [name]: next }
}
function setUseQty(name, n, max) { useQty.value = { ...useQty.value, [name]: Math.min(n, max) } }

function showEquipDetail(item) { detailItem.value = item }
function showItemDetail(item) { itemDetail.value = item }

const availableEnchants = computed(() => {
  if (!detailItem.value) return []
  const slot = detailItem.value.slot
  const enchants = props.player.enchantsBySlot?.[slot] || []
  const existing = detailItem.value.enchants || []
  return enchants.filter(r => !existing.includes(r.id))
})

function getEnchantName(id) {
  const r = props.player.enchantsBySlot?.weapon?.concat(props.player.enchantsBySlot?.armor || [], props.player.enchantsBySlot?.accessory || []).find(e => e.id === id)
  return r ? r.name : id
}

function getEnchantDesc(id) {
  const all = [...(props.player.enchantsBySlot?.weapon || []), ...(props.player.enchantsBySlot?.armor || []), ...(props.player.enchantsBySlot?.accessory || [])]
  const r = all.find(e => e.id === id)
  return r ? r.desc : ''
}

function formatMaterials(materials) {
  return materials.map(m => {
    const count = getMaterialCount(m.name)
    return `${m.name}×${m.count}(${count})`
  }).join(' ')
}

function getMaterialCount(name) {
  const item = props.player.inventory?.find(i => i.name === name)
  return item ? item.count : 0
}

function isEnchantDisabled(recipe) {
  if (props.player.gold < recipe.cost) return true
  for (const mat of recipe.materials) {
    if (getMaterialCount(mat.name) < mat.count) return true
  }
  return false
}

function handleEnchant(recipeId) {
  emit('enchant', detailItem.value.uid, recipeId)
  detailItem.value = null
}
</script>

<style scoped>
.bag-view { display: flex; flex-direction: column; gap: 0.6rem; max-width: 560px; margin: 0 auto; }

.sub-tabs { display: flex; gap: 0.3rem; }
.sub-tab { flex: 1; padding: 0.5rem; border: 1px solid rgba(157,140,240,0.1); border-radius: 8px; background: rgba(20,22,42,0.4); color: var(--muted); font-size: 0.85rem; cursor: pointer; transition: all var(--duration-normal) var(--ease-out); font-family: inherit; }
.sub-tab.active { background: rgba(212,175,94,0.08); border-color: var(--accent); color: var(--accent); box-shadow: 0 0 12px rgba(212,175,94,0.1); }

.section { padding: 0.6rem 0.8rem; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; font-size: 0.85rem; color: var(--muted); }
.gold-display { color: var(--accent); font-weight: 600; }
.empty-hint { text-align: center; padding: 1.2rem; color: var(--dim); font-style: italic; font-size: 0.82rem; }

/* 网格 */
.item-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem; }
.grid-cell { display: flex; flex-direction: column; align-items: center; gap: 0.1rem; padding: 0.4rem 0.2rem; border: 1px solid var(--rule); border-radius: 8px; cursor: pointer; transition: all 0.15s; background: rgba(24,26,46,0.4); position: relative; text-align: center; }
.grid-cell:hover { border-color: var(--accent2); transform: translateY(-2px); background: rgba(157,140,240,0.06); }
.cell-icon { font-size: 1.3rem; }
.cell-icon.consumable { }
.cell-icon.equip { }
.cell-name { font-size: 0.65rem; font-weight: 600; word-break: break-all; line-height: 1.2; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; }
.cell-stat { font-size: 0.58rem; color: var(--accent2); }
.cell-count { font-size: 0.62rem; color: var(--muted); }
.cell-price { font-size: 0.6rem; color: var(--accent); }
.cell-badge { position: absolute; top: 1px; right: 3px; font-size: 0.55rem; color: var(--accent); font-weight: 600; }
.cell-lock { position: absolute; top: 1px; left: 3px; font-size: 0.6rem; }

/* 分页器 */
.pager { display: flex; justify-content: center; align-items: center; gap: 0.5rem; padding: 0.3rem 0 0.1rem; }
.pager-btn { padding: 0.2rem 0.6rem; border: 1px solid var(--rule); border-radius: 6px; background: rgba(20,22,42,0.5); color: var(--ink); font-size: 0.75rem; cursor: pointer; transition: all 0.2s; }
.pager-btn:hover:not(:disabled) { border-color: var(--accent2); }
.pager-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.pager-info { font-size: 0.72rem; color: var(--muted); font-family: monospace; }

/* 通用弹窗 */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 1rem; }
.modal-box { background: var(--bg2); border: 1px solid var(--rule); border-radius: 12px; padding: 1.2rem; max-width: 320px; width: 100%; max-height: 85vh; overflow-y: auto; }
.modal-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; }
.modal-row { display: flex; justify-content: space-between; align-items: center; padding: 0.2rem 0; font-size: 0.82rem; }
.ml { color: var(--muted); }
.mv { color: var(--accent); font-weight: 600; }
.modal-desc { font-size: 0.78rem; color: var(--dim); margin: 0.3rem 0; padding: 0.3rem 0.5rem; background: rgba(157,140,240,0.05); border-radius: 6px; }
.modal-section { margin-top: 0.4rem; }
.modal-section-title { font-size: 0.78rem; color: var(--accent2); font-weight: 600; margin-bottom: 0.3rem; }
.modal-total { font-size: 0.75rem; color: var(--accent); font-weight: 600; margin: 0.3rem 0; }
.modal-action-btn { width: 100%; margin-top: 0.3rem; }
.modal-actions { display: flex; gap: 0.3rem; margin-top: 0.5rem; }
.modal-actions .btn { flex: 1; }

/* 锻造 / 合成 / 重铸 */
.forge-section { padding: 0.5rem; border: 1px solid var(--rule); border-radius: 6px; margin-top: 0.4rem; background: rgba(212,175,94,0.04); }
.forge-header { font-size: 0.8rem; font-weight: 600; color: var(--accent); margin-bottom: 0.3rem; }
.forge-cost { font-size: 0.72rem; color: var(--muted); margin-bottom: 0.3rem; }
.forge-btn { width: 100%; }
.forge-tip { font-size: 0.68rem; color: #d4af5e; margin-top: 0.3rem; }
.modal-close-btn { width: 100%; margin-top: 0.3rem; }

/* 数量控制 */
.qty-controls { display: flex; align-items: center; gap: 0.15rem; }
.qty-btn { width: 24px; height: 24px; border-radius: 4px; border: 1px solid var(--rule); background: rgba(20,22,42,0.6); color: var(--muted); font-size: 0.85rem; cursor: pointer; line-height: 1; font-family: inherit; transition: all 0.15s; }
.qty-btn:hover { border-color: var(--accent2); color: var(--accent2); }
.qty-val { font-size: 0.78rem; font-weight: 600; color: var(--accent); min-width: 20px; text-align: center; }
.quick-btn { font-size: 0.62rem !important; padding: 0.1rem 0.35rem !important; color: var(--accent2) !important; border-color: rgba(157,140,240,0.2) !important; }

/* 装备详情弹窗 */
.equip-detail-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 1rem; }
.equip-detail-box { background: var(--bg2); border: 1px solid var(--rule); border-radius: 12px; padding: 1.2rem; max-width: 340px; width: 100%; max-height: 85vh; overflow-y: auto; }
.detail-name { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.2rem; }
.detail-quality { font-size: 0.75rem; margin-bottom: 0.6rem; color: var(--muted); }
.detail-stats { display: flex; flex-direction: column; gap: 0.2rem; margin-bottom: 0.6rem; }
.detail-stat { font-size: 0.82rem; color: var(--accent2); background: rgba(157,140,240,0.08); padding: 0.15rem 0.4rem; border-radius: 4px; }

.enchanted-list { margin-bottom: 0.6rem; padding: 0.5rem; background: rgba(212,175,94,0.05); border-radius: 6px; border: 1px solid rgba(212,175,94,0.15); }
.enchant-header { font-size: 0.78rem; color: var(--accent); font-weight: 600; margin-bottom: 0.3rem; }
.enchant-item { display: flex; flex-direction: column; gap: 0.1rem; margin-bottom: 0.3rem; }
.enchant-name { font-size: 0.78rem; color: var(--accent); font-weight: 600; }
.enchant-desc { font-size: 0.7rem; color: var(--muted); }
.enchant-section { margin-bottom: 0.6rem; padding: 0.5rem; background: rgba(157,140,240,0.05); border-radius: 6px; border: 1px solid rgba(157,140,240,0.12); }
.enchant-recipe { display: flex; justify-content: space-between; align-items: center; gap: 0.4rem; padding: 0.35rem 0; border-bottom: 1px solid var(--rule); }
.enchant-recipe:last-child { border-bottom: none; }
.enchant-recipe.disabled { opacity: 0.5; }
.recipe-info { display: flex; flex-direction: column; gap: 0.1rem; flex: 1; }
.recipe-name { font-size: 0.78rem; font-weight: 600; color: var(--accent2); }
.recipe-desc { font-size: 0.7rem; color: var(--muted); }
.recipe-cost { font-size: 0.68rem; color: var(--dim); }
.detail-actions { display: flex; gap: 0.3rem; margin-top: 0.4rem; }
.detail-actions .btn { flex: 1; }
</style>
