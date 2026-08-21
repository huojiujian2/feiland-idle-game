<template>
  <div class="view-container evo-view">
    <!-- 子标签 -->
    <div class="sub-tabs">
      <button class="sub-tab" :class="{ active: subTab === 'race' }" @click="subTab = 'race'">
        <IconBase name="dna" :size="14" class="btn-icon" />种族进化
      </button>
      <button class="sub-tab" :class="{ active: subTab === 'law' }" @click="subTab = 'law'">
        <IconBase name="scroll" :size="14" class="btn-icon" />法则
      </button>
      <button class="sub-tab" :class="{ active: subTab === 'ascend' }" @click="subTab = 'ascend'">
        <IconBase name="sparkle" :size="14" class="btn-icon" />登神
      </button>
    </div>

    <!-- 种族进化 -->
    <div v-if="subTab === 'race'" class="evo-section">
      <!-- 当前种族 -->
      <div class="card race-current">
        <div class="race-stage-badge" :style="{ background: raceStageColor }">Stage {{ player.raceStage }}</div>
        <div class="race-portrait" v-if="currentRaceImg">
          <img :src="currentRaceImg" :alt="player.race" />
        </div>
        <div class="race-name">{{ player.race }}</div>
        <div class="race-desc">{{ raceInfo.current?.desc || '' }}</div>
        <div class="race-bonus">{{ raceInfo.current?.bonusText || '' }}</div>
      </div>

      <!-- 进化路线 -->
      <div class="card race-path" v-if="raceInfo.next">
        <div class="section-header">
          <span>进化路线</span>
          <span class="next-race-name">→ {{ raceInfo.next.name }}</span>
        </div>
        <div class="race-portrait next" v-if="nextRaceImg">
          <img :src="nextRaceImg" :alt="raceInfo.next.name" />
        </div>
        <div class="race-next-desc">{{ raceInfo.next.desc }}</div>
        <div class="race-next-bonus">加成：{{ raceInfo.next.bonusText }}</div>

        <!-- 进化条件 -->
        <div class="evo-reqs">
          <div class="evo-req" :class="{ met: player.level >= raceInfo.next.reqLevel }">
            <span class="req-icon">{{ player.level >= raceInfo.next.reqLevel ? '✓' : '✗' }}</span>
            <span>等级 Lv.{{ raceInfo.next.reqLevel }}（当前 Lv.{{ player.level }}）</span>
          </div>
          <div v-if="raceInfo.next.reqMaterial" class="evo-req" :class="{ met: hasMaterial }">
            <span class="req-icon">{{ hasMaterial ? '✓' : '✗' }}</span>
            <span>{{ raceInfo.next.reqMaterial.name }} ×{{ raceInfo.next.reqMaterial.count }}
              （拥有 {{ materialCount }}）</span>
          </div>
        </div>

        <button class="btn btn-primary evo-btn" :class="{ 'btn-disabled': !player.canEvolve || !hasMaterial }"
          @click="$emit('evolve')">
          {{ player.canEvolve ? '进化' : '条件不足' }}
        </button>
      </div>

      <div v-else class="card race-max">
        <div class="max-text">已达终极种族形态</div>
      </div>
    </div>

    <!-- 法则系统 -->
    <div v-if="subTab === 'law'" class="evo-section">
      <div class="card law-bonus-box" v-if="player.laws.length > 0">
        <div class="section-header">
          <span>已学法则加成</span>
          <span class="law-count">{{ player.laws.length }} 个法则</span>
        </div>
        <div class="law-bonus-list">
          <span v-if="lawBonus.damage" class="law-bonus-item">伤害+{{ (lawBonus.damage * 100).toFixed(0) }}%</span>
          <span v-if="lawBonus.defense" class="law-bonus-item">减伤+{{ (lawBonus.defense * 100).toFixed(0) }}%</span>
          <span v-if="lawBonus.exp" class="law-bonus-item">经验+{{ (lawBonus.exp * 100).toFixed(0) }}%</span>
          <span v-if="lawBonus.gold" class="law-bonus-item">金币+{{ (lawBonus.gold * 100).toFixed(0) }}%</span>
          <span v-if="lawBonus.heal" class="law-bonus-item">治愈+{{ (lawBonus.heal * 100).toFixed(0) }}%</span>
          <span v-if="lawBonus.allAttr" class="law-bonus-item">全属性+{{ (lawBonus.allAttr * 100).toFixed(0) }}%</span>
        </div>
      </div>

      <div class="card law-list">
        <div class="section-header"><span>法则列表</span></div>
        <div class="law-items">
          <div v-for="law in player.availableLaws" :key="law.id" class="law-item"
            :class="{ learned: law.learned, locked: law.locked }">
            <div class="law-item-header">
              <span class="law-item-name">{{ law.name }}</span>
              <span v-if="law.learned" class="law-status learned">已领悟</span>
              <span v-else-if="law.locked" class="law-status locked">Lv.{{ law.reqLevel }}</span>
              <span v-else class="law-status available">可领悟</span>
            </div>
            <div class="law-item-desc">{{ law.desc }}</div>
            <div class="law-item-bonus">
              <span v-if="law.bonus.damage">伤害+{{ (law.bonus.damage * 100).toFixed(0) }}%</span>
              <span v-if="law.bonus.defense">减伤+{{ (law.bonus.defense * 100).toFixed(0) }}%</span>
              <span v-if="law.bonus.exp">经验+{{ (law.bonus.exp * 100).toFixed(0) }}%</span>
              <span v-if="law.bonus.gold">金币+{{ (law.bonus.gold * 100).toFixed(0) }}%</span>
              <span v-if="law.bonus.heal">治愈+{{ (law.bonus.heal * 100).toFixed(0) }}%</span>
              <span v-if="law.bonus.allAttr">全属性+{{ (law.bonus.allAttr * 100).toFixed(0) }}%</span>
            </div>
            <div class="law-item-cost">消耗：{{ law.cost.name }} ×{{ law.cost.count }}
              （拥有 {{ getMaterialCount(law.cost.name) }}）</div>
            <button v-if="law.canLearn" class="btn btn-sm btn-primary law-btn"
              :class="{ 'btn-disabled': getMaterialCount(law.cost.name) < law.cost.count }"
              @click="$emit('learnLaw', law.id)">领悟法则</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 登神 -->
    <div v-if="subTab === 'ascend'" class="evo-section">
      <!-- 当前神格 -->
      <div class="card ascend-current">
        <div class="ascend-godhood" :style="{ color: godhoodColor }">
          {{ godhoodText }}
        </div>
        <div v-if="player.godhood" class="ascend-faith">
          信仰值：{{ player.faith }}
        </div>
      </div>

      <!-- 半神 -->
      <div class="card ascend-stage" :class="{ current: player.godhood === null, done: player.godhood !== null }">
        <div class="ascend-stage-name" :style="{ color: '#ff9d5e' }">半神</div>
        <div class="ascend-desc">{{ ascInfo.demigod.desc }}</div>
        <div class="ascend-bonus">{{ ascInfo.demigod.bonusText }}</div>
        <div class="ascend-reqs">
          <div class="ascend-req" :class="{ met: player.level >= ascInfo.demigod.reqLevel }">
            <span class="req-icon">{{ player.level >= ascInfo.demigod.reqLevel ? '✓' : '✗' }}</span>
            <span>等级 Lv.{{ ascInfo.demigod.reqLevel }}（当前 Lv.{{ player.level }}）</span>
          </div>
          <div class="ascend-req" :class="{ met: allAttrsMet(ascInfo.demigod.reqAttr) }">
            <span class="req-icon">{{ allAttrsMet(ascInfo.demigod.reqAttr) ? '✓' : '✗' }}</span>
            <span>每项属性 ≥ {{ ascInfo.demigod.reqAttr }}</span>
          </div>
          <div class="ascend-req" :class="{ met: player.laws.length >= ascInfo.demigod.reqLaws }">
            <span class="req-icon">{{ player.laws.length >= ascInfo.demigod.reqLaws ? '✓' : '✗' }}</span>
            <span>学会 ≥ {{ ascInfo.demigod.reqLaws }} 个法则（当前 {{ player.laws.length }}）</span>
          </div>
        </div>
        <button v-if="player.godhood === null" class="btn btn-primary ascend-btn"
          @click="$emit('ascend')">尝试登神</button>
        <div v-else class="ascend-done">已达成</div>
      </div>

      <!-- 神灵 -->
      <div class="card ascend-stage" :class="{ current: player.godhood === 'demigod', done: player.godhood === 'god' }">
        <div class="ascend-stage-name" :style="{ color: '#ffd700' }">神灵</div>
        <div class="ascend-desc">{{ ascInfo.god.desc }}</div>
        <div class="ascend-bonus">{{ ascInfo.god.bonusText }}</div>
        <div class="ascend-reqs">
          <div class="ascend-req" :class="{ met: player.level >= ascInfo.god.reqLevel }">
            <span class="req-icon">{{ player.level >= ascInfo.god.reqLevel ? '✓' : '✗' }}</span>
            <span>等级 Lv.{{ ascInfo.god.reqLevel }}（当前 Lv.{{ player.level }}）</span>
          </div>
          <div class="ascend-req" :class="{ met: allAttrsMet(ascInfo.god.reqAttr) }">
            <span class="req-icon">{{ allAttrsMet(ascInfo.god.reqAttr) ? '✓' : '✗' }}</span>
            <span>每项属性 ≥ {{ ascInfo.god.reqAttr }}</span>
          </div>
          <div class="ascend-req" :class="{ met: player.laws.length >= ascInfo.god.reqLaws }">
            <span class="req-icon">{{ player.laws.length >= ascInfo.god.reqLaws ? '✓' : '✗' }}</span>
            <span>学会 ≥ {{ ascInfo.god.reqLaws }} 个法则（当前 {{ player.laws.length }}）</span>
          </div>
          <div class="ascend-req" :class="{ met: player.faith >= ascInfo.god.reqFaith }">
            <span class="req-icon">{{ player.faith >= ascInfo.god.reqFaith ? '✓' : '✗' }}</span>
            <span>信仰值 ≥ {{ ascInfo.god.reqFaith }}（当前 {{ player.faith }}）</span>
          </div>
        </div>
        <button v-if="player.godhood === 'demigod'" class="btn btn-primary ascend-btn"
          @click="$emit('ascend')">点燃神火</button>
        <div v-else-if="player.godhood === 'god'" class="ascend-done">已达成</div>
        <div v-else class="ascend-locked">需先成为半神</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import IconBase from './icons/IconBase.vue'

