<template>
  <!-- v2.7：创世之书统一为全局风格——去掉沉浸背景层，使用普通 card 容器 -->
  <div class="genesis-screen">
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
          </button>
          <button class="parch-tab-refresh" type="button" @click="init" title="刷新造物列表">⟳</button>
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
                  <select v-model="d.kind" class="parchment-select drop-kind">
                    <option value="material">材料</option>
                    <option value="equip" :disabled="availableDropsForArea.equips.length === 0">
                      自创装备（{{ availableDropsForArea.equips.length }}）
                    </option>
                  </select>
                  <select v-model="d.name" class="parchment-select drop-select">
                    <option v-if="d.kind === 'material'" v-for="mat in materialNames" :key="mat" :value="mat">{{ mat }}</option>
                    <option v-else v-for="eq in availableDropsForArea.equips" :key="eq.id" :value="eq.id">
                      {{ eq.name }}（[{{ qualityName(eq.quality) }}] · {{ slotName(eq.slot) }}）
                    </option>
                  </select>
                  <!-- v2.7：移除掉率输入框，由后端全局常量决定 -->
                  <span class="drop-rate-hint" :title="d.kind === 'equip' ? '自创装备默认 3% 掉落' : '自创材料默认 5% 掉落'">
                    {{ d.kind === 'equip' ? '3%' : '5%' }}
                  </span>
                  <button type="button" class="btn-mini drop-del" @click="mDraft.drops.splice(idx, 1)" aria-label="移除掉落">×</button>
                </div>
                <button
                  v-if="mDraft.drops.length < data.dropsMax"
                  type="button"
                  class="btn btn-ghost btn-sm"
                  @click="addDrop"
                >
                  + 追加掉落
                </button>
              </div>
            </div>

            <div class="parchment-actions">
              <button
                class="btn btn-primary submit-btn"
                @click="submitMonster"
                :disabled="!canSubmitMonster"
              >
                <span class="submit-icon">⚡</span>
                <span class="submit-text">降生（{{ data.limits.monsterCostGold }} 金币）</span>
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
              <label class="field-label">✦ 品质</label>
              <div class="slot-row slot-row--quality">
                <button
                  v-for="q in (data.equipQualityChoices || ['epic'])"
                  :key="q"
                  type="button"
                  class="race-mini quality-mini"
                  :class="{ 'is-active': eDraft.quality === q, 'is-locked': qualityLocked(q, eDraft.areaId) }"
                  :style="{ '--qc': qualityColor(q) }"
                  @click="if (!qualityLocked(q, eDraft.areaId)) eDraft.quality = q;"
                >
                  <span class="race-mini-name" :style="eDraft.quality === q ? { color: qualityColor(q) } : null">
                    {{ qualityName(q) }}
                    <template v-if="qualityMinLv(q) > 1">· Lv{{ qualityMinLv(q) }}图</template>
                  </span>
                  <span v-if="qualityLocked(q, eDraft.areaId)" class="quality-lock">🔒</span>
                </button>
              </div>
              <p class="field-hint">品质越高属性预算越充足（传说 1.4× · 神话 2×），但需要投放到更高等级的地图。</p>
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
                <span v-if="eBudget.growthFrom" class="budget-growth-tag" :class="'growth-' + eBudget.growthFrom">
                  {{ eBudget.growthFrom === 'system' ? '系统基础 ×1.1' :
                     eBudget.growthFrom === 'previous' ? '上次最强 ×1.1' :
                     '已达 10× 上限' }}
                </span>
                <span v-if="eBudget.previousMax" class="budget-prev-tag">
                  世界最强：{{ eBudget.previousMax }} → 本次：{{ eBudget.totalBudget }}
                </span>
                <span v-else-if="eBudget.systemMax" class="budget-prev-tag">
                  系统最强：{{ eBudget.systemMax }} → 本次：{{ eBudget.totalBudget }}
                </span>
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
                class="btn btn-primary submit-btn"
                @click="submitEquip"
                :disabled="!canSubmitEquip"
              >
                <span class="submit-icon">⚡</span>
                <span class="submit-text">锻造（{{ data.limits.equipCostGold }} 金币）</span>
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
                  <span v-if="m.creator || m.creatorUsername" class="lib-creator-tag" :title="`造物主：${displayCreator(m)}`">{{ displayCreator(m) }}造</span>
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
              <button type="button" class="btn-mini lib-del" @click="del('monsters', m.id)">抹去</button>
            </div>

            <div v-for="e in myEquips" :key="e.id" class="lib-card">
              <div class="lib-glyph">
                <span class="lib-glyph-text">{{ equipGlyph(e.slot) }}</span>
              </div>
              <div class="lib-info">
                <div class="lib-name lib-name--epic">
                  「 {{ e.name }} 」 <span :style="{ color: qualityColor(e.quality) }">[{{ qualityName(e.quality) }}]</span>
                  <span class="lib-tag">类型 · {{ slotName(e.slot) }}</span>
                  <span v-if="e.creator || e.creatorUsername" class="lib-creator-tag" :title="`造物主：${displayCreator(e)}`">{{ displayCreator(e) }}造</span>
                </div>
                <div class="lib-desc">{{ e.desc || '（未写神谕）' }}</div>
                <div class="lib-meta">投放于 <strong>{{ areaName(e.areaId) }}</strong> · 需要 <strong>Lv.{{ e.reqLevel }}</strong></div>
                <div class="lib-worldstate">
                  <span :class="['ws-tag', e.worldState === 'committed' ? 'ws-committed' : 'ws-pending']">
                    {{ e.worldState === 'committed' ? '✦ 已投入世界（作为怪物掉落）' : '◇ 待投入（需被怪物挂为掉落）' }}
                  </span>
                </div>
                <div class="lib-stats">
                  <span v-for="(v, k) in e.stats" :key="k">{{ statName(k) }} +{{ v }}</span>
                </div>
              </div>
              <button type="button" class="btn-mini lib-del" @click="del('equips', e.id)">抹去</button>
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
import { ref, reactive, computed, onMounted, watch, inject } from 'vue';
import api from '../api.js';
import { toast } from '../ui-bridge.js';

