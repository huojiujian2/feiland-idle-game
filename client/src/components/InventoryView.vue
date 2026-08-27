<template>
  <div class="view-container bag-view">
      <!-- 装备网格 -->
      <div class="card section">
        <div class="section-header">
          <span><IconBase name="sword" :size="14" class="section-icon" />装备 ({{ filteredEquips.length }})</span>
          <div class="section-actions">
            <button class="btn btn-sm bulk-merge-btn" :disabled="mergeableGroups.length === 0" @click="openBulkMerge">
              <IconBase name="sparkle" :size="12" /> 一键合成
              <span v-if="mergeableGroups.length > 0" class="bulk-merge-badge">{{ mergeableGroups.length }}</span>
            </button>
            <button class="btn btn-sm bulk-sell-btn" @click="openBulkSell">批量出售</button>
          </div>
        </div>
        <div class="search-bar">
          <IconBase name="scroll" :size="12" class="search-icon" />
          <input type="text" v-model="equipSearch" class="search-input" placeholder="搜索装备名称、品质、部位..." />
          <button v-if="equipSearch" class="search-clear" @click="equipSearch = ''">×</button>
        </div>
        <div v-if="filteredEquips.length === 0" class="empty-hint">空空如也...去打怪掉装备吧！</div>
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
          <span><IconBase name="bag" :size="14" class="section-icon" />物品 ({{ filteredMats.length }})</span>
        </div>
        <div class="search-bar">
          <IconBase name="scroll" :size="12" class="search-icon" />
          <input type="text" v-model="matSearch" class="search-input" placeholder="搜索物品名称..." />
          <button v-if="matSearch" class="search-clear" @click="matSearch = ''">×</button>
        </div>
        <div v-if="filteredMats.length === 0" class="empty-hint">暂无物品</div>
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
        <!-- v2.4 移出"加入合成槽"按钮——合成入口已搬到顶部"批量出售"旁边的"一键合成" -->
        <!-- 重置附魔（v2.4：改名 + 改后端语义，原"重铸词条"改成"清空 enchants 再随机洗一组"） -->
        <div class="forge-section">
          <div class="forge-header">重置附魔</div>
          <div class="forge-cost">消耗 1000 金币，重新附魔</div>
          <button class="btn btn-sm" :class="{ 'btn-disabled': player.gold < 1000 }"
            @click="handleReforge">消耗1000金 重置附魔</button>
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

    <!-- 按等级批量出售装备弹窗 -->
    <div v-if="bulkSellVisible" class="modal-overlay" @click.self="bulkSellVisible = false">
      <div class="modal-box">
        <div class="modal-title">
          <IconBase name="sword" :size="16" class="btn-icon icon-accent2" />按等级批量出售
        </div>
        <div class="bulk-hint">选择装备的"需要等级"上限，符合的装备会全部卖出（不会卖已穿戴的）。</div>
        <div class="bulk-options">
          <button class="bulk-opt" :class="{ active: bulkSellMaxLevel === 30 }" @click="bulkSellMaxLevel = 30">≤ Lv.30</button>
          <button class="bulk-opt" :class="{ active: bulkSellMaxLevel === 50 }" @click="bulkSellMaxLevel = 50">≤ Lv.50</button>
          <button class="bulk-opt" :class="{ active: bulkSellMaxLevel === 100 }" @click="bulkSellMaxLevel = 100">≤ Lv.100</button>
          <button class="bulk-opt" :class="{ active: bulkSellMaxLevel === 150 }" @click="bulkSellMaxLevel = 150">≤ Lv.150</button>
          <button class="bulk-opt" :class="{ active: bulkSellMaxLevel === null }" @click="bulkSellMaxLevel = null">全部</button>
        </div>
        <div class="modal-row"><span class="ml">将卖出</span><span class="mv">{{ bulkSellPreview.count }} 件</span></div>
        <div class="modal-row"><span class="ml">预计获得</span><span class="mv"><IconBase name="gold" :size="13" class="icon-accent" /> {{ bulkSellPreview.gold }}</span></div>
        <div v-if="bulkSellPreview.byQuality.length > 0" class="bulk-quality-list">
          <span v-for="q in bulkSellPreview.byQuality" :key="q.name" class="bulk-quality-item" :style="{ color: qualityColors[q.name] }">
            {{ qualityLabels[q.name] }} ×{{ q.count }}
          </span>
        </div>
        <div class="modal-actions">
          <button class="btn btn-danger btn-sm"
            :class="{ 'btn-disabled': bulkSellPreview.count === 0 }"
            @click="confirmBulkSell">确认出售</button>
          <button class="btn btn-sm" @click="bulkSellVisible = false">取消</button>
        </div>
      </div>
    </div>

    <!-- v2.4 一键合成弹窗：列出所有可合成组，让玩家确认 -->
    <div v-if="bulkMergeVisible" class="modal-overlay" @click.self="bulkMergeVisible = false">
      <div class="modal-box">
        <div class="modal-title">
          <IconBase name="sparkle" :size="16" class="btn-icon icon-accent2" />一键合成
        </div>
        <div class="bulk-hint">
          按 <strong>同品质 + 同槽位</strong> 自动分组，每 3 件可合 1 件更高品质。<br>
          <span style="color:#d4af5e;">⚠</span> 已穿戴 / 有附魔 的装备会被跳过；强化等级不保留。
        </div>
        <div v-if="mergeableGroups.length === 0" class="empty-hint">暂无可合成的组合（背包中没有同品质×3 的未装备无附魔装备）</div>
        <div v-else class="bulk-merge-list">
          <div v-for="(g, i) in mergeableGroups" :key="i" class="bulk-merge-row" :class="{ active: bulkMergeSelected.has(i) }" @click="toggleBulkMergeRow(i)">
            <span class="bulk-merge-check">{{ bulkMergeSelected.has(i) ? '✓' : '☐' }}</span>
            <span class="bulk-merge-quality" :style="{ color: qualityColors[g.quality] }">{{ qualityLabels[g.quality] }}</span>
            <span class="bulk-merge-slot">{{ slotLabels[g.slot] }}</span>
            <span class="bulk-merge-arrow">→</span>
            <span class="bulk-merge-next" :style="{ color: qualityColors[g.nextQuality] }">{{ qualityLabels[g.nextQuality] }}</span>
            <span class="bulk-merge-count">×{{ g.items.length }} 件</span>
          </div>
        </div>
        <div class="modal-row"><span class="ml">将合成</span><span class="mv">{{ bulkMergeSelectedCount }} 次</span></div>
        <div class="modal-row"><span class="ml">消耗装备</span><span class="mv">{{ bulkMergeSelectedCount * 3 }} 件</span></div>
        <div class="modal-actions">
          <button class="btn btn-primary btn-sm"
            :class="{ 'btn-disabled': bulkMergeSelectedCount === 0 }"
            @click="confirmBulkMerge">确认合成 {{ bulkMergeSelectedCount }} 次</button>
          <button class="btn btn-sm" @click="bulkMergeVisible = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import IconBase from './icons/IconBase.vue'
