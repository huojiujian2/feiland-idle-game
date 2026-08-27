<template>
  <div class="view-container codex-view">
    <!-- 分类切换 -->
    <div class="codex-tabs">
      <div v-for="cat in categories" :key="cat.id" class="codex-tab"
        :class="{ active: activeCat === cat.id }" @click="activeCat = cat.id">
        <IconBase :name="cat.icon" :size="16" class="cat-icon icon-accent2" />
        <span class="cat-label">{{ cat.label }}</span>
      </div>
    </div>

    <!-- 搜索框 -->
    <div class="search-bar">
      <IconBase name="scroll" :size="12" class="search-icon" />
      <input type="text" v-model="searchQuery" class="search-input" :placeholder="searchPlaceholder" />
      <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">×</button>
    </div>

    <!-- 材料图鉴 -->
    <div v-if="activeCat === 'material'" class="codex-grid">
      <div v-for="mat in pagedItems" :key="mat.name" class="codex-item"
        @click="selectItem(mat)">
        <div class="item-icon mat-icon"><IconBase name="bag" :size="28" class="icon-accent2" /></div>
        <div class="item-name">{{ mat.name }}</div>
        <div class="item-price">💰{{ mat.price }}</div>
      </div>
    </div>

    <!-- 装备图鉴 -->
    <div v-if="activeCat === 'equip'" class="codex-grid">
      <div v-for="eq in pagedItems" :key="eq.templateId" class="codex-item"
        @click="selectItem(eq)">
        <div class="item-icon" :class="eq.quality">
          <IconBase :name="equipIcons[eq.slot]" :size="28" />
        </div>
        <div class="item-name" :style="{ color: qualityColors[eq.quality] }">{{ eq.name }}<span v-if="eq.creator || eq.creatorUsername" class="creator-tag" :title="`造物主：${displayCreator(eq)}`">{{ displayCreator(eq) }}造</span></div>
        <div class="item-quality" :style="{ color: qualityColors[eq.quality] }">{{ qualityLabels[eq.quality] }}</div>
      </div>
    </div>

    <!-- 消耗品图鉴 -->
    <div v-if="activeCat === 'consumable'" class="codex-grid">
      <div v-for="con in pagedItems" :key="con.id" class="codex-item"
        @click="selectItem(con)">
        <div class="item-icon con-icon">
          <IconBase :name="getConsumableIconName(con.id)" :size="28" class="icon-accent2" />
        </div>
        <div class="item-name">{{ con.name }}</div>
        <div class="item-price">💰{{ con.price }}</div>
      </div>
    </div>

    <!-- 怪物图鉴 -->
    <div v-if="activeCat === 'monster'" class="codex-grid">
      <div v-for="mo in pagedItems" :key="mo.name + mo.area + (mo.creator || '')" class="codex-item"
        @click="selectItem(mo)">
        <div class="item-icon mon-icon"><IconBase name="skull" :size="28" /></div>
        <div class="item-name">{{ mo.name }}<span v-if="mo.creator || mo.creatorUsername" class="creator-tag" :title="`造物主：${displayCreator(mo)}`">{{ displayCreator(mo) }}造</span></div>
        <div class="item-area">{{ mo.areaName }}</div>
      </div>
    </div>

    <!-- 分页器 -->
    <div v-if="totalPages > 1" class="pager">
      <button class="pager-btn" :disabled="page === 1" @click="page--">‹ 上一页</button>
      <span class="pager-info">{{ page }} / {{ totalPages }}</span>
      <button class="pager-btn" :disabled="page === totalPages" @click="page++">下一页 ›</button>
    </div>
    <div v-else-if="currentList.length > 0" class="pager-info-single">共 {{ currentList.length }} 项</div>

    <!-- 详情弹窗 -->
    <div v-if="selected" class="detail-overlay" @click.self="selected = null">
      <div class="detail-box">
        <!-- 材料详情 -->
        <template v-if="activeCat === 'material'">
          <div class="detail-title">📦 {{ selected.name }}</div>
          <div class="detail-row"><span class="dl">售价</span><span class="dv">💰{{ selected.price }}</span></div>
          <div class="detail-section-title">获取来源</div>
          <div v-if="selected.sources.length" class="source-list">
            <div v-for="src in selected.sources" :key="src.area" class="source-item">
              <span class="src-area">📍 {{ src.areaName }}</span>
              <span class="src-rate">掉率 {{ (src.rate * 100).toFixed(1) }}%</span>
            </div>
          </div>
          <div v-else class="no-source">商店购买或任务获取</div>
          <div v-if="selected.uses.length" class="detail-section-title">用途</div>
          <div v-if="selected.uses.length" class="use-list">
            <div v-for="use in selected.uses" :key="use" class="use-item">{{ use }}</div>
          </div>
        </template>

        <!-- 装备详情 -->
        <template v-if="activeCat === 'equip'">
          <div class="detail-title" :style="{ color: qualityColors[selected.quality] }">{{ equipIcons[selected.slot] }} {{ selected.name }}<span v-if="selected.creator || selected.creatorUsername" class="creator-tag" :title="`造物主：${displayCreator(selected)}`">{{ displayCreator(selected) }}造</span></div>
          <div class="detail-row" v-if="selected.customDesc"><span class="dl">神谕</span><span class="dv">{{ selected.customDesc }}</span></div>
          <div class="detail-row"><span class="dl">品质</span><span class="dv" :style="{ color: qualityColors[selected.quality] }">{{ qualityLabels[selected.quality] }}</span></div>
          <div class="detail-row"><span class="dl">类型</span><span class="dv">{{ slotLabels[selected.slot] }}</span></div>
          <div class="detail-row"><span class="dl">需求等级</span><span class="dv">Lv.{{ selected.reqLevel }}</span></div>
          <div class="detail-section-title">属性</div>
          <div class="stat-list">
            <div v-for="(val, key) in selected.stats" :key="key" class="stat-item">
              {{ statLabels[key] || key }} +{{ val }}{{ ['exp','gold'].includes(key) ? '%' : '' }}
            </div>
          </div>
          <div class="detail-section-title">获取来源</div>
          <div v-if="selected.sources.length" class="source-list">
            <div v-for="src in selected.sources" :key="src.area" class="source-item">
              <span class="src-area">📍 {{ src.areaName }}</span>
              <span class="src-rate">掉率 {{ (src.rate * 100).toFixed(1) }}%</span>
            </div>
          </div>
          <div v-if="selected.shopPrice" class="detail-row"><span class="dl">商店价格</span><span class="dv">💰{{ selected.shopPrice }}</span></div>
        </template>

        <!-- 消耗品详情 -->
        <template v-if="activeCat === 'consumable'">
          <div class="detail-title">{{ getConsumableIcon(selected.id) }} {{ selected.name }}</div>
          <div class="detail-row"><span class="dl">价格</span><span class="dv">💰{{ selected.price }}</span></div>
          <div class="detail-row"><span class="dl">效果</span><span class="dv">{{ selected.desc }}</span></div>
          <div class="detail-section-title">获取来源</div>
          <div class="source-list">
            <div class="source-item"><span class="src-area">🏪 商店购买</span></div>
          </div>
        </template>

        <!-- 怪物详情 -->
        <template v-if="activeCat === 'monster'">
          <div class="detail-title">👹 {{ selected.name }}<span v-if="selected.creator || selected.creatorUsername" class="creator-tag" :title="`造物主：${displayCreator(selected)}`">{{ displayCreator(selected) }}造</span></div>
          <div class="detail-row" v-if="selected.customDesc"><span class="dl">神谕</span><span class="dv">{{ selected.customDesc }}</span></div>
          <div class="detail-row"><span class="dl">出没地点</span><span class="dv">{{ selected.areaName }} (Lv.{{ selected.areaLevel }}+)</span></div>
          <div class="detail-section-title">属性</div>
          <div class="monster-stats-grid">
            <div class="ms-item"><span class="ms-label">HP</span><span class="ms-val">{{ selected.hp }}</span></div>
            <div class="ms-item"><span class="ms-label">攻击</span><span class="ms-val">{{ selected.atk }}</span></div>
            <div class="ms-item"><span class="ms-label">防御</span><span class="ms-val">{{ selected.def }}</span></div>
            <div class="ms-item"><span class="ms-label">敏捷</span><span class="ms-val">{{ selected.agi }}</span></div>
            <div class="ms-item"><span class="ms-label">经验</span><span class="ms-val">{{ selected.exp }}</span></div>
            <div class="ms-item"><span class="ms-label">金币</span><span class="ms-val">{{ selected.gold }}</span></div>
          </div>
          <div v-if="selected.skills && selected.skills.length" class="detail-section-title">技能</div>
          <div v-if="selected.skills && selected.skills.length" class="monster-skills">
            <div v-for="sk in selected.skillDetails" :key="sk.id" class="mskill-item">
              <span class="mskill-name">{{ sk.name }}</span>
              <span class="mskill-desc">{{ sk.desc }}</span>
              <span class="mskill-mult">×{{ sk.mult }}</span>
            </div>
          </div>
        </template>

        <button class="btn detail-close-btn" @click="selected = null">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, inject } from 'vue'
