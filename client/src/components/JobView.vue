<template>
  <div class="view-container job-view">
    <!-- 还没选职业 -->
    <div v-if="!player.jobPath" class="job-choose">
      <template v-if="player.canChooseJob">
        <div class="section-header"><span>选择你的职业方向</span></div>
        <p class="job-tip">达到 Lv.11，你觉醒了超凡之力，请在灵性之海中构建你的职业</p>
        <div class="job-cards">
          <div v-for="job in Object.values(jobTree)" :key="job.id" class="job-card"
            :class="{ selected: selectedJob === job.id }" @click="selectedJob = job.id">
            <div class="job-icon">{{ jobIcons[job.id] }}</div>
            <div class="job-name">{{ job.name }}</div>
            <div class="job-desc">{{ job.desc }}</div>
            <div class="job-stages-mini">
              <span v-for="(s, i) in job.stages" :key="i" class="stage-mini">Lv.{{ s.level }} {{ s.name }}</span>
            </div>
          </div>
        </div>
        <button v-if="selectedJob" class="btn btn-primary confirm-job"
          @click="$emit('choose', selectedJob)">确认选择：{{ jobTree[selectedJob]?.name }}</button>
      </template>
      <div v-else class="job-locked">
        <p>需要达到 Lv.11 才能选择职业方向</p>
        <p class="job-progress">当前等级: Lv.{{ player.level }} / 11</p>
      </div>
    </div>

    <!-- 已选职业：进阶路线 -->
    <div v-else class="job-progress-display">
      <div class="job-current">
        <span class="job-current-path">{{ player.jobInfo?.pathName }}</span>
        <span class="job-current-name">{{ player.job }}</span>
      </div>

      <div class="stages-timeline">
        <div v-for="(stage, i) in player.jobInfo?.stages" :key="i" class="stage-node"
          :class="{ done: player.level >= stage.level, current: player.job === stage.name, future: player.level < stage.level }">
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
</template>

<script setup>
import { ref } from 'vue'

defineProps(['player', 'jobTree'])
defineEmits(['choose'])

const selectedJob = ref(null)
const jobIcons = { thunder: '⚡', light: '✨', wind: '🌪', knight: '🛡', alchemy: '⚗' }
</script>

<style scoped>
.job-view { display: flex; flex-direction: column; gap: 0.8rem; max-width: 560px; margin: 0 auto; }

.section-header { font-size: 0.9rem; color: var(--accent); font-weight: 600; }
.job-tip { font-size: 0.78rem; color: var(--muted); }
.job-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.5rem; }
.job-card { padding: 0.7rem; border: 1px solid var(--rule); border-radius: 8px; cursor: pointer; transition: all 0.2s; background: rgba(24,26,46,0.5); text-align: center; }
.job-card:hover { border-color: var(--accent2); transform: translateY(-2px); }
.job-card.selected { border-color: var(--accent); background: rgba(var(--gold-rgb),0.1); box-shadow: 0 0 0 1px var(--accent); }
.job-icon { font-size: 1.6rem; margin-bottom: 0.2rem; }
.job-name { font-weight: 600; font-size: 0.9rem; color: var(--accent); }
.job-desc { font-size: 0.68rem; color: var(--muted); margin: 0.2rem 0; line-height: 1.3; }
.job-stages-mini { display: flex; flex-direction: column; gap: 0.1rem; }
.stage-mini { font-size: 0.62rem; color: var(--dim); }
.confirm-job { margin-top: 0.8rem; width: 100%; padding: 0.6rem; }

.job-locked { text-align: center; padding: 2rem 1rem; }
.job-locked p { color: var(--muted); }
.job-progress { color: var(--accent); font-weight: 600; margin-top: 0.4rem; }

/* 已选职业 */
.job-current { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.8rem; }
.job-current-path { font-size: 0.75rem; color: var(--muted); }
.job-current-name { font-size: 1.1rem; font-weight: 600; color: var(--accent); }

.stages-timeline { display: flex; flex-direction: column; }
.stage-node { display: flex; gap: 0.6rem; padding: 0.4rem 0; position: relative; }
.stage-node:not(:last-child)::before { content: ''; position: absolute; left: 11px; top: 28px; bottom: -4px; width: 2px; background: var(--rule); }
.stage-node.done:not(:last-child)::before { background: var(--accent2); }
.stage-dot { width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 0.68rem; font-weight: 700; z-index: 1; background: var(--bg3); border: 2px solid var(--rule); color: var(--dim); }
.stage-node.done .stage-dot { background: var(--accent2); border-color: var(--accent2); color: #0e0f1c; }
.stage-node.current .stage-dot { background: var(--accent); border-color: var(--accent); color: #0e0f1c; box-shadow: 0 0 8px rgba(var(--gold-rgb),0.4); }
.stage-name { font-size: 0.85rem; font-weight: 600; }
.stage-node.done .stage-name { color: var(--accent2); }
.stage-node.current .stage-name { color: var(--accent); }
.stage-node.future .stage-name { color: var(--dim); }
.stage-level { font-size: 0.68rem; color: var(--muted); }
.stage-desc { font-size: 0.72rem; color: var(--dim); margin-top: 0.1rem; }
.next-hint { margin-top: 0.8rem; padding: 0.5rem 0.7rem; background: rgba(var(--gold-rgb),0.08); border: 1px solid rgba(var(--gold-rgb),0.2); border-radius: 6px; font-size: 0.78rem; color: var(--accent); }
</style>