import api from '../api.js'
import { toast, modalConfirm } from '../ui-bridge.js'

const props = defineProps(['player', 'qualityColors', 'materialPrices'])
const emit = defineEmits(['use', 'sellMaterial', 'sellEquip', 'sellEquipsByLevel', 'equip', 'enchant', 'refresh'])

const detailItem = ref(null)
const itemDetail = ref(null)
const useQty = ref({})
// 搜索关键词
const equipSearch = ref('')
const matSearch = ref('')
// 按等级批量出售弹窗
const bulkSellVisible = ref(false)
const bulkSellMaxLevel = ref(30)

// 锻造相关（与后端常量保持一致）
const UPGRADE_LEVEL_MAX = 10
const UPGRADE_BASE_GOLD = 200
const QUALITY_GOLD_MULT = { normal: 1, fine: 1.5, epic: 2.5, legend: 4, mythic: 7 }
const UPGRADE_MATERIAL_BY_QUALITY = {
  normal: '青铜矿', fine: '铁矿', epic: '飞龙鳞片', legend: '龙鳞', mythic: '深渊之石'
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
  if (!await modalConfirm(`确认消耗 ${getUpgradeCost()} 金币 + ${(detailItem.value.upgradeLevel||0)+1} 个 ${getUpgradeMaterial()} 强化到 +${(detailItem.value.upgradeLevel||0)+1}？`)) return
  try {
    const res = await api.upgradeEquipment(props.player.username, detailItem.value.uid)
    if (res.success) {
      emit('refresh', res.data)
      detailItem.value = res.data.equips.find(e => e.uid === detailItem.value.uid)
        || Object.values(res.data.equipped || {}).find(e => e && e.uid === detailItem.value.uid)
        || detailItem.value
      toast.success('强化成功！')
    } else toast.error(res.message || '强化失败')
  } catch (e) { toast.error('强化失败：' + e.message) }
}
function inMergeSlots(uid) { return false /* v2.4：合成 UI 已迁移到顶部"一键合成"弹窗 */ }
// v2.4：旧的"逐件选 + 立即合成"流程已废弃，全部走"一键合成"弹窗
//   保留 inMergeSlots 是为了兼容可能引用它的模板（如未来回滚），返回 false 表示无可用合成槽
async function handleReforge() {
  if (!detailItem.value) return
  if (!await modalConfirm('消耗 1000 金币清空这件装备的所有附魔（清空后需自己重新附魔，最多 3 槽）。继续？')) return
  try {
    const res = await api.reforgeEquipment(props.player.username, detailItem.value.uid)
    if (res.success) {
      emit('refresh', res.data)
      detailItem.value = res.data.equips.find(e => e.uid === detailItem.value.uid)
        || Object.values(res.data.equipped || {}).find(e => e && e.uid === detailItem.value.uid)
        || detailItem.value
      toast.success('附魔已清空，请重新附魔')
    } else toast.error(res.message || '重置失败')
  } catch (e) { toast.error('重置失败：' + e.message) }
}

