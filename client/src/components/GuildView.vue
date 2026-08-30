<template>
  <div class="guild-view">
    <div class="guild-header">
      <button class="back-btn" type="button" @click="$emit('goBack')">‹ 返回地图</button>
      <div class="guild-title-row">
        <span class="guild-title-icon">⚔️</span>
        <span class="guild-title-text">公会大厅</span>
      </div>
      <div class="guild-sub">创建/加入 · 成员管理 · 公告 · 捐献 · 等级</div>
    </div>

    <div v-if="loading" class="empty-tip">加载中…</div>
    <template v-else>
      <!-- 未入会 -->
      <template v-if="!myGuild">
        <div class="create-card">
          <div class="section-title">创建公会</div>
          <div class="create-row">
            <input v-model="createName" placeholder="2-12字符 中英数下划线" maxlength="12" class="guild-input" />
            <button class="guild-btn primary" :disabled="creating || !createName.trim()" @click="onCreate">{{ creating ? '创建中…' : '创建（500金币）' }}</button>
          </div>
          <div class="hint">名称全服唯一，大小写不敏感</div>
        </div>

        <div class="list-section">
          <div class="list-head">
            <span class="section-title">公会列表</span>
            <div class="search-row">
              <input v-model="q" placeholder="搜索公会名" class="guild-input small" @keyup.enter="loadList" />
              <button class="guild-btn" @click="loadList">搜索</button>
            </div>
          </div>
          <div v-if="list.length===0" class="empty-tip">暂无公会</div>
          <div v-else class="guild-list">
            <div v-for="g in list" :key="g.id" class="guild-card">
              <div class="g-head">
                <span class="g-name">{{ g.name }}</span>
                <span class="g-level">Lv.{{ g.level }} {{ g.level===5?'已满级':'' }}</span>
              </div>
              <div class="g-meta">成员 {{ g.memberCount }}/{{ g.maxMembers }} · 会长 {{ g.leaderName }} Lv.{{ g.leaderLevel }} · 经验 {{ g.exp }}{{ g.nextLevelExp ? '/'+g.nextLevelExp : '' }}</div>
              <div v-if="g.announcement" class="g-ann">公告：{{ g.announcement }}</div>
              <button class="guild-btn small" :disabled="joining" @click="onJoin(g.id)">加入</button>
            </div>
          </div>
          <div v-if="total > pageSize" class="pager">
            <button class="guild-btn small" :disabled="page<=1" @click="page--; loadList()">上一页</button>
            <span class="page-info">{{ page }}/{{ Math.ceil(total/pageSize) }}</span>
            <button class="guild-btn small" :disabled="page>=Math.ceil(total/pageSize)" @click="page++; loadList()">下一页</button>
          </div>
        </div>
      </template>

      <!-- 已入会 -->
      <template v-else>
        <div class="detail-card">
          <div class="g-head">
            <span class="g-name">{{ myGuild.name }}</span>
            <span class="g-level">Lv.{{ myGuild.level }}</span>
          </div>
          <div class="g-meta">经验 {{ myGuild.exp }}{{ myGuild.nextLevelExp ? '/'+myGuild.nextLevelExp : '（已满级）' }} · 成员 {{ myGuild.memberCount }}/{{ myGuild.maxMembers }} · 会长 {{ myGuild.leaderUsername }}</div>
          <div class="progress-bar"><div class="progress-fill" :style="{width: guildProgress+'%'}"></div></div>
          <div class="viewer-line">本会贡献 {{ viewer.currentContribution }} · 生涯累计 {{ viewer.lifetimeContribution }}</div>
        </div>

        <div class="ann-section">
          <div class="section-title">公告</div>
          <div class="ann-text">{{ myGuild.announcement || '暂无公告' }}</div>
          <div class="ann-meta" v-if="myGuild.announcementAt">由 {{ myGuild.announcementBy }} 于 {{ formatTime(myGuild.announcementAt) }}</div>
          <button v-if="canAnnounce" class="guild-btn small" @click="showAnnEdit=!showAnnEdit">{{ showAnnEdit ? '取消编辑' : '编辑公告' }}</button>
          <div v-if="showAnnEdit" class="ann-edit">
            <textarea v-model="annText" maxlength="200" placeholder="≤200字" class="guild-input area"></textarea>
            <button class="guild-btn primary small" :disabled="annSaving" @click="onAnnSave">{{ annSaving ? '保存中…' : '保存' }}</button>
          </div>
        </div>

        <div class="members-section">
          <div class="section-title">成员（{{ myGuild.members.length }}）</div>
          <div class="member-list">
            <div v-for="m in myGuild.members" :key="m.username" class="member-item">
              <div class="m-main">
                <span class="m-name">{{ m.name }}<span class="m-user">({{ m.username }})</span></span>
                <span class="m-role" :class="m.role">{{ roleLabel(m.role) }}</span>
              </div>
              <div class="m-meta">Lv.{{ m.level }} · 贡献 {{ m.contribution }} · {{ formatTime(m.joinedAt) }}</div>
              <div v-if="m.username !== currentUser && canManage(m)" class="m-actions">
                <button class="guild-btn tiny" @click="onKick(m.username)">踢出</button>
                <button v-if="m.role==='member'" class="guild-btn tiny" @click="onRole(m.username,'officer')">升官员</button>
                <button v-if="m.role==='officer'" class="guild-btn tiny" @click="onRole(m.username,'member')">降成员</button>
                <button v-if="m.role==='officer'" class="guild-btn tiny" @click="onRole(m.username,'vice')">升副会长</button>
                <button v-if="m.role==='vice'" class="guild-btn tiny" @click="onRole(m.username,'officer')">降官员</button>
                <button v-if="isLeader" class="guild-btn tiny primary" @click="onTransfer(m.username)">转让会长</button>
              </div>
            </div>
          </div>
        </div>

        <div class="donate-section">
          <div class="section-title">捐献</div>
          <div class="donate-grid">
            <div v-for="opt in donateOpts" :key="opt.id" class="donate-card">
              <div class="donate-label">{{ opt.label }}</div>
              <div class="donate-cost">{{ opt.costText }}</div>
              <div class="donate-reward">+{{ opt.reward.guildExp }}经验 · +{{ opt.reward.contrib }}贡献</div>
              <div class="donate-limit">今日 {{ donateCounts[opt.id]||0 }}/{{ opt.dailyLimit }}</div>
              <button class="guild-btn small" :disabled="(donateCounts[opt.id]||0)>=opt.dailyLimit || donating" @click="onDonate(opt.id)">捐献</button>
            </div>
          </div>
        </div>

        <div class="store-section">
          <div class="section-title">库存</div>
          <div class="store-line">金币：{{ myGuild.store.gold||0 }}</div>
          <div class="store-line" v-if="storeMaterials.length">材料：{{ storeMaterials.join('、') }}</div>
          <div class="store-line" v-else>材料：无</div>
        </div>

        <div class="logs-section">
          <div class="section-title">日志（近30）</div>
          <div v-if="!myGuild.logs.length" class="empty-tip">暂无日志</div>
          <div v-else class="log-list">
            <div v-for="(l,i) in myGuild.logs.slice().reverse()" :key="i" class="log-item">
              <span class="log-time">{{ formatTime(l.at) }}</span>
              <span class="log-by">{{ l.by }}</span>
              <span class="log-action">{{ l.action }}</span>
              <span v-if="l.target" class="log-target">→{{ l.target }}</span>
              <span v-if="l.detail" class="log-detail">{{ l.detail }}</span>
            </div>
          </div>
        </div>

        <div class="action-row">
          <button class="guild-btn" @click="onLeave">离开公会</button>
          <button v-if="isLeader" class="guild-btn danger" @click="onDisband">解散公会</button>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../api.js';
