<template>
  <!-- 登录/注册/创建角色界面 -->
  <div v-if="!player" class="login-screen">
    <div class="login-bg" style="background-image: url('/img/login-bg.jpg')"></div>
    <div class="login-box">
      <div class="login-title">
        <span class="login-icon">⚔</span>
        <h1>费兰德世界</h1>
        <p>从鹰人部落到天使帝国 · 挂机文字成长</p>
      </div>

      <!-- 登录/注册 -->
      <div v-if="loginStep === 'login'">
        <input v-model="usernameInput" class="login-input" placeholder="账号"
          @keyup.enter="$refs.pwdInput?.focus()" maxlength="16" />
        <input v-model="passwordInput" class="login-input" placeholder="密码" type="password"
          ref="pwdInput" @keyup.enter="handleLogin" maxlength="32" />
        <div class="login-btns">
          <button class="btn btn-primary login-btn" @click="handleLogin">登录</button>
          <button class="btn login-btn" @click="loginStep = 'register'">注册新账号</button>
        </div>
        <p class="login-hint">输入账号密码登录，新玩家请先注册</p>
      </div>

      <!-- 注册 -->
      <div v-else-if="loginStep === 'register'">
        <input v-model="usernameInput" class="login-input" placeholder="设置账号"
          maxlength="16" />
        <input v-model="passwordInput" class="login-input" placeholder="设置密码" type="password"
          maxlength="32" />
        <input v-model="passwordConfirm" class="login-input" placeholder="确认密码" type="password"
          @keyup.enter="handleRegister" maxlength="32" />
        <div class="login-btns">
          <button class="btn btn-primary login-btn" @click="handleRegister">确认注册</button>
          <button class="btn login-btn" @click="loginStep = 'login'">返回登录</button>
        </div>
      </div>

      <!-- 创建角色 -->
      <div v-else-if="loginStep === 'create'">
        <div class="create-hint">欢迎来到费兰德世界！请为你的角色命名</div>
        <div class="create-race-preview">
          <div class="race-portrait">
            <img src="/img/race-eagle.jpg" alt="鹰人" />
          </div>
          <span class="race-tag">🦅 鹰人</span>
          <span class="race-desc">凡尘大陆的低等种族，拥有飞行的天赋</span>
        </div>
        <input v-model="charNameInput" class="login-input" placeholder="输入角色名..."
          @keyup.enter="handleCreateChar" maxlength="12" />
        <button class="btn btn-primary login-btn" @click="handleCreateChar">创建角色</button>
      </div>
    </div>
  </div>

  <!-- 游戏主界面 -->
  <div v-else class="game-screen">
    <!-- 顶部状态栏 -->
    <header class="game-header">
      <div class="header-left">
        <span class="header-name">{{ player.name }}</span>
        <span class="header-race">{{ player.race }}</span>
        <span v-if="player.currentTitle" class="header-race" style="color:var(--accent)">{{ player.currentTitle }}</span>
        <span class="header-level" :style="{ color: player.stage.color }">Lv.{{ player.level }}</span>
        <span class="header-job" v-if="player.job !== '无'">{{ player.job }}</span>
        <span class="header-godhood" v-if="player.godhood === 'demigod'">半神</span>
        <span class="header-godhood god" v-if="player.godhood === 'god'">神灵</span>
      </div>
      <div class="header-right">
        <span class="header-gold">💰{{ player.gold }}</span>
        <button class="btn btn-sm shop-btn" @click="showShop = true">🛒</button>
        <button class="btn btn-sm" @click="logout">退出</button>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="game-body">
      <transition :name="transitionName" mode="out-in">
        <div :key="activeTab" class="page-slide">
          <CharacterView v-if="activeTab === 'char'" :player="player" :jobTree="jobTree"
            @allocate="handleAllocate"
            @equip="handleEquip" @unequip="handleUnequip" @enchant="handleEnchant"
            @chooseJob="handleChooseJob"
            @goSkill="activeTab = 'skill'"
            @goEvo="activeTab = 'evo'"
            @goQuest="activeTab = 'quest'" />
          <SkillView v-else-if="activeTab === 'skill'" :player="player"
            @equipAffix="handleEquipAffix" @unequipAffix="handleUnequipAffix" />
          <InventoryView v-else-if="activeTab === 'bag'" :player="player"
            :qualityColors="qualityColors" :materialPrices="materialPrices"
            @use="handleUseItem" @sellMaterial="handleSellMaterial"
            @sellEquip="handleSellEquip" @equip="handleEquip" @enchant="handleEnchant" />
          <MapView v-else-if="activeTab === 'map'" :player="player" :areas="areas"
            @select="handleAreaChange" @strategy-change="handleStrategyChange"
            @goRank="activeTab = 'rank'" />
          <CodexView v-else-if="activeTab === 'codex'" />
          <EvolutionView v-else-if="activeTab === 'evo'" :player="player"
            @evolve="handleEvolve" @learnLaw="handleLearnLaw" @ascend="handleAscend" />
          <LeaderboardView v-else-if="activeTab === 'rank'" :currentUser="currentUserRef" />
          <QuestView v-else-if="activeTab === 'quest'" :player="player" :currentUser="currentUserRef" @refresh="player = $event" />
        </div>
      </transition>
    </main>
    <TutorialOverlay v-if="player && typeof player.tutorialStep==='number' && player.tutorialStep<6" :player="player" @next="handleTutorialNext" @skip="handleTutorialSkip" />

    <!-- 底部 TabBar（固定 5 个，中间地图凸起圆形） -->
    <nav class="tabbar">
      <div v-for="tab in mainTabs" :key="tab.id" class="tabbar-item"
        :class="{ active: activeTab === tab.id, 'tabbar-center': tab.id === 'map' }"
        :data-tab="tab.id" @click="handleTabClick(tab.id)">
        <span class="tabbar-icon">{{ tab.icon }}</span>
        <span class="tabbar-text">{{ tab.label }}</span>
        <span v-if="tab.badge" class="tabbar-badge">{{ tab.badge }}</span>
      </div>
    </nav>

    <!-- 升级提示 -->
    <transition name="levelup">
      <div v-if="levelUpNotice" class="levelup-notice">
        <span>等级提升！Lv.{{ levelUpNotice }}</span>
      </div>
    </transition>

    <!-- 商店弹窗（底部弹出 Action Sheet） -->
    <transition name="sheet">
      <div v-if="showShop" class="shop-overlay" @click.self="closeShop">
        <div class="shop-sheet">
          <div class="sheet-header">
            <span class="sheet-title">🛒 商店</span>
            <span class="sheet-gold">💰 {{ player.gold }}</span>
            <button class="btn btn-sm sheet-close" @click="closeShop">✕</button>
          </div>
          <div class="shop-grid">
            <div v-for="item in pagedShop" :key="item.id" class="shop-cell" @click="shopDetail = item">
              <div class="shop-icon">{{ getShopIcon(item) }}</div>
              <div class="shop-name">{{ item.name }}</div>
              <div class="shop-price">💰{{ item.price }}</div>
            </div>
          </div>
          <div v-if="shopTotalPages > 1" class="shop-pager">
            <button class="pager-btn" :disabled="shopPage === 1" @click="shopPage--">‹</button>
            <span class="pager-info">{{ shopPage }}/{{ shopTotalPages }}</span>
            <button class="pager-btn" :disabled="shopPage === shopTotalPages" @click="shopPage++">›</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 商店商品详情弹窗（嵌套） -->
    <div v-if="shopDetail" class="shop-detail-overlay" @click.self="shopDetail = null">
      <div class="shop-detail-box">
        <div class="sd-title">{{ getShopIcon(shopDetail) }} {{ shopDetail.name }}</div>
        <div class="sd-row"><span class="sd-label">类型</span><span class="sd-val">{{ shopDetail.type === 'consumable' ? '消耗品' : '装备' }}</span></div>
        <div class="sd-row"><span class="sd-label">价格</span><span class="sd-val">💰{{ shopDetail.price }}</span></div>
        <div class="sd-desc">{{ shopDetail.desc }}</div>
        <div v-if="shopDetail.type === 'consumable'" class="sd-section">
          <div class="sd-section-title">购买数量</div>
          <div class="qty-controls">
            <button class="qty-btn" @click="changeBuyQty(shopDetail.id, -1)">−</button>
            <span class="qty-val">{{ buyQty[shopDetail.id] || 1 }}</span>
            <button class="qty-btn" @click="changeBuyQty(shopDetail.id, 1)">+</button>
            <button class="btn btn-sm quick-btn" @click="setBuyQty(shopDetail.id, 10)">×10</button>
          </div>
          <div class="sd-total">合计: 💰{{ shopDetail.price * (buyQty[shopDetail.id] || 1) }}</div>
          <button class="btn btn-primary btn-sm sd-buy-btn"
            :class="{ 'btn-disabled': player.gold < shopDetail.price * (buyQty[shopDetail.id] || 1) }"
            @click="handleBuy(shopDetail.id, buyQty[shopDetail.id] || 1); shopDetail = null">购买</button>
        </div>
        <div v-else class="sd-actions">
          <button class="btn btn-primary btn-sm" :class="{ 'btn-disabled': player.gold < shopDetail.price }"
            @click="handleBuy(shopDetail.id, 1); shopDetail = null">购买</button>
        </div>
        <button class="btn btn-sm sd-close-btn" @click="shopDetail = null">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import api from './api.js'
