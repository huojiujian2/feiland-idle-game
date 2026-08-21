<template>
  <div class="view-container map-view">
    <!-- 上半：地图选择 -->
    <div class="map-section">
      <div class="section-header">
        <span><IconBase name="map" :size="14" class="section-icon" />挂机区域</span>
        <span class="current-area" v-if="currentAreaName">当前: {{ currentAreaName }}</span>
      </div>
      <div class="area-list">
        <div v-for="area in areas" :key="area.id" class="area-item"
          :class="{ active: area.id === player.currentArea, locked: player.level < area.minLevel }"
          @click="player.level >= area.minLevel ? $emit('select', area.id) : null">
          <div class="area-top">
            <span class="area-name">{{ area.name }}</span>
            <span v-if="area.id === player.currentArea" class="area-tag">挂机中</span>
            <span v-else-if="player.level < area.minLevel" class="area-lock">🔒Lv.{{ area.minLevel }}</span>
            <span v-else class="area-go">前往</span>
          </div>
          <div class="area-desc">{{ area.desc }}</div>
          <div class="area-monsters">{{ area.monsters.join('、') }}</div>
        </div>
      </div>
    </div>

    <!-- 战斗策略 -->
    <div class="strategy-section card" v-if="player.strategies">
      <div class="section-header"><span><IconBase name="crossedSwords" :size="14" class="section-icon" />战斗策略</span><span v-if="strategyCdText" class="strategy-cd">{{ strategyCdText }}</span></div>
      <div class="strategy-grid">
        <button v-for="s in player.strategies" :key="s.id"
          class="strategy-btn"
          :class="{ active: s.active, locked: !s.unlocked && !s.active }"
          :disabled="(!s.unlocked && !s.active) || (strategyCdRemaining>0 && !s.active)"
          :aria-pressed="s.active ? 'true' : 'false'"
          @click="$emit('strategy-change', s.id)">
          <span class="strategy-name">{{ s.name }}</span>
          <span class="strategy-desc">{{ s.desc }}</span>
          <span v-if="!s.unlocked && !s.active" class="strategy-lock">🔒Lv.{{ s.reqLevel }}</span>
          <span v-else-if="s.active" class="strategy-tag">当前</span>
        </button>
      </div>
    </div>

    <!-- 战斗属性面板 -->
    <div class="combat-stats card" v-if="player.combatStats">
      <div class="section-header"><span><IconBase name="sword" :size="14" class="section-icon" />战斗属性</span></div>
      <div class="combat-stats-grid">
        <div class="cs-item"><span class="cs-label">攻击</span><span class="cs-val atk">{{ player.combatStats.atk }}</span></div>
        <div class="cs-item"><span class="cs-label">防御</span><span class="cs-val def">{{ player.combatStats.def }}</span></div>
        <div class="cs-item"><span class="cs-label">敏捷</span><span class="cs-val agi">{{ player.combatStats.agi }}</span></div>
        <div class="cs-item" v-if="player.combatStats.dmgBonus"><span class="cs-label">增伤</span><span class="cs-val">+{{ (player.combatStats.dmgBonus * 100).toFixed(0) }}%</span></div>
        <div class="cs-item" v-if="player.combatStats.defBonus"><span class="cs-label">减伤</span><span class="cs-val">+{{ (player.combatStats.defBonus * 100).toFixed(0) }}%</span></div>
        <div class="cs-item" v-if="player.combatStats.healBonus"><span class="cs-label">治愈</span><span class="cs-val">+{{ (player.combatStats.healBonus * 100).toFixed(0) }}%</span></div>
      </div>
    </div>

    <!-- 下半：战斗日志（含飘字 overlay） -->
    <div class="log-section card" data-tutorial="log">
      <div class="log-header">
        <span><IconBase name="crossedSwords" :size="14" class="section-icon" />战斗日志</span>
        <span class="countdown-timer">
          <span class="hourglass" :class="{ running: countdown > 0 }"><IconBase name="scroll" :size="13" /></span>
          <span class="countdown">{{ countdown }}s</span>
        </span>
      </div>
      <div class="damage-layer" aria-hidden="true">
        <div v-for="d in damageItems" :key="d.id" class="dmg-float" :class="[d.kind, { crit: d.crit }]" :style="{ left: d.x + '%', top: d.y + '%' }">
          <span v-if="d.kind==='heal'">+{{ d.value }}</span>
          <span v-else-if="d.kind==='miss'">闪避</span>
          <span v-else>-{{ d.value }}</span>
          <span v-if="d.crit" class="dmg-crit-tag">暴击</span>
        </div>
      </div>
      <div class="log-body" ref="logBody">
        <div v-if="!player.logs.length" class="log-empty">正在寻找猎物...</div>

        <template v-for="(log, i) in player.logs" :key="i">
        <!-- 战斗日志 -->
        <div v-if="log.type === 'battle'" class="log-entry fade-in battle" @click="toggleExpand(i)">
          <div class="battle-card">
            <!-- 战斗头部 -->
            <div class="battle-top">
              <span class="log-time">{{ formatTime(log.time) }}</span>
              <span class="battle-result" :class="log.result">{{ resultText(log.result) }}</span>
              <span class="battle-vs">vs <span class="monster">{{ log.monster.name }}</span></span>
              <span class="battle-rounds">{{ log.rounds }}回合</span>
              <span class="rating-badge" :class="ratingClass(log)">{{ ratingLetter(log) }}</span>
            </div>

            <!-- 简要奖励（始终显示） -->
            <div class="battle-summary-row">
              <span v-if="log.exp" class="reward-exp"><IconBase name="scroll" :size="12" class="btn-icon icon-accent2" /> +{{ log.exp }}</span>
              <span v-if="log.gold" class="reward-gold"><IconBase name="gold" :size="12" class="btn-icon icon-accent" /> +{{ log.gold }}</span>
              <span v-if="log.drops.length" class="reward-drops"><IconBase name="bag" :size="12" class="btn-icon icon-accent2" /> {{ log.drops.length }}件</span>
              <span class="expand-hint">{{ expandedLogs.has(i) ? '收起' : '展开详情' }}</span>
            </div>

            <!-- 展开的战斗详情 -->
            <transition name="expand">
              <div v-if="expandedLogs.has(i)" class="battle-detail" @click.stop>

                <!-- 评级横幅 -->
                <div class="rating-banner" :class="ratingClass(log)">
                  <span class="rating-big">{{ ratingLetter(log) }}</span>
                  <span class="rating-desc">{{ ratingDesc(log) }}</span>
                  <span class="rating-rounds">{{ log.rounds }}回合{{ log.result === 'win' ? '击杀' : log.result === 'lose' ? '战败' : '超时' }}</span>
                </div>

                <!-- HP 血条 -->
                <div class="hp-bars">
                  <div class="hp-bar-row">
                    <span class="hp-label">你</span>
                    <div class="mini-bar"><div class="mini-bar-fill p-hp" :style="{ width: pct(log.finalPHp, player.maxHp) + '%' }"></div></div>
                    <span class="hp-val">{{ log.finalPHp }}/{{ player.maxHp }}</span>
                  </div>
                </div>

                <!-- 回合制剧本 -->
                <div v-for="(r, ri) in (log.detail || [])" :key="ri" class="round-block">
                  <!-- 回合标题 -->
                  <div class="round-title">
                    【第 {{ r.round }} 回合·{{ roundTheme(r, log, ri) }}】
                  </div>

                  <!-- 狂暴计时器（25回合后） -->
                  <div v-if="r.round >= 25 && r.round <= 30" class="fury-timer">
                    🔥 战斗白热化！还剩 {{ 30 - r.round }} 回合！
                  </div>

                  <!-- AGI 行动预判 -->
                  <div v-if="r.pActions > 1" class="agi-predict">
                    ⚡ 敏捷优势！行动比 {{ r.pActions }}:{{ r.mActions }} → 本回合连续行动 {{ r.pActions }} 次！
                  </div>
                  <div v-else-if="r.mActions > 1" class="agi-predict monster-adv">
                    ⚠ 怪物敏捷占优！行动比 {{ r.pActions }}:{{ r.mActions }}
                  </div>

                  <!-- 处理后的行动列表 -->
                  <template v-for="(item, ai) in processActions(r.actions)" :key="ai">
                     <!-- 连击风暴（T-005：skill 进入 combo，passive 不计） -->
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

                     <!-- 单条行动（T-005：skill 优先，复合并列渲染） -->
                    <div v-else class="action-narrative" :class="actionClass(item)">
                      <!-- 主动技能（优先，含 damage+heal/def_buff+heal 复合） -->
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
                      <!-- 玩家伤害 -->
                      <template v-else-if="item.actor === 'player' && item.damage !== undefined && !item.dodge">
                        <span class="act-icon">🗡️</span>
                        <span class="act-text">你的<strong class="skill-name">{{ item.skill }}</strong>{{ getDamageVerb(item.damage, item.targetMaxHp, ai) }}敌人！造成</span>
                        <span class="act-dmg" :class="{ crit: item.crit }">{{ item.damage }}</span>
                        <span v-if="item.heal !== undefined" class="act-heal"> +{{ item.heal }} HP</span>
                        <span class="act-hp">→ 怪物HP: {{ item.targetHp }}/{{ item.targetMaxHp }}</span>
                        <div v-if="item.crit" class="crit-highlight">⚡ 暴击！电光四溅！</div>
                      </template>

                      <!-- 玩家治疗 -->
                      <template v-else-if="item.actor === 'player' && item.heal !== undefined">
                        <span class="act-icon">💚</span>
                        <span class="act-text">你释放<strong class="skill-name">{{ item.skill }}</strong>，恢复</span>
                        <span class="act-heal">+{{ item.heal }} HP</span>
                      </template>

                      <!-- 玩家增益 -->
                      <template v-else-if="item.actor === 'player' && item.buff !== undefined">
                        <span class="act-icon">💪</span>
                        <span class="act-text">你释放<strong class="skill-name">{{ item.skill }}</strong>，战力提升！</span>
                        <span v-if="item.heal !== undefined" class="act-heal"> +{{ item.heal }} HP</span>
                      </template>

                      <!-- 玩家闪避 -->
                      <template v-else-if="item.actor === 'player' && item.dodge">
                        <span class="act-icon">💨</span>
                        <span class="act-text">{{ getDodgeVerb(ai) }}了{{ log.monster.name }}的攻击！</span>
                      </template>

                      <!-- 免死护盾 -->
                      <template v-else-if="item.actor === 'player' && item.shield">
                        <div class="shield-highlight">🛡 不屈壁垒！骑士在致命一击下屹立不倒，护盾破碎！</div>
                      </template>

                      <!-- 圣光复生 -->
                      <template v-else-if="item.actor === 'player' && item.revive">
                        <div class="revive-highlight">✨ 圣光复生！你从死亡中苏醒，HP恢复至 {{ item.targetHp }}！</div>
                      </template>

                      <!-- 怪物攻击 -->
                      <template v-else-if="item.actor === 'monster' && item.damage !== undefined">
                        <span class="act-icon">👹</span>
                        <span v-if="item.skill !== '普通攻击'" class="monster-charge">⚠ {{ log.monster.name }}蓄力</span>
                        <span class="act-text">{{ log.monster.name }}{{ getMonsterVerb(log.monster.name, ai) }}<strong class="skill-name">{{ item.skill }}</strong>！造成</span>
                        <span class="act-dmg monster-dmg">{{ item.damage }}</span>
                        <span class="act-hp">→ 你的HP: {{ item.targetHp }}/{{ item.targetMaxHp }}</span>
                      </template>

                      <!-- 怪物攻击被闪避（已经在上方处理） -->
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

                <!-- MVP 战报统计 -->
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
            </transition>
          </div>
        </div>

        <!-- 升级日志 -->
        <div v-else-if="log.type === 'levelup'" class="log-entry levelup">
          <span class="log-time">{{ formatTime(log.time) }}</span>
          <span class="log-text levelup-text">{{ log.text }}</span>
        </div>

        <!-- 职业日志 -->
        <div v-else-if="log.type === 'job'" class="log-entry job">
          <span class="log-time">{{ formatTime(log.time) }}</span>
          <span class="log-text job-text">{{ log.text }}</span>
        </div>

        <!-- 技能日志 -->
        <div v-else-if="log.type === 'skill'" class="log-entry skill">
          <span class="log-time">{{ formatTime(log.time) }}</span>
          <span class="log-text skill-text">🔮 {{ log.text }}</span>
        </div>

        <!-- 进化日志 -->
        <div v-else-if="log.type === 'evolve'" class="log-entry evolve">
          <span class="log-time">{{ formatTime(log.time) }}</span>
          <span class="log-text evolve-text">🧬 {{ log.text }}</span>
        </div>

        <!-- 其他日志 -->
        <div v-else class="log-entry">
          <span class="log-time">{{ formatTime(log.time) }}</span>
          <span class="log-text">{{ log.text || JSON.stringify(log) }}</span>
        </div>
        </template>
      </div>
    </div>

    <!-- 右侧折叠面板：排行+竞技场 -->
    <div class="side-panel" :class="{ expanded: sideOpen }">
      <button class="side-toggle" @click="sideOpen = !sideOpen">
        <span class="side-arrow">{{ sideOpen ? '›' : '‹' }}</span>
      </button>
      <transition name="side-slide">
        <div v-if="sideOpen" class="side-tabs">
          <div class="side-tab-item" @click="$emit('goRank')">
            <span class="side-tab-icon">🏆</span>
            <span class="side-tab-label">排行榜</span>
          </div>
          <div class="side-tab-item" @click="$emit('goPvP')">
            <span class="side-tab-icon">⚔️</span>
            <span class="side-tab-label">竞技场</span>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import IconBase from './icons/IconBase.vue'