import { toast, modalConfirm } from '../ui-bridge.js';

const props = defineProps(['player','currentUser']);
defineEmits(['goBack']);

const loading = ref(true);
const myGuild = ref(null);
const viewer = ref({ role:null, currentContribution:0, lifetimeContribution:0, donateDaily:{ dayKey:'', counts:{} }, joinAt:null });
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const q = ref('');
const createName = ref('');
const creating = ref(false);
const joining = ref(false);
const showAnnEdit = ref(false);
const annText = ref('');
const annSaving = ref(false);
const donating = ref(false);

const donateOpts = [
  { id:'gold_small', label:'小额捐献', costText:'200金币', reward:{guildExp:10, contrib:10}, dailyLimit:5 },
  { id:'gold_large', label:'大力捐献', costText:'1000金币', reward:{guildExp:60, contrib:50}, dailyLimit:3 },
  { id:'mat_herb', label:'草药捐献', costText:'草药×5', reward:{guildExp:15, contrib:15}, dailyLimit:5 },
];

const isLeader = computed(()=> viewer.value.role==='leader');
const canAnnounce = computed(()=> ['leader','vice','officer'].includes(viewer.value.role));
const donateCounts = computed(()=> viewer.value.donateDaily?.counts || {});
const guildProgress = computed(()=>{
  if(!myGuild.value) return 0;
  const exp=myGuild.value.exp, next=myGuild.value.nextLevelExp;
  if(next===null) return 100;
  const curLvExp = myGuild.value.level===1?0: [0,0,500,2000,5000][myGuild.value.level] ||0;
  const need = next - curLvExp;
  const have = exp - curLvExp;
  return Math.max(0, Math.min(100, Math.round(have/need*100)));
});
const storeMaterials = computed(()=>{
  if(!myGuild.value?.store?.materials) return [];
  return Object.entries(myGuild.value.store.materials).map(([k,v])=>`${k}×${v}`);
});