// v2.2：从 App 注入全服玩家名册 { username -> name }，用于把"造物主"解析成真名
const playerNameMap = inject('playerNameMap', ref({}));
const refreshPlayerNameMap = inject('refreshPlayerNameMap', () => {});

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

// v2.7：去掉 count 字段（"我的造物有限制"由后端 LIMITS 校验即可，不在前端显示 /60）
const tabs = computed(() => [
  { key: 'monster', label: '降生之页', glyph: '✦' },
  { key: 'equip', label: '锻造之页', glyph: '⛊' },
  { key: 'library', label: '我的造物', glyph: '✧' },
]);

const mDraft = reactive({
  name: '', desc: '', areaId: 'gaomanshan', race: 'dragon', skills: [],
  hp: 10, atk: 3, def: 1, agi: 3,
  drops: [{ kind: 'material', name: '草药' }],
});
const eDraft = reactive({
  name: '', desc: '', areaId: 'gaomanshan', slot: 'weapon', quality: 'epic',
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
  const slotBudgets = areaBudgets[eDraft.slot] || {};
  return slotBudgets[eDraft.quality] || { totalBudget: 0, refName: '无参照' };
});

// v2.1：当前怪物页签选中的地图里，所有可作为掉落的自创装备
const availableDropsForArea = computed(() => {
  const equips = (data.value.equipsByArea && data.value.equipsByArea[mDraft.areaId]) || [];
  return { equips };
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
  if (eBudget.value.totalBudget > 0 && eTotal.value > eBudget.value.totalBudget) return false;
  // 高端品质要求目标图等级达标（legend ≥90 / mythic ≥180）
  const area = areasMap[eDraft.areaId];
  if (area && (data.value.equipQualityMinLevel || {})[eDraft.quality]) {
    if ((area.minLevel || 0) < data.value.equipQualityMinLevel[eDraft.quality]) return false;
  }
  return true;
});