import CharacterView from './components/CharacterView.vue'
import SkillView from './components/SkillView.vue'
import InventoryView from './components/InventoryView.vue'
import MapView from './components/MapView.vue'
import CodexView from './components/CodexView.vue'
import EvolutionView from './components/EvolutionView.vue'
import LeaderboardView from './components/LeaderboardView.vue'
import QuestView from './components/QuestView.vue'
import TutorialOverlay from './components/TutorialOverlay.vue'

const player = ref(null)
const areas = ref([])
const jobTree = ref({})
const shopItems = ref([])
const materialPrices = ref({})
const qualityColors = ref({ normal: '#9d9bb8', fine: '#5eda7a', epic: '#9d8cf0', legend: '#d4af5e' })
const levelUpNotice = ref(null)
const activeTab = ref('char')
const showShop = ref(false)
const shopDetail = ref(null)
const buyQty = ref({})
const shopPage = ref(1)
const shopPageSize = 8

// 登录流程
const loginStep = ref('login') // 'login' | 'register' | 'create'
const usernameInput = ref('')
const passwordInput = ref('')
const passwordConfirm = ref('')
const charNameInput = ref('')
let pollTimer = null
let prevLevel = 0
let currentUser = ''
const currentUserRef = ref('')

// 底部固定 5 个 Tab：角色、技能、地图(中间凸起)、背包、图鉴
const mainTabs = computed(() => [
  { id: 'char', label: '角色', icon: '👤', badge: player.value?.attrPoints > 0 ? player.value.attrPoints : null },
  { id: 'skill', label: '技能', icon: '🔮', badge: null },
  { id: 'map', label: '地图', icon: '🗺', badge: null },
  { id: 'bag', label: '背包', icon: '🎒', badge: null },
  { id: 'codex', label: '图鉴', icon: '📖', badge: null },
])
const transitionName = ref('slide-left')

