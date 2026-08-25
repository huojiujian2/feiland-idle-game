<template>
  <!-- 创世之书（v0.8 沉浸版：沿用登录页羊皮卷轴风格 + 创世主题变奏） -->
  <div class="genesis-screen">
    <!-- 沉浸背景：星尘 + 符文环 + 烛光 + 羊皮纸纹理 + 双卷轴方向边光 -->
    <div class="imm-bg" aria-hidden="true">
      <div class="imm-stars"></div>
      <div class="imm-rune-ring"></div>
      <div class="imm-candle imm-candle--left"></div>
      <div class="imm-candle imm-candle--right"></div>
      <div class="imm-parchment"></div>
      <div class="imm-vignette"></div>
    </div>

    <div class="genesis-scroll">
      <!-- 神谕扉页（未二转） -->
      <header v-if="!data.unlocked" class="locked-hero">
        <div class="hero-rune" aria-hidden="true">
          <span class="hero-rune-dot"></span>
        </div>
        <h1 class="hero-title">
          <span class="hero-title-main">创世之书</span>
        </h1>
        <p class="hero-subtitle">命运的扉页尚未向你展开</p>
        <p class="hero-oracle">
          "当你完成第二次轮回，便可翻开此书，<br />
          以意志为笔，以虚无为墨，<br />
          为这费兰德注入只属于你的造物。"
        </p>
        <div class="locked-hint">需要 <strong>二转</strong>（转生次数 ≥ 2）才能解锁</div>
      </header>

      <!-- 已解锁：英雄区 + Tab 切换 -->
      <template v-else>
        <header class="unlocked-hero">
          <div class="hero-rune" aria-hidden="true">
            <span class="hero-rune-dot"></span>
          </div>
          <h1 class="hero-title">
            <span class="hero-title-main">创世之书</span>
          </h1>
          <p class="hero-subtitle">以意志凝聚真名 · 让全服世界见证你的造物</p>
        </header>

        <!-- 三模式切换：卷轴 Tab -->
        <div class="parchment-tabs">
          <button
            v-for="t in tabs"
            :key="t.key"
            class="parch-tab"
            :class="{ 'is-active': mode === t.key }"
            @click="mode = t.key"
            type="button"
          >
            <span class="parch-tab-glyph">{{ t.glyph }}</span>
            <span class="parch-tab-text">{{ t.label }}</span>
            <span class="parch-tab-count" v-if="t.count !== null">{{ t.count }}/60</span>
          </button>
        </div>

        <!-- 降生之页 -->
        <div v-if="mode === 'monster'" class="parchment">
          <div class="parchment-inner">
            <div class="form-intro">
              <span class="form-intro-line">"呼其真名，赋其血脉，自虚无中走出"</span>
              <span class="form-intro-name">降生之页</span>
            </div>

            <div class="field">
              <label class="field-label">✦ 真名</label>
              <div
                class="field-row"
                :class="{ 'is-focus': focusField === 'm-name', 'is-valid': mDraft.name.length >= 2 }"
              >
                <input
                  v-model="mDraft.name"
                  class="parchment-input"
                  placeholder="例如：熔岩蜗牛"
                  :maxlength="LIMITS.nameMax"
                  @focus="focusField = 'm-name'"
                  @blur="focusField = ''"
                />
                <span class="field-icon">✧</span>
              </div>
            </div>

            <div class="field">
              <label class="field-label">✦ 神谕</label>
              <textarea
                v-model="mDraft.desc"
                class="parchment-textarea"
                placeholder="描述它的来历与形态……"
                :maxlength="LIMITS.descMax"
                rows="2"
                @focus="focusField = 'm-desc'"
                @blur="focusField = ''"
              ></textarea>
            </div>

            <div class="field">
              <label class="field-label">✦ 血脉</label>
              <div class="race-pool">
                <button
                  v-for="(r, key) in data.races"
                  :key="key"
                  type="button"
                  class="race-mini"
                  :class="{ 'is-active': mDraft.race === key }"
                  @click="selectRace(key)"
                >
                  <span class="race-mini-glyph">{{ r.glyph || '✦' }}</span>
                  <span class="race-mini-name">{{ r.name }}</span>
                </button>
              </div>
            </div>

            <div class="field">
              <label class="field-label">
                ✦ 特性（≤{{ data.monsterSkillsMax }}）· 已选 {{ mDraft.skills.length }}/{{ data.monsterSkillsMax }}
              </label>
              <div class="skill-pool">
                <button
                  v-for="sk in availableSkills"
                  :key="sk.id"
                  type="button"
                  class="skill-chip"
                  :class="{ selected: mDraft.skills.includes(sk.id) }"
                  @click="toggleSkill(sk.id)"
                >
                  {{ sk.name }}
                </button>
              </div>
            </div>

            <div class="field">
              <label class="field-label">✦ 降生之地</label>
              <select
                v-model="mDraft.areaId"
                class="parchment-select"
                @focus="focusField = 'm-area'"
                @blur="focusField = ''"
              >
                <option v-for="a in areas" :key="a.id" :value="a.id">
                  {{ a.name }}（Lv.{{ a.minLevel }}）
                </option>
              </select>
            </div>

            <div class="field">
              <label class="field-label">
                ✦ 属性 · 预算 {{ mBudget.totalBudget }}（参照：{{ mBudget.name }}）
              </label>
              <div class="stat-grid">
                <div v-for="(_, key) in { hp:'', atk:'', def:'', agi:'' }" :key="key" class="stat-cell">
                  <span class="stat-name">{{ statNameZh(key) }}</span>
                  <input
                    v-model.number="mDraft[key]"
                    type="number"
                    min="0"
                    :max="mBudget.caps[key]"
                    class="stat-input"
                    :title="`上限 ${mBudget.caps[key]}`"
                  />
                </div>
              </div>
              <p
                class="field-hint"
                :class="{ 'is-invalid': mTotal > mBudget.totalBudget }"
                v-if="mBudget.totalBudget > 0"
              >
                <template v-if="mTotal <= mBudget.totalBudget">
                  剩余预算 <strong>{{ mBudget.totalBudget - mTotal }}</strong>
                </template>
                <template v-else>
                  超出预算 <strong>{{ mTotal - mBudget.totalBudget }}</strong>，降生将被拒绝
                </template>
              </p>
            </div>

            <div class="field">
              <label class="field-label">
                ✦ 挂载掉落（≤{{ data.dropsMax }}）· 经验金币由系统锁定，不可填
              </label>
              <div class="drop-list">
                <div v-for="(d, idx) in mDraft.drops" :key="idx" class="drop-row">
                  <select v-model="d.name" class="parchment-select drop-select">
                    <option v-for="mat in materialNames" :key="mat" :value="mat">{{ mat }}</option>
                  </select>
                  <input
                    v-model.number="d.rate"
                    type="number"
                    min="0.01"
                    max="0.5"
                    step="0.01"
                    class="parchment-input drop-rate"
                  />
                  <button type="button" class="btn-rune-mini drop-del" @click="mDraft.drops.splice(idx, 1)" aria-label="移除掉落">×</button>
                </div>
                <button
                  v-if="mDraft.drops.length < data.dropsMax"
                  type="button"
                  class="btn-rune btn-rune--ghost btn-rune--sm"
                  @click="addDrop"
                >
                  + 追加掉落
                </button>
              </div>
            </div>

            <div class="parchment-actions">
              <button
                class="btn-rune btn-rune--primary"
                @click="submitMonster"
                :disabled="!canSubmitMonster"
              >
                <span class="btn-rune-flame"></span>
                <span class="btn-rune-text">⚡ 降生（{{ data.limits.monsterCostGold }} 金币）</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 锻造之页 -->
        <div v-if="mode === 'equip'" class="parchment">
          <div class="parchment-inner">
            <div class="form-intro">
              <span class="form-intro-line">"置其名于铁砧之上，以意志击锤出形"</span>
              <span class="form-intro-name">锻造之页</span>
            </div>

            <div class="field">
              <label class="field-label">✦ 真名</label>
              <div
                class="field-row"
                :class="{ 'is-focus': focusField === 'e-name', 'is-valid': eDraft.name.length >= 2 }"
              >
                <input
                  v-model="eDraft.name"
                  class="parchment-input"
                  placeholder="例如：蜗牛之牙"
                  :maxlength="LIMITS.nameMax"
                  @focus="focusField = 'e-name'"
                  @blur="focusField = ''"
                />
                <span class="field-icon">✧</span>
              </div>
            </div>

            <div class="field">
              <label class="field-label">✦ 神谕</label>
              <textarea
                v-model="eDraft.desc"
                class="parchment-textarea"
                placeholder="它的来历与传说……"
                :maxlength="LIMITS.descMax"
                rows="2"
              ></textarea>
            </div>

            <div class="field">
              <label class="field-label">✦ 类型</label>
              <div class="slot-row">
                <button
                  v-for="(s, key) in data.equipSlots"
                  :key="key"
                  type="button"
                  class="race-mini"
                  :class="{ 'is-active': eDraft.slot === key }"
                  @click="eDraft.slot = key"
                >
                  <span class="race-mini-glyph">{{ equipGlyph(key) }}</span>
                  <span class="race-mini-name">{{ s.name }}</span>
                </button>
              </div>
            </div>

            <div class="field">
              <label class="field-label">✦ 投放地图</label>
              <select v-model="eDraft.areaId" class="parchment-select">
                <option v-for="a in areas" :key="a.id" :value="a.id">
                  {{ a.name }}（Lv.{{ a.minLevel }}）
                </option>
              </select>
            </div>

            <div class="field">
              <label class="field-label">
                ✦ 属性 · 预算 {{ eBudget.totalBudget }}（参照：{{ eBudget.refName }}）
              </label>
              <div class="stat-grid stat-grid--wide">
                <div v-for="(s, key) in data.equipStatKeys" :key="key" class="stat-cell">
                  <span class="stat-name">{{ s.name }}</span>
                  <input
                    v-model.number="eDraft.stats[key]"
                    type="number"
                    min="0"
                    class="stat-input"
                  />
                </div>
              </div>
              <p
                class="field-hint"
                :class="{ 'is-invalid': eStatCount > data.equipStatsMax || eTotal > eBudget.totalBudget }"
              >
                已用 {{ eStatCount }} / {{ data.equipStatsMax }} 种属性 · 总和 {{ eTotal }} / {{ eBudget.totalBudget }}
              </p>
            </div>

            <div class="parchment-actions">
              <button
                class="btn-rune btn-rune--primary"
                @click="submitEquip"
                :disabled="!canSubmitEquip"
              >
                <span class="btn-rune-flame"></span>
                <span class="btn-rune-text">🔥 锻造（{{ data.limits.equipCostGold }} 金币）</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 我的造物 -->
        <div v-if="mode === 'library'" class="parchment">
          <div class="parchment-inner">
            <div class="form-intro">
              <span class="form-intro-line">"翻看你刻入命运之书的每一笔"</span>
              <span class="form-intro-name">我的造物 ({{ myMonsters.length + myEquips.length }}/60)</span>
            </div>

            <div v-if="myMonsters.length === 0 && myEquips.length === 0" class="library-empty">
              <span class="library-empty-glyph">📜</span>
              <p>尚未降生任何造物。翻开第一页吧。</p>
            </div>

            <div v-for="m in myMonsters" :key="m.id" class="lib-card">
              <div class="lib-glyph">
                <span class="lib-glyph-text">{{ (data.races[m.race] || {}).glyph || '✦' }}</span>
              </div>
              <div class="lib-info">
                <div class="lib-name">
                  「 {{ m.name }} 」
                  <span class="lib-tag">种族 · {{ raceName(m.race) }}</span>
                </div>
                <div class="lib-desc">{{ m.desc || '（未写神谕）' }}</div>
                <div class="lib-meta">
                  出现于 <strong>{{ areaName(m.areaId) }}</strong> · 特性 <strong>{{ (m.skills || []).map(skillName).join('、') }}</strong>
                </div>
                <div class="lib-stats">
                  <span>HP {{ m.hp }}</span>
                  <span>ATK {{ m.atk }}</span>
                  <span>DEF {{ m.def }}</span>
                  <span>AGI {{ m.agi }}</span>
                </div>
              </div>
              <button type="button" class="btn-rune-mini lib-del" @click="del('monsters', m.id)">抹去</button>
            </div>

            <div v-for="e in myEquips" :key="e.id" class="lib-card">
              <div class="lib-glyph">
                <span class="lib-glyph-text">{{ equipGlyph(e.slot) }}</span>
              </div>
              <div class="lib-info">
                <div class="lib-name lib-name--epic">
                  「 {{ e.name }} 」 [史诗]
                  <span class="lib-tag">类型 · {{ slotName(e.slot) }}</span>
                </div>
                <div class="lib-desc">{{ e.desc || '（未写神谕）' }}</div>
                <div class="lib-meta">投放于 <strong>{{ areaName(e.areaId) }}</strong> · 需要 <strong>Lv.{{ e.reqLevel }}</strong></div>
                <div class="lib-stats">
                  <span v-for="(v, k) in e.stats" :key="k">{{ statName(k) }} +{{ v }}</span>
                </div>
              </div>
              <button type="button" class="btn-rune-mini lib-del" @click="del('equips', e.id)">抹去</button>
            </div>
          </div>
        </div>

        <p class="oracle-quote">
          "你低语真名，万界屏息 —— 它们从虚无中走出，因为你想让它们存在。"
        </p>
      </template>

      <!-- 神谕飘字（卷轴风格） -->
      <transition name="oracle-fade">
        <div v-if="lastOracle" class="oracle-toast" @click="lastOracle = ''">
          <div class="oracle-toast-frame">
            <div class="oracle-toast-rune" aria-hidden="true">✦</div>
            <div class="oracle-toast-text">{{ lastOracle }}</div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
