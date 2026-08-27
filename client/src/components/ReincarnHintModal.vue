<!--
  ====== 满百级转生提醒弹窗 v0.9 ======
  玩家首次达到 Lv.100 时弹出
  - 标题：轮回之刻已至
  - 内容：可转生说明 + 下一转收益预览
  - 按钮：去转生 / 我知道了
-->
<template>
  <div class="reinc-hint-overlay" @click.self="$emit('close')">
    <div class="reinc-hint-box">
      <div class="reinc-hint-ornament top">✦</div>
      <div class="reinc-hint-ornament bottom">✦</div>

      <div class="reinc-hint-glyph">∞</div>
      <div class="reinc-hint-title">轮回之刻已至</div>
      <div class="reinc-hint-subtitle">你已达到 Lv.{{ level }}，可以首次转生</div>

      <div class="reinc-hint-divider">— 转生将获得 —</div>

      <div class="reinc-hint-buffs">
        <div class="buff-item">
          <span class="buff-label">经验加成</span>
          <span class="buff-val">+2%</span>
        </div>
        <div class="buff-item">
          <span class="buff-label">金币加成</span>
          <span class="buff-val">+2%</span>
        </div>
        <div class="buff-item">
          <span class="buff-label">基础攻击</span>
          <span class="buff-val">+5</span>
        </div>
        <div class="buff-item">
          <span class="buff-label">基础防御</span>
          <span class="buff-val">+5</span>
        </div>
        <div class="buff-item">
          <span class="buff-label">基础生命</span>
          <span class="buff-val">+5</span>
        </div>
        <div class="buff-item">
          <span class="buff-label">基础敏捷</span>
          <span class="buff-val">+5</span>
        </div>
      </div>

      <div class="reinc-hint-warn">
        ⚠ 转生将重置等级、经验、属性点<br/>
        装备、词条、法则、登神进度、积分、材料全部保留
      </div>

      <div class="reinc-hint-actions">
        <button class="btn btn-secondary reinc-hint-btn" @click="$emit('close')">
          我知道了
        </button>
        <button class="btn btn-primary reinc-hint-btn" @click="$emit('goReincarn')">
          立即转生 →
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  level: { type: Number, required: true },
});
defineEmits(['close', 'goReincarn']);
</script>

<style scoped>
.reinc-hint-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.78);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  animation: fadeIn 0.3s ease;
  padding: 1.5rem;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes popIn { from { opacity: 0; transform: scale(0.85) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }

.reinc-hint-box {
  position: relative;
  background: linear-gradient(160deg, #1a1c35 0%, #0a0b14 100%);
  border: 1px solid var(--accent);
  border-radius: 16px;
  padding: 2rem 1.5rem 1.5rem;
  max-width: 380px;
  width: 100%;
  text-align: center;
  box-shadow: 0 0 50px rgba(var(--gold-rgb),0.35), 0 0 100px rgba(var(--gold-rgb),0.15);
  animation: popIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.reinc-hint-ornament {
  position: absolute;
  font-size: 1.2rem;
  color: var(--accent);
  opacity: 0.6;
  font-weight: 700;
}
.reinc-hint-ornament.top { top: 0.8rem; left: 1rem; }
.reinc-hint-ornament.bottom { bottom: 0.8rem; right: 1rem; }

.reinc-hint-glyph {
  font-size: 3.5rem;
  color: var(--accent);
  text-shadow: 0 0 24px rgba(var(--gold-rgb),0.6);
  font-family: var(--font-display, serif);
  margin-bottom: 0.4rem;
  animation: glyphPulse 2s ease-in-out infinite;
}
@keyframes glyphPulse {
  0%, 100% { transform: scale(1); text-shadow: 0 0 24px rgba(var(--gold-rgb),0.6); }
  50% { transform: scale(1.08); text-shadow: 0 0 36px rgba(var(--gold-rgb),0.9); }
}

.reinc-hint-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--accent);
  letter-spacing: 0.1em;
  margin-bottom: 0.3rem;
  font-family: var(--font-display, serif);
}

.reinc-hint-subtitle {
  font-size: 0.85rem;
  color: var(--dim, #aaa);
  margin-bottom: 1.2rem;
}

.reinc-hint-divider {
  font-size: 0.75rem;
  color: var(--accent2, #c9bcf8);
  letter-spacing: 0.15em;
  margin: 0.8rem 0 0.6rem;
  opacity: 0.8;
}

.reinc-hint-buffs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.buff-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.7rem;
  background: rgba(var(--gold-rgb),0.08);
  border: 1px solid rgba(var(--gold-rgb),0.2);
  border-radius: 6px;
}
.buff-label {
  font-size: 0.72rem;
  color: var(--dim, #aaa);
}
.buff-val {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--accent);
}

.reinc-hint-warn {
  font-size: 0.7rem;
  color: rgba(224,88,88,0.85);
  background: rgba(224,88,88,0.08);
  border: 1px solid rgba(224,88,88,0.2);
  border-radius: 6px;
  padding: 0.5rem 0.7rem;
  line-height: 1.5;
  margin-bottom: 1rem;
}

.reinc-hint-actions {
  display: flex;
  gap: 0.5rem;
}
.reinc-hint-btn {
  flex: 1;
  padding: 0.7rem 0.8rem;
  font-size: 0.9rem;
  font-weight: 600;
}
</style>