const tabOrder = ['char', 'skill', 'bag', 'map', 'codex', 'evo', 'rank', 'quest']

watch(activeTab, (newTab, oldTab) => {
  const newIdx = tabOrder.indexOf(newTab)
  const oldIdx = tabOrder.indexOf(oldTab)
  transitionName.value = newIdx >= oldIdx ? 'slide-left' : 'slide-right'
})

const shopTotalPages = computed(() => Math.max(1, Math.ceil((shopItems.value?.length || 0) / shopPageSize)))
const pagedShop = computed(() => (shopItems.value || []).slice((shopPage.value - 1) * shopPageSize, shopPage.value * shopPageSize))

function getShopIcon(item) {
  if (item.type === 'consumable') {
    if (item.id?.includes('hp')) return '🧪'
    if (item.id?.includes('mp')) return '🔵'
    if (item.id?.includes('exp')) return '📜'
    return '📦'
  }
  if (item.id?.includes('spear') || item.id?.includes('sword') || item.id?.includes('blade') || item.id?.includes('lance')) return '⚔️'
  if (item.id?.includes('armor') || item.id?.includes('wings') || item.id?.includes('cloak')) return '🛡️'
  if (item.id?.includes('tooth') || item.id?.includes('ring') || item.id?.includes('amulet') || item.id?.includes('feather') || item.id?.includes('eye')) return '💍'
  return '🔧'
}

function changeBuyQty(id, delta) {
  const cur = buyQty.value[id] || 1
  buyQty.value = { ...buyQty.value, [id]: Math.max(1, Math.min(99, cur + delta)) }
}
function setBuyQty(id, n) { buyQty.value = { ...buyQty.value, [id]: n } }
function closeShop() { showShop.value = false; shopDetail.value = null; shopPage.value = 1 }