// ====== 创世之书 v0.8 沉浸版 ======
// @file components/GenesisView
// @module genesis-view
// @description 沿用登录页 v0.8 羊皮卷轴风格：暗金 + Cinzel 字体 + 符文环 + 烛光
//              + 沉浸表单（卷轴底边金线，无边框） + 三 Tab 卷轴切换
import { ref, reactive, computed, onMounted } from 'vue';
import api from '../api.js';
import { toast } from '../ui-bridge.js';

const SKILL_NAME = {
  fire_breath: '龙息', tail_sweep: '尾扫', roar: '咆哮',
  bite: '撕咬', charge: '冲撞', claw: '利爪',
  star_arrow: '星辰箭', wing_blade: '翼刃斩', magic_bolt: '魔力冲击',
  soul_drain: '灵魂吞噬', soul_split: '灵魂分裂', dark_slash: '暗影斩',
  element_storm: '元素风暴', steam_blast: '蒸汽爆破', ice_breath: '冰息',
  void_tear: '虚空撕裂', realm_rift: '界域崩裂', void_nova: '虚空新星',
  time_stop: '时间停止', god_smash: '神怒一击',
  holy_smite: '圣光击', divine_judgment: '神圣审判',
  poison: '毒液',
};
const STAT_NAME_ZH = { hp: '生命', atk: '攻击', def: '防御', agi: '敏捷' };
const EQUIP_GLYPH = { weapon: '⚔', armor: '⛊', accessory: '❖' };