const props = defineProps(['player', 'areas'])
defineEmits(['select', 'strategy-change', 'goRank', 'goPvP'])

const strategyCdRemaining = ref(0)
const sideOpen = ref(false)
let strategyCdTimer = null

function refreshStrategyCd(){
  const v = props.player.strategyCdRemaining
  strategyCdRemaining.value = typeof v === 'number' ? v : 0
}
watch(() => props.player.strategyCdRemaining, refreshStrategyCd, { immediate:true })
watch(() => props.player.strategy, refreshStrategyCd)

watch(() => strategyCdRemaining.value, (val)=>{
  if(strategyCdTimer) clearInterval(strategyCdTimer)
  if(val>0){
    strategyCdTimer = setInterval(()=>{ strategyCdRemaining.value = Math.max(0, strategyCdRemaining.value - 1000) }, 1000)
  }
})
onUnmounted(()=>{ if(strategyCdTimer) clearInterval(strategyCdTimer) })
const strategyCdText = computed(()=>{
  if(strategyCdRemaining.value<=0) return ''
  const s = Math.ceil(strategyCdRemaining.value/1000)
  const m = Math.floor(s/60), sec = s%60
  return m>0 ? `冷却 ${m}m${sec}s` : `冷却 ${sec}s`
})

const logBody = ref(null)
const expandedLogs = ref(new Set())
const currentAreaName = computed(() => props.areas.find(a => a.id === props.player.currentArea)?.name || '')