function roleLabel(r){ const m={leader:'会长', vice:'副会长', officer:'官员', member:'成员'}; return m[r]||r; }
function formatTime(ts){ if(!ts) return '--'; const d=new Date(ts); return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
function canManage(target){
  const myRole = viewer.value.role;
  if(!myRole) return false;
  if(target.role==='leader') return false;
  if(myRole==='leader') return true;
  if(myRole==='vice') return ['officer','member'].includes(target.role);
  return false;
}

async function loadMy(){
  const res = await api.getMyGuild(props.currentUser);
  if(res.success){
    const d=res.data || {};
    myGuild.value = d.guild || null;
    viewer.value = d.viewer || { role:null, currentContribution:0, lifetimeContribution:0, donateDaily:{counts:{}}, joinAt:null };
    if(myGuild.value) annText.value = myGuild.value.announcement || '';
  } else {
    toast.error(res.message||'加载公会失败');
  }
}
async function loadList(){
  const res = await api.getGuilds(q.value.trim(), page.value, pageSize.value);
  if(res.success){
    const d=res.data || {};
    list.value = d.list || [];
    total.value = d.total||0;
  }
}
async function refreshAll(){ await Promise.all([loadMy(), loadList()]); }

async function onCreate(){
  const name=createName.value.trim();
  if(!name) return;
  creating.value=true;
  const res=await api.createGuild(props.currentUser, name);
  creating.value=false;
  if(res.success){ toast.success('创建成功'); createName.value=''; await refreshAll(); }
  else toast.error(res.message||'创建失败');
}
async function onJoin(gid){
  joining.value=true;
  const res=await api.joinGuild(props.currentUser, gid);
  joining.value=false;
  if(res.success){ toast.success('加入成功'); await refreshAll(); }
  else toast.error(res.message||'加入失败');
}
async function onLeave(){
  const ok = await modalConfirm('确定离开公会？会长需先转让。');
  if(!ok) return;
  const res=await api.leaveGuild(props.currentUser);
  if(res.success){ toast.success('已离开'); await refreshAll(); }
  else toast.error(res.message||'离开失败');
}
async function onKick(target){
  const ok = await modalConfirm(`确定踢出 ${target}？`);
  if(!ok) return;
  const res=await api.kickGuildMember(props.currentUser, target);
  if(res.success){ toast.success('已踢出'); await loadMy(); }
  else toast.error(res.message||'踢出失败');
}
async function onRole(target, role){
  const res=await api.updateGuildRole(props.currentUser, target, role);
  if(res.success){ toast.success('已调整'); await loadMy(); }
  else toast.error(res.message||'调整失败');
}
async function onTransfer(target){
  const ok=await modalConfirm(`确定将公会转让给 ${target}？`);
  if(!ok) return;
  const res=await api.transferGuild(props.currentUser, target);
  if(res.success){ toast.success('已转让'); await loadMy(); }
  else toast.error(res.message||'转让失败');
}
async function onAnnSave(){
  if(annText.value.length>200){ toast.error('公告不能超过200字'); return; }
  annSaving.value=true;
  const res=await api.updateGuildAnnouncement(props.currentUser, annText.value.trim());
  annSaving.value=false;
  if(res.success){ toast.success('已更新'); showAnnEdit.value=false; await loadMy(); }
  else toast.error(res.message||'更新失败');
}
async function onDonate(id){
  donating.value=true;
  const res=await api.donateGuild(props.currentUser, id);
  donating.value=false;
  if(res.success){
    const d=res.data||{};
    if(d.viewer) viewer.value=d.viewer;
    if(d.guild) myGuild.value=d.guild;
    toast.success(`捐献成功 +${d.reward?.contrib||0}贡献`);
    // 刷新确保库存与等级同步
    await loadMy();
  } else toast.error(res.message||'捐献失败');
}
async function onDisband(){
  const ok=await modalConfirm('确定解散公会？所有成员将被移出，日志归档。');
  if(!ok) return;
  const res=await api.disbandGuild(props.currentUser);
  if(res.success){ toast.success('已解散'); await refreshAll(); }
  else toast.error(res.message||'解散失败');
}

onMounted(async ()=>{
  await refreshAll();
  loading.value=false;
});
</script>

<style scoped>
.guild-view{display:flex; flex-direction:column; gap:0.6rem; padding:0.6rem 0.8rem; padding-bottom:calc(var(--tabbar-h) + var(--safe-bottom) + var(--browser-bar-h,0px) + 0.75rem); max-width:560px; margin:0 auto;}
.guild-header{display:flex; flex-direction:column; gap:0.2rem;}
.back-btn{align-self:flex-start; padding:0.3rem 0.7rem; background:rgba(var(--violet-rgb),0.1); border:1px solid var(--rule); border-radius:6px; color:var(--muted); cursor:pointer; font-size:0.75rem;}
.back-btn:hover{background:rgba(var(--violet-rgb),0.2); color:var(--text);}
.guild-title-row{display:flex; align-items:center; gap:0.4rem;}
.guild-title-icon{font-size:1.4rem;}
.guild-title-text{font-size:1.1rem; font-weight:800; color:var(--accent);}
.guild-sub{font-size:0.7rem; color:var(--muted);}
.empty-tip{padding:0.8rem; text-align:center; color:var(--muted); font-size:0.78rem;}
.section-title{font-size:0.78rem; font-weight:700; color:var(--accent);}
.create-card{padding:0.6rem; background:var(--bg2); border:1px solid var(--rule); border-radius:8px;}
.create-row{display:flex; gap:0.4rem; margin-top:0.4rem;}
.guild-input{flex:1; padding:0.4rem 0.6rem; background:var(--bg); border:1px solid var(--rule); border-radius:6px; color:var(--text); font-size:0.78rem;}
.guild-input.small{max-width:160px;}
.guild-input.area{width:100%; min-height:60px; resize:vertical;}
.hint{font-size:0.65rem; color:var(--muted); margin-top:0.2rem;}
.list-head{display:flex; justify-content:space-between; align-items:center; gap:0.4rem; flex-wrap:wrap;}
.search-row{display:flex; gap:0.3rem; align-items:center;}
.guild-btn{padding:0.35rem 0.7rem; background:rgba(var(--panel-rgb),0.5); border:1px solid var(--rule); border-radius:6px; color:var(--muted); cursor:pointer; font-size:0.72rem;}
.guild-btn:hover{border-color:var(--accent2); color:var(--text);}
.guild-btn.primary{border-color:var(--accent); color:var(--accent); background:rgba(var(--gold-rgb),0.1); font-weight:700;}
.guild-btn.small{padding:0.3rem 0.5rem; font-size:0.7rem;}
.guild-btn.tiny{padding:0.2rem 0.4rem; font-size:0.65rem;}
.guild-btn.danger{border-color:var(--danger); color:var(--danger);}
.guild-btn:disabled{opacity:0.5; cursor:not-allowed;}
.guild-list{display:flex; flex-direction:column; gap:0.35rem; margin-top:0.4rem;}
.guild-card{padding:0.5rem; background:var(--bg2); border:1px solid var(--rule); border-radius:8px;}
.g-head{display:flex; justify-content:space-between; align-items:center;}
.g-name{font-weight:700; color:var(--text);}
.g-level{font-size:0.68rem; background:rgba(var(--gold-rgb),0.15); color:var(--accent); padding:0.15rem 0.4rem; border-radius:4px;}
.g-meta{font-size:0.68rem; color:var(--muted); margin-top:0.15rem; font-family:monospace;}
.g-ann{font-size:0.68rem; color:var(--muted); margin-top:0.15rem; background:var(--bg); padding:0.25rem 0.4rem; border-radius:4px;}
.pager{display:flex; justify-content:center; align-items:center; gap:0.5rem; margin-top:0.4rem;}
.page-info{font-size:0.7rem; color:var(--muted); font-family:monospace;}
.detail-card{padding:0.6rem; background:var(--bg2); border:1px solid var(--rule); border-radius:8px;}
.progress-bar{margin-top:0.3rem; height:6px; background:rgba(var(--panel-rgb),0.5); border-radius:3px; overflow:hidden;}
.progress-fill{height:100%; background:linear-gradient(90deg,var(--accent),var(--accent2));}
.viewer-line{font-size:0.68rem; color:var(--muted); margin-top:0.25rem; font-family:monospace;}
.ann-section,.members-section,.donate-section,.store-section,.logs-section{padding:0.5rem; background:var(--bg2); border:1px solid var(--rule); border-radius:8px;}
.ann-text{font-size:0.78rem; color:var(--text); margin-top:0.3rem; white-space:pre-wrap; background:var(--bg); padding:0.4rem; border-radius:6px; min-height:1.2rem;}
.ann-meta{font-size:0.65rem; color:var(--muted); margin-top:0.15rem; font-family:monospace;}
.ann-edit{margin-top:0.4rem; display:flex; flex-direction:column; gap:0.3rem;}
.member-list{display:flex; flex-direction:column; gap:0.3rem; margin-top:0.3rem;}
.member-item{padding:0.4rem; background:var(--bg); border:1px solid var(--rule); border-radius:6px;}
.m-main{display:flex; justify-content:space-between; align-items:center;}
.m-name{font-weight:600; color:var(--text); font-size:0.78rem;}
.m-user{color:var(--muted); font-weight:400; font-size:0.68rem; margin-left:0.2rem;}
.m-role{font-size:0.65rem; padding:0.15rem 0.35rem; border-radius:4px; background:rgba(var(--panel-rgb),0.5); color:var(--muted);}
.m-role.leader{background:rgba(var(--gold-rgb),0.15); color:var(--accent);}
.m-role.vice{background:rgba(var(--violet-rgb),0.15); color:var(--violet);}
.m-meta{font-size:0.65rem; color:var(--muted); margin-top:0.15rem; font-family:monospace;}
.m-actions{display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.3rem;}
.donate-grid{display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.3rem; margin-top:0.3rem;}
.donate-card{padding:0.4rem; background:var(--bg); border:1px solid var(--rule); border-radius:6px; text-align:center;}
.donate-label{font-size:0.75rem; font-weight:700; color:var(--text);}
.donate-cost{font-size:0.65rem; color:var(--muted); margin-top:0.15rem;}
.donate-reward{font-size:0.65rem; color:var(--success); margin-top:0.1rem;}
.donate-limit{font-size:0.65rem; color:var(--muted); margin-top:0.1rem; font-family:monospace;}
.store-line{font-size:0.72rem; color:var(--muted); margin-top:0.15rem; font-family:monospace;}
.log-list{display:flex; flex-direction:column; gap:0.2rem; margin-top:0.3rem; max-height:220px; overflow:auto;}
.log-item{display:flex; flex-wrap:wrap; gap:0.3rem; font-size:0.65rem; font-family:monospace; padding:0.25rem 0.35rem; background:var(--bg); border-radius:4px;}
.log-time{color:var(--muted);}
.log-by{color:var(--accent2);}
.log-action{color:var(--text); font-weight:600;}
.log-target{color:var(--danger);}
.log-detail{color:var(--muted);}
.action-row{display:flex; gap:0.4rem; justify-content:center; margin-top:0.4rem;}
@media(max-width:480px){ .donate-grid{grid-template-columns:1fr;} }
</style>