// ========== v2.4 一键合成 ==========
// 品质 → 下一阶品质（与后端 QUALITY_NEXT 对齐）
const QUALITY_NEXT_FRONT = { normal: 'fine', fine: 'epic', epic: 'legend', legend: 'mythic', mythic: null };
// 已被穿戴的 uid 集合（用于过滤）
const equippedUidSet = computed(() => {
  const s = new Set();
  for (const slot of ['weapon', 'armor', 'accessory']) {
    const e = props.player?.equipped?.[slot];
    if (e && e.uid) s.add(e.uid);
  }
  return s;
});
// 把背包装备按 [quality, slot] 分桶，每桶满 3 个就能合成 1 次
const mergeableGroups = computed(() => {
  const buckets = new Map(); // key: `${quality}|${slot}` -> [item1, item2, ...]
  for (const item of (props.player?.equips || [])) {
    if (!item || !item.quality || !item.slot) continue;
    if (equippedUidSet.value.has(item.uid)) continue;          // 已穿戴跳过
    if (item.enchants && item.enchants.length > 0) continue;    // 有附魔跳过
    if (!QUALITY_NEXT_FRONT[item.quality]) continue;            // 已最高品质跳过
    const key = `${item.quality}|${item.slot}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }
  const out = [];
  for (const [key, items] of buckets) {
    if (items.length < 3) continue;
    const [quality, slot] = key.split('|');
    const nextQuality = QUALITY_NEXT_FRONT[quality];
    // 3 件一组：每 3 件 1 次合成，剩余 < 3 件的忽略
    const groups = Math.floor(items.length / 3);
    // 取前面 groups*3 件作为本次合成目标（按背包顺序）
    const useItems = items.slice(0, groups * 3);
    out.push({ quality, slot, nextQuality, items: useItems, count: groups });
  }
  // 按"下一阶品质从低到高"排序，优先展示低阶（让玩家先看到"普通→精良"再"精良→史诗"）
  out.sort((a, b) => {
    const order = ['fine', 'epic', 'legend', 'mythic'];
    return order.indexOf(a.nextQuality) - order.indexOf(b.nextQuality);
  });
  return out;
});
const bulkMergeVisible = ref(false);
const bulkMergeSelected = ref(new Set());
const bulkMergeSelectedCount = computed(() => {
  let sum = 0;
  for (const idx of bulkMergeSelected.value) {
    sum += mergeableGroups.value[idx]?.count || 0;
  }
  return sum;
});
function openBulkMerge() {
  bulkMergeSelected.value = new Set(mergeableGroups.value.map((_, i) => i)); // 默认全选
  bulkMergeVisible.value = true;
}
function toggleBulkMergeRow(i) {
  const s = new Set(bulkMergeSelected.value);
  if (s.has(i)) s.delete(i); else s.add(i);
  bulkMergeSelected.value = s;
}
async function confirmBulkMerge() {
  if (bulkMergeSelectedCount.value === 0) return;
  const groups = [...bulkMergeSelected.value].map(i => mergeableGroups.value[i]);
  const totalMerges = bulkMergeSelectedCount.value;
  if (!await modalConfirm(`确认执行 ${totalMerges} 次合成？共消耗 ${totalMerges * 3} 件装备，得到 ${totalMerges} 件更高品质装备。\n（强化等级不保留，已穿戴/有附魔的装备已自动跳过）`)) return;
  let lastPlayer = null;
  let successCount = 0;
  let failCount = 0;
  const failed = [];
  for (const g of groups) {
    for (let k = 0; k < g.count; k++) {
      const slice = g.items.slice(k * 3, k * 3 + 3);
      if (slice.length < 3) break;
      try {
        const res = await api.mergeEquipment(props.player.username, slice.map(i => i.uid));
        if (res.success) {
          successCount++;
          lastPlayer = res.data;
        } else {
          failCount++;
          failed.push(res.message || '合成失败');
        }
      } catch (e) {
        failCount++;
        failed.push(e.message || '网络错误');
      }
    }
  }
  if (lastPlayer) emit('refresh', lastPlayer);
  if (successCount > 0) toast.success(`合成完成：${successCount} 次成功${failCount > 0 ? `，${failCount} 次失败` : ''}`);
  else toast.error(failed[0] || '合成失败');
  bulkMergeVisible.value = false;
}

const equipPage = ref(1)
const matPage = ref(1)
const pageSize = 12

const qualityLabels = { normal: '普通', fine: '精良', epic: '史诗', legend: '传说', mythic: '神话' }
const slotLabels = { weapon: '武器', armor: '护甲', accessory: '饰品' }
const statLabels = { atk: '攻击', def: '防御', hp: 'HP', mp: 'MP', str: '力量', con: '体质', spi: '精神', agi: '敏捷', cha: '魅力', exp: '经验', gold: '金币' }
const equipSlotIcons = { weapon: 'sword', armor: 'shield', accessory: 'gem' }

// 搜索过滤
const filteredEquips = computed(() => {
  const q = equipSearch.value.trim().toLowerCase()
  if (!q) return props.player.equips
  return props.player.equips.filter(item => {
    if (item.name?.toLowerCase().includes(q)) return true
    if (qualityLabels[item.quality]?.toLowerCase().includes(q)) return true
    if (slotLabels[item.slot]?.toLowerCase().includes(q)) return true
    if (item.quality?.toLowerCase().includes(q)) return true
    if (item.slot?.toLowerCase().includes(q)) return true
    // 搜索属性名
    if (item.stats) {
      for (const key of Object.keys(item.stats)) {
        if ((statLabels[key] || key).toLowerCase().includes(q)) return true
      }
    }
    return false
  })
})

const filteredMats = computed(() => {
  const q = matSearch.value.trim().toLowerCase()
  if (!q) return props.player.inventory
  return props.player.inventory.filter(item =>
    item.name?.toLowerCase().includes(q)
  )
})

const equipTotalPages = computed(() => Math.max(1, Math.ceil(filteredEquips.value.length / pageSize)))
const pagedEquips = computed(() => filteredEquips.value.slice((equipPage.value - 1) * pageSize, equipPage.value * pageSize))

const matTotalPages = computed(() => Math.max(1, Math.ceil(filteredMats.value.length / pageSize)))
const pagedMats = computed(() => filteredMats.value.slice((matPage.value - 1) * pageSize, matPage.value * pageSize))

watch(() => filteredEquips.value.length, () => { if (equipPage.value > equipTotalPages.value) equipPage.value = 1 })
watch(() => filteredMats.value.length, () => { if (matPage.value > matTotalPages.value) matPage.value = 1 })
// 搜索时重置页码
watch(equipSearch, () => { equipPage.value = 1 })
watch(matSearch, () => { matPage.value = 1 })

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

// 装备品质售价（与后端 EQUIP_SELL_PRICES 保持一致）
const EQUIP_SELL_PRICES_LOCAL = { normal: 20, fine: 80, epic: 300, legend: 1500, mythic: 5000 }

function openBulkSell() { bulkSellVisible.value = true }

const bulkSellPreview = computed(() => {
  const all = props.player.equips || []
  const matched = all.filter(it => bulkSellMaxLevel.value == null || (it.reqLevel || 0) <= bulkSellMaxLevel.value)
  const byQualityMap = {}
  let gold = 0
  for (const it of matched) {
    gold += EQUIP_SELL_PRICES_LOCAL[it.quality] || 20
    byQualityMap[it.quality] = (byQualityMap[it.quality] || 0) + 1
  }
  const order = ['mythic', 'legend', 'epic', 'fine', 'normal']
  const byQuality = order
    .filter(q => byQualityMap[q])
    .map(q => ({ name: q, count: byQualityMap[q] }))
  return { count: matched.length, gold, byQuality }
})

async function confirmBulkSell() {
  if (bulkSellPreview.value.count === 0) return
  const label = bulkSellMaxLevel.value == null ? '全部' : `≤ Lv.${bulkSellMaxLevel.value}`
  if (!await modalConfirm(`确认卖出 ${bulkSellPreview.value.count} 件装备（${label}），预计获得 ${bulkSellPreview.value.gold} 金币？此操作不可撤销。`)) return
  emit('sellEquipsByLevel', bulkSellMaxLevel.value)
  bulkSellVisible.value = false
}

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

/* 搜索框 */
.search-bar { position: relative; margin-bottom: 0.5rem; display: flex; align-items: center; }
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
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1100; padding: 1rem; }
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
.equip-detail-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1100; padding: 1rem; }
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

/* 批量出售 */
.bulk-sell-btn { padding: 0.2rem 0.6rem; font-size: 0.7rem; color: var(--accent2); border-color: rgba(157,140,240,0.2); }
.section-actions { display: flex; gap: 0.3rem; align-items: center; }
.bulk-merge-btn { padding: 0.2rem 0.55rem; font-size: 0.7rem; color: #d4af5e; border-color: rgba(212,175,94,0.3); display: inline-flex; align-items: center; gap: 0.25rem; }
.bulk-merge-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.bulk-merge-badge { background: rgba(212,175,94,0.25); color: #d4af5e; padding: 0 5px; border-radius: 8px; font-size: 0.62rem; font-weight: 700; }
.bulk-merge-list { display: flex; flex-direction: column; gap: 0.3rem; margin: 0.4rem 0; max-height: 50vh; overflow-y: auto; }
.bulk-merge-row {
  display: grid;
  grid-template-columns: 1.2rem auto 1fr auto 1fr auto;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.6rem;
  background: rgba(20,22,42,0.55);
  border: 1px solid var(--rule);
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
}
.bulk-merge-row:hover { border-color: rgba(212,175,94,0.4); }
.bulk-merge-row.active { background: rgba(212,175,94,0.12); border-color: var(--accent); }
.bulk-merge-check { font-size: 0.95rem; color: var(--accent); text-align: center; }
.bulk-merge-quality { font-weight: 700; font-size: 0.85rem; }
.bulk-merge-slot { color: var(--muted); font-size: 0.75rem; }
.bulk-merge-arrow { color: var(--muted); }
.bulk-merge-next { font-weight: 700; font-size: 0.85rem; }
.bulk-merge-count { color: var(--accent2); font-size: 0.75rem; font-family: monospace; }
.bulk-hint { font-size: 0.72rem; color: var(--muted); margin: 0.4rem 0; line-height: 1.5; }
.bulk-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.3rem; margin: 0.4rem 0; }
.bulk-opt { padding: 0.45rem 0.3rem; font-size: 0.78rem; background: rgba(20,22,42,0.6); border: 1px solid var(--rule); border-radius: 6px; color: var(--muted); cursor: pointer; font-family: inherit; transition: all 0.15s; }
.bulk-opt:hover { border-color: var(--accent2); color: var(--accent2); }
.bulk-opt.active { background: rgba(212,175,94,0.1); border-color: var(--accent); color: var(--accent); font-weight: 700; }
.bulk-quality-list { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0.3rem 0 0.5rem; }
.bulk-quality-item { padding: 0.15rem 0.4rem; font-size: 0.7rem; background: rgba(20,22,42,0.6); border: 1px solid var(--rule); border-radius: 3px; font-weight: 600; }
</style>