// ====== 飘字 overlay ======
const damageItems = ref([])
const lastBattleTime = ref(null)
let dmgSeq = 0
const dmgTimers = new Set()

function spawnDamageFromLog(log){
  if(!log || log.type !== 'battle' || !Array.isArray(log.detail)) return
  if(lastBattleTime.value === log.time) return
  lastBattleTime.value = log.time
  const actions = []
  for(const r of log.detail){
    for(const a of (r.actions||[])){
      if(a.damage !== undefined) actions.push(a)
      else if(a.heal !== undefined) actions.push(a)
      else if(a.dodge) actions.push(a)
    }
  }
  // 截断 12 个，取最新回合的伤害优先
  const slice = actions.slice(-12)
  slice.forEach((a, idx)=>{
    const id = Date.now() + '_' + (dmgSeq++)
    let kind = 'player-dmg'
    let value = a.damage
    let crit = !!a.crit
    if(a.heal !== undefined){ kind='heal'; value=a.heal }
    else if(a.dodge){ kind='miss'; value=0 }
    else if(a.actor==='monster'){ kind='monster-dmg' }
    else { kind='player-dmg' }
    const item = { id, kind, value, crit, x: 20 + Math.random()*60, y: 18 + Math.random()*42 }
    const delay = idx * 80
    const t = setTimeout(()=>{
      dmgTimers.delete(t)
      damageItems.value.push(item)
      if(damageItems.value.length>12) damageItems.value = damageItems.value.slice(-12)
      const rm = setTimeout(()=>{
        dmgTimers.delete(rm)
        damageItems.value = damageItems.value.filter(x=>x.id!==id)
      }, 1650)
      dmgTimers.add(rm)
    }, delay)
    dmgTimers.add(t)
  })
}