const areasMap = reactive({});
const props = defineProps({ player: Object });

const LIMITS = { nameMax: 12, descMax: 60 };
const MATERIAL_NAMES = ['兽皮', '草药', '兽骨', '青铜矿', '铁矿', '海灵石', '飞龙鳞片', '泰坦之血碎片', '深海水晶', '风羽玉露', '光明晶', '天使之羽', '附魔卷轴', '炼金材料', '龙鳞', '龙血', '法则碎片', '深渊之石'];

const data = ref({
  unlocked: false,
  races: {},
  commonSkills: [],
  monsterSkillsMax: 2,
  dropsMax: 2,
  equipSlots: {},
  equipStatKeys: {},
  equipStatsMax: 4,
  limits: { monsterCostGold: 5000, equipCostGold: 8000 },
  monsterBudgets: {},
  equipBudgets: {},
});
const mode = ref('monster');
const lastOracle = ref('');
const areas = ref([]);
const materialNames = MATERIAL_NAMES;
const myMonsters = ref([]);
const myEquips = ref([]);
const focusField = ref('');

const tabs = computed(() => [
  { key: 'monster', label: '降生之页', glyph: '✦' },
  { key: 'equip', label: '锻造之页', glyph: '⛊' },
  { key: 'library', label: '我的造物', glyph: '✧', count: myMonsters.value.length + myEquips.value.length },
]);

const mDraft = reactive({
  name: '', desc: '', areaId: 'gaomanshan', race: 'dragon', skills: [],
  hp: 10, atk: 3, def: 1, agi: 3,
  drops: [{ name: '草药', rate: 0.1 }],
});
const eDraft = reactive({
  name: '', desc: '', areaId: 'gaomanshan', slot: 'weapon',
  stats: { atk: 0, def: 0, hp: 0, mp: 0, str: 0, spi: 0, agi: 0, con: 0 },
});