// 自创装备品质（史诗/传说/神话）
const QUALITY_LABELS = { epic: '史诗', legend: '传说', mythic: '神话' };
const QUALITY_COLORS = { epic: '#9d8cf0', legend: '#d4af5e', mythic: '#ff6738' };
function qualityName(q) { return QUALITY_LABELS[q] || q; }
function qualityColor(q) { return QUALITY_COLORS[q] || '#9d8cf0'; }
function qualityMinLv(q) { return (data.value.equipQualityMinLevel || {})[q] || 1; }
function qualityLocked(q, areaId) {
  const area = areasMap[areaId];
  if (!area) return false;
  return (area.minLevel || 0) < qualityMinLv(q);
}

function toggleSkill(id) {
  const idx = mDraft.skills.indexOf(id);
  if (idx >= 0) mDraft.skills.splice(idx, 1);
  else if (mDraft.skills.length < data.value.monsterSkillsMax) mDraft.skills.push(id);
}
function addDrop() { mDraft.drops.push({ kind: 'material', name: materialNames[0] }); }
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

// v2.2 显示用：把 creatorUsername（账号）解析成"游戏内的真名"展示
//   规则：账号 === 当前玩家.username → 用 player.name；其它账号 → 用全服名册 playerNameMap 反查
function displayCreator(item) {
  const owner = item?.creatorUsername || item?.creator;
  if (!owner) return '';
  // 自己的：直接用 props.player.name（避免名册延迟导致显示回账号）
  if (owner === props.player?.username) {
    return props.player?.name || owner;
  }
  // 别人的：从全服名册反查（注入自 App.vue）
  const fromMap = playerNameMap.value && playerNameMap.value[owner];
  return (fromMap && fromMap.name) || owner;
}

// v2.2 兼容：creator 可能存的是 player.name 也可能是 player.username（旧数据）
// 同时也兼容未来 creatorUsername 字段（万一以后改名）
function isMineCreator(item) {
  const aliases = new Set([props.player?.username, props.player?.name].filter(Boolean));
  if (aliases.has(item.creator)) return true;
  if (!item.creator && item.creatorUsername && aliases.has(item.creatorUsername)) return true;
  return false;
}
async function refreshFromServer() {
  const username = props.player?.username;
  if (!username) return;
  const r = await api.getGenesis(username);
  if (r && r.success) {
    data.value = { ...data.value, ...r.data };
    myMonsters.value = (r.data.monsters || []).filter(isMineCreator);
    myEquips.value   = (r.data.equips   || []).filter(isMineCreator);
    console.log('[Genesis] myMonsters=', myMonsters.value.length, 'myEquips=', myEquips.value.length,
      'username=', username, 'name=', props.player?.name);
  }
  const aRes = await api.getAreas();
  if (aRes && aRes.success) {
    const list = aRes.data || [];
    for (const a of list) areasMap[a.id] = a;
    areas.value = [...list].sort((a, b) => a.minLevel - b.minLevel);
  }
}
async function init() { return refreshFromServer(); }
onMounted(refreshFromServer);
// 切换账号 / props.player 重新指向新对象时，重新拉数据
watch(() => props.player?.username, (u) => { if (u) init(); });