function findLatestBattle(logs){
  if(!logs || !logs.length) return null
  return logs.find(l => l.type === 'battle') || null
}

// 首次挂载不飘旧日志，仅记录时间（兼容 battle 后追加 levelup 的情况）
{
  const latestBattle = findLatestBattle(props.player.logs)
  if(latestBattle) lastBattleTime.value = latestBattle.time
}
watch(() => props.player.logs, (logs)=>{
  if(!logs || !logs.length) return
  const latestBattle = findLatestBattle(logs)
  if(latestBattle) spawnDamageFromLog(latestBattle)
})

// ====== 沙漏倒计时 ======
const countdown = ref(5)
let countdownTimer = null

watch(() => props.player.logs, () => {
  countdown.value = 5
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    countdown.value = countdown.value > 0 ? countdown.value - 1 : 5
  }, 1000)
}, { deep: true })

onUnmounted(() => { if (countdownTimer) clearInterval(countdownTimer) })
onUnmounted(()=>{ dmgTimers.forEach(t=>clearTimeout(t)); dmgTimers.clear() })

watch(() => props.player.logs, () => {
  nextTick(() => { if (logBody.value) logBody.value.scrollTop = 0 })
}, { deep: true })

function toggleExpand(index) {
  const s = new Set(expandedLogs.value)
  if (s.has(index)) s.delete(index)
  else s.add(index)
  expandedLogs.value = s
}

function formatTime(ts) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
}

// ====== 动词库 ======
const VERBS = {
  high: ['粉碎', '湮灭', '碾压', '暴轰', '撕裂虚空'],
  mid: ['重击', '撕裂', '贯穿', '猛劈', '直击'],
  low: ['轻击', '擦伤', '划过', '掠过', '弹击'],
  dodge: ['侧身躲过', '残影规避', '相位穿梭', '飘然闪开', '鬼魅般避开'],
  monsterGeneric: ['猛击', '挥击', '扑袭', '冲撞', '挥爪'],
}
const MONSTER_TYPES = {
  dragon:   { match: ['龙'], verbs: ['龙息', '龙威', '甩尾', '利爪撕扯', '翼击'] },
  beast:    { match: ['狼', '熊', '蜥', '蛇', '兔', '猪', '虫', '蛛'], verbs: ['撕咬', '爪击', '扑袭', '冲撞', '尾鞭'] },
  machine:  { match: ['傀儡', '蒸汽', '地精', '机械', '魔像'], verbs: ['激光扫射', '过载冲击', '机械臂击', '齿轮碾压'] },
  undead:   { match: ['魔', '暗', '虚空', '深渊', '亡', '骷髅', '僵尸', '怨', '灵'], verbs: ['魂噬', '诅咒', '冰冷触摸', '暗影斩', '亡灵侵蚀'] },
  elemental:{ match: ['火', '水', '雷', '风', '冰', '岩', '光'], verbs: ['元素冲击', '能量爆发', '属性湮灭', '自然之力'] },
}

function pick(arr, seed) { return arr[Math.abs(seed) % arr.length] }

function getDamageVerb(damage, targetMaxHp, seed = 0) {
  const ratio = damage / Math.max(1, targetMaxHp)
  if (ratio > 0.3) return pick(VERBS.high, seed)
  if (ratio > 0.1) return pick(VERBS.mid, seed)
  return pick(VERBS.low, seed)
}

function getDodgeVerb(seed = 0) { return pick(VERBS.dodge, seed) }

function getMonsterVerb(monsterName, seed = 0) {
  for (const type of Object.values(MONSTER_TYPES)) {
    if (type.match.some(k => monsterName.includes(k))) return pick(type.verbs, seed)
  }
  return pick(VERBS.monsterGeneric, seed)
}

// ====== 回合主题 ======
const ROUND_THEMES = ['试探交锋', '战意升腾', '鏖战正酣', '生死搏杀', '终极对决', '最后碰撞']

function roundTheme(round, log, ri) {
  if (round.pActions >= 3) return '疾风连击'
  if (round.round >= 25) return '生死搏杀'
  if (ri === 0 && round.round === 1) return '雷霆之怒'
  return pick(ROUND_THEMES, ri + round.round)
}

// ====== 评级 ======
function ratingLetter(log) {
  if (log.result === 'win' && log.rounds <= 5) return 'S'
  if (log.result === 'win' && log.rounds <= 15) return 'A'
  if (log.result === 'win') return 'B'
  return 'C'
}
function ratingDesc(log) {
  return { S: '摧枯拉朽！', A: '稳扎稳打', B: '苦战获胜', C: '险象环生' }[ratingLetter(log)]
}
function ratingClass(log) { return 'rating-' + ratingLetter(log).toLowerCase() }

function resultText(result) { return { win: '胜利', lose: '战败', timeout: '超时' }[result] || result }

