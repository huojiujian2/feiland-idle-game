<template>
  <!-- 转生 / 轮回 Tab -->
  <div class="evo-section">
    <div class="card reinc-header">
      <div class="reinc-title">轮回 {{ reincInfo.reincarnation || 0 }} 次</div>
      <div class="reinc-subtitle">累计转生点数：<b>{{ reincInfo.reincPoints || 0 }}</b></div>
    </div>

    <div class="card reinc-buffs">
      <div class="buffs-title">永久加成（当前）</div>
      <div class="buff-grid">
        <div class="buff-cell"><span class="buff-label">经验</span><span class="buff-val">+{{ Math.round((reincInfo.permanentBuffs?.expBonus || 0) * 100) }}%</span></div>
        <div class="buff-cell"><span class="buff-label">金币</span><span class="buff-val">+{{ Math.round((reincInfo.permanentBuffs?.goldBonus || 0) * 100) }}%</span></div>
        <!-- v10：基础 4 维每次转生各 +1，在永久加成区显示累计值 -->
        <div class="buff-cell buff-cell-full">
          <span class="buff-label">基础攻击/防御/生命/敏捷</span>
          <span class="buff-val">+{{ reincInfo.permanentBuffs?.baseAtkBonus || 0 }}</span>
        </div>
        <!-- v8：4 个属性之魂改为"永久增幅 %"，不再用 flat 值显示 -->
        <div class="buff-cell"><span class="buff-label">攻击增幅</span><span class="buff-val">+{{ Math.round((reincInfo.permanentBuffs?.baseAtkPercent || 0) * 100) }}%</span></div>
        <div class="buff-cell"><span class="buff-label">防御增幅</span><span class="buff-val">+{{ Math.round((reincInfo.permanentBuffs?.baseDefPercent || 0) * 100) }}%</span></div>
        <div class="buff-cell"><span class="buff-label">生命增幅</span><span class="buff-val">+{{ Math.round((reincInfo.permanentBuffs?.baseHpPercent || 0) * 100) }}%</span></div>
        <div class="buff-cell"><span class="buff-label">敏捷增幅</span><span class="buff-val">+{{ Math.round((reincInfo.permanentBuffs?.baseAgiPercent || 0) * 100) }}%</span></div>
      </div>
    </div>

    <div class="card reinc-preview">
      <div class="preview-title">转生 1 次后将获得</div>
      <div class="preview-grid">
        <!-- v4：直接显示 nextBuffs（单次增量），不再做差值计算（会出现负数） -->
        <span>经验/金币加成：+{{ Math.round((reincInfo.nextBuffs?.expBonus || 0) * 100) }}%</span>
        <span>基础攻击/防御/生命/敏捷：各 +{{ reincInfo.nextBuffs?.baseAtkBonus || 0 }}</span>
        <span>转生点数：+{{ reincEstimatePoints }}</span>
      </div>
    </div>

    <div class="card reinc-reqs">
      <div class="reqs-title">转生条件</div>
      <div class="req-row" :class="{ met: player.level >= 100 }">
        <span class="req-icon">{{ player.level >= 100 ? '✓' : '✗' }}</span>
        <span>等级 Lv.100（当前 Lv.{{ player.level }}）</span>
      </div>
      <div class="req-row" :class="{ met: reincInfo.canReincarnate && player.level >= 100 }">
        <span class="req-icon">{{ reincInfo.canReincarnate ? '✓' : '✗' }}</span>
        <span>通关龙岛或更高级区域</span>
      </div>
    </div>

    <button class="btn btn-primary reinc-btn"
      :class="{ 'btn-disabled': !reincInfo.canReincarnate || player.level < 100 || reincLoading }"
      :disabled="reincLoading"
      @click="$emit('reincarnate')">
      {{ reincLoading ? '轮回中...' : '立即转生' }}
    </button>
    <div class="reinc-warning">⚠ 转生将重置等级、经验、属性点；装备、词条、法则、登神进度、积分、材料保留</div>

    <!-- 内测：一键转生（后续随经验卷轴一起删除） -->
    <div class="card auto-reinc-card">
      <button class="btn auto-reinc-toggle" :class="{ open: autoReincOpen }" @click="autoReincOpen = !autoReincOpen">
        ⚡ 一键转生（内测）
      </button>
      <div v-if="autoReincOpen" class="auto-reinc-panel">
        <div class="auto-reinc-tip">用金币按高级经验卷轴（800 金币 / 3000 经验）速升到目标等级后连续转生，金币不够会停在断点</div>
        <div class="auto-reinc-fields">
          <label class="auto-reinc-field">
            <span>转生次数</span>
            <input type="number" min="1" max="999" v-model.number="autoReincTimes" />
          </label>
          <label class="auto-reinc-field">
            <span>目标等级</span>
            <input type="number" min="100" max="6000" v-model.number="autoReincLevel" />
          </label>
        </div>
        <div class="auto-reinc-cost">
          预计消耗：<b :class="{ 'cost-lack': autoReincCost > player.gold }">{{ autoReincCostText }}</b>
          （当前金币 {{ player.gold }}）
        </div>
        <button class="btn btn-primary auto-reinc-run"
          :class="{ 'btn-disabled': autoReincInvalid || autoReincRunning }"
          :disabled="autoReincRunning"
          @click="$emit('autoReincarnate', { times: autoReincTimes, targetLevel: autoReincLevel })">
          {{ autoReincRunning ? '转生中...' : '开始一键转生' }}
        </button>
      </div>
    </div>

    <!-- 二转解锁：创世之书入口 -->
    <div v-if="(reincInfo.reincarnation || 0) >= 2" class="card reinc-genesis">
      <div class="genesis-title-row">
        <span class="genesis-icon">📜</span>
        <div class="genesis-info">
          <div class="genesis-name">创世之书</div>
          <div class="genesis-sub">二转已解锁 · 你可以捏怪物、造装备</div>
        </div>
      </div>
      <button class="btn btn-primary reinc-genesis-btn" @click="$emit('goGenesis')">
        翻开创世之书 →
      </button>
    </div>

    <div class="card reinc-shop">
      <div class="shop-title-row">
        <IconBase name="dna" :size="14" class="icon-accent" />
        <span class="shop-title">转生点商店</span>
        <span class="shop-points">可用：<b>{{ reincInfo.reincPoints || 0 }}</b></span>
      </div>
      <div v-if="reincShop.length === 0" class="shop-loading">加载中...</div>
      <div v-else class="shop-grid">
        <div v-for="item in reincShop" :key="item.id" class="shop-item"
          :class="{ 'locked': (reincInfo.reincPoints || 0) < item.cost }">
          <div class="shop-item-name">
            {{ item.name }}
            <!-- v7：显示"第 N 次购买" -->
            <span class="shop-item-bought" v-if="item.boughtCount > 0">
              已买 {{ item.boughtCount }} 次
            </span>
          </div>
          <div class="shop-item-desc">{{ item.desc }}</div>
          <select v-if="item.options?.length" v-model="boxOptions[item.id]" class="box-option-select">
            <option v-for="opt in item.options" :key="opt" :value="opt">{{ opt }} ×5</option>
          </select>
          <div class="shop-item-bottom">
            <!-- v7：动态价格 = 已买次数 + 1 -->
            <span class="shop-item-cost" :title="`第 ${item.boughtCount + 1} 次购买`">
              <IconBase name="dna" :size="12" class="icon-accent" /> {{ item.cost }}
            </span>
            <button class="btn btn-sm btn-primary"
              :class="{ 'btn-disabled': (reincInfo.reincPoints || 0) < item.cost || shopBuying }"
              @click="$emit('buyReincItem', item, boxOptions[item.id])">兑换</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// ====== 转生 / 轮回 Tab ======