async function submitMonster() {
  const r = await api.birthMonster(props.player.username, { ...mDraft });
  if (r && r.success) {
    showOracle(r.data.oracle);
    myMonsters.value.push(r.data.monster);
    props.player.gold = r.data.player.gold;
    // v2.1：怪物降生后若有装备掉落被挂上 → 装备 commit 到世界
    // 重新拉取数据以更新 equipsMax / equipBudgets / equipsByArea
    await refreshFromServer();
    refreshPlayerNameMap();   // v2.2：刷新名册
    mode.value = 'library';   // 切到"我的造物"看到新怪物 + 装备状态
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
    await refreshFromServer();
    refreshPlayerNameMap();   // v2.2：刷新名册
    mode.value = 'library';   // 自动切到"我的造物"页签让玩家看到新装备
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
/* ============ v2.7：创世之书统一全局风格 ============ */
.genesis-screen {
  position: relative;
  min-height: 100%;
  /* v1.03：底部预留 fixed TabBar 高度（含 iOS 安全区 + 悬浮底栏检测值） */
  padding-bottom: calc(var(--tabbar-h) + var(--safe-bottom) + var(--browser-bar-h, 0px) + 0.75rem);
}
.genesis-scroll {
  position: relative;
  z-index: 1;
}

/* 神谕扉页（未二转） */
.locked-hero {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--muted);
}
.hero-rune {
  width: 56px; height: 56px;
  margin: 0 auto 1rem;
  border: 1px dashed rgba(var(--gold-rgb),0.4);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.hero-rune-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 10px rgba(var(--gold-rgb),0.6);
}
.hero-title { font-size: 1.5rem; font-weight: 700; color: var(--text); margin-bottom: 0.4rem; }
.hero-title-main { color: var(--accent); }
.hero-subtitle { font-size: 0.88rem; color: var(--muted); margin-bottom: 1rem; line-height: 1.6; }
.hero-oracle {
  font-size: 0.88rem;
  color: var(--muted);
  line-height: 1.7;
  margin: 1rem auto;
  max-width: 28rem;
}
.locked-hint {
  margin-top: 1.5rem;
  padding: 0.6rem 1rem;
  background: rgba(var(--gold-rgb),0.08);
  border: 1px dashed rgba(var(--gold-rgb),0.3);
  border-radius: 6px;
  color: var(--accent);
  font-size: 0.88rem;
  display: inline-block;
}

/* 已解锁：英雄区 */
.unlocked-hero { text-align: center; padding: 1.5rem 1rem 0.8rem; }
.unlocked-hero .hero-rune { width: 42px; height: 42px; margin-bottom: 0.6rem; }
.unlocked-hero .hero-title { font-size: 1.25rem; }
.unlocked-hero .hero-subtitle { margin-bottom: 0; font-size: 0.82rem; }

/* 三模式切换：复用全局 tab 风格 */
/* v2.7：tabs 与卡片与页面边缘齐平（去掉 margin: 0 1rem） */
/* v2.7 fix：3 个 Tab 等分剩余空间，⟳ 刷新按钮固定在右端 32px */
.parchment-tabs { display: flex; gap: 0.4rem; margin: 0 0 0.6rem; padding: 0 0.9rem; flex-wrap: wrap; align-items: center; }
.parch-tab {
  display: flex; flex-direction: column; align-items: center;
  gap: 0.1rem;
  padding: 0.4rem 0.6rem;
  background: rgba(var(--panel2-rgb),0.6);
  border: 1px solid rgba(var(--violet-rgb),0.18);
  border-radius: 6px;
  color: var(--muted);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.78rem;
  transition: all var(--duration-normal) var(--ease-out);
  flex: 1 1 0;          /* 等分剩余宽度 */
  min-width: 0;         /* 允许收缩（防止内容溢出撑爆） */
}
.parch-tab:hover { color: var(--accent2); border-color: rgba(var(--violet-rgb),0.4); }
.parch-tab.is-active {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(var(--gold-rgb),0.10);
}
.parch-tab-glyph { font-size: 1rem; line-height: 1; }
.parch-tab-text { font-weight: 600; }
.parch-tab-refresh {
  flex: 0 0 32px;       /* v2.7 fix：固定 32px，不参与等分 */
  width: 32px; height: 32px;
  background: rgba(var(--panel2-rgb),0.6);
  border: 1px solid rgba(var(--violet-rgb),0.18);
  border-radius: 50%;
  color: var(--accent);
  font-size: 1rem;
  cursor: pointer;
  align-self: center;
  transition: all var(--duration-normal) var(--ease-out);
}
.parch-tab-refresh:hover { background: rgba(var(--gold-rgb),0.15); }

/* 卷轴卡片：复用全局 .card 风格 */
/* v2.7：去掉左右 margin，让卡片与页面边缘齐平 */
.parchment {
  margin: 0 0 0.9rem;
  padding: 1rem;
  background: linear-gradient(135deg, rgba(var(--panel2-rgb),0.65), rgba(var(--panel-rgb),0.55));
  backdrop-filter: blur(12px);
  border: 1px solid rgba(var(--violet-rgb),0.1);
  border-radius: var(--radius);
  position: relative;
}
.parchment-inner { position: relative; }
.parchment-inner::before { content: '✦'; position: absolute; top: -0.3rem; left: -0.2rem; color: var(--accent); font-size: 0.9rem; opacity: 0.7; }
.parchment-inner::after { content: '✦'; position: absolute; bottom: -0.3rem; right: -0.2rem; color: var(--accent); font-size: 0.9rem; opacity: 0.7; }

/* 表单头部 / 字段 */
.form-intro {
  display: flex; flex-direction: column; align-items: center; gap: 0.3rem;
  margin-bottom: 1rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid rgba(var(--gold-rgb),0.15);
}
.form-intro-line { font-size: 0.82rem; color: var(--muted); }
.form-intro-name { font-size: 1.05rem; font-weight: 700; color: var(--accent); }

.field { margin-bottom: 0.9rem; width: 100%; }
.field-label {
  display: block;
  font-size: 0.82rem;
  color: var(--muted);
  margin-bottom: 0.35rem;
  font-weight: 600;
}
.field-hint {
  font-size: 0.82rem;
  color: var(--dim);
  margin-top: 0.4rem;
  line-height: 1.5;
  padding: 0.5rem 0.7rem;
  background: rgba(var(--panel2-rgb),0.4);
  border-radius: 4px;
  border: 1px solid rgba(var(--violet-rgb),0.1);
}
.field-hint strong { color: var(--accent); font-weight: 600; }
.field-hint.is-invalid {
  color: #e05858;
  background: rgba(224,88,88,0.08);
  border-color: rgba(224,88,88,0.3);
}
.field-hint.is-invalid strong { color: #ff8866; }
.field-row {
  display: flex; align-items: center;
  width: 100%;
  background: rgba(8,8,14,0.55);
  border-bottom: 1px solid rgba(var(--gold-rgb),0.25);
  padding: 0.5rem 0.7rem;
  border-radius: 4px 4px 0 0;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
}
.field-row.is-focus { border-bottom-color: var(--accent); }
.field-row.is-valid { border-bottom-color: var(--accent); }
.parchment-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-size: 0.92rem;
  font-family: inherit;
  padding: 0;
}
.parchment-input::placeholder { color: var(--dim); }
.field-icon { margin-left: 0.4rem; color: var(--accent); font-size: 0.9rem; }

.parchment-textarea {
  width: 100%;
  background: rgba(8,8,14,0.55);
  border: 1px solid rgba(var(--gold-rgb),0.2);
  border-radius: 4px;
  color: var(--text);
  font-size: 0.88rem;
  font-family: inherit;
  padding: 0.5rem 0.7rem;
  resize: vertical;
  min-height: 60px;
  line-height: 1.5;
}
.parchment-textarea:focus { outline: none; border-color: var(--accent); }

.parchment-select {
  width: 100%;
  background: rgba(8,8,14,0.55);
  border: 1px solid rgba(var(--gold-rgb),0.2);
  border-radius: 4px;
  color: var(--text);
  font-size: 0.88rem;
  padding: 0.5rem 0.6rem;
  font-family: inherit;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M0 0 L5 6 L10 0 Z' fill='%23d4af5e'/></svg>");
  background-repeat: no-repeat;
  background-position: right 0.6rem center;
  padding-right: 1.6rem;
}
.parchment-select:focus { outline: none; border-color: var(--accent); }

/* 种族 / 特性 / 附魔网格 */
/* v2.7：血脉 / 类型 / 品质统一用 .race-mini 风格 */
/* v2.7 fix：血脉容器是 .race-pool（不是 .race-grid），两种都设为 4 列网格 */
.race-grid,
.race-pool { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.4rem; margin-top: 0.3rem; }
.slot-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; margin-top: 0.3rem; }
.slot-row--quality { grid-template-columns: repeat(5, 1fr); }