// ====== 连击处理（T-005：仅主动/普通 damage 进入 combo，passive 不计） ======
function processActions(actions) {
  const result = []
  let combo = []

  function flushCombo() {
    if (!combo.length) return
    if (combo.length >= 2) {
      result.push({ isCombo: true, hits: [...combo], totalDamage: combo.reduce((s, a) => s + (a.damage || 0), 0) })
    } else {
      result.push(combo[0])
    }
    combo = []
  }

  for (const act of actions) {
    if (act.actor === 'player' && act.damage !== undefined && !act.dodge && act.type !== 'passive') {
      combo.push(act)
    } else {
      flushCombo()
      result.push(act)
    }
  }
  flushCombo()
  return result
}

function actionClass(item) {
  if (item.type === 'skill') return 'skill-action'
  if (item.type === 'passive') {
    if (item.source === 'dodgeAtk') return 'player-dmg'
    if (item.source === 'deathShield') return 'player-shield'
    if (item.source === 'revive') return 'player-revive'
    if (item.shield) return 'player-shield'
    if (item.revive) return 'player-revive'
  }
  if (item.actor === 'player') {
    if (item.damage !== undefined && !item.dodge) return 'player-dmg'
    if (item.heal !== undefined) return 'player-heal'
    if (item.buff !== undefined) return 'player-buff'
    if (item.dodge) return 'player-dodge'
    if (item.shield) return 'player-shield'
    if (item.revive) return 'player-revive'
  } else {
    return 'monster-act'
  }
  return ''
}

// ====== 统计 ======
function maxDamage(log) {
  let max = 0
  for (const r of (log.detail || [])) {
    for (const a of (r.actions || [])) {
      if (a.damage && a.damage > max) max = a.damage
    }
  }
  return max
}

function maxCombo(log) {
  let max = 0
  for (const r of (log.detail || [])) {
    if (r.pActions > max) max = r.pActions
  }
  return max
}

function dodgeCount(log) {
  let count = 0
  for (const r of (log.detail || [])) {
    for (const a of (r.actions || [])) {
      if (a.dodge) count++
    }
  }
  return count
}

function pct(cur, max) { return Math.max(0, Math.min(100, Math.round(cur / Math.max(1, max) * 100))) }

function dropQuality(name) {
  if (name.includes('传说') || name.includes('神器')) return 'q-legendary'
  if (name.includes('史诗') || name.includes('紫')) return 'q-epic'
  if (name.includes('稀有') || name.includes('蓝')) return 'q-rare'
  if (name.includes('精良') || name.includes('绿')) return 'q-uncommon'
  return 'q-common'
}
</script>

<style scoped>
.map-view { display: flex; flex-direction: column; gap: 0.6rem; max-width: 560px; margin: 0 auto; height: 100%; }

.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; font-size: 0.85rem; color: var(--muted); }
.current-area { color: var(--accent); font-size: 0.78rem; font-weight: 600; }

/* 地图列表 */
.map-section { flex-shrink: 0; }
.area-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.4rem; }
.area-item { padding: 0.5rem 0.6rem; border: 1px solid rgba(157,140,240,0.1); border-radius: 6px; cursor: pointer; transition: all var(--duration-normal) var(--ease-out); background: rgba(20,22,42,0.5); }
.area-item:hover { border-color: var(--accent2); background: rgba(157,140,240,0.08); }
.area-item.active { border-color: var(--accent); background: rgba(212,175,94,0.08); box-shadow: 0 0 0 1px var(--accent); }
.area-item.locked { opacity: 0.45; cursor: not-allowed; }
.area-top { display: flex; justify-content: space-between; align-items: center; }
.area-name { font-size: 0.82rem; font-weight: 600; }
.area-tag { font-size: 0.62rem; color: var(--accent); background: rgba(212,175,94,0.15); padding: 0.05rem 0.3rem; border-radius: 3px; font-weight: 600; }
.area-lock { font-size: 0.62rem; color: var(--dim); }
.area-go { font-size: 0.62rem; color: var(--accent2); }
.area-desc { font-size: 0.68rem; color: var(--muted); margin: 0.15rem 0; }
.area-monsters { font-size: 0.65rem; color: var(--dim); }

