<template>
  <div class="battle-detail" @click.stop>
    <!-- 评级横幅 -->
    <div class="rating-banner" :class="ratingClass(log)">
      <span class="rating-big">{{ ratingLetter(log) }}</span>
      <span class="rating-desc">{{ ratingDesc(log) }}</span>
      <span class="rating-rounds">{{ log.rounds }}回合{{ log.result === 'win' ? '击杀' : log.result === 'lose' ? '战败' : (log.result === 'draw' || log.result === 'timeout') ? '平局' : '超时' }}</span>
    </div>

    <!-- HP 血条 -->
    <div class="hp-bars">
      <div class="hp-bar-row">
        <span class="hp-label">你</span>
        <div class="mini-bar"><div class="mini-bar-fill p-hp" :style="{ width: pct(log.finalPHp, maxHp) + '%' }"></div></div>
        <span class="hp-val">{{ log.finalPHp }}/{{ maxHp }}</span>
      </div>
    </div>

    <!-- 回合制剧本 -->
    <div v-for="(r, ri) in (log.detail || [])" :key="ri" class="round-block">
      <div class="round-title">【第 {{ r.round }} 回合·{{ roundTheme(r, ri) }}】</div>
      <div v-if="r.round >= 25 && r.round <= 30" class="fury-timer">
        🔥 战斗白热化！还剩 {{ 30 - r.round }} 回合！
      </div>
      <div v-if="r.pActions > 1" class="agi-predict">
        ⚡ 敏捷优势！行动比 {{ r.pActions }}:{{ r.mActions }} → 本回合连续行动 {{ r.pActions }} 次！
      </div>
      <div v-else-if="r.mActions > 1" class="agi-predict monster-adv">
        ⚠ 怪物敏捷占优！行动比 {{ r.pActions }}:{{ r.mActions }}
      </div>

      <template v-for="(item, ai) in processActions(r.actions)" :key="ai">
        <div v-if="item.isCombo" class="combo-block">
          <div class="combo-header">⚡ 连击风暴！连续出手 {{ item.hits.length }} 次！</div>
          <div v-for="(hit, hi) in item.hits" :key="hi" class="combo-hit" :class="{ 'skill-action': hit.type==='skill' }">
            <span class="combo-num">{{ hi + 1 }}</span>
            <span class="combo-skill" :class="{ 'skill-used': hit.type==='skill' }">{{ hit.skill }}</span>
            <span class="combo-dmg" :class="{ crit: hit.crit }">{{ hit.damage }}</span>
            <span v-if="hit.crit" class="crit-tag">暴击!</span>
            <span v-if="hit.heal !== undefined || hit.selfHeal !== undefined" class="combo-heal">+{{ hit.heal || hit.selfHeal }} HP</span>
            <span v-if="hit.selfHp !== undefined" class="combo-hp">→ HP {{ hit.selfHp }}/{{ hit.healTargetHp || hit.targetMaxHp }}</span>
          </div>
          <div class="combo-total">总伤害: {{ item.totalDamage }}</div>
        </div>
        <div v-else class="action-narrative" :class="actionClass(item)">
          <template v-if="item.type === 'skill'">
            <span class="act-icon">✦</span>
            <span class="act-text">你释放<strong class="skill-name">{{ item.skill }}</strong></span>
            <span v-if="item.damage !== undefined" class="act-dmg" :class="{ crit: item.crit }"> -{{ item.damage }}</span>
            <span v-if="item.heal !== undefined" class="act-heal"> +{{ item.heal }} HP</span>
            <span v-if="item.buff !== undefined" class="act-buff"> 增益</span>
            <span v-if="item.note" class="act-note">（{{ item.note }}）</span>
            <span v-if="item.damage !== undefined" class="act-hp">→ 怪物HP: {{ item.targetHp }}/{{ item.targetMaxHp }}</span>
            <span v-else class="act-hp">→ 你的HP: {{ item.targetHp }}/{{ item.targetMaxHp }}</span>
            <div v-if="item.crit" class="crit-highlight">⚡ 暴击！电光四溅！</div>
          </template>
          <template v-else-if="item.actor === 'player' && item.damage !== undefined && !item.dodge">
            <span class="act-icon">🗡️</span>
            <span class="act-text">你的<strong class="skill-name">{{ item.skill }}</strong>{{ getDamageVerb(item.damage, item.targetMaxHp, ai) }}敌人！造成</span>
            <span class="act-dmg" :class="{ crit: item.crit }">{{ item.damage }}</span>
            <span v-if="item.heal !== undefined" class="act-heal"> +{{ item.heal }} HP</span>
            <span class="act-hp">→ 怪物HP: {{ item.targetHp }}/{{ item.targetMaxHp }}</span>
            <div v-if="item.crit" class="crit-highlight">⚡ 暴击！电光四溅！</div>
          </template>
          <template v-else-if="item.actor === 'player' && item.heal !== undefined">
            <span class="act-icon">💚</span>
            <span class="act-text">你释放<strong class="skill-name">{{ item.skill }}</strong>，恢复</span>
            <span class="act-heal">+{{ item.heal }} HP</span>
          </template>
          <template v-else-if="item.actor === 'player' && item.buff !== undefined">
            <span class="act-icon">💪</span>
            <span class="act-text">你释放<strong class="skill-name">{{ item.skill }}</strong>，战力提升！</span>
            <span v-if="item.heal !== undefined" class="act-heal"> +{{ item.heal }} HP</span>
          </template>
          <template v-else-if="item.actor === 'player' && item.dodge">
            <span class="act-icon">💨</span>
            <span class="act-text">{{ getDodgeVerb(ai) }}了{{ log.monster.name }}的攻击！</span>
          </template>
          <template v-else-if="item.actor === 'player' && item.shield">
            <div class="shield-highlight">🛡 不屈壁垒！骑士在致命一击下屹立不倒，护盾破碎！</div>
          </template>
          <template v-else-if="item.actor === 'player' && item.revive">
            <div class="revive-highlight">✨ 圣光复生！你从死亡中苏醒，HP恢复至 {{ item.targetHp }}！</div>
          </template>
          <template v-else-if="item.actor === 'monster' && item.damage !== undefined">
            <span class="act-icon">👹</span>
            <span v-if="item.skill !== '普通攻击'" class="monster-charge">⚠ {{ log.monster.name }}蓄力</span>
            <span class="act-text">{{ log.monster.name }}{{ getMonsterVerb(log.monster.name, ai) }}<strong class="skill-name">{{ item.skill }}</strong>！造成</span>
            <span class="act-dmg monster-dmg">{{ item.damage }}</span>
            <span class="act-hp">→ 你的HP: {{ item.targetHp }}/{{ item.targetMaxHp }}</span>
          </template>
          <template v-else-if="item.actor === 'monster' && item.damage === undefined">
            <span class="act-icon">💨</span>
            <span class="act-text">{{ log.monster.name }}的<strong>{{ item.skill }}</strong>被你{{ getDodgeVerb(ai) }}！</span>
          </template>
        </div>
      </template>
    </div>

    <!-- 击杀定格 -->
    <div v-if="log.result === 'win'" class="kill-highlight">
      💀 终结！{{ log.monster.name }}化为光粒消散，你获得胜利！
    </div>
    <div v-else-if="log.result === 'lose'" class="defeat-highlight">
      💀 你倒下了...仅获得 10% 经验
    </div>
    <div v-else class="timeout-highlight">
      ⏰ 战斗超时！势均力敌，获得 30% 经验
    </div>

    <!-- MVP 战报 -->
    <div class="mvp-stats">
      <div class="mvp-title">📊 本场战报</div>
      <div class="mvp-grid">
        <span class="mvp-item">🗡 最高伤害 <strong>{{ maxDamage(log) }}</strong></span>
        <span class="mvp-item">⚡ 最大连击 <strong>{{ maxCombo(log) }}次</strong></span>
        <span class="mvp-item">🎯 闪避 <strong>{{ dodgeCount(log) }}次</strong></span>
      </div>
    </div>

    <!-- 战利品 -->
    <div v-if="log.drops.length" class="drop-cards">
      <div class="drop-title">🎁 战利品</div>
      <div class="drop-list">
        <span v-for="d in log.drops" :key="d" class="drop-chip" :class="dropQuality(d)">{{ d }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
// ====== 战斗日志详情 ======
// @file components/map/BattleLogDetail
// @module battle-log-detail
// @description 单条战斗日志展开后的完整剧本（评级、HP、回合剧本、击杀定格、MVP、战利品）
import {
  ratingLetter, ratingDesc, ratingClass,
  roundTheme, processActions, actionClass,
  getDamageVerb, getDodgeVerb, getMonsterVerb,
  maxDamage, maxCombo, dodgeCount, pct, dropQuality,
} from './battleLogUtils';

defineProps({
  log: { type: Object, required: true },
  maxHp: { type: Number, required: true },
});
</script>

<style scoped>
.battle-detail { padding-top: 0.5rem; border-top: 1px solid var(--rule); }

.rating-banner { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.6rem; background: rgba(20,22,42,0.6); border-radius: 6px; margin-bottom: 0.4rem; }
.rating-banner.rating-s { background: linear-gradient(135deg, rgba(212,175,94,0.2), rgba(212,175,94,0.1)); border: 1px solid var(--accent); }
.rating-banner.rating-a { background: rgba(157,140,240,0.15); border: 1px solid var(--accent2); }
.rating-banner.rating-b { background: rgba(94,218,122,0.1); }
.rating-big { font-size: 1.4rem; font-weight: 800; color: var(--accent); font-family: monospace; }
.rating-desc { flex: 1; font-size: 0.8rem; color: var(--text); font-weight: 600; }
.rating-rounds { font-size: 0.7rem; color: var(--muted); }

.hp-bars { margin-bottom: 0.5rem; }
.hp-bar-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.7rem; }
.hp-label { width: 1.5rem; color: var(--muted); }
.mini-bar { flex: 1; height: 6px; background: rgba(20,22,42,0.8); border-radius: 3px; overflow: hidden; }
.mini-bar-fill { height: 100%; transition: width 0.3s; }
.mini-bar-fill.p-hp { background: linear-gradient(90deg, var(--danger), var(--accent)); }
.hp-val { font-family: monospace; font-size: 0.65rem; color: var(--muted); min-width: 5rem; text-align: right; }