.race-mini {
  display: flex; flex-direction: column; align-items: center;
  gap: 0.2rem;
  padding: 0.5rem 0.3rem;
  background: rgba(8,8,14,0.5);
  border: 1px solid rgba(var(--gold-rgb),0.15);
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  color: var(--muted);
  transition: all var(--duration-normal) var(--ease-out);
  position: relative;
}
.race-mini:hover {
  border-color: rgba(var(--violet-rgb),0.4);
  transform: translateY(-1px);
  color: var(--text);
}
.race-mini.is-active {
  background: rgba(var(--gold-rgb),0.12);
  border-color: var(--accent);
  color: var(--accent);
}
.race-mini.is-locked { opacity: 0.5; cursor: not-allowed; }
.race-mini.is-locked:hover { transform: none; border-color: rgba(var(--gold-rgb),0.15); }

.race-mini-glyph { font-size: 1.3rem; line-height: 1; color: var(--accent2); }
.race-mini.is-active .race-mini-glyph { color: var(--accent); }
.race-mini-name { font-size: 0.78rem; font-weight: 600; }
.quality-mini { border-color: rgba(var(--gold-rgb),0.15); }
.quality-mini.is-active { border-color: var(--qc, var(--accent)); color: var(--qc, var(--accent)); }
.quality-lock { position: absolute; top: 2px; right: 3px; font-size: 0.65rem; opacity: 0.7; }