/* 战斗属性 */
.combat-stats { padding: 0.6rem 0.8rem; }
.combat-stats-grid { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.cs-item { display: flex; flex-direction: column; align-items: center; padding: 0.2rem 0.5rem; background: rgba(157,140,240,0.06); border-radius: 5px; }
.cs-label { font-size: 0.62rem; color: var(--dim); }
.cs-val { font-size: 0.82rem; font-weight: 700; }
.cs-val.atk { color: var(--danger); }
.cs-val.def { color: var(--accent2); }
.cs-val.agi { color: var(--success); }

/* 战斗日志 */
.log-section { flex: 1; display: flex; flex-direction: column; min-height: 180px; overflow: hidden; position: relative; }
.log-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 0.4rem; border-bottom: 1px solid var(--rule); margin-bottom: 0.3rem; font-size: 0.85rem; }
.countdown-timer { display: flex; align-items: center; gap: 0.2rem; font-size: 0.7rem; color: var(--muted); }
/* 飘字 overlay */
.damage-layer { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 5; }
.dmg-float { position: absolute; font-weight: 800; font-size: 0.95rem; text-shadow: 0 1px 4px rgba(0,0,0,0.6); animation: dmgFloat var(--duration-damage) var(--ease-out) forwards; white-space: nowrap; }
.dmg-float.player-dmg, .dmg-float.physical-dmg { color: var(--danger); }
.dmg-float.monster-dmg, .dmg-float.magical-dmg { color: var(--accent2); }
.dmg-float.heal { color: var(--success); }
.dmg-float.miss { color: var(--muted); font-size: 0.78rem; font-weight: 600; animation: missFloat var(--duration-damage) var(--ease-out) forwards; }
.dmg-float.crit { color: var(--dmg-crit); font-size: 1.15rem; transform: scale(1.15); animation: dmgFloat var(--duration-damage) var(--ease-out) forwards, critShake var(--crit-shake-duration) var(--crit-shake-delay); }
.dmg-crit-tag { font-size: 0.58rem; margin-left: 0.15rem; vertical-align: super; }
@keyframes dmgFloat { 0% { transform: translateY(0) scale(1); opacity: 0; } 12% { opacity: 1; } 100% { transform: translateY(-60px) scale(1); opacity: 0; } }
@keyframes missFloat { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(-32px); opacity: 0; } }
@keyframes critShake { 0%,100% { transform: translateX(0) scale(1.15); } 25% { transform: translateX(-2px) scale(1.3); } 50% { transform: translateX(2px) scale(1.3); } 75% { transform: translateX(-1px) scale(1.3); } }
@media (prefers-reduced-motion: reduce){ .dmg-float, .dmg-float.crit { animation: dmgFade var(--duration-damage) var(--ease-out) forwards; } @keyframes dmgFade { 0% { opacity:0;} 12%{opacity:1;} 100%{opacity:0;} } }
.hourglass { display: inline-block; font-size: 0.75rem; }
.hourglass.running { animation: spin 2s linear infinite; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.countdown { font-family: monospace; font-weight: 600; }

.log-body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.3rem; }
.log-empty { text-align: center; color: var(--dim); padding: 1.5rem; font-style: italic; }

.log-entry { padding: 0.3rem 0.4rem; border-radius: 6px; font-size: 0.75rem; border-left: 2px solid transparent; }
.log-entry.battle { border-left-color: var(--accent2); background: rgba(20,22,42,0.4); cursor: pointer; transition: background var(--duration-fast) var(--ease-out); }
.log-entry.battle:hover { background: rgba(20,22,42,0.6); }
.log-entry.levelup { background: rgba(212,175,94,0.08); border-left-color: var(--accent); }
.log-entry.job { background: rgba(157,140,240,0.08); border-left-color: var(--accent2); }
.log-entry.skill { background: rgba(94,218,122,0.06); border-left-color: var(--success); }
.log-entry.evolve { background: rgba(212,175,94,0.08); border-left-color: var(--accent); }
.log-time { color: var(--dim); font-size: 0.62rem; font-family: monospace; }
.log-text { color: var(--ink); margin-left: 0.3rem; }
.levelup-text { color: var(--accent); font-weight: 600; }
.job-text { color: var(--accent2); font-weight: 600; }
.skill-text { color: var(--success); font-weight: 600; }
.evolve-text { color: var(--accent); font-weight: 600; }