const mTotal = computed(() => (Number(mDraft.hp) || 0) + (Number(mDraft.atk) || 0) + (Number(mDraft.def) || 0) + (Number(mDraft.agi) || 0));
const eTotal = computed(() => Object.values(eDraft.stats).reduce((s, v) => s + (Number(v) || 0), 0));
const eStatCount = computed(() => Object.values(eDraft.stats).filter(v => Number(v) > 0).length);

const mBudget = computed(() => {
  return data.value.monsterBudgets[mDraft.areaId] || { caps: { hp: 1, atk: 0, def: 0, agi: 0 }, totalBudget: 0, name: '无参照' };
});
const eBudget = computed(() => {
  const areaBudgets = data.value.equipBudgets[eDraft.areaId] || {};
  return areaBudgets[eDraft.slot] || { totalBudget: 0, refName: '无参照' };
});

const availableSkills = computed(() => {
  const r = data.value.races[mDraft.race];
  const set = new Set([...(r?.skills || []), ...data.value.commonSkills]);
  return Object.entries(SKILL_NAME).filter(([id]) => set.has(id)).map(([id, name]) => ({ id, name }));
});

const canSubmitMonster = computed(() => {
  if (!data.value.unlocked) return false;
  if (!mDraft.name) return false;
  if (mDraft.skills.length === 0 || mDraft.skills.length > data.value.monsterSkillsMax) return false;
  return mTotal.value <= mBudget.value.totalBudget;
});
const canSubmitEquip = computed(() => {
  if (!data.value.unlocked) return false;
  if (!eDraft.name) return false;
  if (eTotal.value <= 0) return false;
  if (eStatCount.value > data.value.equipStatsMax) return false;
  return true;
});

function toggleSkill(id) {
  const idx = mDraft.skills.indexOf(id);
  if (idx >= 0) mDraft.skills.splice(idx, 1);
  else if (mDraft.skills.length < data.value.monsterSkillsMax) mDraft.skills.push(id);
}
function addDrop() { mDraft.drops.push({ name: materialNames[0], rate: 0.1 }); }
function selectRace(key) {
  mDraft.race = key;
  mDraft.skills = [];
}
function skillName(id) { return SKILL_NAME[id] || id; }
function areaName(id) { return (areasMap[id] || {}).name || id; }
function raceName(key) { return (data.value.races[key] || {}).name || key; }
function slotName(key) { return (data.value.equipSlots[key] || {}).name || key; }
function statName(key) { return (data.value.equipStatKeys[key] || {}).name || key; }
function statNameZh(key) { return STAT_NAME_ZH[key] || key; }
function equipGlyph(slot) { return EQUIP_GLYPH[slot] || '✦'; }

async function init() {
  const username = props.player?.username;
  if (!username) return;
  const r = await api.getGenesis(username);
  if (r && r.success) {
    data.value = { ...data.value, ...r.data };
    myMonsters.value = r.data.monsters || [];
    myEquips.value = r.data.equips || [];
  }
  const aRes = await api.getAreas();
  if (aRes && aRes.success) {
    const list = aRes.data || [];
    for (const a of list) areasMap[a.id] = a;
    areas.value = [...list].sort((a, b) => a.minLevel - b.minLevel);
  }
}
onMounted(init);

async function submitMonster() {
  const r = await api.birthMonster(props.player.username, { ...mDraft });
  if (r && r.success) {
    showOracle(r.data.oracle);
    myMonsters.value.push(r.data.monster);
    props.player.gold = r.data.player.gold;
    toast.success('它已降生。');
  } else {
    toast.error(r?.message || '降生失败');
  }
}
async function submitEquip() {
  const cleanStats = {};
  for (const [k, v] of Object.entries(eDraft.stats)) {
    if (Number(v) > 0) cleanStats[k] = Math.floor(Number(v));
  }
  const r = await api.forgeEquip(props.player.username, { ...eDraft, stats: cleanStats, affixId: eDraft.affixId || null });
  if (r && r.success) {
    showOracle(r.data.oracle);
    myEquips.value.push(r.data.equip);
    props.player.gold = r.data.player.gold;
    toast.success('锻造完成。');
  } else {
    toast.error(r?.message || '锻造失败');
  }
}
async function del(kind, id) {
  if (!confirm('确认抹去这个造物？此操作无法撤销。')) return;
  const r = await api.deleteGenesis(props.player.username, kind, id);
  if (r && r.success) {
    showOracle(r.data.oracle);
    if (kind === 'monsters') myMonsters.value = myMonsters.value.filter(x => x.id !== id);
    else myEquips.value = myEquips.value.filter(x => x.id !== id);
    props.player.gold = r.data.player.gold;
  } else {
    toast.error(r?.message || '抹去失败');
  }
}
function showOracle(text) {
  lastOracle.value = text;
  setTimeout(() => { if (lastOracle.value === text) lastOracle.value = ''; }, 5000);
}
</script>