.skill-grid { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.skill-chip {
  padding: 0.3rem 0.6rem;
  background: rgba(var(--violet-rgb),0.08);
  border: 1px solid rgba(var(--violet-rgb),0.25);
  border-radius: 999px;
  font-size: 0.72rem;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.skill-chip:hover { color: var(--accent2); border-color: var(--accent2); }
.skill-chip.selected { background: rgba(var(--gold-rgb),0.18); color: var(--accent); border-color: var(--accent); }

/* 四维属性 */
.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; }
.stat-cell { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
.stat-name { font-size: 0.78rem; color: var(--muted); font-weight: 600; letter-spacing: 0.02em; }
.stat-label { font-size: 0.78rem; color: var(--muted); font-weight: 600; letter-spacing: 0.02em; }
.stat-input {
  width: 100%;
  text-align: center;
  background: rgba(8,8,14,0.55);
  border: 1px solid rgba(var(--gold-rgb),0.2);
  border-radius: 4px;
  color: var(--accent);
  font-size: 1rem;
  font-weight: 600;
  padding: 0.45rem 0.3rem;
  font-family: monospace;
}
.stat-input:focus { outline: none; border-color: var(--accent); background: rgba(var(--panel-rgb),0.8); }
.stat-summary { display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--muted); margin-top: 0.5rem; padding-top: 0.4rem; border-top: 1px dashed rgba(var(--gold-rgb),0.15); }
.stat-summary strong { color: var(--accent); font-weight: 600; }

/* 掉落列表 */
.drop-list { display: flex; flex-direction: column; gap: 0.4rem; }
.drop-row {
  display: grid;
  grid-template-columns: 1fr 80px 56px 28px;
  gap: 0.4rem;
  align-items: center;
}
.drop-select { background: rgba(8,8,14,0.55); }
.drop-rate-hint {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 0.5rem;
  font-size: 0.78rem;
  font-weight: 600;
  font-family: monospace;
  color: #5eda7a;
  background: rgba(94,218,122,0.10);
  border: 1px solid rgba(94,218,122,0.3);
  border-radius: 4px;
  cursor: help;
}

.drop-add-btn {
  margin-top: 0.4rem;
  padding: 0.4rem 0.8rem;
  background: transparent;
  border: 1px dashed rgba(var(--gold-rgb),0.3);
  border-radius: 4px;
  color: var(--accent);
  font-size: 0.78rem;
  cursor: pointer;
  font-family: inherit;
}
.drop-add-btn:hover { background: rgba(var(--gold-rgb),0.08); border-style: solid; }
.drop-del {
  width: 28px; height: 28px;
  background: transparent;
  border: 1px solid rgba(224,88,88,0.3);
  border-radius: 4px;
  color: #e05858;
  cursor: pointer;
  font-size: 0.85rem;
}
.drop-del:hover { background: rgba(224,88,88,0.15); }

/* 提交按钮（主操作） */
.submit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  margin-top: 0.8rem;
  padding: 0.65rem;
  background: linear-gradient(135deg, rgba(var(--gold-rgb),0.18), rgba(var(--violet-rgb),0.12));
  border: 1px solid var(--accent);
  border-radius: 6px;
  color: var(--accent);
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: 0.05em;
  transition: all 0.15s;
}
.submit-icon { font-size: 1.05rem; line-height: 1; }
.submit-text { line-height: 1; }
.submit-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(var(--gold-rgb),0.28), rgba(var(--violet-rgb),0.18));
  transform: translateY(-1px);
}
.submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* "我的造物"卡片 */
.lib-card {
  display: flex;
  gap: 0.7rem;
  padding: 0.8rem;
  margin-bottom: 0.6rem;
  background: rgba(var(--panel2-rgb),0.5);
  border: 1px solid rgba(var(--violet-rgb),0.12);
  border-radius: 8px;
  position: relative;
  transition: all 0.15s;
}
.lib-card:hover { border-color: rgba(var(--gold-rgb),0.3); }
.lib-glyph {
  width: 48px; height: 48px;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(var(--violet-rgb),0.1);
  border: 1px solid rgba(var(--violet-rgb),0.2);
  border-radius: 8px;
}
.lib-glyph-text { font-size: 1.4rem; color: var(--accent2); }
.lib-info { flex: 1; min-width: 0; }
.lib-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 0.25rem;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.lib-name--epic { color: #c9bcf8; }
.lib-tag {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--muted);
  margin-left: 0.2rem;
  padding: 1px 5px;
  background: rgba(var(--violet-rgb),0.12);
  border-radius: 4px;
}
.lib-creator-tag {
  display: inline-block;
  padding: 1px 6px;
  font-size: 0.68rem;
  font-weight: 600;
  background: rgba(var(--gold-rgb),0.12);
  border: 1px solid rgba(var(--gold-rgb),0.3);
  border-radius: 4px;
  color: var(--accent);
  vertical-align: middle;
}
.lib-desc { font-size: 0.82rem; color: var(--muted); margin-bottom: 0.35rem; line-height: 1.5; }
.lib-meta { font-size: 0.78rem; color: var(--dim); line-height: 1.6; margin-bottom: 0.35rem; }
.lib-meta strong { color: var(--accent); font-weight: 600; }
.lib-worldstate { margin-bottom: 0.4rem; }
.ws-tag {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 600;
}
.ws-pending { background: rgba(var(--violet-rgb),0.15); color: var(--accent2); border: 1px solid rgba(var(--violet-rgb),0.3); }
.ws-committed { background: rgba(var(--gold-rgb),0.15); color: var(--accent); border: 1px solid rgba(var(--gold-rgb),0.4); }
.lib-stats { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.lib-stats span {
  font-size: 0.75rem;
  color: var(--accent);
  background: rgba(var(--gold-rgb),0.08);
  padding: 1px 6px;
  border-radius: 4px;
}
.lib-del {
  align-self: flex-start;
  background: transparent;
  border: 1px solid rgba(224,88,88,0.3);
  border-radius: 4px;
  color: #e05858;
  padding: 0.3rem 0.5rem;
  font-size: 0.78rem;
  cursor: pointer;
  font-family: inherit;
}
.lib-del:hover { background: rgba(224,88,88,0.15); }
.lib-empty { text-align: center; padding: 2rem 1rem; color: var(--muted); font-size: 0.88rem; }
.lib-empty-glyph { font-size: 2rem; opacity: 0.4; display: block; margin-bottom: 0.5rem; }

/* 神谕飘字 */
.oracle-quote {
  margin: 1.2rem auto 0;
  padding: 1rem 1.2rem;
  max-width: 32rem;
  background: linear-gradient(135deg, rgba(var(--panel2-rgb),0.6), rgba(var(--panel-rgb),0.45));
  border: 1px solid rgba(var(--gold-rgb),0.2);
  border-radius: 8px;
  color: var(--accent);
  font-size: 0.95rem;
  line-height: 1.7;
  text-align: center;
  font-weight: 500;
}
.oracle-toast {
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1200;
  animation: fadeIn 0.3s ease-out;
}
.oracle-toast-frame {
  padding: 0.9rem 1.5rem;
  background: linear-gradient(135deg, rgba(var(--panel2-rgb),0.95), rgba(var(--panel-rgb),0.92));
  border: 1px solid var(--accent);
  border-radius: 8px;
  color: var(--text);
  text-align: center;
  box-shadow: 0 0 16px rgba(var(--gold-rgb),0.25);
}
.oracle-toast-rune { font-size: 1.4rem; color: var(--accent); margin-bottom: 0.2rem; }
.oracle-toast-text { font-size: 0.95rem; line-height: 1.6; color: var(--text); }

/* 一键合成弹窗（v2.4） */
.bulk-merge-list { display: flex; flex-direction: column; gap: 0.3rem; margin: 0.4rem 0; max-height: 50vh; overflow-y: auto; }
.bulk-merge-row {
  display: grid;
  grid-template-columns: 1.2rem auto 1fr auto 1fr auto;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.6rem;
  background: rgba(var(--panel-rgb),0.55);
  border: 1px solid var(--rule);
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s;
}
.bulk-merge-row:hover { border-color: rgba(var(--gold-rgb),0.4); }
.bulk-merge-row.active { background: rgba(var(--gold-rgb),0.12); border-color: var(--accent); }
.bulk-merge-check { font-size: 0.95rem; color: var(--accent); text-align: center; }
.bulk-merge-quality { font-weight: 600; font-size: 0.88rem; }
.bulk-merge-slot { color: var(--muted); font-size: 0.78rem; }
.bulk-merge-arrow { color: var(--muted); }
.bulk-merge-next { font-weight: 600; font-size: 0.88rem; }
.bulk-merge-count { color: var(--accent2); font-size: 0.78rem; font-family: monospace; }

/* 响应式 */
@media (max-width: 480px) {
  .hero-title { font-size: 1.4rem; }
  .parchment { padding: 0.9rem 0.7rem; }
  .parchment-tabs { padding: 0 0.7rem; }
  .race-grid { grid-template-columns: repeat(2, 1fr); }
  .slot-row { grid-template-columns: repeat(3, 1fr); }
  .slot-row--quality { grid-template-columns: repeat(5, 1fr); }
}
</style>