// @file components/evolution/ReincTab
// @module evolution-reinc-tab
// @description 转生 Tab：轮回信息 + 永久加成 + 下一级预览 + 转生条件 + 转生按钮 + 转生点商店
import { reactive, ref, computed } from 'vue';
import IconBase from '../icons/IconBase.vue';

const props = defineProps({
  player: { type: Object, required: true },
  reincInfo: { type: Object, required: true },
  reincEstimatePoints: { type: Number, default: 0 },
  reincShop: { type: Array, default: () => [] },
  reincLoading: { type: Boolean, default: false },
  shopBuying: { type: Boolean, default: false },
  autoReincRunning: { type: Boolean, default: false },
});
const emit = defineEmits(['reincarnate', 'buyReincItem', 'autoReincarnate']);

// 材料宝盒自选：每个宝盒商品的当前选中材料
const boxOptions = reactive({});

// ====== 内测：一键转生（后续随经验卷轴一起删除） ======
const autoReincOpen = ref(false);
const autoReincTimes = ref(1);
const autoReincLevel = ref(100);

// 与后端 expToNext 一致：floor(50 * level^1.5)
function expToNextLocal(level) { return Math.floor(50 * Math.pow(level, 1.5)); }
// 当前等级（转生后从 1 级算）→ 目标等级的缺口经验（粗略预估，按最坏情况每轮从 1 级开始）
const autoReincCost = computed(() => {
  const lv = Math.floor(Number(autoReincLevel.value) || 0);
  if (lv < 100) return 0;
  let need = 0;
  for (let l = 1; l < lv; l++) need += expToNextLocal(l);
  const perRun = Math.ceil(need / 3000) * 800;
  // 第一轮如果当前等级已达标则免买
  const firstRunFree = props.player.level >= lv ? 1 : 0;
  return perRun * (Math.max(1, Math.floor(Number(autoReincTimes.value) || 0)) - firstRunFree);
});
const autoReincCostText = computed(() => {
  const cost = autoReincCost.value;
  const scrolls = Math.ceil(cost / 800);
  return `${cost.toLocaleString()} 金币（约 ${scrolls.toLocaleString()} 张卷轴）`;
});
const autoReincInvalid = computed(() =>
  !(Math.floor(Number(autoReincTimes.value) || 0) >= 1) || !(Math.floor(Number(autoReincLevel.value) || 0) >= 100));