// ====== 登录/注册/创建角色 ======
async function handleLogin() {
  const username = usernameInput.value.trim()
  const password = passwordInput.value
  if (!username || !password) return
  const res = await api.login(username, password)
  if (!res.success) { alert(res.message); return }

  currentUser = username
  currentUserRef.value = username
  if (res.hasCharacter) {
    player.value = res.data
    prevLevel = res.data.level
    loadStaticData()
    startPolling()
  } else {
    // 需要创建角色
    loginStep.value = 'create'
  }
}

async function handleRegister() {
  const username = usernameInput.value.trim()
  const password = passwordInput.value
  const confirm = passwordConfirm.value
  if (!username || !password) { alert('请填写账号和密码'); return }
  if (password !== confirm) { alert('两次密码不一致'); return }

  const res = await api.register(username, password)
  if (!res.success) { alert(res.message); return }

  alert('注册成功！请登录')
  loginStep.value = 'login'
  passwordInput.value = ''
  passwordConfirm.value = ''
}

async function handleCreateChar() {
  const charName = charNameInput.value.trim()
  if (!charName) { alert('请输入角色名'); return }

  const res = await api.createCharacter(currentUser, charName)
  if (!res.success) { alert(res.message); return }

  player.value = res.data
  prevLevel = res.data.level
  currentUserRef.value = currentUser
  loadStaticData()
  startPolling()
}

// ====== 数据加载 ======
async function loadStaticData() {
  const [areasRes, jobsRes, shopRes] = await Promise.all([api.getAreas(), api.getJobs(), api.getShop()])
  if (areasRes.success) areas.value = areasRes.data
  if (jobsRes.success) jobTree.value = jobsRes.data
  if (shopRes.success) shopItems.value = shopRes.data
}

async function startPolling() {
  pollTimer = setInterval(async () => {
    if (!player.value) return
    const res = await api.getPlayer(currentUser)
    if (res.success) {
      if (res.data.level > prevLevel) {
        levelUpNotice.value = res.data.level
        prevLevel = res.data.level
        setTimeout(() => { levelUpNotice.value = null }, 2500)
      }
      player.value = res.data
    }
  }, 5000)
}

// ====== 引导（T-050） ======
let tutorialRetrying = false
async function updateTutorial(nextStep){
  if(!player.value) return
  if(tutorialRetrying) return
  tutorialRetrying = true
  try{
    const res = await api.updateTutorial(currentUser, nextStep)
    if(res && res.success) player.value = res.data
  }catch(e){
    // 网络异常，保留当前步，依赖轮询补偿
  }finally{
    tutorialRetrying = false
  }
}
function handleTabClick(tabId){
  activeTab.value = tabId
  const step = player.value?.tutorialStep
  if(step===1 && tabId==='char') updateTutorial(2)
  else if(step===3 && tabId==='map') updateTutorial(4)
  else if(step===4 && tabId==='bag'){
    if((player.value?.level ?? 0) >= 5) updateTutorial(5)
  }
  else if(step===5 && tabId==='skill'){
    if(player.value?.jobPath) updateTutorial(6)
  }
}
function handleTutorialNext(){
  const cur = player.value?.tutorialStep ?? 0
  updateTutorial(cur+1)
}
function handleTutorialSkip(){ updateTutorial(6) }
let hasHydrated = false
watch(()=>player.value?.tutorialStep, (step)=>{
  if(step===0 && !hasHydrated){
    hasHydrated = true
    if(activeTab.value !== 'map') activeTab.value = 'map'
  }
  if(step!==0) hasHydrated = true
})
// 补偿重试：allocate 成功后 alloc1.done 但教程仍在 2，需重试 2→3（仅轮询成功时触发一次）
watch(()=>player.value?.questView?.dailyQuests, (list)=>{
  if(!player.value || tutorialRetrying) return
  if(player.value.tutorialStep!==2) return
  const dq = list?.find(x=>x.id==='alloc1')
  if(dq && dq.done){
    updateTutorial(3)
  }
}, {deep:true})