import IconBase from './icons/IconBase.vue'
import api from '../api.js'

const props = defineProps({ player: Object })

// v2.2：从 App 注入全服玩家名册
const playerNameMap = inject('playerNameMap', ref({}))
const refreshPlayerNameMap = inject('refreshPlayerNameMap', () => {})

// v2.2：把账号解析成"游戏内的真名"展示（自己造的优先显示真名；别人的查全服名册）
function displayCreator(item) {
  const owner = item?.creatorUsername || item?.creator
  if (!owner) return ''
  if (owner === props.player?.username) {
    return props.player?.name || owner
  }
  const fromMap = playerNameMap.value && playerNameMap.value[owner]
  return (fromMap && fromMap.name) || owner
}

const activeCat = ref('material')
const selected = ref(null)
const page = ref(1)
const pageSize = 16
const searchQuery = ref('')
const codexData = ref({ materials: [], equips: [], consumables: [], monsters: [] })

const searchPlaceholder = computed(() => {
  const map = { material: '搜索材料名称...', equip: '搜索装备名称、品质、部位...', consumable: '搜索消耗品名称...', monster: '搜索怪物名称、地点...' }
  return map[activeCat.value] || '搜索...'
})

const currentList = computed(() => {
  let list = []
  if (activeCat.value === 'material') list = codexData.value.materials
  else if (activeCat.value === 'equip') list = codexData.value.equips
  else if (activeCat.value === 'consumable') list = codexData.value.consumables
  else if (activeCat.value === 'monster') list = codexData.value.monsters

  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return list

  return list.filter(item => {
    // 名称搜索（所有类别通用）
    if (item.name?.toLowerCase().includes(q)) return true
    // 装备：搜索品质、部位、属性
    if (activeCat.value === 'equip') {
      if (qualityLabels[item.quality]?.toLowerCase().includes(q)) return true
      if (slotLabels[item.slot]?.toLowerCase().includes(q)) return true
      if (item.stats) {
        for (const key of Object.keys(item.stats)) {
          if ((statLabels[key] || key).toLowerCase().includes(q)) return true
        }
      }
    }
    // 怪物：搜索地点
    if (activeCat.value === 'monster') {
      if (item.areaName?.toLowerCase().includes(q)) return true
    }
    return false
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(currentList.value.length / pageSize)))
const pagedItems = computed(() => currentList.value.slice((page.value - 1) * pageSize, page.value * pageSize))

watch(activeCat, () => { page.value = 1; searchQuery.value = '' })
watch(searchQuery, () => { page.value = 1 })

const qualityColors = { normal: '#9d9bb8', fine: '#5eda7a', epic: '#9d8cf0', legend: '#d4af5e', mythic: '#ff6738' }
const qualityLabels = { normal: '普通', fine: '精良', epic: '史诗', legend: '传说', mythic: '神话' }
const slotLabels = { weapon: '武器', armor: '护甲', accessory: '饰品' }
const statLabels = { atk: '攻击', def: '防御', hp: 'HP', mp: 'MP', str: '力量', con: '体质', spi: '精神', agi: '敏捷', cha: '魅力', exp: '经验', gold: '金币' }
const equipIcons = { weapon: 'sword', armor: 'shield', accessory: 'gem' }

const categories = [
  { id: 'material', label: '材料', icon: 'bag' },
  { id: 'equip', label: '装备', icon: 'sword' },
  { id: 'consumable', label: '消耗品', icon: 'heart' },
  { id: 'monster', label: '怪物', icon: 'skull' }
]

function getConsumableIcon(id) {
  if (id.includes('hp')) return '🧪'
  if (id.includes('mp')) return '🔵'
  if (id.includes('exp')) return '📜'
  return '📦'
}
function getConsumableIconName(id) {
  if (id.includes('hp')) return 'heart'
  if (id.includes('mp')) return 'sparkle'
  if (id.includes('exp')) return 'scroll'
  return 'bag'
}

function selectItem(item) {
  selected.value = item
}

onMounted(async () => {
  const res = await api.getCodex()
  if (res.success) {
    codexData.value = res.data
  }
  // v2.2：保险起见，进入图鉴页时也拉一次名册（如果用户先开图鉴后登录）
  if (Object.keys(playerNameMap.value || {}).length === 0) refreshPlayerNameMap()
})
</script>

<style scoped>
.codex-view { display: flex; flex-direction: column; gap: 0.5rem; max-width: 560px; margin: 0 auto; }

/* 分类tab */
.codex-tabs { display: flex; gap: 0.3rem; }
.codex-tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.1rem; padding: 0.4rem; border: 1px solid var(--rule); border-radius: 8px; cursor: pointer; transition: all 0.2s; background: rgba(20,22,42,0.5); }
.codex-tab:hover { border-color: var(--accent2); }
.codex-tab.active { border-color: var(--accent); background: rgba(212,175,94,0.1); }
.cat-icon { font-size: 1.1rem; }
.cat-label { font-size: 0.68rem; color: var(--muted); }
.codex-tab.active .cat-label { color: var(--accent); font-weight: 600; }

/* 搜索框 */
.search-bar { position: relative; display: flex; align-items: center; margin-bottom: 0.3rem; }
.search-icon { position: absolute; left: 0.6rem; color: var(--dim); z-index: 1; }
.search-input {
  width: 100%; padding: 0.45rem 2rem 0.45rem 1.8rem;
  background: rgba(20, 22, 42, 0.6);
  border: 1px solid var(--rule);
  border-radius: 6px;
  color: var(--text);
  font-size: 0.8rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}
.search-input:focus { border-color: var(--accent2); }
.search-input::placeholder { color: var(--dim); }
.search-clear {
  position: absolute; right: 0.4rem;
  background: none; border: none;
  color: var(--dim); font-size: 1rem;
  cursor: pointer; padding: 0.2rem 0.4rem;
}
.search-clear:hover { color: var(--text); }

/* 网格 */
.codex-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 0.4rem; }
.codex-item { display: flex; flex-direction: column; align-items: center; gap: 0.1rem; padding: 0.5rem 0.3rem; border: 1px solid var(--rule); border-radius: 8px; cursor: pointer; transition: all 0.2s; background: rgba(24,26,46,0.4); text-align: center; }
.codex-item:hover { border-color: var(--accent2); transform: translateY(-2px); }
.item-icon { font-size: 1.5rem; display: flex; align-items: center; justify-content: center; }
.item-icon.normal { filter: brightness(0.9); }
.item-icon.fine { filter: hue-rotate(60deg); }
.item-icon.epic { filter: hue-rotate(220deg); }
.item-icon.legend { filter: hue-rotate(30deg) saturate(1.5); }
.item-name { font-size: 0.72rem; font-weight: 600; word-break: break-all; line-height: 1.2; }
.creator-tag {
  display: inline-block; margin-left: 4px; padding: 0 4px;
  font-size: 0.55rem; font-weight: 400;
  background: linear-gradient(135deg, #5e3a7a, #2c1a3e);
  border: 1px solid #d4af5e; border-radius: 3px;
  color: #d4af5e; vertical-align: middle; letter-spacing: 0;
}
.detail-title .creator-tag { font-size: 0.7rem; padding: 1px 6px; }
.item-price { font-size: 0.65rem; color: var(--accent); }
.item-quality { font-size: 0.6rem; }
.item-area { font-size: 0.6rem; color: var(--dim); }

/* 详情弹窗 */
.detail-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 1100; padding: 1rem; }
.detail-box { background: var(--bg2); border: 1px solid var(--rule); border-radius: 12px; padding: 1.2rem; max-width: 340px; width: 100%; max-height: 85vh; overflow-y: auto; }
.detail-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; }
.detail-row { display: flex; justify-content: space-between; align-items: center; padding: 0.2rem 0; font-size: 0.82rem; }
.dl { color: var(--muted); }
.dv { color: var(--accent); font-weight: 600; }
.detail-section-title { font-size: 0.78rem; color: var(--accent2); font-weight: 600; margin: 0.6rem 0 0.3rem; }
.source-list { display: flex; flex-direction: column; gap: 0.2rem; }
.source-item { display: flex; justify-content: space-between; align-items: center; padding: 0.3rem 0.5rem; background: rgba(157,140,240,0.06); border-radius: 6px; font-size: 0.75rem; }
.src-area { color: var(--accent2); }
.src-rate { color: var(--accent); font-weight: 600; }
.no-source { font-size: 0.75rem; color: var(--dim); }
.use-list { display: flex; flex-direction: column; gap: 0.2rem; }
.use-item { font-size: 0.75rem; color: var(--muted); padding: 0.2rem 0.5rem; background: rgba(94,218,122,0.06); border-radius: 4px; }
.stat-list { display: flex; flex-direction: column; gap: 0.2rem; }
.stat-item { font-size: 0.8rem; color: var(--accent2); background: rgba(157,140,240,0.08); padding: 0.2rem 0.5rem; border-radius: 4px; }
.monster-stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.3rem; }
.ms-item { display: flex; flex-direction: column; align-items: center; padding: 0.3rem; background: rgba(20,22,42,0.5); border-radius: 6px; }
.ms-label { font-size: 0.62rem; color: var(--dim); }
.ms-val { font-size: 0.85rem; font-weight: 700; color: var(--accent); }
.monster-skills { display: flex; flex-direction: column; gap: 0.2rem; }
.mskill-item { display: flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.5rem; background: rgba(224,88,88,0.06); border-radius: 4px; }
.mskill-name { font-size: 0.75rem; font-weight: 600; color: var(--danger); }
.mskill-desc { font-size: 0.68rem; color: var(--muted); flex: 1; }
.mskill-mult { font-size: 0.72rem; color: var(--accent); font-weight: 600; }
.detail-close-btn { width: 100%; margin-top: 0.8rem; }

/* 分页器 */
.pager { display: flex; justify-content: center; align-items: center; gap: 0.6rem; padding: 0.4rem 0; }
.pager-btn { padding: 0.3rem 0.8rem; border: 1px solid var(--rule); border-radius: 6px; background: rgba(20,22,42,0.5); color: var(--ink); font-size: 0.75rem; cursor: pointer; transition: all 0.2s; }
.pager-btn:hover:not(:disabled) { border-color: var(--accent2); background: rgba(157,140,240,0.08); }
.pager-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.pager-info { font-size: 0.75rem; color: var(--muted); font-family: monospace; }
.pager-info-single { text-align: center; font-size: 0.7rem; color: var(--dim); padding: 0.3rem; }
</style>
