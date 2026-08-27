<template>
  <div v-if="battleResult" class="battle-overlay" @click.self="$emit('close')">
    <div class="battle-modal">
      <div class="battle-result-banner" :class="{ win: battleResult.isWin, lose: !battleResult.isWin }">
        {{ battleResult.isWin ? '胜利!' : '失败...' }}
      </div>

      <div class="battle-info">
        <div class="battle-side">
          <div class="bs-name">{{ playerName }}</div>
          <div class="bs-hp">{{ battleResult.battle.myHp }} / {{ battleResult.battle.myMaxHp }}</div>
          <div class="bs-stats">ATK {{ battleResult.battle.myStats.atk }} DEF {{ battleResult.battle.myStats.def }}</div>
        </div>
        <div class="battle-vs">VS</div>
        <div class="battle-side">
          <div class="bs-name">{{ battleResult.targetName }}</div>
          <div class="bs-hp">{{ battleResult.battle.enemyHp }} / {{ battleResult.battle.enemyMaxHp }}</div>
          <div class="bs-stats">ATK {{ battleResult.battle.enemyStats.atk }} DEF {{ battleResult.battle.enemyStats.def }}</div>
        </div>
      </div>

      <div class="battle-rounds" ref="roundsBody">
        <div v-for="r in battleResult.battle.rounds" :key="r.round" class="round-block">
          <div class="round-header">回合 {{ r.round }}</div>
          <div v-for="(a, idx) in r.actions" :key="idx" class="action-row" :class="a.actor">
            <span class="action-actor">{{ a.actor === 'A' ? playerName : battleResult.targetName }}</span>
            <span v-if="a.damage" class="action-dmg" :class="{ crit: a.crit }">
              {{ a.skill }} -{{ a.damage }}{{ a.crit ? ' 暴击!' : '' }}
            </span>
            <span v-else-if="a.heal" class="action-heal">{{ a.skill }} +{{ a.heal }}</span>
            <span v-else-if="a.dodge" class="action-dodge">{{ a.skill }}</span>
            <span v-else-if="a.buff" class="action-buff">{{ a.skill }}</span>
            <span v-else-if="a.shield" class="action-shield">{{ a.skill }}</span>
            <span v-else-if="a.revive" class="action-revive">{{ a.skill }}</span>
          </div>
        </div>
      </div>

      <div class="battle-rewards">
        <div class="reward-item"><IconBase name="gold" :size="14" class="btn-icon icon-accent" /> {{ battleResult.rewards.gold }}</div>
        <div class="reward-item"><IconBase name="scroll" :size="14" class="btn-icon icon-accent2" /> {{ battleResult.rewards.exp }}</div>
        <div class="reward-item"><IconBase name="gem" :size="14" class="btn-icon icon-accent2" /> {{ battleResult.rewards.coins || 0 }}</div>
        <div class="reward-item" :class="{ up: battleResult.ratingChange > 0, down: battleResult.ratingChange < 0 }">
          积分 {{ battleResult.ratingChange > 0 ? '+' : '' }}{{ battleResult.ratingChange }}
        </div>
      </div>

      <button class="battle-close" @click="$emit('close')">关闭</button>
    </div>
  </div>
</template>

<script setup>
// ====== PvP 战斗回放弹窗 ======
// @file components/pvp/PvPBattleReplay
// @module pvp-battle-replay
// @description 挑战结束后弹出，展示回合制回放和奖励结算
import { ref, onMounted, nextTick } from 'vue';
import IconBase from '../icons/IconBase.vue';

const props = defineProps({
  battleResult: { type: Object, default: null },
  playerName: { type: String, default: '你' },
});
defineEmits(['close']);

const roundsBody = ref(null);

function scrollRoundsToBottom() {
  if (roundsBody.value) roundsBody.value.scrollTop = roundsBody.value.scrollHeight;
}

onMounted(() => nextTick(scrollRoundsToBottom));
</script>

<style scoped>
.battle-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 1100; display: flex; align-items: center; justify-content: center; padding: 1rem; }
.battle-modal { background: var(--bg2); border: 1px solid var(--rule); border-radius: 12px; max-width: 460px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; }
.battle-result-banner { padding: 0.8rem; text-align: center; font-size: 1.4rem; font-weight: 800; border-radius: 12px 12px 0 0; }
.battle-result-banner.win { background: linear-gradient(135deg, var(--success), #3d8c4d); color: white; }
.battle-result-banner.lose { background: linear-gradient(135deg, var(--danger), #8c3d3d); color: white; }

.battle-info { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 0.5rem; padding: 0.6rem 0.8rem; background: rgba(20,22,42,0.5); }
.battle-side { text-align: center; }
.bs-name { font-weight: 700; font-size: 0.85rem; }
.bs-hp { font-family: monospace; font-size: 0.75rem; color: var(--accent); margin: 0.15rem 0; }
.bs-stats { font-size: 0.65rem; color: var(--muted); }
.battle-vs { font-size: 1.1rem; font-weight: 800; color: var(--accent2); }

.battle-rounds { flex: 1; overflow-y: auto; padding: 0.5rem 0.8rem; min-height: 200px; max-height: 40vh; }
.round-block { margin-bottom: 0.5rem; padding: 0.4rem; background: rgba(20,22,42,0.4); border-radius: 4px; }
.round-header { font-size: 0.72rem; font-weight: 700; color: var(--accent2); margin-bottom: 0.2rem; }
.action-row { display: flex; align-items: center; gap: 0.3rem; padding: 0.15rem 0; font-size: 0.7rem; flex-wrap: wrap; }
.action-actor { color: var(--muted); font-size: 0.65rem; min-width: 4rem; }
.action-dmg { color: var(--danger); font-weight: 700; font-family: monospace; }
.action-dmg.crit { color: var(--dmg-crit); text-shadow: 0 0 4px var(--dmg-crit); }
.action-heal { color: var(--success); font-weight: 700; font-family: monospace; }
.action-dodge { color: var(--accent2); font-style: italic; }
.action-buff { color: var(--accent); font-weight: 600; }
.action-shield, .action-revive { color: var(--success); font-weight: 700; }
.action-row.A { border-left: 2px solid var(--accent); padding-left: 0.3rem; }
.action-row.B { border-left: 2px solid var(--accent2); padding-left: 0.3rem; }

.battle-rewards { display: flex; gap: 0.4rem; padding: 0.5rem 0.8rem; border-top: 1px solid var(--rule); flex-wrap: wrap; justify-content: center; }
.reward-item { font-size: 0.78rem; padding: 0.2rem 0.5rem; background: rgba(157,140,240,0.1); border-radius: 4px; font-family: monospace; }
.reward-item.up { color: var(--success); }
.reward-item.down { color: var(--danger); }

.battle-close { margin: 0.5rem 0.8rem 0.8rem; padding: 0.5rem; background: var(--accent); color: var(--bg); border: none; border-radius: 6px; font-weight: 700; cursor: pointer; }
.battle-close:hover { filter: brightness(1.1); }
</style>