// ====== 操作处理 ======
async function handleAllocate(a) {
  try{
    const r = await api.allocateAttributes(currentUser, a)
    if (r.success){
      player.value = r.data
      // 2→3 补偿重试：读取 r.data.questView 而非旧 player，失败由轮询补偿
      const done = r.data?.questView?.dailyQuests?.find(x=>x.id==='alloc1')?.done
      if(player.value?.tutorialStep===2 && done){
        updateTutorial(3)
      }
    } else alert(r.message)
  }catch(e){
    alert(e.message || '分配失败')
  }
}
async function handleAreaChange(id) { const r = await api.changeArea(currentUser, id); if (r.success) player.value = r.data; else alert(r.message) }
async function handleChooseJob(p) { const r = await api.chooseJob(currentUser, p); if (r.success) { player.value = r.data; activeTab.value = 'char' } else alert(r.message) }
async function handleEquipAffix(affixId, slot) { const r = await api.equipAffix(currentUser, affixId, slot); if (r.success) player.value = r.data; else alert(r.message) }
async function handleUnequipAffix(affixId) { const r = await api.unequipAffix(currentUser, affixId); if (r.success) player.value = r.data; else alert(r.message) }
async function handleEquip(u) { const r = await api.equip(currentUser, u); if (r.success) player.value = r.data; else alert(r.message) }
async function handleUnequip(s) { const r = await api.unequip(currentUser, s); if (r.success) player.value = r.data; else alert(r.message) }
async function handleBuy(i, c) { const r = await api.buy(currentUser, i, c); if (r.success) player.value = r.data; else alert(r.message) }
 async function handleUseItem(i, c) { const r = await api.useItem(currentUser, i, c); if (r.success) player.value = r.data; else alert(r.message) }
async function handleSellMaterial(n, c) { const r = await api.sellMaterial(currentUser, n, c); if (r.success) player.value = r.data; else alert(r.message) }
async function handleSellEquip(u) { const r = await api.sellEquip(currentUser, u); if (r.success) player.value = r.data; else alert(r.message) }
async function handleEnchant(itemUid, recipeId) { const r = await api.enchant(currentUser, itemUid, recipeId); if (r.success) player.value = r.data; else alert(r.message) }
async function handleEvolve() { const r = await api.evolve(currentUser); if (r.success) player.value = r.data; else alert(r.message) }
async function handleLearnLaw(lawId) { const r = await api.learnLaw(currentUser, lawId); if (r.success) player.value = r.data; else alert(r.message) }
async function handleAscend() { const r = await api.ascend(currentUser); if (r.success) player.value = r.data; else alert(r.message) }
async function handleStrategyChange(strategy){ const r = await api.setStrategy(currentUser, strategy); if(r.success) player.value = r.data; else if(r.data) player.value = r.data; if(!r.success) alert(r.message) }

function logout() {
  player.value = null
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  hasHydrated = false
  loginStep.value = 'login'
  usernameInput.value = ''
  passwordInput.value = ''
  passwordConfirm.value = ''
  charNameInput.value = ''
  currentUser = ''
  currentUserRef.value = ''
}

onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })
</script>

<style scoped>
.game-screen { height: 100vh; display: flex; flex-direction: column; }
.game-body { flex: 1; overflow: hidden; position: relative; }
.page-slide { height: 100%; overflow-y: auto; }
.slide-left-enter-active, .slide-left-leave-active,
.slide-right-enter-active, .slide-right-leave-active {
  transition: transform 0.28s var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)), opacity 0.28s ease;
}
.slide-left-enter-from { transform: translateX(30%); opacity: 0; }
.slide-left-leave-to { transform: translateX(-15%); opacity: 0; }
.slide-right-enter-from { transform: translateX(-15%); opacity: 0; }
.slide-right-leave-to { transform: translateX(30%); opacity: 0; }

/* 商店按钮 */
.shop-btn { font-size: 1rem !important; padding: 0.2rem 0.5rem !important; }