<style scoped>
/* ============ 沉浸层（与 v0.8 LoginScreen 同款） ============ */
.genesis-screen {
  position: relative;
  min-height: 100%;
  background: #06070d;
  overflow: hidden;
}
.imm-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}
.imm-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 20% 10%, rgba(212,175,94,0.14), transparent 55%),
    radial-gradient(ellipse at 80% 90%, rgba(157,140,240,0.16), transparent 55%),
    radial-gradient(ellipse at 50% 50%, rgba(255,200,120,0.04), transparent 70%),
    linear-gradient(180deg, #0a0b14 0%, #06070d 100%);
}
.imm-stars {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(1px 1px at 12% 18%, rgba(255,235,180,0.85), transparent 50%),
    radial-gradient(1px 1px at 28% 72%, rgba(212,175,94,0.7), transparent 50%),
    radial-gradient(1px 1px at 45% 35%, rgba(255,255,255,0.8), transparent 50%),
    radial-gradient(1px 1px at 68% 22%, rgba(157,140,240,0.7), transparent 50%),
    radial-gradient(1px 1px at 82% 65%, rgba(255,220,140,0.6), transparent 50%),
    radial-gradient(1px 1px at 8% 88%, rgba(255,235,180,0.6), transparent 50%),
    radial-gradient(1px 1px at 92% 12%, rgba(255,255,255,0.7), transparent 50%);
  background-size: 600px 600px;
  animation: stars-drift 42s linear infinite;
  opacity: 0.8;
}
@keyframes stars-drift {
  from { background-position: 0 0; }
  to { background-position: -600px 600px; }
}
.imm-rune-ring {
  position: absolute;
  top: 12%;
  left: 50%;
  width: 460px;
  height: 460px;
  transform: translateX(-50%);
  border: 1px dashed rgba(212,175,94,0.15);
  border-radius: 50%;
  animation: rune-rotate 80s linear infinite;
}
.imm-rune-ring::before {
  content: '';
  position: absolute;
  inset: 30px;
  border: 1px solid rgba(212,175,94,0.06);
  border-radius: 50%;
}
@keyframes rune-rotate {
  to { transform: translateX(-50%) rotate(360deg); }
}
.imm-candle {
  position: absolute;
  bottom: 6%;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,180,90,0.20) 0%, rgba(255,150,60,0.05) 40%, transparent 70%);
  filter: blur(4px);
  animation: candle-flicker 3.8s ease-in-out infinite;
}
.imm-candle--left { left: -50px; }
.imm-candle--right { right: -50px; animation-delay: 1.6s; }
@keyframes candle-flicker {
  0%, 100% { opacity: 0.55; transform: scale(1); }
  35% { opacity: 0.85; transform: scale(1.06); }
  60% { opacity: 0.7; transform: scale(0.97); }
}
.imm-parchment {
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(45deg, rgba(212,175,94,0.018) 0 2px, transparent 2px 8px),
    repeating-linear-gradient(-45deg, rgba(157,140,240,0.018) 0 2px, transparent 2px 8px);
  mix-blend-mode: screen;
  opacity: 0.65;
}
.imm-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%);
}

/* ============ 主滚动容器 ============
   不要自己设 overflow-y —— 外层 App.vue 的 game-body/view-container 已经在控制整页滚动。
   这里只做居中容器，让内容在视觉上居中、在滚动时跟随外层一起滚。 */
.genesis-scroll {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 460px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 0.8rem 0.8rem 2rem;
  /* 不再 overflow-y: auto / max-height —— 否则会出现「页内还嵌套一个滚动条」的现象 */
}

/* ============ 英雄区 ============ */
.locked-hero,
.unlocked-hero {
  text-align: center;
  position: relative;
  padding: 0.4rem 0 0.2rem;
  width: 100%;
  animation: fadeInUp 0.7s var(--ease-out, ease) both;
}
.hero-rune {
  width: 56px;
  height: 56px;
  margin: 0 auto 0.6rem;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hero-rune::before,
.hero-rune::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid rgba(212,175,94,0.35);
  border-radius: 50%;
  animation: rune-rotate 22s linear infinite;
}
.hero-rune::after {
  inset: 8px;
  border-style: dotted;
  border-color: rgba(157,140,240,0.3);
  animation-duration: 14s;
  animation-direction: reverse;
}
.hero-rune-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 16px rgba(212,175,94,0.7), 0 0 4px #fff;
  animation: hero-pulse 2.4s ease-in-out infinite;
}
@keyframes hero-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 16px rgba(212,175,94,0.7), 0 0 4px #fff; }
  50% { transform: scale(1.25); box-shadow: 0 0 24px rgba(212,175,94,1), 0 0 6px #fff; }
}
.hero-title {
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 1.7rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: 0.06em;
}
.hero-title-main {
  background: linear-gradient(135deg, #f0d896 0%, #d4af5e 45%, #9d7c3a 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 0 36px rgba(212,175,94,0.3);
  filter: drop-shadow(0 0 12px rgba(212,175,94,0.25));
}
.hero-subtitle {
  font-size: 0.78rem;
  color: rgba(212,175,94,0.7);
  letter-spacing: 0.14em;
  margin-top: 0.4rem;
  font-style: italic;
}
.hero-oracle {
  margin-top: 0.6rem;
  font-size: 0.86rem;
  color: rgba(243,232,196,0.85);
  font-family: var(--font-display, 'Cinzel', serif);
  font-style: italic;
  line-height: 1.9;
  letter-spacing: 0.05em;
  text-shadow: 0 0 6px rgba(212,175,94,0.18);
}
.locked-hint {
  margin-top: 0.9rem;
  padding: 0.4rem 0.8rem;
  display: inline-block;
  background: rgba(212,175,94,0.08);
  border: 1px solid rgba(212,175,94,0.35);
  border-radius: 4px;
  color: var(--accent);
  font-size: 0.78rem;
  letter-spacing: 0.08em;
}
.locked-hint strong { color: #ff9d5e; }

/* ============ 卷轴 Tab ============ */
.parchment-tabs {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.4rem;
  padding: 0.4rem;
  background: rgba(8,8,14,0.55);
  border: 1px solid rgba(212,175,94,0.18);
  border-radius: 4px;
}
.parch-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.55rem 0.3rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  font-family: inherit;
  color: rgba(212,175,94,0.55);
  transition: all 0.25s var(--ease-out, ease);
}
.parch-tab:hover {
  background: rgba(212,175,94,0.08);
  color: rgba(212,175,94,0.85);
  border-color: rgba(212,175,94,0.2);
}
.parch-tab.is-active {
  background: linear-gradient(180deg, rgba(212,175,94,0.18) 0%, rgba(28,30,54,0.85) 100%);
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 0 14px rgba(212,175,94,0.25), inset 0 1px 0 rgba(255,235,180,0.18);
}
.parch-tab.is-active::before {
  content: '';
  position: relative;
  display: block;
  margin: -4px 0 0 -4px;
  width: calc(100% + 8px);
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
}
.parch-tab-glyph {
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 1.2rem;
  line-height: 1;
  color: var(--accent);
  text-shadow: 0 0 8px rgba(212,175,94,0.4);
}
.parch-tab-text {
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.06em;
}
.parch-tab-count {
  font-size: 0.6rem;
  color: rgba(157,140,240,0.7);
  letter-spacing: 0.04em;
  font-family: monospace;
}

/* ============ 卷轴卡片 ============ */
.parchment {
  position: relative;
  width: 100%;
  background: linear-gradient(135deg, rgba(60,46,28,0.88) 0%, rgba(38,28,16,0.92) 100%);
  border: 1px solid rgba(212,175,94,0.18);
  border-radius: 4px;
  padding: 1.6rem 1.6rem 1.4rem;
  box-shadow:
    0 0 0 1px rgba(0,0,0,0.4) inset,
    0 0 24px rgba(212,175,94,0.10),
    0 8px 28px rgba(0,0,0,0.5);
}
.parchment::before,
.parchment::after {
  content: '';
  position: absolute;
  left: 8px; right: 8px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(212,175,94,0.45), transparent);
}
.parchment::before { top: 6px; }
.parchment::after { bottom: 6px; }