</script>

<style scoped>
.card { padding: 0.7rem 0.9rem; background: rgba(var(--panel-rgb),0.6); border: 1px solid var(--rule); border-radius: 8px; }
.evo-section { display: flex; flex-direction: column; gap: 0.6rem; }

.reinc-header { text-align: center; }
.reinc-title { font-size: 1.2rem; font-weight: 800; color: var(--accent); margin-bottom: 0.3rem; }
.reinc-subtitle { font-size: 0.8rem; color: var(--muted); }
.reinc-subtitle b { color: var(--accent2); }

.reinc-buffs { display: flex; flex-direction: column; gap: 0.4rem; }
.buffs-title { font-size: 0.82rem; color: var(--muted); margin-bottom: 0.3rem; }
.buff-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.3rem; }
.buff-cell { display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0.6rem; background: rgba(var(--panel-rgb),0.5); border-radius: 4px; font-size: 0.78rem; }
.buff-cell-full { grid-column: 1 / -1; }
.buff-label { color: var(--muted); }
.buff-val { color: var(--accent); font-weight: 700; font-family: monospace; }

.reinc-preview { display: flex; flex-direction: column; gap: 0.3rem; }
.preview-title { font-size: 0.82rem; color: var(--muted); margin-bottom: 0.2rem; }
.preview-grid { display: flex; flex-direction: column; gap: 0.3rem; }
.preview-grid span { padding: 0.3rem 0.6rem; background: rgba(var(--gold-rgb),0.08); border-radius: 4px; font-size: 0.78rem; color: var(--accent); }

.reinc-reqs { display: flex; flex-direction: column; gap: 0.3rem; }
.reqs-title { font-size: 0.82rem; color: var(--muted); margin-bottom: 0.2rem; }
.req-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem; background: rgba(var(--panel-rgb),0.5); border-radius: 4px; font-size: 0.78rem; }
.req-row.met { background: rgba(94,218,122,0.08); border: 1px solid rgba(94,218,122,0.3); }
.req-icon { font-size: 0.85rem; }
.req-row.met .req-icon { color: var(--success); }
.req-row:not(.met) .req-icon { color: var(--danger); }
.reinc-btn { width: 100%; padding: 0.6rem; font-weight: 700; }
.reinc-warning { font-size: 0.7rem; color: var(--dim); text-align: center; line-height: 1.5; }