const props = defineProps(['player'])
defineEmits(['evolve', 'learnLaw', 'ascend'])

const subTab = ref('race')

const RACE_IMAGES = {
  '鹰人': '/img/race-eagle.jpg',
  '翼人': '/img/race-winged.jpg',
  '天使': '/img/race-angel.jpg'
}

const currentRaceImg = computed(() => RACE_IMAGES[props.player.race] || null)
const nextRaceImg = computed(() => {
  const next = raceInfo.value.next
  return next ? (RACE_IMAGES[next.name] || null) : null
})

const raceInfo = computed(() => props.player.raceInfo || { current: null, next: null })
const lawBonus = computed(() => props.player.lawBonus || {})
const ascInfo = computed(() => props.player.ascensionInfo || { demigod: {}, god: {} })

const raceStageColor = computed(() => {
  const stage = props.player.raceStage
  if (stage === 0) return 'rgba(157,155,184,0.2)'
  if (stage === 1) return 'rgba(157,140,240,0.2)'
  return 'rgba(212,175,94,0.2)'
})

const hasMaterial = computed(() => {
  const next = raceInfo.value.next
  if (!next || !next.reqMaterial) return true
  return getMaterialCount(next.reqMaterial.name) >= next.reqMaterial.count
})

const materialCount = computed(() => {
  const next = raceInfo.value.next
  if (!next || !next.reqMaterial) return 0
  return getMaterialCount(next.reqMaterial.name)
})

