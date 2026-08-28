<template>
  <!-- 职业区块 -->
  <div class="job-section card">
    <div class="section-header" @click="toggleSection('job')">
      <span><IconBase name="star" :size="14" class="section-icon" /> 职业</span>
      <span class="toggle-icon">{{ openSections.job ? '▾' : '▸' }}</span>
    </div>
    <div v-if="openSections.job" class="job-content">
      <!-- A. 未选职业 + Lv.11 已达：显示选择卡 -->
      <div v-if="!player.jobPath && player.canChooseJob">
        <p class="sub-tip">达到 Lv.11，请在灵性之海中构建你的职业</p>
        <div class="job-cards">
          <div
            v-for="job in Object.values(jobTree)"
            :key="job.id"
            class="job-card-mini"
            :class="{ selected: selectedJob === job.id }"
            @click="selectedJob = job.id"
          >
            <div class="job-card-icon">{{ job.icon || jobIcons[job.id] }}</div>
            <div class="job-card-name">{{ job.name }}</div>
            <div class="job-card-desc">{{ job.desc }}</div>
          </div>
        </div>
        <button
          v-if="selectedJob"
          class="btn btn-primary confirm-job-btn"
          @click="$emit('chooseJob', selectedJob)"
        >确认选择：{{ jobTree[selectedJob]?.name }}</button>
      </div>
      <!-- B. 未选职业 + 未到 Lv.11：锁定提示 -->
      <div v-else-if="!player.jobPath && !player.canChooseJob" class="job-locked-hint">
        <p>需要达到 Lv.11 才能选择职业方向</p>
        <p class="job-progress">当前等级: Lv.{{ player.level }} / 11</p>
      </div>
      <!-- C. 已选职业：成长 + 天赋 + 机制 + 进阶路线 -->
      <div v-else-if="player.jobPath">
        <div class="job-current">
          <span class="job-path-name">{{ player.jobInfo?.icon }} {{ player.jobInfo?.pathName }}</span>
          <span class="job-current-name">{{ player.job }}</span>
        </div>
        <div class="growth-box" v-if="player.jobInfo?.growth">
          <div class="growth-title">成长系数</div>
          <div class="growth-list">
            <span v-for="(val, key) in player.jobInfo.growth" :key="key" class="growth-item">
              {{ growthLabels[key] || key }}: <b>{{ val > 1 ? '×' + val : val > 0 ? '+' + (val*100) + '%' : '—' }}</b>
            </span>
          </div>
        </div>
        <div class="talent-box" v-if="player.jobInfo?.talents">
          <div class="talent-title">专属天赋（常驻）</div>
          <div v-for="(t, i) in player.jobInfo.talents" :key="i" class="talent-item">
            <span class="talent-name">{{ t.name }}</span>
            <span class="talent-desc">{{ t.desc }}</span>
          </div>
        </div>
        <div class="mechanic-box" v-if="player.jobInfo?.mechanics">
          <div class="mechanic-title">成长机制</div>
          <div
            v-for="(m, i) in player.jobInfo.mechanics"
            :key="i"
            class="mechanic-item"
            :class="{ unlocked: player.jobInfo.jobStage > i, locked: player.jobInfo.jobStage <= i }"
          >
            <span class="mechanic-stage">{{ i + 1 }}阶</span>
            <span class="mechanic-name">{{ m.name }}</span>
            <span class="mechanic-desc">{{ m.desc }}</span>
            <span class="mechanic-status">{{ player.jobInfo.jobStage > i ? '✓' : '🔒' }}</span>
          </div>
        </div>
        <div class="stages-timeline">
          <div
            v-for="(stage, i) in player.jobInfo?.stages"
            :key="i"
            class="stage-node"
            :class="{ done: player.level >= stage.level, current: player.job === stage.name, future: player.level < stage.level }"
          >
            <div class="stage-dot">{{ i + 1 }}</div>
            <div class="stage-info">
              <div class="stage-name">{{ stage.name }}</div>
              <div class="stage-level">Lv.{{ stage.level }}</div>
              <div class="stage-desc">{{ stage.desc }}</div>
            </div>
          </div>
        </div>
        <div v-if="player.jobInfo?.nextStage" class="next-hint">
          下一阶段: {{ player.jobInfo.nextStage.name }} (Lv.{{ player.jobInfo.nextStage.level }})
        </div>
      </div>
    </div>
  </div>

  <!-- 设置栏 -->
  <div class="settings-section card">
    <div class="section-header">
      <span><IconBase name="scroll" :size="14" class="section-icon" /> 设置</span>
    </div>
    <button class="theme-setting-btn" type="button" @click="showThemeModal = true">
      <span class="theme-setting-label">界面风格</span>
      <span class="theme-setting-current">{{ currentThemeName }} ▸</span>
    </button>
  </div>

  <!-- 右侧折叠面板（fixed 全屏，与其他区块无布局冲突） -->
  <div class="side-panel" :class="{ expanded: sideOpen }">
    <button class="side-toggle" @click="sideOpen = !sideOpen">
      <span class="side-arrow">{{ sideOpen ? '›' : '‹' }}</span>
    </button>
    <transition name="side-slide">
      <div v-if="sideOpen" class="side-tabs">
        <div class="side-tab-item" @click="$emit('goEvo')">
          <span class="side-tab-icon"><IconBase name="dna" :size="16" class="icon-accent2" /></span>
          <span class="side-tab-label">进阶</span>
          <span v-if="player.canEvolve" class="side-tab-badge">!</span>
        </div>
        <div class="side-tab-item" @click="$emit('goQuest')">
          <span class="side-tab-icon"><IconBase name="scroll" :size="16" class="icon-accent2" /></span>
          <span class="side-tab-label">任务</span>
          <span v-if="questBadge" class="side-tab-badge">{{ questBadge }}</span>
        </div>
        <div class="side-tab-item" @click="showTitleModal = true">
          <span class="side-tab-icon"><IconBase name="trophy" :size="16" class="icon-accent" /></span>
          <span class="side-tab-label">称号</span>
          <span v-if="activeTimeTitleCount > 0" class="side-tab-badge side-tab-badge--gold">{{ activeTimeTitleCount }}</span>
        </div>
        <div
          v-if="(player.reincarnation || 0) >= 2"
          class="side-tab-item side-tab-item--genesis"
          @click="$emit('goGenesis')"
        >
          <span class="side-tab-icon"><IconBase name="book" :size="16" class="icon-accent" /></span>
          <span class="side-tab-label">创世</span>
          <span class="side-tab-badge side-tab-badge--gold">!</span>
        </div>
      </div>
    </transition>
  </div>

  <ThemeModal v-if="showThemeModal" :current="currentTheme" @apply="onThemeApply" @close="showThemeModal = false" />

  <TitleModal
    v-if="showTitleModal"
    :currentKey="player.currentTitle"
    :currentName="currentTitleName"
    :currentColor="currentTitleColor"
    :username="player.username"
    @changed="onTitleChanged"
    @close="showTitleModal = false"
  />