.parchment-inner {
  position: relative;
  border: 0;
  padding: 0.4rem 0.4rem 0.1rem;
}
.parchment-inner::before {
  content: '✦';
  position: absolute;
  top: -6px;
  left: -6px;
  width: 16px; height: 16px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #d4af5e, #8a6c2e);
  color: #1a1208;
  font-size: 9px;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(212,175,94,0.7);
  z-index: 2;
}
.parchment-inner::after {
  content: '✦';
  position: absolute;
  bottom: -6px;
  right: -6px;
  width: 16px; height: 16px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #d4af5e, #8a6c2e);
  color: #1a1208;
  font-size: 9px;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(212,175,94,0.7);
  z-index: 2;
}

/* 表单引导 */
.form-intro {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  margin-bottom: 0.9rem;
}
.form-intro-line {
  font-size: 0.7rem;
  color: rgba(212,175,94,0.55);
  letter-spacing: 0.14em;
  font-style: italic;
}
.form-intro-name {
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 1rem;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.16em;
  text-shadow: 0 0 10px rgba(212,175,94,0.3);
}

/* ============ 字段（与 v0.8 LoginScreen 同款，无方框） ============ */
.field { margin-bottom: 0.9rem; }
.field-label {
  display: block;
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--accent);
  letter-spacing: 0.12em;
  margin-bottom: 0.35rem;
  font-family: var(--font-display, 'Cinzel', serif);
  text-shadow: 0 0 8px rgba(212,175,94,0.25);
}
.field-row {
  position: relative;
  display: flex;
  align-items: center;
  background: transparent;
  border: 0;
  border-bottom: 1px solid rgba(212,175,94,0.35);
  border-radius: 0;
  padding: 0.2rem 0.1rem 0.55rem;
  transition: border-color 0.25s var(--ease-out, ease), background 0.25s;
}
.field-row::before {
  content: '';
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0,0,0,0.4), transparent);
  pointer-events: none;
}
.field-row.is-focus {
  border-bottom-color: var(--accent);
  background: linear-gradient(180deg, transparent 0%, rgba(212,175,94,0.06) 100%);
}
.field-row.is-focus::before { opacity: 0; }
.field-row.is-valid { border-bottom-color: rgba(94,218,122,0.7); }
.parchment-input {
  flex: 1;
  background: transparent;
  border: 0;
  outline: 0;
  padding: 0.4rem 0.4rem;
  color: #f3e8c4;
  font-size: 0.95rem;
  font-family: inherit;
  letter-spacing: 0.04em;
  caret-color: var(--accent);
}
.parchment-input::placeholder { color: rgba(212,175,94,0.4); font-style: italic; }
.parchment-textarea {
  width: 100%;
  background: transparent;
  border: 0;
  border-bottom: 1px solid rgba(212,175,94,0.35);
  border-radius: 0;
  padding: 0.4rem 0.4rem;
  color: #f3e8c4;
  font-family: inherit;
  font-size: 0.92rem;
  resize: vertical;
  min-height: 50px;
  outline: 0;
  caret-color: var(--accent);
}
.parchment-textarea::placeholder { color: rgba(212,175,94,0.4); font-style: italic; }
.parchment-textarea:focus { border-bottom-color: var(--accent); }
.parchment-select {
  width: 100%;
  background: rgba(8,8,14,0.55);
  border: 1px solid rgba(212,175,94,0.25);
  border-radius: 4px;
  padding: 0.5rem 0.6rem;
  color: #f3e8c4;
  font-family: inherit;
  font-size: 0.9rem;
  outline: 0;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23d4af5e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 12px;
  padding-right: 2rem;
}
.field-icon {
  padding: 0 0.4rem;
  color: rgba(212,175,94,0.6);
  font-size: 1rem;
  display: flex;
  align-items: center;
}
.field-row.is-valid .field-icon { color: var(--success); }
.field-hint {
  font-size: 0.7rem;
  color: rgba(212,175,94,0.55);
  margin: 0.35rem 0 0 0.1rem;
  letter-spacing: 0.05em;
  font-style: italic;
}
.field-hint.is-invalid { color: rgba(224,88,88,0.85); }

