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
        <div class="buff-cell"><span class="buff-label">基础攻击</span><span class="buff-val">+{{ reincInfo.permanentBuffs?.baseAtkBonus || 0 }}</span></div>
        <div class="buff-cell"><span class="buff-label">基础防御</span><span class="buff-val">+{{ reincInfo.permanentBuffs?.baseDefBonus || 0 }}</span></div>
        <div class="buff-cell"><span class="buff-label">基础生命</span><span class="buff-val">+{{ reincInfo.permanentBuffs?.baseHpBonus || 0 }}</span></div>
        <div class="buff-cell"><span class="buff-label">基础敏捷</span><span class="buff-val">+{{ reincInfo.permanentBuffs?.baseAgiBonus || 0 }}</span></div>
      </div>
    </div>

    <div class="card reinc-preview">
      <div class="preview-title">转生 1 次后将获得</div>
      <div class="preview-grid">
        <span>经验/金币加成：+{{ Math.round(((reincInfo.nextBuffs?.expBonus || 0) - (reincInfo.permanentBuffs?.expBonus || 0)) * 100) }}%</span>
        <span>基础攻击/防御/生命/敏捷：各 +5</span>
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
          <div class="shop-item-name">{{ item.name }}</div>
          <div class="shop-item-desc">{{ item.desc }}</div>
          <div class="shop-item-bottom">
            <span class="shop-item-cost">
              <IconBase name="dna" :size="12" class="icon-accent" /> {{ item.cost }}
            </span>
            <button class="btn btn-sm btn-primary"
              :class="{ 'btn-disabled': (reincInfo.reincPoints || 0) < item.cost || shopBuying }"
              @click="$emit('buyReincItem', item)">兑换</button>
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
import IconBase from '../icons/IconBase.vue';

defineProps({
  player: { type: Object, required: true },
  reincInfo: { type: Object, required: true },
  reincEstimatePoints: { type: Number, default: 0 },
  reincShop: { type: Array, default: () => [] },
  reincLoading: { type: Boolean, default: false },
  shopBuying: { type: Boolean, default: false },
});
defineEmits(['reincarnate', 'buyReincItem']);
</script>

<style scoped>
.card { padding: 0.7rem 0.9rem; background: rgba(20,22,42,0.6); border: 1px solid var(--rule); border-radius: 8px; }
.evo-section { display: flex; flex-direction: column; gap: 0.6rem; }

.reinc-header { text-align: center; }
.reinc-title { font-size: 1.2rem; font-weight: 800; color: var(--accent); margin-bottom: 0.3rem; }
.reinc-subtitle { font-size: 0.8rem; color: var(--muted); }
.reinc-subtitle b { color: var(--accent2); }

.reinc-buffs { display: flex; flex-direction: column; gap: 0.4rem; }
.buffs-title { font-size: 0.82rem; color: var(--muted); margin-bottom: 0.3rem; }
.buff-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.3rem; }
.buff-cell { display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0.6rem; background: rgba(20,22,42,0.5); border-radius: 4px; font-size: 0.78rem; }
.buff-label { color: var(--muted); }
.buff-val { color: var(--accent); font-weight: 700; font-family: monospace; }

.reinc-preview { display: flex; flex-direction: column; gap: 0.3rem; }
.preview-title { font-size: 0.82rem; color: var(--muted); margin-bottom: 0.2rem; }
.preview-grid { display: flex; flex-direction: column; gap: 0.3rem; }
.preview-grid span { padding: 0.3rem 0.6rem; background: rgba(212,175,94,0.08); border-radius: 4px; font-size: 0.78rem; color: var(--accent); }

.reinc-reqs { display: flex; flex-direction: column; gap: 0.3rem; }
.reqs-title { font-size: 0.82rem; color: var(--muted); margin-bottom: 0.2rem; }
.req-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem; background: rgba(20,22,42,0.5); border-radius: 4px; font-size: 0.78rem; }
.req-row.met { background: rgba(94,218,122,0.08); border: 1px solid rgba(94,218,122,0.3); }
.req-icon { font-size: 0.85rem; }
.req-row.met .req-icon { color: var(--success); }
.req-row:not(.met) .req-icon { color: var(--danger); }
.reinc-btn { width: 100%; padding: 0.6rem; font-weight: 700; }
.reinc-warning { font-size: 0.7rem; color: var(--dim); text-align: center; line-height: 1.5; }

.reinc-shop { display: flex; flex-direction: column; gap: 0.4rem; }
.shop-title-row { display: flex; align-items: center; gap: 0.4rem; padding-bottom: 0.4rem; border-bottom: 1px solid var(--rule); }
.shop-title { font-size: 0.85rem; font-weight: 700; color: var(--accent2); flex: 1; }
.shop-points { font-size: 0.78rem; color: var(--muted); }
.shop-points b { color: var(--accent); font-size: 0.95rem; }
.shop-loading { text-align: center; padding: 0.8rem; color: var(--dim); font-size: 0.78rem; }
.shop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.4rem; }
.shop-item { background: rgba(20,22,42,0.6); border: 1px solid var(--rule); border-radius: 6px; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.3rem; transition: all 0.2s; }
.shop-item:hover:not(.locked) { border-color: var(--accent2); transform: translateY(-1px); }
.shop-item.locked { opacity: 0.6; }
.shop-item-name { font-size: 0.8rem; font-weight: 700; color: var(--accent); }
.shop-item-desc { font-size: 0.7rem; color: var(--muted); flex: 1; line-height: 1.4; }
.shop-item-bottom { display: flex; justify-content: space-between; align-items: center; gap: 0.3rem; }
.shop-item-cost { font-size: 0.78rem; color: var(--accent); font-weight: 700; font-family: monospace; display: flex; align-items: center; gap: 0.2rem; }
.shop-item-bottom .btn { padding: 0.2rem 0.6rem; font-size: 0.72rem; }
</style>