</template>

<script setup>
// ====== 职业 + 设置栏 + 右侧折叠 + 主题/称号弹窗 ======
// @file components/character/JobSettingsPanel
// @module character-job-settings-panel
// @description 职业选择/进阶路线 + 主题切换 + 右侧折叠面板（进阶/任务/称号/创世）+ ThemeModal/TitleModal
import { ref, computed, reactive, onMounted, watch } from 'vue';
import IconBase from '../icons/IconBase.vue';
import ThemeModal from '../ThemeModal.vue';
import TitleModal from '../TitleModal.vue';
import { THEMES, getTheme, applyTheme } from '../../theme.js';
import { resolveTitleName, resolveTitleColor } from '../../utils/titles.js';
import api from '../../api.js';
import { toast } from '../../ui-bridge.js';
import { jobIcons, growthLabels } from './labels.js';

const props = defineProps({
  player: { type: Object, required: true },
  jobTree: { type: Object, default: () => ({}) },
});
const emit = defineEmits([
  'chooseJob',
  'goEvo',
  'goQuest',
  'goGenesis',
]);

// ====== 主题切换 ======
const showThemeModal = ref(false);
const currentTheme = ref(getTheme());
const currentThemeName = computed(() => THEMES.find(t => t.key === currentTheme.value)?.name || THEMES[0].name);
function onThemeApply(key) {
  applyTheme(key);
  currentTheme.value = key;
}

// ====== 称号系统 ======
const showTitleModal = ref(false);
const _allTitleCache = ref({});
const activeTimeTitleCount = ref(0);
const currentTitleName = computed(() => resolveTitleName(props.player?.currentTitle, props.player, _allTitleCache));
const currentTitleColor = computed(() => resolveTitleColor(props.player?.currentTitle, _allTitleCache));

async function refreshTitleCache() {
  if (!props.player?.username) return;
  try {
    const res = await api.getTitles(props.player.username);
    if (res.success) {
      _allTitleCache.value = res.data.all || {};
      activeTimeTitleCount.value = (res.data.active || []).length;
    }
  } catch (_) {}
}
onMounted(refreshTitleCache);
watch(() => props.player?.currentTitle, () => refreshTitleCache());

function onTitleChanged(newKey) {
  if (!props.player) return;
  props.player.currentTitle = newKey;
  refreshTitleCache();
}

// ====== 折叠状态 + 任务徽章 ======
const openSections = reactive({ job: false });
function toggleSection(key) { openSections[key] = !openSections[key]; }

const sideOpen = ref(false);

const questBadge = computed(() => {
  const qv = props.player.questView;
  if (!qv) return 0;
  let n = 0;
  for (const q of qv.dailyQuests || []) if (q.done && !q.claimed) n++;
  if (qv.chest && !qv.chest.claimed && qv.chest.canClaim) n++;
  for (const a of qv.achievements || []) if (a.unlocked && !a.claimed) n++;
  return n;
});

// ====== 职业选择 ======
const selectedJob = ref(null);
</script>