/* ============ 种族/槽位小型卷卡 ============ */
.race-pool,
.slot-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
  gap: 0.4rem;
}
.slot-row { grid-template-columns: repeat(3, 1fr); }
.race-mini {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.45rem 0.3rem;
  background: rgba(8,8,14,0.5);
  border: 1px solid rgba(212,175,94,0.18);
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  color: rgba(212,175,94,0.7);
  transition: all 0.2s var(--ease-out, ease);
}
.race-mini:hover {
  background: rgba(212,175,94,0.08);
  border-color: rgba(212,175,94,0.4);
  color: var(--accent);
}
.race-mini.is-active {
  background: linear-gradient(180deg, rgba(212,175,94,0.22) 0%, rgba(8,8,14,0.85) 100%);
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 0 14px rgba(212,175,94,0.3), inset 0 1px 0 rgba(255,235,180,0.2);
}
.race-mini-glyph {
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 1.1rem;
  line-height: 1;
  color: var(--accent);
  text-shadow: 0 0 6px rgba(212,175,94,0.45);
}
.race-mini-name {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

/* ============ 技能/掉落芯片 ============ */
.skill-pool {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.skill-chip {
  padding: 0.4rem 0.7rem;
  background: rgba(8,8,14,0.5);
  border: 1px solid rgba(212,175,94,0.2);
  border-radius: 14px;
  font-size: 0.78rem;
  color: rgba(212,175,94,0.75);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s var(--ease-out, ease);
}
.skill-chip:hover {
  background: rgba(212,175,94,0.1);
  border-color: rgba(212,175,94,0.45);
  color: var(--accent);
}
.skill-chip.selected {
  background: linear-gradient(180deg, rgba(212,175,94,0.25) 0%, rgba(157,140,240,0.2) 100%);
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 0 10px rgba(212,175,94,0.3);
}

.drop-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.drop-row {
  display: grid;
  grid-template-columns: 1fr 80px 28px;
  gap: 0.4rem;
  align-items: center;
}
.drop-select { background: rgba(8,8,14,0.55); }
.drop-rate { text-align: center; }

.btn-rune-mini {
  background: transparent;
  border: 1px solid rgba(212,175,94,0.4);
  color: var(--accent);
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.78rem;
  transition: all 0.2s var(--ease-out, ease);
}
.btn-rune-mini:hover {
  background: rgba(212,175,94,0.1);
  border-color: var(--accent);
}
.drop-del { padding: 0.3rem; color: rgba(224,88,88,0.7); border-color: rgba(224,88,88,0.3); }
.drop-del:hover { background: rgba(224,88,88,0.1); border-color: var(--danger); }

/* ============ 属性输入网格 ============ */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}
.stat-grid--wide { grid-template-columns: repeat(4, 1fr); }
@media (max-width: 420px) {
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
  .stat-grid--wide { grid-template-columns: repeat(3, 1fr); }
}
.stat-cell {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.5rem;
  background: rgba(8,8,14,0.4);
  border: 1px solid rgba(212,175,94,0.15);
  border-radius: 3px;
}
.stat-name {
  font-size: 0.72rem;
  color: rgba(212,175,94,0.7);
  font-family: var(--font-display, 'Cinzel', serif);
  letter-spacing: 0.04em;
}
/* 彻底移除 number 上下增减按钮（火狐 / 谷歌 / Edge / Safari 全覆盖）
   Firefox 用 -moz-appearance: textfield；
   Webkit 用 ::-webkit-inner-spin-button / outer-spin-button display:none；
   Edge 用 Edge UA hack。*/
.stat-input {
  width: 100%;
  min-width: 0;
  background: transparent;
  border: 0;
  color: var(--accent);
  font-size: 0.88rem;
  font-weight: 700;
  font-family: monospace;
  outline: none;
  text-align: left;
  padding: 0;
  /* 长数字不被截断：内容溢出时水平滚动而不是被剪掉 */
  -moz-appearance: textfield;
  appearance: textfield;
  text-overflow: clip;
  overflow: visible;
}
.stat-input:focus { text-align: left; }
.stat-input::-webkit-outer-spin-button,
.stat-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
  display: none;
}
/* IE / Edge legacy */
.stat-input::-ms-clear,
.stat-input::-ms-reveal,
.stat-input::-ms-expand { display: none; }

