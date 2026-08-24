<template>
  <div class="view-container genesis-view">
    <!-- 未二转：神谕扉页 -->
    <div v-if="!data.unlocked" class="genesis-locked">
      <div class="locked-card">
        <div class="locked-icon">📜</div>
        <h2 class="locked-title">创世之书</h2>
        <p class="locked-desc">
          "命运的扉页尚未向你展开——<br />
          当你完成第二次轮回，便可翻开此书，<br />
          以意志为笔，以虚无为墨，<br />
          为这费兰德注入只属于你的造物。"
        </p>
        <div class="locked-hint">需要 <strong>二转</strong>（转生次数 ≥ 2）才能解锁</div>
      </div>
    </div>

    <!-- 已解锁：三模式切换 -->
    <template v-else>
      <div class="genesis-tabs">
        <div class="gen-tab" :class="{ active: mode === 'monster' }" @click="mode = 'monster'">
          <span class="tab-icon">🐉</span> 降生之页
        </div>
        <div class="gen-tab" :class="{ active: mode === 'equip' }" @click="mode = 'equip'">
          <span class="tab-icon">⚒️</span> 锻造之页
        </div>
        <div class="gen-tab" :class="{ active: mode === 'library' }" @click="mode = 'library'">
          <span class="tab-icon">📖</span> 我的造物 ({{ myMonsters.length + myEquips.length }}/60)
        </div>
      </div>

      <!-- 降生之页 -->
      <div v-if="mode === 'monster'" class="gen-panel">
        <div class="gen-form">
          <div class="gen-row">
            <label class="gen-label">真名（≤{{ LIMITS.nameMax }}）</label>
            <input v-model="mDraft.name" class="gen-input" placeholder="例如：熔岩蜗牛" :maxlength="LIMITS.nameMax" />
          </div>
          <div class="gen-row">
            <label class="gen-label">神谕（≤{{ LIMITS.descMax }}）</label>
            <textarea v-model="mDraft.desc" class="gen-textarea" placeholder="描述它的来历与形态..." :maxlength="LIMITS.descMax" rows="2"></textarea>
          </div>
          <div class="gen-row">
            <label class="gen-label">血脉</label>
            <select v-model="mDraft.race" class="gen-select" @change="mDraft.skills = []">
              <option v-for="(r, key) in data.races" :key="key" :value="key">{{ r.name }}</option>
            </select>
          </div>
          <div class="gen-row">
            <label class="gen-label">特性（≤{{ data.monsterSkillsMax }}）</label>
            <div class="skill-pool">
              <div v-for="sk in availableSkills" :key="sk.id"
                class="skill-chip" :class="{ selected: mDraft.skills.includes(sk.id) }"
                @click="toggleSkill(sk.id)">
                {{ sk.name }}
              </div>
            </div>
            <div class="hint">已选 {{ mDraft.skills.length }} / {{ data.monsterSkillsMax }}</div>
          </div>
          <div class="gen-row">
            <label class="gen-label">降生之地</label>
            <select v-model="mDraft.areaId" class="gen-select">
              <option v-for="a in areas" :key="a.id" :value="a.id">{{ a.name }}（Lv.{{ a.minLevel }}）</option>
            </select>
          </div>
          <div class="gen-row">
            <label class="gen-label">属性（预算：{{ mBudget.totalBudget }}）</label>
            <div class="stat-grid">
              <div class="stat-cell">
                <span class="stat-name">生命</span>
                <input v-model.number="mDraft.hp" type="number" min="1" :max="mBudget.caps.hp" class="stat-input" :title="`上限 ${mBudget.caps.hp}`" />
              </div>
              <div class="stat-cell">
                <span class="stat-name">攻击</span>
                <input v-model.number="mDraft.atk" type="number" min="0" :max="mBudget.caps.atk" class="stat-input" :title="`上限 ${mBudget.caps.atk}`" />
              </div>
              <div class="stat-cell">
                <span class="stat-name">防御</span>
                <input v-model.number="mDraft.def" type="number" min="0" :max="mBudget.caps.def" class="stat-input" :title="`上限 ${mBudget.caps.def}`" />
              </div>
              <div class="stat-cell">
                <span class="stat-name">敏捷</span>
                <input v-model.number="mDraft.agi" type="number" min="0" :max="mBudget.caps.agi" class="stat-input" :title="`上限 ${mBudget.caps.agi}`" />
              </div>
            </div>
            <div class="hint" :class="{ over: mTotal > mBudget.totalBudget }">
              <span v-if="mTotal <= mBudget.totalBudget">剩余 <strong>{{ mBudget.totalBudget - mTotal }}</strong></span>
              <span v-else>超出 <strong>{{ mTotal - mBudget.totalBudget }}</strong></span>
            </div>
          </div>
          <div class="gen-row">
            <label class="gen-label">挂载掉落（≤{{ data.dropsMax }}）</label>
            <div class="drop-list">
              <div v-for="(d, idx) in mDraft.drops" :key="idx" class="drop-row">
                <select v-model="d.name" class="gen-select">
                  <option v-for="mat in materialNames" :key="mat" :value="mat">{{ mat }}</option>
                </select>
                <input v-model.number="d.rate" type="number" min="0.01" max="0.5" step="0.01" class="stat-input" />
                <button class="drop-del" @click="mDraft.drops.splice(idx, 1)">×</button>
              </div>
              <button v-if="mDraft.drops.length < data.dropsMax" class="drop-add" @click="addDrop">+ 追加掉落</button>
            </div>
          </div>
          <button class="gen-submit" @click="submitMonster" :disabled="!canSubmitMonster">
            <span class="submit-icon">⚡</span> 降生（消耗 {{ data.limits.monsterCostGold }} 金币）
          </button>
        </div>
      </div>

      <!-- 锻造之页 -->
      <div v-if="mode === 'equip'" class="gen-panel">
        <div class="gen-form">
          <div class="gen-row">
            <label class="gen-label">真名（≤{{ LIMITS.nameMax }}）</label>
            <input v-model="eDraft.name" class="gen-input" placeholder="例如：蜗牛之牙" :maxlength="LIMITS.nameMax" />
          </div>
          <div class="gen-row">
            <label class="gen-label">神谕（≤{{ LIMITS.descMax }}）</label>
            <textarea v-model="eDraft.desc" class="gen-textarea" placeholder="它的来历与传说..." :maxlength="LIMITS.descMax" rows="2"></textarea>
          </div>
          <div class="gen-row">
            <label class="gen-label">类型</label>
            <div class="slot-row">
              <div v-for="(s, key) in data.equipSlots" :key="key"
                class="slot-chip" :class="{ selected: eDraft.slot === key }"
                @click="eDraft.slot = key">{{ s.name }}</div>
            </div>
          </div>
          <div class="gen-row">
            <label class="gen-label">投放地图</label>
            <select v-model="eDraft.areaId" class="gen-select">
              <option v-for="a in areas" :key="a.id" :value="a.id">{{ a.name }}（Lv.{{ a.minLevel }}）</option>
            </select>
          </div>
          <div class="gen-row">
            <label class="gen-label">属性（预算 {{ eBudget.totalBudget }}，参照：{{ eBudget.refName }}）</label>
            <div class="stat-grid">
              <div v-for="(s, key) in data.equipStatKeys" :key="key" class="stat-cell">
                <span class="stat-name">{{ s.name }}</span>
                <input v-model.number="eDraft.stats[key]" type="number" min="0" class="stat-input" />
              </div>
            </div>
            <div class="hint" :class="{ over: eStatCount > data.equipStatsMax || eTotal > eBudget.totalBudget }">
              已用 {{ eStatCount }} / {{ data.equipStatsMax }} 种属性 · 总和 {{ eTotal }} / {{ eBudget.totalBudget }}
            </div>
          </div>
          <button class="gen-submit" @click="submitEquip" :disabled="!canSubmitEquip">
            <span class="submit-icon">🔥</span> 锻造（消耗 {{ data.limits.equipCostGold }} 金币）
          </button>
        </div>
      </div>

      <!-- 我的造物 -->
      <div v-if="mode === 'library'" class="gen-panel">
        <div class="library-list">
          <div v-if="myMonsters.length === 0 && myEquips.length === 0" class="library-empty">
            <p>尚未降生任何造物。翻开第一页吧。</p>
          </div>
          <div v-for="m in myMonsters" :key="m.id" class="lib-card">
            <div class="lib-icon">🐉</div>
            <div class="lib-info">
              <div class="lib-name">{{ m.name }}</div>
              <div class="lib-desc">{{ m.desc }}</div>
              <div class="lib-meta">
                出现在：<strong>{{ areaName(m.areaId) }}</strong> · 种族：<strong>{{ raceName(m.race) }}</strong>
                · 特性：<strong>{{ (m.skills || []).map(skillName).join('、') }}</strong>
              </div>
              <div class="lib-stats">
                <span>HP {{ m.hp }}</span><span>ATK {{ m.atk }}</span><span>DEF {{ m.def }}</span><span>AGI {{ m.agi }}</span>
              </div>
            </div>
            <button class="lib-del" @click="del('monsters', m.id)">抹去</button>
          </div>
          <div v-for="e in myEquips" :key="e.id" class="lib-card">
            <div class="lib-icon">{{ equipIcon(e.slot) }}</div>
            <div class="lib-info">
              <div class="lib-name epic">{{ e.name }} [史诗]</div>
              <div class="lib-desc">{{ e.desc }}</div>
              <div class="lib-meta">
                类型：<strong>{{ slotName(e.slot) }}</strong> · 需要：<strong>Lv.{{ e.reqLevel }}</strong>
              </div>
              <div class="lib-stats">
                <span v-for="(v, k) in e.stats" :key="k">{{ statName(k) }} {{ v }}</span>
              </div>
            </div>
            <button class="lib-del" @click="del('equips', e.id)">抹去</button>
          </div>
        </div>
      </div>

      <!-- 神谕飘字 -->
      <transition name="oracle-fade">
        <div v-if="lastOracle" class="oracle-toast" @click="lastOracle = ''">
          <div class="oracle-icon">📜</div>
          <div class="oracle-text">{{ lastOracle }}</div>
        </div>
      </transition>
    </template>
  </div>