/* 中间凸起地图按钮 */
.tabbar-center {
  position: relative;
  margin-top: -1.4rem;
  z-index: 2;
}
.tabbar-center .tabbar-icon {
  width: 48px; height: 48px; line-height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent, #d4af5e), #c4a04e);
  color: var(--bg, #0d0e1a);
  font-size: 1.4rem;
  display: block; margin: 0 auto;
  box-shadow: 0 4px 14px rgba(212,175,94,0.4), 0 0 0 4px var(--bg2, #14162a);
  transition: transform 0.2s var(--ease-out, ease), box-shadow 0.2s ease;
}
.tabbar-center.active .tabbar-icon {
  box-shadow: 0 6px 20px rgba(212,175,94,0.6), 0 0 0 4px var(--bg2, #14162a);
  transform: scale(1.08);
}
.tabbar-center .tabbar-text {
  font-size: 0.6rem; margin-top: 0.15rem;
}

/* 商店底部弹窗 */
.sheet-enter-active, .sheet-leave-active { transition: all var(--duration-slow, 300ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)); }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .shop-sheet, .sheet-leave-to .shop-sheet { transform: translateY(100%); }

.shop-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);
  display: flex; align-items: flex-end; justify-content: center; z-index: 300; padding: 0;
}
.shop-sheet {
  background: var(--bg2, #14162a); border: 1px solid var(--rule, #2a2b42); border-bottom: none;
  border-radius: 16px 16px 0 0; padding: 1rem; width: 100%; max-width: 560px;
  max-height: 70vh; overflow-y: auto;
  transition: transform var(--duration-slow, 300ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
}
.sheet-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem; }
.sheet-title { font-size: 1rem; font-weight: 700; color: var(--accent, #d4af5e); }
.sheet-gold { font-size: 0.82rem; color: var(--accent, #d4af5e); font-weight: 600; }
.sheet-close { font-size: 0.85rem !important; }

.shop-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem; }
.shop-cell {
  display: flex; flex-direction: column; align-items: center; gap: 0.1rem; padding: 0.4rem 0.2rem;
  border: 1px solid var(--rule, #2a2b42); border-radius: 8px; cursor: pointer;
  transition: all 0.15s; background: rgba(24,26,46,0.4); text-align: center;
}
.shop-cell:hover { border-color: var(--accent2, #9d8cf0); transform: translateY(-2px); background: rgba(157,140,240,0.06); }
.shop-icon { font-size: 1.3rem; }
.shop-name { font-size: 0.65rem; font-weight: 600; word-break: break-all; line-height: 1.2; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; }
.shop-price { font-size: 0.6rem; color: var(--accent, #d4af5e); }

.shop-pager { display: flex; justify-content: center; align-items: center; gap: 0.5rem; padding: 0.3rem 0 0.1rem; }
.pager-btn { padding: 0.2rem 0.6rem; border: 1px solid var(--rule, #2a2b42); border-radius: 6px; background: rgba(20,22,42,0.5); color: var(--ink, #ece9f5); font-size: 0.75rem; cursor: pointer; transition: all 0.2s; }
.pager-btn:hover:not(:disabled) { border-color: var(--accent2, #9d8cf0); }
.pager-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.pager-info { font-size: 0.72rem; color: var(--muted, #9d9bb8); font-family: monospace; }

/* 商店商品详情弹窗 */
.shop-detail-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex;
  align-items: center; justify-content: center; z-index: 400; padding: 1rem;
}
.shop-detail-box {
  background: var(--bg2, #14162a); border: 1px solid var(--rule, #2a2b42);
  border-radius: 12px; padding: 1.2rem; max-width: 320px; width: 100%; max-height: 85vh; overflow-y: auto;
}
.sd-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; }
.sd-row { display: flex; justify-content: space-between; align-items: center; padding: 0.2rem 0; font-size: 0.82rem; }
.sd-label { color: var(--muted, #9d9bb8); }
.sd-val { color: var(--accent, #d4af5e); font-weight: 600; }
.sd-desc { font-size: 0.78rem; color: var(--dim, #6d6b8a); margin: 0.4rem 0; padding: 0.4rem 0.5rem; background: rgba(157,140,240,0.05); border-radius: 6px; line-height: 1.5; }
.sd-section { margin-top: 0.4rem; }
.sd-section-title { font-size: 0.78rem; color: var(--accent2, #9d8cf0); font-weight: 600; margin-bottom: 0.3rem; }
.sd-total { font-size: 0.75rem; color: var(--accent, #d4af5e); font-weight: 600; margin: 0.3rem 0; }
.sd-buy-btn { width: 100%; margin-top: 0.3rem; }
.sd-actions { display: flex; gap: 0.3rem; margin-top: 0.4rem; }
.sd-actions .btn { flex: 1; }
.sd-close-btn { width: 100%; margin-top: 0.3rem; }

/* 数量控制 */
.qty-controls { display: flex; align-items: center; gap: 0.15rem; }
.qty-btn { width: 24px; height: 24px; border-radius: 4px; border: 1px solid var(--rule, #2a2b42); background: rgba(20,22,42,0.6); color: var(--muted, #9d9bb8); font-size: 0.85rem; cursor: pointer; line-height: 1; font-family: inherit; transition: all 0.15s; }
.qty-btn:hover { border-color: var(--accent2, #9d8cf0); color: var(--accent2, #9d8cf0); }
.qty-val { font-size: 0.78rem; font-weight: 600; color: var(--accent, #d4af5e); min-width: 20px; text-align: center; }
.quick-btn { font-size: 0.62rem !important; padding: 0.1rem 0.35rem !important; color: var(--accent2, #9d8cf0) !important; border-color: rgba(157,140,240,0.2) !important; }
</style>