.round-block { margin-bottom: 0.5rem; padding: 0.4rem; background: rgba(20,22,42,0.3); border-radius: 4px; }
.round-title { font-size: 0.78rem; font-weight: 700; color: var(--accent2); margin-bottom: 0.3rem; }
.fury-timer { font-size: 0.7rem; color: var(--danger); font-weight: 700; margin-bottom: 0.3rem; }
.agi-predict { font-size: 0.7rem; color: var(--accent); margin-bottom: 0.3rem; }
.agi-predict.monster-adv { color: var(--danger); }

.action-narrative { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.3rem; padding: 0.2rem 0; font-size: 0.72rem; line-height: 1.5; }
.act-icon { font-size: 0.85rem; }
.act-text { color: var(--text); }
.skill-name { color: var(--accent2); font-weight: 700; }
.act-dmg { font-weight: 700; color: var(--danger); font-family: monospace; }
.act-dmg.crit { color: var(--dmg-crit); text-shadow: 0 0 4px var(--dmg-crit); }
.act-dmg.monster-dmg { color: var(--accent2); }
.act-heal { font-weight: 700; color: var(--success); font-family: monospace; }
.act-buff { font-weight: 700; color: var(--accent); }
.act-note { color: var(--muted); font-size: 0.65rem; }
.act-hp { color: var(--muted); font-family: monospace; font-size: 0.65rem; }
.crit-highlight { width: 100%; margin-top: 0.2rem; padding: 0.2rem 0.4rem; background: rgba(212,175,94,0.15); border-radius: 4px; font-size: 0.7rem; color: var(--accent); font-weight: 700; text-align: center; }
.monster-charge { font-size: 0.68rem; color: var(--danger); font-weight: 700; margin-right: 0.2rem; }