</template>

<script setup>
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
// areasMap 是个以 areaId 为键的对象（与服务端引擎里 AREAS[id].monsters 形态一致）
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
  monsterBudgets: {},   // 各图怪物预算：{ areaId: { caps, totalBudget, name, minLevel } }
  equipBudgets: {},     // 各图×槽位预算：{ areaId: { weapon: { totalBudget, refName }, ... } }
});
const mode = ref('monster');
const lastOracle = ref('');
const areas = ref([]);
const materialNames = MATERIAL_NAMES;
const myMonsters = ref([]);
const myEquips = ref([]);

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
  return data.value.monsterBudgets[mDraft.areaId] || { caps: { hp: 1, atk: 0, def: 0, agi: 0 }, totalBudget: 0 };
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
function skillName(id) { return SKILL_NAME[id] || id; }
function areaName(id) { return (areasMap[id] || {}).name || id; }
function raceName(key) { return (data.value.races[key] || {}).name || key; }
function slotName(key) { return (data.value.equipSlots[key] || {}).name || key; }
function statName(key) { return (data.value.equipStatKeys[key] || {}).name || key; }
function equipIcon(slot) { return slot === 'weapon' ? '⚔️' : slot === 'armor' ? '🛡️' : '💍'; }

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
    // 把数组形式转换为以 id 为键的对象（保留 order 用于 select）
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
.genesis-view { background: linear-gradient(180deg, #1a0e2a 0%, #0d0518 100%); color: #d8c5a8; min-height: 100%; padding: 16px; }
.genesis-locked { display:flex; justify-content:center; padding:40px 0; }
.locked-card { max-width:380px; text-align:center; padding:32px 24px; background:rgba(255,255,255,0.04); border:1px solid rgba(212,175,94,0.3); border-radius:8px; }
.locked-icon { font-size:48px; margin-bottom:12px; }
.locked-title { color:#d4af5e; margin:8px 0 16px; font-size:20px; letter-spacing:4px; }
.locked-desc { line-height:1.9; color:#a89878; font-size:14px; }
.locked-hint { margin-top:18px; color:#d4af5e; font-size:13px; }

.genesis-tabs { display:flex; gap:8px; margin-bottom:16px; padding:6px; background:rgba(0,0,0,0.3); border-radius:8px; }
.gen-tab { flex:1; padding:10px; text-align:center; cursor:pointer; border-radius:6px; color:#a89878; font-size:13px; transition: all .2s; }
.gen-tab.active { background:#3a2848; color:#d4af5e; }
.gen-tab .tab-icon { margin-right:4px; }

.gen-panel { padding:8px; }
.gen-form { display:flex; flex-direction:column; gap:14px; }
.gen-row { display:flex; flex-direction:column; gap:6px; }
.gen-label { font-size:12px; color:#d4af5e; letter-spacing:1px; }
.gen-input, .gen-select, .gen-textarea { background:rgba(0,0,0,0.4); border:1px solid rgba(212,175,94,0.3); color:#d8c5a8; padding:8px 10px; border-radius:4px; font-size:13px; }
.gen-textarea { resize:vertical; min-height:48px; }
.hint { font-size:11px; color:#888; }
.hint.over { color:#ff7d7d; }

.skill-pool { display:flex; flex-wrap:wrap; gap:6px; }
.skill-chip { padding:5px 10px; background:rgba(255,255,255,0.06); border:1px solid rgba(212,175,94,0.2); border-radius:14px; font-size:12px; cursor:pointer; }
.skill-chip.selected { background:#5e3a7a; border-color:#d4af5e; color:#fff; }

.stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
.stat-cell { display:flex; align-items:center; gap:4px; background:rgba(0,0,0,0.3); padding:6px; border-radius:4px; }
.stat-name { font-size:11px; color:#a89878; min-width:24px; }
.stat-input {
  width:100%; min-width:0; background:transparent; border:none; color:#d8c5a8;
  font-size:14px; outline:none; text-align:center;
  /* 隐藏 number 输入框的 ± 上下箭头 */
  -moz-appearance: textfield;
  appearance: textfield;
}
.stat-input::-webkit-outer-spin-button,
.stat-input::-webkit-inner-spin-button {
  -webkit-appearance: none; margin: 0;
}
.stat-cap { font-size:10px; color:#666; }

.drop-list { display:flex; flex-direction:column; gap:6px; }
.drop-row { display:flex; align-items:center; gap:6px; }
.drop-del, .drop-add { background:transparent; border:1px solid rgba(212,175,94,0.3); color:#d4af5e; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:12px; }

.slot-row { display:flex; gap:6px; }
.slot-chip { padding:8px 16px; background:rgba(255,255,255,0.06); border:1px solid rgba(212,175,94,0.2); border-radius:6px; cursor:pointer; font-size:13px; }
.slot-chip.selected { background:#5e3a7a; border-color:#d4af5e; }

.gen-submit { margin-top:8px; padding:12px; background:linear-gradient(135deg, #5e3a7a, #2c1a3e); border:1px solid #d4af5e; color:#fff; font-size:14px; border-radius:6px; cursor:pointer; letter-spacing:2px; }
.gen-submit:disabled { opacity:0.4; cursor:not-allowed; }
.submit-icon { margin-right:6px; }

.library-list { display:flex; flex-direction:column; gap:10px; }
.library-empty { text-align:center; padding:40px; color:#777; }
.lib-card { display:flex; gap:12px; padding:12px; background:rgba(255,255,255,0.04); border:1px solid rgba(212,175,94,0.2); border-radius:6px; }
.lib-icon { font-size:32px; }
.lib-info { flex:1; min-width:0; }
.lib-name { font-size:15px; color:#d4af5e; font-weight:600; margin-bottom:4px; }
.lib-name.epic { color:#9d8cf0; }
.lib-desc { font-size:12px; color:#a89878; margin-bottom:6px; }
.lib-meta { font-size:11px; color:#888; line-height:1.6; }
.lib-stats { font-size:11px; color:#a89878; margin-top:4px; display:flex; gap:10px; flex-wrap:wrap; }
.lib-stats span { background:rgba(212,175,94,0.1); padding:2px 6px; border-radius:3px; }
.lib-del { align-self:flex-start; padding:6px 12px; background:transparent; border:1px solid #a04040; color:#ff7d7d; border-radius:4px; cursor:pointer; font-size:12px; }

.oracle-toast { position:fixed; left:50%; bottom:80px; transform:translateX(-50%); background:rgba(20,12,30,0.95); border:1px solid #d4af5e; border-radius:8px; padding:14px 20px; max-width:360px; cursor:pointer; box-shadow:0 8px 32px rgba(0,0,0,0.5); z-index:100; }
.oracle-icon { font-size:20px; margin-bottom:4px; }
.oracle-text { color:#d4af5e; font-size:13px; line-height:1.7; font-style:italic; }
.oracle-fade-enter-active, .oracle-fade-leave-active { transition: all .4s ease; }
.oracle-fade-enter-from, .oracle-fade-leave-to { opacity:0; transform: translate(-50%, 20px); }
</style>