const godhoodText = computed(() => {
  if (props.player.godhood === 'god') return '神灵'
  if (props.player.godhood === 'demigod') return '半神'
  return '凡人'
})

const godhoodColor = computed(() => {
  if (props.player.godhood === 'god') return '#ffd700'
  if (props.player.godhood === 'demigod') return '#ff9d5e'
  return '#9d9bb8'
})

function getMaterialCount(name) {
  const item = props.player.inventory?.find(i => i.name === name)
  return item ? item.count : 0
}

function allAttrsMet(req) {
  const a = props.player.attributes
  return a.strength >= req && a.constitution >= req && a.spirit >= req && a.agility >= req && a.charm >= req
}
</script>

<style scoped>
.evo-view { display: flex; flex-direction: column; gap: 0.6rem; max-width: 560px; margin: 0 auto; }

.sub-tabs { display: flex; gap: 0.3rem; }
.sub-tab { flex: 1; padding: 0.5rem; border: 1px solid var(--rule); border-radius: 8px; background: rgba(20,22,42,0.4); color: var(--muted); font-size: 0.8rem; cursor: pointer; transition: all var(--duration-normal) var(--ease-out); font-family: inherit; }
.sub-tab.active { background: rgba(212,175,94,0.08); border-color: var(--accent); color: var(--accent); box-shadow: 0 0 12px rgba(212,175,94,0.1); }

.evo-section { display: flex; flex-direction: column; gap: 0.6rem; }