/* 战斗卡片头部 */
.battle-card { }
.battle-top { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.battle-result { font-size: 0.7rem; font-weight: 700; padding: 0.05rem 0.4rem; border-radius: 3px; }
.battle-result.win { color: var(--success); background: rgba(94,218,122,0.12); }
.battle-result.lose { color: var(--danger); background: rgba(224,88,88,0.12); }
.battle-result.timeout { color: var(--muted); background: rgba(157,155,184,0.12); }
.battle-vs { font-size: 0.75rem; color: var(--ink); }
.monster { color: var(--danger); font-weight: 600; }
.battle-rounds { font-size: 0.68rem; color: var(--dim); }

/* 评级徽章 */
.rating-badge { font-size: 0.62rem; font-weight: 800; padding: 0.05rem 0.35rem; border-radius: 3px; margin-left: auto; }
.rating-badge.rating-s { color: #d4af5e; background: rgba(212,175,94,0.18); }
.rating-badge.rating-a { color: var(--success); background: rgba(94,218,122,0.12); }
.rating-badge.rating-b { color: var(--accent2); background: rgba(157,140,240,0.12); }
.rating-badge.rating-c { color: var(--muted); background: rgba(157,155,184,0.12); }

/* 简要奖励行 */
.battle-summary-row { display: flex; gap: 0.4rem; margin-top: 0.2rem; align-items: center; }
.reward-exp { font-size: 0.7rem; color: var(--accent2); font-weight: 600; }
.reward-gold { font-size: 0.7rem; color: var(--accent); font-weight: 600; }
.reward-drops { font-size: 0.68rem; color: var(--success); }
.expand-hint { font-size: 0.62rem; color: var(--dim); margin-left: auto; }

/* 展开详情 */
.battle-detail { margin-top: 0.4rem; padding-top: 0.4rem; border-top: 1px solid var(--rule); }

/* 评级横幅 */
.rating-banner { display: flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.6rem; border-radius: 6px; margin-bottom: 0.4rem; }
.rating-banner.rating-s { background: rgba(212,175,94,0.12); border: 1px solid rgba(212,175,94,0.3); }
.rating-banner.rating-a { background: rgba(94,218,122,0.08); border: 1px solid rgba(94,218,122,0.25); }
.rating-banner.rating-b { background: rgba(157,140,240,0.08); border: 1px solid rgba(157,140,240,0.2); }
.rating-banner.rating-c { background: rgba(157,155,184,0.08); border: 1px solid rgba(157,155,184,0.2); }
.rating-big { font-size: 1.1rem; font-weight: 800; }
.rating-banner.rating-s .rating-big { color: #d4af5e; }
.rating-banner.rating-a .rating-big { color: var(--success); }
.rating-banner.rating-b .rating-big { color: var(--accent2); }
.rating-banner.rating-c .rating-big { color: var(--muted); }
.rating-desc { font-size: 0.75rem; font-weight: 600; color: var(--ink); }
.rating-rounds { font-size: 0.65rem; color: var(--dim); margin-left: auto; }

/* HP 血条 */
.hp-bars { margin-bottom: 0.3rem; }
.hp-bar-row { display: flex; align-items: center; gap: 0.3rem; }
.hp-label { font-size: 0.62rem; color: var(--muted); width: 18px; }
.mini-bar { flex: 1; height: 6px; background: rgba(157,140,240,0.1); border-radius: 3px; overflow: hidden; }
.mini-bar-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
.mini-bar-fill.p-hp { background: linear-gradient(90deg, #c04545, #5eda7a); }
.hp-val { font-size: 0.62rem; color: var(--dim); }

/* 回合块 */
.round-block { margin-bottom: 0.3rem; }
.round-title { font-size: 0.72rem; font-weight: 700; color: var(--accent2); margin-bottom: 0.15rem; }

/* 狂暴计时器 */
.fury-timer { font-size: 0.68rem; color: var(--danger); font-weight: 600; margin-bottom: 0.15rem; }

/* AGI 预判 */
.agi-predict { font-size: 0.68rem; color: var(--accent); margin-bottom: 0.15rem; font-weight: 600; }
.agi-predict.monster-adv { color: var(--danger); }

/* 行动叙述 */
.action-narrative { display: flex; align-items: baseline; gap: 0.2rem; font-size: 0.7rem; padding: 0.12rem 0.3rem; border-radius: 4px; margin-bottom: 0.08rem; flex-wrap: wrap; }
.action-narrative.skill-action { background: var(--skill-bg); border-left: 2px solid var(--skill-border); }
.action-narrative.skill-action .skill-name { color: var(--skill-icon); }
.combo-hit.skill-action .combo-skill.skill-used { color: var(--skill-icon); }
.action-narrative.player-dmg { background: rgba(157,140,240,0.06); }
.action-narrative.player-heal { background: rgba(94,218,122,0.06); }
.action-narrative.player-buff { background: rgba(212,175,94,0.06); }
.action-narrative.player-dodge { background: rgba(94,218,122,0.08); }
.action-narrative.monster-act { background: rgba(224,88,88,0.05); }

.act-icon { font-size: 0.72rem; }
.act-text { color: var(--ink); }
.skill-name { color: var(--accent2); font-weight: 600; }
.act-dmg { color: var(--danger); font-weight: 700; font-size: 0.78rem; }
.act-dmg.crit { color: #ff6b3d; font-size: 0.85rem; text-shadow: 0 0 4px rgba(255,107,61,0.4); }
.act-dmg.monster-dmg { color: #e05858; }
.act-heal { color: var(--success); font-weight: 700; }
.act-hp { color: var(--dim); font-size: 0.62rem; }

/* 怪物蓄力 */
.monster-charge { font-size: 0.62rem; color: var(--warning, #d4af5e); margin-right: 0.15rem; }

/* 高光定格 */
.crit-highlight { width: 100%; font-size: 0.72rem; font-weight: 700; color: #ff6b3d; padding: 0.1rem 0.3rem; margin-top: 0.05rem; }
.shield-highlight { font-size: 0.75rem; font-weight: 700; color: var(--accent2); padding: 0.15rem 0.3rem; background: rgba(157,140,240,0.1); border-radius: 4px; margin: 0.1rem 0; }
.revive-highlight { font-size: 0.75rem; font-weight: 700; color: var(--accent); padding: 0.15rem 0.3rem; background: rgba(212,175,94,0.1); border-radius: 4px; margin: 0.1rem 0; }

/* 连击风暴（T-005：仅 var(--skill-*)） */
.combo-block { margin: 0.15rem 0; padding: 0.2rem 0.3rem; border-radius: 5px; background: var(--skill-bg); border-left: 2px solid var(--skill-border); }
.combo-header { font-size: 0.72rem; font-weight: 700; color: var(--skill-highlight); margin-bottom: 0.1rem; }
.combo-hit { display: flex; align-items: center; gap: 0.2rem; font-size: 0.68rem; padding: 0.06rem 0.2rem; }
.combo-hit.skill-action { background: var(--skill-bg); border-radius: 3px; }
.combo-num { font-size: 0.6rem; color: var(--dim); width: 14px; }
.combo-skill { color: var(--muted); flex: 1; }
.combo-skill.skill-used { color: var(--skill-highlight); font-weight: 600; }
.combo-dmg { font-weight: 700; color: var(--danger); }
.combo-dmg.crit { color: #ff6b3d; font-size: 0.75rem; }
.combo-heal { color: var(--success); font-weight: 600; }
.combo-hp { color: var(--muted); font-size: 0.62rem; }
.crit-tag { font-size: 0.6rem; color: #ff6b3d; font-weight: 600; }
.combo-total { font-size: 0.68rem; font-weight: 700; color: var(--danger); margin-top: 0.05rem; }

/* 击杀/失败/超时定格 */
.kill-highlight { font-size: 0.8rem; font-weight: 700; color: var(--success); padding: 0.2rem 0.3rem; background: rgba(94,218,122,0.1); border-radius: 4px; margin: 0.3rem 0; text-align: center; }
.defeat-highlight { font-size: 0.8rem; font-weight: 700; color: var(--danger); padding: 0.2rem 0.3rem; background: rgba(224,88,88,0.08); border-radius: 4px; margin: 0.3rem 0; text-align: center; }
.timeout-highlight { font-size: 0.8rem; font-weight: 700; color: var(--muted); padding: 0.2rem 0.3rem; background: rgba(157,155,184,0.08); border-radius: 4px; margin: 0.3rem 0; text-align: center; }

/* MVP 统计 */
.mvp-stats { margin: 0.3rem 0; padding: 0.3rem 0.4rem; border-radius: 5px; background: rgba(20,22,42,0.5); }
.mvp-title { font-size: 0.68rem; font-weight: 600; color: var(--muted); margin-bottom: 0.15rem; }
.mvp-grid { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.mvp-item { font-size: 0.65rem; color: var(--dim); }
.mvp-item strong { color: var(--ink); font-weight: 700; }

/* 战利品 */
.drop-cards { margin-top: 0.2rem; }
.drop-title { font-size: 0.68rem; font-weight: 600; color: var(--muted); margin-bottom: 0.15rem; }
.drop-list { display: flex; flex-wrap: wrap; gap: 0.2rem; }
.drop-chip { font-size: 0.65rem; padding: 0.08rem 0.35rem; border-radius: 3px; font-weight: 500; }
.drop-chip.q-legendary { color: #d4af5e; background: rgba(212,175,94,0.15); border: 1px solid rgba(212,175,94,0.3); }
.drop-chip.q-epic { color: #c971ff; background: rgba(201,113,255,0.12); border: 1px solid rgba(201,113,255,0.25); }
.drop-chip.q-rare { color: var(--accent2); background: rgba(157,140,240,0.08); border: 1px solid rgba(157,140,240,0.2); }
.drop-chip.q-uncommon { color: var(--success); background: rgba(94,218,122,0.08); border: 1px solid rgba(94,218,122,0.2); }
.drop-chip.q-common { color: var(--dim); background: rgba(157,155,184,0.08); }

/* 战斗策略 — 4列网格（GAMEPLAY_TASKS:421）仅 var(--*) */
.strategy-section { padding: 0.6rem 0.8rem; }
.strategy-cd { font-size: 0.68rem; color: var(--accent); font-weight: 600; }
.strategy-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.4rem; }
@media (max-width: 480px){ .strategy-grid { grid-template-columns: repeat(2, 1fr); } }
.strategy-btn { display:flex; flex-direction:column; gap:0.15rem; padding:0.45rem 0.5rem; border:1px solid var(--rule); border-radius:6px; background: var(--lb-row-bg); cursor:pointer; transition: all var(--duration-normal) var(--ease-out); text-align:left; }
.strategy-btn:hover:not(:disabled) { border-color: var(--accent2); background: var(--lb-row-hover); }
.strategy-btn.active { border-color: var(--accent); background: var(--lb-gold-bg); box-shadow: 0 0 0 1px var(--accent); }
.strategy-btn.locked { opacity:0.5; cursor:not-allowed; }
.strategy-btn:disabled { opacity:0.5; cursor:not-allowed; }
.strategy-name { font-size:0.78rem; font-weight:700; color: var(--ink); }
.strategy-desc { font-size:0.62rem; color: var(--muted); }
.strategy-lock { font-size:0.62rem; color: var(--dim); }
.strategy-tag { font-size:0.62rem; color: var(--accent); font-weight:600; }

/* 展开动画 */
.expand-enter-active, .expand-leave-active { transition: all var(--duration-normal) var(--ease-out); overflow: hidden; }
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; }
.expand-enter-to, .expand-leave-from { opacity: 1; max-height: 1000px; }

/* 右侧折叠面板 */
.side-panel {
  position: fixed; right: 0; top: 50%; transform: translateY(-50%);
  z-index: 50; display: flex; align-items: center;
}
.side-toggle {
  width: 24px; height: 44px; border: 1px solid var(--rule, #2a2b42);
  border-right: none; border-radius: 8px 0 0 8px;
  background: var(--bg2, #14162a); color: var(--muted, #9d9bb8);
  cursor: pointer; font-size: 1rem; padding: 0;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s ease;
}
.side-toggle:hover { color: var(--accent, #d4af5e); border-color: var(--accent, #d4af5e); }
.side-tabs {
  background: var(--bg2, #14162a); border: 1px solid var(--rule, #2a2b42);
  border-right: none; border-radius: 10px 0 0 10px;
  padding: 0.35rem; display: flex; flex-direction: column; gap: 0.25rem;
  box-shadow: -4px 0 12px rgba(0,0,0,0.3);
}
.side-tab-item {
  display: flex; align-items: center; gap: 0.35rem; padding: 0.4rem 0.7rem;
  border-radius: 8px; cursor: pointer; white-space: nowrap;
  transition: all 0.15s ease; color: var(--muted, #9d9bb8);
}
.side-tab-item:hover { background: rgba(157,140,240,0.08); color: var(--ink, #ece9f5); }
.side-tab-icon { font-size: 1rem; }
.side-tab-label { font-size: 0.72rem; font-weight: 600; }
.side-tab-badge {
  background: var(--danger, #e85d75); color: #fff; font-size: 0.58rem;
  min-width: 14px; height: 14px; line-height: 14px; text-align: center;
  border-radius: 7px; padding: 0 3px; margin-left: auto;
}
.side-slide-enter-active, .side-slide-leave-active {
  transition: all var(--duration-fast, 150ms) var(--ease-out, ease);
}
.side-slide-enter-from, .side-slide-leave-to { opacity: 0; transform: translateX(15px); }
</style>