/* ============ 卷轴按钮（与 v0.8 LoginScreen 同款） ============ */
.parchment-actions {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin-top: 0.6rem;
}
.btn-rune {
  position: relative;
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(212,175,94,0.45);
  border-radius: 4px;
  background: linear-gradient(135deg, rgba(60,46,28,0.85), rgba(38,28,16,0.85));
  color: #f3e8c4;
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.25s var(--ease-out, ease);
  font-family: inherit;
}
.btn-rune-sm { padding: 0.5rem 0.8rem; font-size: 0.82rem; }
.btn-rune::before {
  content: '';
  position: absolute;
  inset: 1px;
  border: 1px solid rgba(212,175,94,0.18);
  border-radius: 3px;
  pointer-events: none;
}
.btn-rune-text { position: relative; z-index: 1; }
.btn-rune--primary {
  background: linear-gradient(135deg, var(--accent) 0%, #a8884a 60%, #6e5520 100%);
  color: #1a1208;
  border-color: #d4af5e;
  box-shadow:
    0 2px 12px rgba(212,175,94,0.35),
    inset 0 1px 0 rgba(255,235,180,0.3);
}
.btn-rune--primary:hover {
  background: linear-gradient(135deg, #f0d896 0%, var(--accent) 50%, #8a6c2e 100%);
  transform: translateY(-1px);
  box-shadow:
    0 4px 18px rgba(212,175,94,0.55),
    inset 0 1px 0 rgba(255,235,180,0.5);
}
.btn-rune-flame {
  position: absolute;
  inset: -2px;
  background: radial-gradient(ellipse at 50% 120%, rgba(255,180,90,0.5), transparent 60%);
  opacity: 0;
  transition: opacity 0.3s;
  animation: flame-pulse 1.6s ease-in-out infinite;
}
.btn-rune--primary:hover .btn-rune-flame { opacity: 1; }
@keyframes flame-pulse {
  0%, 100% { transform: scale(1); opacity: 0.65; }
  50% { transform: scale(1.08); opacity: 0.9; }
}
.btn-rune--ghost {
  background: transparent;
  border-color: rgba(157,140,240,0.35);
  color: rgba(157,140,240,0.85);
}
.btn-rune--ghost:hover {
  background: rgba(157,140,240,0.08);
  border-color: rgba(157,140,240,0.6);
  color: #c9bcf8;
  transform: translateY(-1px);
}
.btn-rune:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
  filter: grayscale(0.5);
}

/* ============ 我的造物卡片 ============ */
.library-empty {
  text-align: center;
  padding: 1.6rem 0.5rem;
  color: rgba(212,175,94,0.55);
  font-style: italic;
}
.library-empty-glyph {
  display: block;
  font-size: 2.4rem;
  margin-bottom: 0.5rem;
  opacity: 0.45;
}
.lib-card {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.8rem;
  margin-bottom: 0.6rem;
  background: rgba(8,8,14,0.55);
  border: 1px solid rgba(212,175,94,0.2);
  border-radius: 4px;
  position: relative;
  transition: border-color 0.2s;
}
.lib-card:hover { border-color: rgba(212,175,94,0.45); }
.lib-card::before {
  content: '';
  position: absolute;
  top: 4px; bottom: 4px;
  left: 0;
  width: 3px;
  background: linear-gradient(180deg, transparent, var(--accent), transparent);
  border-radius: 2px;
}
.lib-glyph {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(212,175,94,0.18) 0%, rgba(8,8,14,0.65) 100%);
  border: 1px solid rgba(212,175,94,0.3);
  border-radius: 50%;
}
.lib-glyph-text {
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 1.3rem;
  color: var(--accent);
  text-shadow: 0 0 8px rgba(212,175,94,0.45);
}
.lib-info { flex: 1; min-width: 0; }
.lib-name {
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 0.2rem;
  text-shadow: 0 0 6px rgba(212,175,94,0.25);
}
.lib-name--epic { color: #c9bcf8; text-shadow: 0 0 6px rgba(157,140,240,0.35); }
.lib-tag {
  font-size: 0.65rem;
  font-weight: 500;
  color: rgba(243,232,196,0.6);
  letter-spacing: 0.04em;
  margin-left: 0.4rem;
}
.lib-desc {
  font-size: 0.78rem;
  color: rgba(243,232,196,0.7);
  margin-bottom: 0.35rem;
  line-height: 1.5;
  font-style: italic;
}
.lib-meta {
  font-size: 0.7rem;
  color: rgba(212,175,94,0.55);
  line-height: 1.6;
  margin-bottom: 0.35rem;
}
.lib-meta strong { color: var(--accent); font-weight: 600; }
.lib-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.lib-stats span {
  font-size: 0.7rem;
  color: rgba(212,175,94,0.7);
  background: rgba(212,175,94,0.08);
  border: 1px solid rgba(212,175,94,0.15);
  padding: 0.1rem 0.5rem;
  border-radius: 3px;
  font-family: monospace;
}
.lib-del {
  padding: 0.3rem 0.6rem;
  background: transparent;
  border: 1px solid rgba(224,88,88,0.4);
  color: rgba(224,88,88,0.85);
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.72rem;
  flex-shrink: 0;
}
.lib-del:hover {
  background: rgba(224,88,88,0.12);
  border-color: var(--danger);
  color: var(--danger);
}

/* ============ 神谕飘字（卷轴气泡） ============ */
.oracle-toast {
  position: fixed;
  left: 50%;
  bottom: 80px;
  transform: translateX(-50%);
  max-width: 360px;
  z-index: 200;
  cursor: pointer;
}
.oracle-toast-frame {
  background: linear-gradient(135deg, rgba(212,175,94,0.18) 0%, rgba(28,30,54,0.95) 100%);
  border: 1px solid var(--accent);
  border-radius: 6px;
  padding: 0.8rem 1.2rem;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(212,175,94,0.25);
}
.oracle-toast-rune {
  font-family: var(--font-display, 'Cinzel', serif);
  font-size: 1.4rem;
  color: var(--accent);
  text-shadow: 0 0 8px rgba(212,175,94,0.6);
  flex-shrink: 0;
}
.oracle-toast-text {
  color: #f3e8c4;
  font-size: 0.85rem;
  font-family: var(--font-display, 'Cinzel', serif);
  font-style: italic;
  letter-spacing: 0.04em;
  line-height: 1.5;
}
.oracle-fade-enter-active, .oracle-fade-leave-active { transition: all 0.4s ease; }
.oracle-fade-enter-from, .oracle-fade-leave-to { opacity: 0; transform: translate(-50%, 20px); }

/* ============ 底部神谕 ============ */
.oracle-quote {
  margin-top: 0.6rem;
  font-family: var(--font-display, 'Cinzel', serif);
  font-style: italic;
  font-size: 0.76rem;
  color: rgba(212,175,94,0.55);
  letter-spacing: 0.06em;
  text-align: center;
  animation: fadeIn 0.6s var(--ease-out, ease) both;
}

/* ============ 通用动画 ============ */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (max-width: 480px) {
  .imm-rune-ring { width: 320px; height: 320px; top: 6%; }
  .hero-title { font-size: 1.4rem; }
  .parchment { padding: 1.2rem 1.1rem 1rem; }
}
</style>