.combo-block { margin: 0.3rem 0; padding: 0.4rem; background: rgba(212,175,94,0.08); border: 1px solid rgba(212,175,94,0.3); border-radius: 4px; }
.combo-header { font-size: 0.75rem; font-weight: 700; color: var(--accent); margin-bottom: 0.3rem; }
.combo-hit { display: flex; align-items: center; gap: 0.3rem; padding: 0.15rem 0; font-size: 0.7rem; }
.combo-hit.skill-action { background: rgba(157,140,240,0.1); padding: 0.15rem 0.3rem; border-radius: 3px; }
.combo-num { width: 1.2rem; height: 1.2rem; background: var(--accent); color: var(--bg); border-radius: 50%; font-weight: 700; font-size: 0.7rem; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.combo-skill { flex: 1; color: var(--text); font-weight: 600; }
.combo-skill.skill-used { color: var(--accent2); font-weight: 700; }
.combo-dmg { font-weight: 700; color: var(--danger); font-family: monospace; }
.combo-dmg.crit { color: var(--dmg-crit); }
.combo-heal { font-weight: 700; color: var(--success); font-family: monospace; font-size: 0.65rem; }
.combo-hp { color: var(--muted); font-family: monospace; font-size: 0.65rem; }
.crit-tag { font-size: 0.6rem; color: var(--accent); font-weight: 700; }
.combo-total { margin-top: 0.3rem; padding-top: 0.3rem; border-top: 1px dashed rgba(212,175,94,0.3); font-size: 0.72rem; font-weight: 700; color: var(--accent); }

.shield-highlight, .revive-highlight { padding: 0.3rem 0.5rem; background: rgba(94,218,122,0.15); border-radius: 4px; font-size: 0.72rem; color: var(--success); font-weight: 700; text-align: center; }
.revive-highlight { background: rgba(212,175,94,0.15); color: var(--accent); }

.kill-highlight, .defeat-highlight, .timeout-highlight { padding: 0.4rem; border-radius: 4px; font-size: 0.8rem; font-weight: 700; text-align: center; margin-top: 0.4rem; }
.kill-highlight { background: rgba(94,218,122,0.15); color: var(--success); }
.defeat-highlight { background: rgba(224,88,88,0.15); color: var(--danger); }
.timeout-highlight { background: rgba(212,175,94,0.15); color: var(--accent); }

.mvp-stats { margin-top: 0.5rem; padding: 0.4rem; background: rgba(20,22,42,0.5); border-radius: 4px; }
.mvp-title { font-size: 0.75rem; font-weight: 700; color: var(--accent2); margin-bottom: 0.3rem; }
.mvp-grid { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.mvp-item { font-size: 0.7rem; color: var(--muted); padding: 0.15rem 0.4rem; background: rgba(20,22,42,0.5); border-radius: 4px; }
.mvp-item strong { color: var(--accent); font-family: monospace; }

.drop-cards { margin-top: 0.5rem; padding: 0.4rem; background: rgba(20,22,42,0.5); border-radius: 4px; }
.drop-title { font-size: 0.75rem; font-weight: 700; color: var(--accent2); margin-bottom: 0.3rem; }
.drop-list { display: flex; flex-wrap: wrap; gap: 0.2rem; }
.drop-chip { font-size: 0.68rem; padding: 0.1rem 0.4rem; border-radius: 3px; background: rgba(157,140,240,0.1); }
.drop-chip.normal { color: var(--muted); }
.drop-chip.fine { color: var(--success); }
.drop-chip.epic { color: var(--accent2); }
.drop-chip.legend { color: var(--accent); }
</style>