/* 内测：一键转生 */
.auto-reinc-card { border-style: dashed; opacity: 0.92; }
.auto-reinc-toggle { width: 100%; padding: 0.45rem; font-size: 0.78rem; font-weight: 600; color: var(--accent2); background: rgba(var(--panel-rgb),0.5); border: 1px solid var(--rule); border-radius: 6px; cursor: pointer; }
.auto-reinc-toggle.open { color: var(--accent); border-color: var(--accent); }
.auto-reinc-panel { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem; }
.auto-reinc-tip { font-size: 0.68rem; color: var(--dim); line-height: 1.5; }
.auto-reinc-fields { display: flex; gap: 0.5rem; }
.auto-reinc-field { flex: 1; display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.72rem; color: var(--muted); }
.auto-reinc-field input { width: 100%; box-sizing: border-box; padding: 0.35rem 0.5rem; background: rgba(var(--panel-rgb),0.6); border: 1px solid var(--rule); border-radius: 4px; color: var(--accent); font-family: monospace; }
.auto-reinc-cost { font-size: 0.72rem; color: var(--muted); }
.auto-reinc-cost b { color: var(--gold, #d4af5e); }
.auto-reinc-cost b.cost-lack { color: var(--danger, #e06c6c); }
.auto-reinc-run { width: 100%; padding: 0.45rem; font-size: 0.8rem; font-weight: 700; }
.reinc-genesis {
  margin-top: 0.6rem; padding: 0.8rem;
  background: linear-gradient(135deg, rgba(94,58,122,0.25), rgba(var(--gold-rgb),0.1));
  border: 1px solid rgba(var(--gold-rgb),0.4);
}
.genesis-title-row { display:flex; align-items:center; gap:0.6rem; margin-bottom:0.6rem; }
.genesis-icon { font-size:1.6rem; }
.genesis-name { color:#d4af5e; font-size:0.9rem; font-weight:600; }
.genesis-sub { color:var(--dim); font-size:0.72rem; }
.reinc-genesis-btn { width:100%; }

.reinc-shop { display: flex; flex-direction: column; gap: 0.4rem; }
.shop-title-row { display: flex; align-items: center; gap: 0.4rem; padding-bottom: 0.4rem; border-bottom: 1px solid var(--rule); }
.shop-title { font-size: 0.85rem; font-weight: 700; color: var(--accent2); flex: 1; }
.shop-points { font-size: 0.78rem; color: var(--muted); }
.shop-points b { color: var(--accent); font-size: 0.95rem; }
.shop-loading { text-align: center; padding: 0.8rem; color: var(--dim); font-size: 0.78rem; }
.shop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.4rem; }
.shop-item { background: rgba(var(--panel-rgb),0.6); border: 1px solid var(--rule); border-radius: 6px; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.3rem; transition: all 0.2s; }
.shop-item:hover:not(.locked) { border-color: var(--accent2); transform: translateY(-1px); }
.shop-item.locked { opacity: 0.6; }
.shop-item-name { font-size: 0.8rem; font-weight: 700; color: var(--accent); display: flex; justify-content: space-between; align-items: center; }
.shop-item-bought { font-size: 0.6rem; color: var(--muted); font-weight: 400; padding: 1px 5px; background: rgba(var(--gold-rgb), 0.1); border-radius: 4px; }
.shop-item-desc { font-size: 0.7rem; color: var(--muted); flex: 1; line-height: 1.4; }
.shop-item-bottom { display: flex; justify-content: space-between; align-items: center; gap: 0.3rem; }
.shop-item-cost { font-size: 0.78rem; color: var(--accent); font-weight: 700; font-family: monospace; display: flex; align-items: center; gap: 0.2rem; }
.shop-item-bottom .btn { padding: 0.2rem 0.6rem; font-size: 0.72rem; }
</style>