/* 种族进化 */
.race-current { position: relative; text-align: center; padding: 1.2rem; }
.race-stage-badge { position: absolute; top: 0.6rem; right: 0.6rem; padding: 0.15rem 0.5rem; border-radius: 6px; font-size: 0.68rem; color: var(--muted); }
.race-portrait { width: 100%; max-width: 220px; aspect-ratio: 4/3; border-radius: 10px; overflow: hidden; margin: 0 auto 0.6rem; border: 1px solid rgba(212,175,94,0.2); position: relative; }
.race-portrait img { width: 100%; height: 100%; object-fit: cover; transition: transform var(--duration-slow) var(--ease-out); }
.race-portrait:hover img { transform: scale(1.05); }
.race-portrait::after { content: ''; position: absolute; inset: 0; background: linear-gradient(0deg, rgba(10,11,20,0.6), transparent 50%); pointer-events: none; }
.race-portrait.next { max-width: 160px; opacity: 0.85; }
.race-name { font-size: 1.4rem; font-weight: 700; font-family: var(--font-display); background: linear-gradient(135deg, var(--accent), var(--accent2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.race-desc { font-size: 0.78rem; color: var(--muted); margin-top: 0.3rem; }
.race-bonus { font-size: 0.75rem; color: var(--accent2); margin-top: 0.2rem; }

.race-path { padding: 0.9rem; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; font-size: 0.82rem; color: var(--muted); }
.next-race-name { color: var(--accent); font-weight: 600; }
.race-next-desc { font-size: 0.78rem; color: var(--ink); margin-bottom: 0.2rem; }
.race-next-bonus { font-size: 0.75rem; color: var(--accent2); margin-bottom: 0.6rem; }

.evo-reqs { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.6rem; }
.evo-req { display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; color: var(--dim); }
.evo-req.met { color: var(--success); }
.req-icon { width: 16px; text-align: center; font-weight: 700; }
.evo-btn { width: 100%; }

.race-max { text-align: center; padding: 1.5rem; }
.max-text { font-size: 0.9rem; color: var(--accent); font-weight: 600; }

/* 法则 */
.law-bonus-box { padding: 0.8rem; }
.law-count { color: var(--accent2); font-weight: 600; }
.law-bonus-list { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.4rem; }
.law-bonus-item { font-size: 0.72rem; color: var(--accent2); background: rgba(157,140,240,0.1); padding: 0.15rem 0.5rem; border-radius: 4px; }

.law-list { padding: 0.8rem; }
.law-items { display: flex; flex-direction: column; gap: 0.4rem; }
.law-item { padding: 0.6rem; border: 1px solid var(--rule); border-radius: 8px; background: rgba(24,26,46,0.4); transition: all 0.2s; }
.law-item.learned { border-color: rgba(94,218,122,0.3); background: rgba(94,218,122,0.05); }
.law-item.locked { opacity: 0.5; }
.law-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem; }
.law-item-name { font-size: 0.88rem; font-weight: 600; }
.law-status { font-size: 0.68rem; padding: 0.1rem 0.4rem; border-radius: 4px; }
.law-status.learned { color: var(--success); background: rgba(94,218,122,0.1); }
.law-status.locked { color: var(--dim); }
.law-status.available { color: var(--accent); background: rgba(212,175,94,0.1); }
.law-item-desc { font-size: 0.75rem; color: var(--muted); }
.law-item-bonus { font-size: 0.72rem; color: var(--accent2); margin-top: 0.2rem; display: flex; gap: 0.4rem; flex-wrap: wrap; }
.law-item-cost { font-size: 0.7rem; color: var(--dim); margin-top: 0.2rem; }
.law-btn { margin-top: 0.4rem; }

/* 登神 */
.ascend-current { text-align: center; padding: 1.2rem; }
.ascend-godhood { font-size: 1.5rem; font-weight: 700; }
.ascend-faith { font-size: 0.82rem; color: var(--accent); margin-top: 0.3rem; }

.ascend-stage { padding: 0.9rem; border: 1px solid var(--rule); }
.ascend-stage.current { border-color: var(--accent2); box-shadow: 0 0 12px rgba(157,140,240,0.15); }
.ascend-stage.done { opacity: 0.6; }
.ascend-stage-name { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.3rem; }
.ascend-desc { font-size: 0.78rem; color: var(--ink); margin-bottom: 0.2rem; }
.ascend-bonus { font-size: 0.75rem; color: var(--accent2); margin-bottom: 0.5rem; }

.ascend-reqs { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.6rem; }
.ascend-req { display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; color: var(--dim); }
.ascend-req.met { color: var(--success); }
.ascend-btn { width: 100%; }
.ascend-done { text-align: center; color: var(--success); font-size: 0.82rem; font-weight: 600; }
.ascend-locked { text-align: center; color: var(--dim); font-size: 0.78rem; }
</style>
