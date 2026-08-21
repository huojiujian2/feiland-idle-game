// 游戏引擎 v0.6 - 词条系统 + 新属性体系 + T-004 策略 + T-040 任务
const {
  AREAS, EQUIP_TEMPLATES, JOB_TREE, SHOP_ITEMS,
  MATERIAL_PRICES, EQUIP_SELL_PRICES,
  RACE_EVOLUTION, ENCHANT_RECIPES, MAX_ENCHANT_SLOTS, LAWS, ASCENSION,
  MONSTER_SKILLS,
  AFFIX_LEVELS, AFFIX_TREE,
  STRATEGIES, STRATEGY_CD_MS,
  ACTIVE_SKILL_CD,
  INITIAL_MATERIAL_POOL, DAILY_QUESTS, DAILY_CHEST, ACHIEVEMENTS,
  getStage, expToNext, createEquipItem
} = require('./data');

// ====== 可注入时钟与随机（测试 seam） ======
// data.js 保持静态，uid 生成由本模块通过 getNow/_rand 注入（Spec §8，边界约定）
let _now = () => Date.now();
let _rand = Math.random;
let _dropRand = Math.random;
let _uidSeq = 0;
function getNow() { return _now(); }
function __setNow(fn) { _now = fn; }
function __setRandom(fn) { _rand = fn; }
function __setDropRandom(fn) { _dropRand = fn; }
function __resetSeams() { _now = () => Date.now(); _rand = Math.random; _dropRand = Math.random; _uidSeq = 0; }
function genUid(){ return getNow() + '_' + (_uidSeq++) + '_' + _rand().toString(36).substr(2, 6); }
function shouldDrop(rate, strategy) {
  const dropBonus = (STRATEGIES[strategy]?.effects?.drop) || 0;
  const eff = rate * (1 + dropBonus);
  return _dropRand() < eff;
}
function buildBattleMonster(monster, strategy) {
  const atkBonus = (STRATEGIES[strategy]?.effects?.monsterAtk) || 0;
  if (atkBonus) return { ...monster, atk: Math.floor(monster.atk * (1 + atkBonus)) };
  return { ...monster };
}
function getActiveSkillCd(level){ return ACTIVE_SKILL_CD[level] || 5; }
function shouldTriggerActiveSkill(round, cd){ return round % cd === 0; }

// ====== T-040 日常（可持久化，每日0点重置） ======
function getTodayKey(){
  const d = new Date(getNow());
  d.setHours(0,0,0,0);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}
function createDailyQuests(){
  return DAILY_QUESTS.map(q=>({ id:q.id, progress:0, target:q.target, done:false, claimed:false }));
}
function refreshDailyIfNeeded(player){
  const today = getTodayKey();
  if(player.dailyResetAt !== today){
    player.dailyQuests = createDailyQuests();
    player.dailyChestClaimed = false;
    player.dailyResetAt = today;
  }
}
function updateDailyProgress(player, questId, inc=1){
  refreshDailyIfNeeded(player);
  const dq = (player.dailyQuests||[]).find(q=>q.id===questId);
  if(!dq || dq.done) return;
  dq.progress = Math.min(dq.target, (dq.progress||0)+inc);
  if(dq.progress >= dq.target) dq.done = true;
}
function ensureQuestStats(player){
  if(!player.questStats) player.questStats = { totalGoldEarned:0, affixSeen:[], seenEquipTemplates:[] };
  if(!Array.isArray(player.questStats.affixSeen)) player.questStats.affixSeen = [];
  if(!Array.isArray(player.questStats.seenEquipTemplates)) player.questStats.seenEquipTemplates = [];
  if(!Number.isFinite(player.questStats.totalGoldEarned)) player.questStats.totalGoldEarned = 0;
}
function grantGold(player, amount){
  if(!amount) return;
  player.gold += amount;
  ensureQuestStats(player);
  player.questStats.totalGoldEarned += amount;
  checkAchievements(player);
}
function grantExpWithLevelUp(player, exp){
  if(!exp) return;
  player.exp += exp;
  const now = getNow();
  while(player.exp >= expToNext(player.level)){
    player.exp -= expToNext(player.level);
    player.level++;
    player.attrPoints += 3;
    player.skillPoints += 1;
    player.maxHp += 20;
    player.maxMp += 10;
    player.hp = player.maxHp;
    player.mp = player.maxMp;
    if(player.jobPath){
      const tree = JOB_TREE[player.jobPath];
      for(const stage of tree.stages){
        if(stage.level===player.level){
          player.job = stage.name;
          player.logs.push({ time: now, type:'job', text:`${stage.desc}，职业进阶为：${stage.name}！被动词条槽位+1` });
        }
      }
    }
  }
  if(exp>0) player.logs.push({ time: now, type:'levelup', level:player.level, text:`获得 ${exp} 经验` });
  checkAchievements(player);
}
function checkAchievements(player){
  if(!player.achievements) player.achievements = {};
  const setUnlock = (id)=>{
    if(!player.achievements[id]) player.achievements[id] = { unlocked:false, claimed:false, unlockAt:0 };
    if(!player.achievements[id].unlocked){
      player.achievements[id].unlocked = true;
      player.achievements[id].unlockAt = getNow();
    }
  };
  if(player.killCount>=100) setUnlock('kill100');
  if(player.killCount>=1000) setUnlock('kill1000');
  if(player.killCount>=10000) setUnlock('kill10000');
  if(player.level>=100) setUnlock('lv100');
  if(player.godhood) setUnlock('ascend');
  if(player.reincarnation>=1) setUnlock('reinc1');
  const seen = (player.questStats && player.questStats.affixSeen) || [];
  if(seen.length>=50) setUnlock('affix50');
  if((player.questStats && player.questStats.totalGoldEarned||0) >= 1000000) setUnlock('gold1m');
  const seenEquips = (player.questStats && player.questStats.seenEquipTemplates) || [];
  if(seenEquips.length>=10) setUnlock('collect10');
  // first is unlocked at create/migrate
}
function claimDaily(player, questId){
  refreshDailyIfNeeded(player);
  const dq = (player.dailyQuests||[]).find(q=>q.id===questId);
  if(!dq) return { success:false, status:404, message:'任务不存在' };
  if(!dq.done) return { success:false, status:409, message:'未完成' };
  if(dq.claimed) return { success:true, status:200, message:'已领取', already:true };
  const tpl = DAILY_QUESTS.find(q=>q.id===questId);
  if(tpl.reward.gold) grantGold(player, tpl.reward.gold);
  if(tpl.reward.exp) grantExpWithLevelUp(player, tpl.reward.exp);
  if(tpl.reward.materialPool){
    const mat = tpl.reward.materialPool[Math.floor(_rand()*tpl.reward.materialPool.length)] || INITIAL_MATERIAL_POOL[0];
    const c = tpl.reward.count||1;
    const ex = player.inventory.find(i=>i.name===mat);
    if(ex) ex.count+=c; else player.inventory.push({ name:mat, count:c, type:'material' });
  }
  dq.claimed = true;
  return { success:true, status:200 };
}
function claimChest(player){
  refreshDailyIfNeeded(player);
  if(player.dailyChestClaimed) return { success:true, status:200, already:true };
  const claimedCount = (player.dailyQuests||[]).filter(q=>q.claimed).length;
  if(claimedCount < DAILY_CHEST.need) return { success:false, status:409, message:'需完成5项已领取' };
  player.dailyChestClaimed = true;
  return { success:true, status:200 };
}
function claimAchievement(player, achId){
  refreshDailyIfNeeded(player);
  const ach = ACHIEVEMENTS.find(a=>a.id===achId);
  if(!ach) return { success:false, status:404, message:'成就不存在' };
  const rec = (player.achievements||{})[achId];
  if(!rec || !rec.unlocked) return { success:false, status:409, message:'未达成' };
  if(rec.claimed) return { success:true, status:200, already:true };
  // 发放
  if(ach.reward.gold) grantGold(player, ach.reward.gold);
  if(ach.reward.equipPool){
    const tpl = ach.reward.equipPool[Math.floor(_rand()*ach.reward.equipPool.length)];
    const item = createEquipItem(tpl, genUid());
    if(item){
      player.equips.push(item);
      ensureQuestStats(player);
      if(!player.questStats.seenEquipTemplates.includes(tpl)) player.questStats.seenEquipTemplates.push(tpl);
    }
  }
  if(ach.reward.affixLevel){
    const pool = AFFIX_TREE[ach.reward.affixLevel] || [];
    if(pool.length){
      const aff = pool[Math.floor(_rand()*pool.length)];
      player.inventory.push({ name: aff.name, count:1, type:'affix', affixId: aff.id });
      ensureQuestStats(player);
      if(!player.questStats.affixSeen.includes(aff.id)) player.questStats.affixSeen.push(aff.id);
      player.logs.push({ time:getNow(), type:'achievement', text:`获得大师词条：${aff.name}` });
    }
  }
  if(ach.reward.reincPoints){
    player.reincPoints = (player.reincPoints||0) + ach.reward.reincPoints;
  }
  rec.claimed = true;
  let titleToGrant = ach.title;
  if(achId === 'ascend'){
    titleToGrant = player.godhood === 'god' ? '神灵' : '半神';
  }
  if(titleToGrant){
    if(!player.titles) player.titles=[];
    if(!player.titles.includes(titleToGrant)) player.titles.push(titleToGrant);
    if(!player.currentTitle) player.currentTitle = titleToGrant;
    rec.grantedTitle = titleToGrant;
  }
  return { success:true, status:200 };
}
function normalizeTutorialStep(v){
  if(!Number.isFinite(v)) return 0;
  let n = Math.floor(v);
  if(n<0) return 0;
  if(n>6) return 6;
  return n;
}
function updateTutorialStep(player, nextStep){
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  if(!Number.isInteger(nextStep) || nextStep<0 || nextStep>6) return { success:false, status:400, message:'step 非法' };
  const cur = normalizeTutorialStep(player.tutorialStep);
  if(nextStep===6){
    if(cur===6) return { success:true, status:200, data: getPlayerView(player) };
    player.tutorialStep = 6;
    return { success:true, status:200, data: getPlayerView(player) };
  }
  if(nextStep===cur) return { success:false, status:409, message:'步骤不连续' };
  if(nextStep !== cur+1) return { success:false, status:409, message:'步骤不连续' };
  // 条件校验
  if(cur===2 && nextStep===3){
    const dq = (player.dailyQuests||[]).find(q=>q.id==='alloc1');
    if(!dq || !dq.done) return { success:false, status:409, message:'条件未满足' };
  }
  if(cur===4 && nextStep===5){
    if(player.level < 5) return { success:false, status:409, message:'条件未满足' };
  }
  player.tutorialStep = nextStep;
  return { success:true, status:200, data: getPlayerView(player) };
}

// ====== 工具：按ID查找词条 ======
function findAffix(affixId) {
  for (const lv of [1, 2, 3, 4]) {
    const found = AFFIX_TREE[lv].find(a => a.id === affixId);
    if (found) return found;
  }
  return null;
}

// ====== 工具：获取职业阶段(0-4) ======
function getJobStage(player) {
  if (!player.jobPath) return 0;
  const tree = JOB_TREE[player.jobPath];
  let stage = 0;
  for (let i = 0; i < tree.stages.length; i++) {
    if (player.level >= tree.stages[i].level) stage = i + 1;
  }
  return stage;
}

// ====== 工具：获取被动词条槽位数 ======
function getPassiveSlots(player) {
  const stage = getJobStage(player);
  return stage + 1; // 0阶=1槽, 1阶=2槽, 2阶=3槽, 3阶=4槽, 4阶=5槽
}

// ====== 工具：获取可装备的词条等级 ======
function getAvailableAffixLevels(player) {
  const result = [];
  for (const [lv, cfg] of Object.entries(AFFIX_LEVELS)) {
    if (player.level >= cfg.reqLevel) result.push(parseInt(lv));
  }
  return result;
}

// ====== 创建新角色 ======
function createCharacter(username, charName) {
  const now = getNow();
  const p = {
    username,
    name: charName || username,
    race: '鹰人',
    raceStage: 0,
    level: 1,
    exp: 0,
    job: '无',
    jobPath: null,
    godhood: null,
    faith: 0,
    attributes: { atk: 5, def: 4, hp: 5, agi: 8 },
    attrPoints: 0,
    skillPoints: 0,
    affixes: { active: null, passive: [] },
    hp: 100, maxHp: 100,
    mp: 50, maxMp: 50,
    gold: 0,
    killCount: 0,
    reincarnation: 0,
    bossKills: 0,
    currentArea: 'gaomanshan',
    inventory: [],
    equips: [],
    equipped: { weapon: null, armor: null, accessory: null },
    laws: [],
    logs: [],
    lastTick: now,
    createdAt: now,
    strategy: 'balanced',
    strategyChangedAt: 0,
    dailyQuests: createDailyQuests(),
    dailyResetAt: getTodayKey(),
    dailyChestClaimed: false,
    achievements: {},
    questStats: { totalGoldEarned: 0, affixSeen: [], seenEquipTemplates: [] },
    titles: [],
    currentTitle: null,
    reincPoints: 0,
    tutorialStep: 0
  };
  // 初次冒险立即可领取
  p.achievements['first'] = { unlocked: true, claimed: false, unlockAt: now };
  return p;
}

// ====== 数据迁移（注意：会原地修改传入对象，含 inventory/equips 清理） ======
function migratePlayer(player) {
  if (!player.equips) player.equips = [];
  if (!player.equipped) player.equipped = { weapon: null, armor: null, accessory: null };
  if (player.skillPoints === undefined) player.skillPoints = 0;
  if (player.jobPath === undefined) player.jobPath = null;
  if (player.raceStage === undefined) player.raceStage = 0;
  if (player.godhood === undefined) player.godhood = null;
  if (player.faith === undefined) player.faith = 0;
  if (!player.laws) player.laws = [];
  if (!player.inventory) player.inventory = [];
  if (player.killCount === undefined) player.killCount = 0;
  if (player.reincarnation === undefined) player.reincarnation = 0;
  if (player.bossKills === undefined) player.bossKills = 0;
  if (typeof player.strategy !== 'string' || !Object.hasOwn(STRATEGIES, player.strategy)) player.strategy = 'balanced';
  if (!Number.isFinite(player.strategyChangedAt)) player.strategyChangedAt = 0;

  // 迁移旧5属性 → 新4属性
  if (player.attributes && player.attributes.strength !== undefined && player.attributes.atk === undefined) {
    const old = player.attributes;
    player.attributes = {
      atk: (old.strength || 5),
      def: (old.constitution || 4),
      hp: (old.constitution || 4),
      agi: (old.agility || 8)
    };
  }
  if (!player.attributes) player.attributes = { atk: 5, def: 4, hp: 5, agi: 8 };

  // 迁移旧skills → affixes
  if (!player.affixes) {
    player.affixes = { active: null, passive: [] };
    if (player.skills && player.skills.length > 0) {
      player.skills = []; // 清除旧技能，玩家需重新选词条
    }
  }

  // 迁移旧 inventory 里的装备
  if (player.inventory.length > 0) {
    player.inventory = player.inventory.filter(i => i.type !== 'equip');
  }
  const addEnchantField = (item) => { if (item && !item.enchants) item.enchants = []; };
  player.equips.forEach(addEnchantField);
  Object.values(player.equipped).forEach(addEnchantField);

  // T-040 日常/成就迁移（可持久化）
  if (!Array.isArray(player.dailyQuests)) player.dailyQuests = createDailyQuests();
  if (typeof player.dailyResetAt !== 'string') player.dailyResetAt = getTodayKey();
  if (typeof player.dailyChestClaimed !== 'boolean') player.dailyChestClaimed = false;
  if (!player.achievements || typeof player.achievements !== 'object') player.achievements = {};
  if (!player.questStats) player.questStats = { totalGoldEarned: 0, affixSeen: [], seenEquipTemplates: [] };
  if (!Array.isArray(player.questStats.affixSeen)) player.questStats.affixSeen = [];
  if (!Array.isArray(player.questStats.seenEquipTemplates)) player.questStats.seenEquipTemplates = [];
  if (!Number.isFinite(player.questStats.totalGoldEarned)) player.questStats.totalGoldEarned = 0;
  if (!Array.isArray(player.titles)) player.titles = [];
  if (player.currentTitle !== null && typeof player.currentTitle !== 'string') player.currentTitle = null;
  if (!Number.isFinite(player.reincPoints)) player.reincPoints = 0;
  if (!Number.isFinite(player.tutorialStep)) player.tutorialStep = 0;
  player.tutorialStep = normalizeTutorialStep(player.tutorialStep);
  // 迁移旧数据兼容：若 achievements 空但已有角色，补初次冒险
  if (!player.achievements['first']) {
    player.achievements['first'] = { unlocked: true, claimed: false, unlockAt: player.createdAt || getNow() };
  }
  refreshDailyIfNeeded(player);
  checkAchievements(player);
  return player;
}

// ====== 周键（周一 0 点边界，ISO 周） ======
function getCurrentWeekKey() {
  const now = new Date(getNow());
  now.setHours(0, 0, 0, 0);
  const day = now.getDay(); // 0 Sun .. 6 Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`; // 周一日期作为周键
}
function maybeResetWeeklyBossKills(store) {
  const meta = store.getMeta();
  const cur = getCurrentWeekKey();
  if (!meta.bossWeek) {
    meta.bossWeek = cur;
    store.setMeta(meta);
    return false;
  }
  if (meta.bossWeek !== cur) {
    let changed = false;
    for (const p of store.getAllPlayers()) {
      if ((p.bossKills || 0) !== 0) { p.bossKills = 0; changed = true; }
    }
    meta.bossWeek = cur;
    store.setMeta(meta);
    if (changed) store.save();
    console.log(`BOSS榜周重置: ${cur}`);
    return true;
  }
  return false;
}

// ====== 力量等阶（含神格） ======
function getStageFull(level, godhood) {
  if (godhood === 'god') return { name: '神灵', color: '#ffd700' };
  if (godhood === 'demigod') return { name: '半神', color: '#ff9d5e' };
  if (level <= 10) return { name: '凡人', color: '#9d9bb8' };
  if (level <= 30) return { name: '超凡·正式阶', color: '#9d8cf0' };
  if (level <= 60) return { name: '超凡·大师阶', color: '#7c6ef0' };
  if (level <= 100) return { name: '超凡·英雄阶', color: '#6c5ef0' };
  return { name: '传奇', color: '#d4af5e' };
}

// ====== 种族进化加成 ======
function getRaceBonus(player) {
  const raceData = RACE_EVOLUTION[player.race];
  if (!raceData || !raceData.bonus) return {};
  return raceData.bonus;
}

// ====== 法则加成 ======
function getLawBonus(player) {
  const bonus = { damage: 0, defense: 0, exp: 0, gold: 0, heal: 0, allAttr: 0 };
  for (const lawId of player.laws) {
    const law = LAWS.find(l => l.id === lawId);
    if (!law) continue;
    const b = law.bonus;
    if (b.damage) bonus.damage += b.damage;
    if (b.defense) bonus.defense += b.defense;
    if (b.exp) bonus.exp += b.exp;
    if (b.gold) bonus.gold += b.gold;
    if (b.heal) bonus.heal += b.heal;
    if (b.allAttr) bonus.allAttr += b.allAttr;
  }
  return bonus;
}

// ====== 登神加成 ======
function getGodhoodBonus(player) {
  if (!player.godhood) return {};
  const asc = ASCENSION[player.godhood];
  return asc ? asc.bonus : {};
}

// ====== 装备加成（含附魔） ======
function getEquipBonus(player) {
  const bonus = { atk: 0, def: 0, hp: 0, mp: 0, agi: 0, exp: 0, gold: 0 };
  for (const slot of ['weapon', 'armor', 'accessory']) {
    const item = player.equipped[slot];
    if (!item || !item.stats) continue;
    const s = item.stats;
    if (s.atk) bonus.atk += s.atk;
    if (s.def) bonus.def += s.def;
    if (s.hp) bonus.hp += s.hp;
    if (s.mp) bonus.mp += s.mp;
    if (s.agi) bonus.agi += s.agi;
    if (s.exp) bonus.exp += s.exp;
    if (s.gold) bonus.gold += s.gold;
    // 旧属性映射
    if (s.str) bonus.atk += s.str * 2;
    if (s.con) { bonus.def += s.con * 1.5; bonus.hp += s.con * 5; }
    if (s.spi) bonus.mp += s.spi * 3;
    if (item.enchants) {
      for (const ench of item.enchants) {
        const recipe = ENCHANT_RECIPES.find(r => r.id === ench);
        if (recipe && recipe.bonus) {
          const b = recipe.bonus;
          if (b.atk) bonus.atk += b.atk;
          if (b.def) bonus.def += b.def;
          if (b.hp) bonus.hp += b.hp;
          if (b.agi) bonus.agi += b.agi;
          if (b.exp) bonus.exp += b.exp;
          if (b.gold) bonus.gold += b.gold;
          if (b.str) bonus.atk += b.str * 2;
          if (b.con) { bonus.def += b.con * 1.5; bonus.hp += b.con * 5; }
          if (b.spi) bonus.mp += b.spi * 3;
        }
      }
    }
  }
  return bonus;
}

// ====== 职业成长系数 ======
function getJobGrowth(player) {
  if (!player.jobPath) return { atk: 1, def: 1, hp: 1, agi: 1, exp: 0, gold: 0 };
  return JOB_TREE[player.jobPath].growth;
}

// ====== 职业专属天赋（常驻被动） ======
function getJobTalents(player) {
  if (!player.jobPath) return {};
  const talents = JOB_TREE[player.jobPath].talents;
  const bonus = {};
  for (const t of talents) {
    Object.assign(bonus, t.effect);
  }
  return bonus;
}

// ====== 职业成长机制（按阶解锁） ======
function getJobMechanics(player) {
  if (!player.jobPath) return {};
  const stage = getJobStage(player);
  const mechanics = JOB_TREE[player.jobPath].mechanics;
  const bonus = {};
  for (let i = 0; i < stage && i < mechanics.length; i++) {
    if (mechanics[i] && mechanics[i].effect) {
      Object.assign(bonus, mechanics[i].effect);
    }
  }
  return bonus;
}

// ====== 词条加成（被动词条，受成长系数影响） ======
function getAffixBonus(player) {
  const bonus = {
    atk: 0, def: 0, hp: 0, agi: 0, exp: 0, gold: 0,
    crit: 0, critDmg: 0, dodge: 0, regen: 0,
    lifesteal: 0, thorns: 0, dmgTaken: 0, ignoreDef: 0,
    shieldRegen: 0, lowHpAtk: 0, lowHpDef: 0,
    dodgeAtk: 0, killExp: 0, killGold: 0,
    firstTurnAgi: 0, flatExp: 0
  };
  const growth = getJobGrowth(player);
  const talents = getJobTalents(player);

  // 炼金系药剂大师天赋：HP/EXP/GOLD词条效果+10%
  const potionBoost = talents.potionBoost || 0;

  for (const affixId of (player.affixes?.passive || [])) {
    const affix = findAffix(affixId);
    if (!affix) continue;
    const e = affix.effect;
    if (e.atk) bonus.atk += e.atk * (growth.atk || 1);
    if (e.def) bonus.def += e.def * (growth.def || 1);
    if (e.hp) bonus.hp += e.hp * (growth.hp || 1) * (1 + potionBoost);
    if (e.agi) bonus.agi += e.agi * (growth.agi || 1);
    if (e.exp) bonus.exp += e.exp * (1 + potionBoost);
    if (e.gold) bonus.gold += e.gold * (1 + potionBoost);
    if (e.crit) bonus.crit += e.crit;
    if (e.critDmg) bonus.critDmg += e.critDmg;
    if (e.dodge) bonus.dodge += e.dodge;
    if (e.regen) bonus.regen += e.regen;
    if (e.lifesteal) bonus.lifesteal += e.lifesteal;
    if (e.thorns) bonus.thorns += e.thorns;
    if (e.dmgTaken) bonus.dmgTaken += e.dmgTaken;
    if (e.ignoreDef) bonus.ignoreDef += e.ignoreDef;
    if (e.shieldRegen) bonus.shieldRegen += e.shieldRegen;
    if (e.lowHpAtk) bonus.lowHpAtk += e.lowHpAtk;
    if (e.lowHpDef) bonus.lowHpDef += e.lowHpDef;
    if (e.dodgeAtk) bonus.dodgeAtk += e.dodgeAtk;
    if (e.killExp) bonus.killExp += e.killExp;
    if (e.killGold) bonus.killGold += e.killGold;
    if (e.firstTurnAgi) bonus.firstTurnAgi += e.firstTurnAgi;
    if (e.flatExp) bonus.flatExp += e.flatExp;
  }
  return bonus;
}

// ====== 总属性（含装备/词条/种族/法则/登神/职业） ======
function getTotalStats(player) {
  const eq = getEquipBonus(player);
  const affix = getAffixBonus(player);
  const raceBonus = getRaceBonus(player);
  const lawBonus = getLawBonus(player);
  const godBonus = getGodhoodBonus(player);
  const talents = getJobTalents(player);
  const mechanics = getJobMechanics(player);
  const base = player.attributes;
  const allAttrMult = 1 + (lawBonus.allAttr || 0);

  // 基础值 = 等级成长 + 属性点 + 装备 + 种族/登神加成
  const baseAtk = (10 + (player.level - 1) * 3 + base.atk * 2 + eq.atk + (raceBonus.str || 0) * 2 + (godBonus.atk || 0) * 2);
  const baseDef = (5 + (player.level - 1) * 2 + base.def * 1.5 + eq.def + (raceBonus.con || 0) * 1.5 + (godBonus.def || 0) * 1.5);
  const baseHp = (100 + (player.level - 1) * 20 + base.hp * 10 + eq.hp + (raceBonus.con || 0) * 5 + (godBonus.hp || 0) * 5);
  const baseAgi = (10 + (player.level - 1) * 2 + base.agi * 1 + eq.agi + (raceBonus.agi || 0) + (godBonus.agi || 0));

  // 策略百分比加成（战斗向，仅 atk/def/regen）
  const strat = STRATEGIES[player.strategy] || STRATEGIES.balanced;
  const sAtk = strat.effects.atk || 0;
  const sDef = strat.effects.def || 0;
  const sRegen = strat.effects.regen || 0;

  // 词条+策略百分比加成
  const atkTotal = Math.floor(baseAtk * (1 + affix.atk) * (1 + sAtk) * allAttrMult);
  const defTotal = Math.floor(baseDef * (1 + affix.def) * (1 + sDef) * allAttrMult);
  const hpTotal = Math.floor(baseHp * (1 + affix.hp) * allAttrMult);
  const agiTotal = Math.floor(baseAgi * (1 + affix.agi) * allAttrMult);

  // 暴击/闪避等
  const crit = affix.crit + (talents.crit || 0) + (mechanics.crit || 0);
  const critDmg = affix.critDmg + (talents.critDmg || 0) + (mechanics.critDmg || 0) + 0.5; // 基础暴击伤害150%
  const dodge = affix.dodge + (talents.dodge || 0) + (mechanics.dodge || 0);
  const regen = (affix.regen + (mechanics.regen || 0)) * (1 + sRegen);
  const dmgTaken = affix.dmgTaken + (talents.dmgTaken || 0);
  const expBonus = eq.exp + affix.exp + (getJobGrowth(player).exp || 0);
  const goldBonus = eq.gold + affix.gold + (getJobGrowth(player).gold || 0) + (talents.goldGain || 0) + (mechanics.goldGain || 0);

  return {
    atk: atkTotal, def: defTotal, hp: hpTotal, agi: agiTotal,
    equipHP: eq.hp, equipMP: eq.mp,
    expBonus, goldBonus,
    crit, critDmg, dodge, regen,
    lifesteal: affix.lifesteal,
    thorns: affix.thorns,
    dmgTaken, ignoreDef: affix.ignoreDef,
    shieldRegen: affix.shieldRegen,
    lowHpAtk: affix.lowHpAtk,
    lowHpDef: affix.lowHpDef + (talents.lowHpDef || 0),
    dodgeAtk: affix.dodgeAtk,
    killExp: affix.killExp,
    killGold: affix.killGold,
    firstTurnAgi: affix.firstTurnAgi + (talents.firstTurnAgi || 0),
    flatExp: affix.flatExp,
    // 职业3阶+机制
    stackAgi: mechanics.stackAgi || 0,
    deathShield: mechanics.deathShield || 0,
    revive: mechanics.revive || 0,
    doubleKill: mechanics.doubleKill || false
  };
}

// ====== 计算玩家战斗属性 ======
function getCombatStats(player) {
  const total = getTotalStats(player);
  const lawBonus = getLawBonus(player);
  const activeAffix = player.affixes?.active ? findAffix(player.affixes.active) : null;

  // 低血量加成（战斗开始时快照，非每回合重算）
  const hpRatio = player.hp / player.maxHp;
  let bonusAtk = 0, bonusDef = 0;
  if (total.lowHpAtk && hpRatio < 0.5) bonusAtk += total.lowHpAtk;
  if (total.lowHpDef && hpRatio < 0.5) bonusDef += total.lowHpDef;
  // T-004 背水一战：额外低血加成（与词条相加后统一 floor），严格读单一数据源
  const desEff = STRATEGIES.desperate.effects;
  if (player.strategy === 'desperate' && hpRatio < desEff.hpThreshold) bonusAtk += desEff.desperateAtk;

  return {
    atk: Math.floor(total.atk * (1 + bonusAtk)),
    def: Math.floor(total.def * (1 + bonusDef)),
    agi: total.agi,
    hp: player.hp,
    maxHp: player.maxHp,
    mp: player.mp,
    maxMp: player.maxMp,
    crit: total.crit,
    critDmg: total.critDmg,
    dodge: total.dodge,
    regen: total.regen,
    lifesteal: total.lifesteal,
    thorns: total.thorns,
    dmgTaken: total.dmgTaken,
    ignoreDef: total.ignoreDef,
    dmgBonus: lawBonus.damage || 0,
    defBonus: lawBonus.defense || 0,
    healBonus: lawBonus.heal || 0,
    expBonus: total.expBonus,
    goldBonus: total.goldBonus,
    firstTurnAgi: total.firstTurnAgi,
    stackAgi: total.stackAgi,
    dodgeAtk: total.dodgeAtk,
    deathShield: total.deathShield,
    revive: total.revive,
    doubleKill: total.doubleKill,
    activeSkill: activeAffix ? {
      id: activeAffix.id, name: activeAffix.name,
      effect: activeAffix.effect, desc: activeAffix.desc
    } : null
  };
}

// ====== 选择怪物战斗技能 ======
function pickMonsterSkill(monster) {
  if (!monster.skills || monster.skills.length === 0) return null;
  for (const skillId of monster.skills) {
    const sk = MONSTER_SKILLS[skillId];
    if (!sk) continue;
    if (_rand() < sk.chance) return sk;
  }
  return null;
}

// ====== 计算伤害 ======
function calcDamage(atk, def, mult, dmgBonus, defBonus, ignoreDef, crit, critDmg) {
  const effDef = def * (1 - (ignoreDef || 0));
  let base = atk * (mult || 1);
  let reduction = effDef * 0.5;
  if (defBonus) reduction *= (1 + defBonus);
  let dmg = base - reduction;
  if (dmgBonus) dmg *= (1 + dmgBonus);
  // 暴击
  let isCrit = false;
  if (crit && _rand() < crit) {
    dmg *= (1 + (critDmg || 0.5));
    isCrit = true;
  }
  // 随机浮动 ±15%
  dmg *= (0.85 + _rand() * 0.3);
  return { value: Math.max(1, Math.floor(dmg)), isCrit };
}

// ====== 动态计算本回合行动次数 ======
function getActionCount(attackerAgi, defenderAgi) {
  const ratio = attackerAgi / Math.max(1, defenderAgi);
  let actions = 1;
  let remaining = ratio - 1;
  while (remaining > 0 && actions < 5) {
    if (_rand() < Math.min(1, remaining)) {
      actions++;
      remaining -= 1;
    } else {
      break;
    }
  }
  return actions;
}

// ====== 回合制战斗模拟（T-005 主动技能 CD 化，保留全部旧机制） ======
function simulateBattle(player, monster) {
  const combat = getCombatStats(player);
  const mHp = monster.hp;
  const mAtk = monster.atk;
  const mDef = monster.def;
  const mAgi = monster.agi;

  let pHp = combat.hp;
  let mCurHp = mHp;
  let pMp = combat.mp;

  // 风行系先手AGI加成
  let agiBonus = 0;
  if (combat.firstTurnAgi) agiBonus = combat.firstTurnAgi;

  const effAgi = Math.floor(combat.agi * (1 + agiBonus));
  const agiRatio = effAgi / Math.max(1, mAgi);
  const playerFirst = effAgi >= mAgi;

  // 风行系无限叠加AGI
  let stackAgiBonus = 0;

  // 局部可变状态（避免重复触发）
  let deathShield = combat.deathShield;
  let revived = false;
  let skillGoldBonus = 0;
  let buffs = []; // { key, value, before, expireRound }

  function applyBuff(key, value, turns, round){
    const expireRound = round + turns;
    const idx = buffs.findIndex(b=>b.key===key);
    if(idx!==-1){
      const old = buffs[idx];
      combat[old.key] = old.before;
      buffs.splice(idx,1);
    }
    const before = combat[key];
    combat[key] = Math.floor(combat[key]*(1+value));
    buffs.push({ key, value, before, expireRound });
  }
  function expireBuffs(round){
    const remain=[];
    for(const b of buffs){
      if(round >= b.expireRound){ combat[b.key] = b.before; }
      else remain.push(b);
    }
    buffs = remain;
  }
  function doPlayerNormalAction(actions){
    const damageResult = calcDamage(combat.atk, mDef, 1, combat.dmgBonus, 0, combat.ignoreDef, combat.crit, combat.critDmg);
    mCurHp -= damageResult.value;
    if(combat.lifesteal>0) pHp = Math.min(combat.maxHp, pHp + Math.floor(damageResult.value*combat.lifesteal));
    actions.push({ actor:'player', skill:'普通攻击', damage:damageResult.value, crit:damageResult.isCrit, targetHp:Math.max(0,mCurHp), targetMaxHp:mHp });
    return damageResult;
  }
  function doMonsterNormalAction(actions){
    if(_rand() < (combat.dodge||0)){
      actions.push({ actor:'player', skill:'闪避!', dodge:true, targetHp:pHp, targetMaxHp:combat.maxHp });
      if(combat.dodgeAtk){
        const counterResult = calcDamage(combat.atk, mDef, 1, combat.dmgBonus, 0, combat.ignoreDef, 1, combat.critDmg);
        mCurHp -= counterResult.value;
        actions.push({ actor:'player', skill:'闪避反击', damage:counterResult.value, type:'passive', source:'dodgeAtk', targetHp:Math.max(0,mCurHp), targetMaxHp:mHp });
      }
      return;
    }
    const monsterSkill = pickMonsterSkill(monster);
    let skillMult=1, skillName='普通攻击';
    if(monsterSkill){ skillMult=monsterSkill.mult; skillName=monsterSkill.name; }
    const monsterDamage = calcDamage(mAtk, combat.def, skillMult, 0, combat.defBonus, 0, 0, 0);
    let dmg=monsterDamage.value; if(combat.dmgTaken) dmg=Math.floor(dmg*(1+combat.dmgTaken));
    pHp -= dmg;
    if(combat.thorns>0) mCurHp -= Math.floor(dmg*combat.thorns);
    if(combat.regen>0 && pHp>0) pHp=Math.min(combat.maxHp, pHp+Math.floor(combat.maxHp*combat.regen));
    if(combat.healBonus>0 && pHp>0) pHp=Math.min(combat.maxHp, pHp+Math.floor(combat.maxHp*combat.healBonus*0.1));
    if(pHp<=0 && deathShield>0){
      pHp=Math.floor(combat.maxHp*deathShield);
      actions.push({ actor:'player', skill:'免死护盾!', shield:true, type:'passive', source:'deathShield', targetHp:pHp, targetMaxHp:combat.maxHp });
      deathShield = 0;
    }
    actions.push({ actor:'monster', skill:skillName, damage:dmg, targetHp:Math.max(0,pHp), targetMaxHp:combat.maxHp });
  }

  const activeAffix = player.affixes?.active ? findAffix(player.affixes.active) : null;
  const cd = activeAffix ? getActiveSkillCd(activeAffix.level) : null;
  const rounds = [];
  const maxRounds = 30;
  let result = 'timeout';

  for (let round = 1; round <= maxRounds; round++) {
    const actions = [];
    expireBuffs(round);
    const roundShouldTrigger = activeAffix && shouldTriggerActiveSkill(round, cd);

    if (combat.stackAgi && round > 1) {
      stackAgiBonus += combat.stackAgi;
    }
    const curAgi = Math.floor(effAgi * (1 + stackAgiBonus));
    const curMActions = getActionCount(mAgi, curAgi);
    const curPActions = getActionCount(curAgi, mAgi);

    // 交替行动队列（AGI buff 本版不重算 effAgi，仅影响 combat 数值）
    const queue = [];
    const maxLen = Math.max(curPActions, curMActions);
    const first = (round === 1) ? playerFirst : (curAgi >= mAgi);
    for (let i = 0; i < maxLen; i++) {
      if (first) {
        if (i < curPActions) queue.push('player');
        if (i < curMActions) queue.push('monster');
      } else {
        if (i < curMActions) queue.push('monster');
        if (i < curPActions) queue.push('player');
      }
    }
    let hasDoneFirstPlayerNormal = false;
    for (const actor of queue) {
      if (pHp <= 0 || mCurHp <= 0) break;
      if (actor==='player' && !hasDoneFirstPlayerNormal){
        doPlayerNormalAction(actions);
        hasDoneFirstPlayerNormal = true;
        if(roundShouldTrigger && mCurHp>0 && pHp>0){
          const skillEffect = activeAffix.effect;
          let skillPushed = false;
          if(skillEffect.type==='damage'){
            const skillDamage = calcDamage(combat.atk, mDef, skillEffect.mult, combat.dmgBonus, 0, combat.ignoreDef, combat.crit, combat.critDmg);
            mCurHp -= skillDamage.value;
            if(combat.lifesteal>0) pHp = Math.min(combat.maxHp, pHp + Math.floor(skillDamage.value*combat.lifesteal));
            actions.push({ actor:'player', skill:activeAffix.name, damage:skillDamage.value, crit:skillDamage.isCrit, type:'skill', targetHp:Math.max(0,mCurHp), targetMaxHp:mHp });
            skillPushed = true;
          } else if(skillEffect.type==='heal'){
            const healAmount=Math.floor(combat.maxHp*skillEffect.value); pHp=Math.min(combat.maxHp,pHp+healAmount);
            actions.push({ actor:'player', skill:activeAffix.name, heal:healAmount, type:'skill', targetHp:pHp, targetMaxHp:combat.maxHp, healTargetHp:pHp });
            skillPushed = true;
          } else if(['atk_buff','def_buff','agi_buff'].includes(skillEffect.type)){
            const buffKey=skillEffect.type.split('_')[0]; applyBuff(buffKey, skillEffect.value, skillEffect.turns, round);
            actions.push({ actor:'player', skill:activeAffix.name, buff:skillEffect.value, type:'skill', targetHp:pHp, targetMaxHp:combat.maxHp });
            skillPushed = true;
          } else if(skillEffect.type==='gold_buff'){
            skillGoldBonus += skillEffect.value;
            actions.push({ actor:'player', skill:activeAffix.name, buff:skillEffect.value, type:'skill', targetHp:pHp, targetMaxHp:combat.maxHp });
            skillPushed = true;
          } else {
            actions.push({ actor:'player', skill:activeAffix.name, type:'skill', note:skillEffect.type, targetHp:pHp, targetMaxHp:combat.maxHp });
            skillPushed = true;
          }
          if(skillPushed && skillEffect.heal){
            const healAmount=Math.floor(combat.maxHp*skillEffect.heal); pHp=Math.min(combat.maxHp,pHp+healAmount);
            const lastAction = actions[actions.length-1];
            if(lastAction.heal) lastAction.heal += healAmount; else lastAction.heal = healAmount;
            lastAction.selfHeal = healAmount; lastAction.selfHp = pHp; lastAction.healTargetHp = pHp;
          }
        }
      } else if(actor==='monster'){
        doMonsterNormalAction(actions);
      } else {
        doPlayerNormalAction(actions);
      }
    }

    rounds.push({ round, actions, pHp:Math.max(0,pHp), mHp:Math.max(0,mCurHp), pActions:curPActions, mActions:curMActions });

    if (mCurHp <= 0) { result = 'win'; break; }
    if (pHp <= 0) {
      if (combat.revive>0 && !revived) {
        pHp = Math.floor(combat.maxHp * combat.revive);
        revived = true;
        rounds.push({ round, actions: [{ actor:'player', skill:'圣光复生!', revive:true, type:'passive', source:'revive', targetHp:pHp, targetMaxHp:combat.maxHp }], pHp, mHp:Math.max(0,mCurHp), pActions:0, mActions:0 });
      } else {
        result = 'lose';
        break;
      }
    }
  }

  pMp = Math.min(combat.maxMp, pMp + Math.floor(combat.maxMp * 0.1));

  return {
    result, rounds,
    playerHp: Math.max(0, pHp),
    playerMaxHp: combat.maxHp,
    playerMp: pMp,
    playerMaxMp: combat.maxMp,
    monsterHp: Math.max(0, mCurHp),
    monsterMaxHp: mHp,
    monsterName: monster.name,
    agiRatio: agiRatio.toFixed(2),
    combatStats: { atk: combat.atk, def: combat.def, agi: combat.agi, crit: combat.crit, dodge: combat.dodge },
    skillGoldBonus
  };
}

// ====== 挂机收益计算 ======
function calculateIdle(player) {
  player = migratePlayer(player);
  const area = AREAS[player.currentArea];
  if (!area) return null;

  const now = getNow();
  const elapsed = now - player.lastTick;
  if (elapsed < 3000) return null;

  recalcMaxStats(player);

  const monster = area.monsters[Math.floor(_rand() * area.monsters.length)];
  const battleMonster = buildBattleMonster(monster, player.strategy);
  const battle = simulateBattle(player, battleMonster);

  player.hp = battle.playerHp;
  player.mp = battle.playerMp;

  const total = getTotalStats(player);
  const eqBonus = getEquipBonus(player);
  const lawBonus = getLawBonus(player);
  const raceBonus = getRaceBonus(player);
  const talents = getJobTalents(player);

  let expGain = 0;
  let goldGain = 0;
  let drops = [];

  // 基础倍率（保留现有回归项）
  let expMult = 1 + total.expBonus + lawBonus.exp + (raceBonus.exp || 0);
  let goldMult = 1 + total.goldBonus + lawBonus.gold;
  if (player.godhood === 'demigod') expMult *= 1.5;
  if (player.godhood === 'god') expMult *= 2;
  // 策略收益倍率（插入点固定，读 STRATEGIES 单一数据源）
  const stratEff = STRATEGIES[player.strategy]?.effects || {};
  if (stratEff.exp) expMult *= (1 + stratEff.exp);
  if (stratEff.gold) goldMult *= (1 + stratEff.gold);

  if (battle.result === 'win') {
    if(battle.skillGoldBonus) goldMult *= (1 + battle.skillGoldBonus);
    expGain = Math.floor(monster.exp * expMult);
    goldGain = Math.floor(monster.gold * goldMult);

    // 雷霆系击杀额外EXP
    if (talents.killExp) {
      const bonusExp = talents.killExp === 'level*2' ? player.level * 2 : Math.floor(monster.exp * talents.killExp);
      expGain += bonusExp;
    }

    // 词条击杀加成
    if (total.killExp) expGain += Math.floor(monster.exp * total.killExp);
    if (total.killGold) goldGain += Math.floor(monster.gold * total.killGold);
    if (total.flatExp) expGain += total.flatExp;

    // 炼金系4阶双倍（仅 win）
    if (total.doubleKill) {
      expGain *= 2;
      goldGain *= 2;
    }

    player.exp += expGain;
    if (goldGain > 0) grantGold(player, goldGain);
    player.killCount = (player.killCount || 0) + 1;
    // BOSS 语义：仅 isBoss 标记的世界 BOSS 计入周榜（见 server/data.js），避免普通怪误计
    if (monster.isBoss) player.bossKills = (player.bossKills || 0) + 1;

    if (player.godhood) {
      player.faith += Math.floor(monster.exp * 0.1);
    }

    for (const drop of area.drops) {
      if (shouldDrop(drop.rate, player.strategy)) {
        if (drop.type === 'material') {
          drops.push(drop.name);
          const existing = player.inventory.find(i => i.name === drop.name);
          if (existing) existing.count++;
          else player.inventory.push({ name: drop.name, count: 1, type: 'material' });
        } else if (drop.type === 'equip') {
          const item = createEquipItem(drop.template, genUid());
          if (item) {
            player.equips.push(item);
            drops.push(`${item.name} [${item.quality}]`);
            ensureQuestStats(player);
            if (!player.questStats.seenEquipTemplates.includes(item.templateId)) player.questStats.seenEquipTemplates.push(item.templateId);
          }
        }
      }
    }
    // 日常：击杀与战斗场次
    updateDailyProgress(player, 'hunt50', 1);
    updateDailyProgress(player, 'battle20', 1);
    checkAchievements(player);
  } else if (battle.result === 'lose') {
    expGain = Math.floor(monster.exp * 0.1 * expMult);
    player.exp += expGain;
    player.hp = Math.max(1, Math.floor(player.maxHp * 0.1));
    updateDailyProgress(player, 'battle20', 1);
  } else {
    expGain = Math.floor(monster.exp * 0.3 * expMult);
    player.exp += expGain;
    updateDailyProgress(player, 'battle20', 1);
  }

  player.mp = Math.min(player.maxMp, player.mp + Math.ceil(player.maxMp * 0.05));

  // 回血被动
  if (total.regen > 0 && player.hp > 0) {
    player.hp = Math.min(player.maxHp, player.hp + Math.floor(player.maxHp * total.regen));
  }

  const logEntry = {
    time: now, type: 'battle',
    monster: { name: monster.name, hp: monster.hp, atk: battleMonster.atk, def: monster.def, agi: monster.agi },
    monsterBaseAtk: monster.atk,
    strategy: player.strategy,
    result: battle.result,
    rounds: battle.rounds.length,
    agiRatio: battle.agiRatio,
    exp: expGain, gold: goldGain, drops,
    detail: battle.rounds.slice(-6),
    finalPHp: battle.playerHp,
    finalMHP: battle.monsterHp,
    combatAtk: battle.combatStats.atk,
    combatDef: battle.combatStats.def,
    combatAgi: battle.combatStats.agi,
    combatCrit: battle.combatStats.crit,
    combatDodge: battle.combatStats.dodge
  };

  player.logs.push(logEntry);
  if (player.logs.length > 30) player.logs = player.logs.slice(-30);

  // 升级
  const levelUps = [];
  while (player.exp >= expToNext(player.level)) {
    player.exp -= expToNext(player.level);
    player.level++;
    player.attrPoints += 3;
    player.skillPoints += 1;
    player.maxHp += 20;
    player.maxMp += 10;
    player.hp = player.maxHp;
    player.mp = player.maxMp;
    levelUps.push(player.level);

    if (player.jobPath) {
      const tree = JOB_TREE[player.jobPath];
      for (const stage of tree.stages) {
        if (stage.level === player.level) {
          player.job = stage.name;
          player.logs.push({ time: now, type: 'job', text: `${stage.desc}，职业进阶为：${stage.name}！被动词条槽位+1` });
        }
      }
    }
  }

  if (levelUps.length > 0) {
    const top = levelUps[levelUps.length - 1];
    player.logs.push({ time: now, type: 'levelup', level: top, text: `等级提升！Lv.${top}，+${levelUps.length * 3}属性 +${levelUps.length}技能点` });
    checkAchievements(player);
  } else if (expGain > 0) {
    // 即使未升级也检查满级等
    checkAchievements(player);
  }

  player.lastTick = now;
  return { logEntry, levelUps };
}

// ====== 分配属性点 ======
function allocateAttributes(player, allocation) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  const total = (allocation.atk || 0) + (allocation.def || 0) + (allocation.hp || 0) + (allocation.agi || 0);
  if (total > player.attrPoints) return { success: false, message: '属性点不足' };
  if (total < 1) return { success: false, message: '请至少分配1点' };
  player.attributes.atk += allocation.atk || 0;
  player.attributes.def += allocation.def || 0;
  player.attributes.hp += allocation.hp || 0;
  player.attributes.agi += allocation.agi || 0;
  player.attrPoints -= total;
  recalcMaxStats(player);
  updateDailyProgress(player, 'alloc1', 1);
  checkAchievements(player);
  return { success: true };
}

function recalcMaxStats(player) {
  const eq = getEquipBonus(player);
  const affix = getAffixBonus(player);
  const raceBonus = getRaceBonus(player);
  const godBonus = getGodhoodBonus(player);
  const base = player.attributes;
  const godMult = player.godhood === 'demigod' ? 2 : (player.godhood === 'god' ? 3 : 1);

  const baseHp = 100 + (player.level - 1) * 20 + base.hp * 10 + eq.hp + (raceBonus.con || 0) * 5 + (godBonus.hp || 0) * 5;
  player.maxHp = Math.floor(baseHp * (1 + affix.hp) * godMult);
  player.maxMp = (50 + (player.level - 1) * 10 + eq.mp) * godMult;
  if (player.hp > player.maxHp) player.hp = player.maxHp;
  if (player.mp > player.maxMp) player.mp = player.maxMp;
}

// ====== 选择职业 ======
function chooseJob(player, jobPath) {
  if (player.level < 11) return { success: false, message: '需要 Lv.11' };
  if (player.jobPath) return { success: false, message: '已选择职业' };
  if (!JOB_TREE[jobPath]) return { success: false, message: '职业不存在' };
  player.jobPath = jobPath;
  player.job = JOB_TREE[jobPath].stages[0].name;
  player.logs.push({ time: getNow(), type: 'job', text: `${JOB_TREE[jobPath].stages[0].desc}，职业：${player.job}！解锁2个被动词条槽位` });
  return { success: true };
}

// ====== 装备/卸下词条 ======
function equipAffix(player, affixId, slot) {
  player = migratePlayer(player);
  const affix = findAffix(affixId);
  if (!affix) return { success: false, message: '词条不存在' };

  // 检查等级
  const affixLevel = AFFIX_LEVELS[affix.level];
  if (player.level < affixLevel.reqLevel) return { success: false, message: `需要 Lv.${affixLevel.reqLevel}` };

  if (affix.slot === 'active') {
    // 装备主动词条（只能装1个）
    player.affixes.active = affixId;
    player.logs.push({ time: getNow(), type: 'affix', text: `装备主动词条：${affix.name}` });
  } else {
    // 装备被动词条
    const maxSlots = getPassiveSlots(player);
    if (player.affixes.passive.length >= maxSlots) return { success: false, message: `被动词条槽位已满（${maxSlots}个）` };
    if (player.affixes.passive.includes(affixId)) return { success: false, message: '已装备此词条' };
    player.affixes.passive.push(affixId);
    player.logs.push({ time: getNow(), type: 'affix', text: `装备被动词条：${affix.name}` });
  }
  recalcMaxStats(player);
  // T-040 日常与收集
  refreshDailyIfNeeded(player);
  updateDailyProgress(player, 'affix1', 1);
  ensureQuestStats(player);
  if(!player.questStats.affixSeen.includes(affixId)) player.questStats.affixSeen.push(affixId);
  checkAchievements(player);
  return { success: true };
}

function unequipAffix(player, affixId) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  if (player.affixes.active === affixId) {
    player.affixes.active = null;
    updateDailyProgress(player, 'affix1', 1);
    checkAchievements(player);
    return { success: true };
  }
  const idx = player.affixes.passive.indexOf(affixId);
  if (idx !== -1) {
    player.affixes.passive.splice(idx, 1);
    recalcMaxStats(player);
    updateDailyProgress(player, 'affix1', 1);
    checkAchievements(player);
    return { success: true };
  }
  return { success: false, message: '未装备此词条' };
}

// ====== 穿戴/卸下装备 ======
function equipItem(player, itemUid) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  const idx = player.equips.findIndex(e => e.uid === itemUid);
  if (idx === -1) return { success: false, message: '装备不存在' };
  const item = player.equips[idx];
  if (player.level < item.reqLevel) return { success: false, message: `需要 Lv.${item.reqLevel}` };
  const old = player.equipped[item.slot];
  if (old) player.equips.push(old);
  player.equipped[item.slot] = item;
  player.equips.splice(idx, 1);
  recalcMaxStats(player);
  ensureQuestStats(player);
  if (item.templateId && !player.questStats.seenEquipTemplates.includes(item.templateId)) {
    player.questStats.seenEquipTemplates.push(item.templateId);
  }
  checkAchievements(player);
  return { success: true };
}

function unequipItem(player, slot) {
  player = migratePlayer(player);
  if (!player.equipped[slot]) return { success: false, message: '该位置无装备' };
  player.equips.push(player.equipped[slot]);
  player.equipped[slot] = null;
  recalcMaxStats(player);
  return { success: true };
}

// ====== 使用消耗品 ======
function useConsumable(player, itemId, count = 1) {
  const shopItem = SHOP_ITEMS.find(s => s.id === itemId);
  if (!shopItem) return { success: false, message: '物品不存在' };
  const invItem = player.inventory.find(i => i.name === shopItem.name);
  if (!invItem || invItem.count < count) return { success: false, message: '数量不足' };
  invItem.count -= count;
  if (invItem.count <= 0) player.inventory = player.inventory.filter(i => i !== invItem);
  for (let i = 0; i < count; i++) {
    if (itemId === 'hp_potion') player.hp = Math.min(player.maxHp, player.hp + 100);
    else if (itemId === 'mp_potion') player.mp = Math.min(player.maxMp, player.mp + 50);
    else if (itemId === 'exp_scroll') player.exp += 500;
  }
  return { success: true };
}

// ====== 购买 ======
function buyItem(player, itemId, count = 1) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  const shopItem = SHOP_ITEMS.find(s => s.id === itemId);
  if (!shopItem) return { success: false, message: '物品不存在' };
  const totalCost = shopItem.price * count;
  if (player.gold < totalCost) return { success: false, message: '金币不足' };
  player.gold -= totalCost;
  if (shopItem.type === 'consumable') {
    const existing = player.inventory.find(i => i.name === shopItem.name);
    if (existing) existing.count += count;
    else player.inventory.push({ name: shopItem.name, count, type: 'consumable', itemId });
  } else if (shopItem.type === 'equip') {
    for (let i = 0; i < count; i++) {
      const item = createEquipItem(itemId, genUid());
      if (item) {
        player.equips.push(item);
        ensureQuestStats(player);
        if (!player.questStats.seenEquipTemplates.includes(item.templateId)) player.questStats.seenEquipTemplates.push(item.templateId);
      }
    }
    checkAchievements(player);
  }
  updateDailyProgress(player, 'buy1', 1);
  return { success: true };
}

// ====== 出售 ======
function sellMaterial(player, itemName, count = 1) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  const invItem = player.inventory.find(i => i.name === itemName);
  if (!invItem || invItem.count < count) return { success: false, message: '数量不足' };
  if (invItem.type && invItem.type !== 'material') return { success: false, message: '该物品不可出售' };
  const price = MATERIAL_PRICES[itemName] || 5;
  grantGold(player, price * count);
  invItem.count -= count;
  if (invItem.count <= 0) player.inventory = player.inventory.filter(i => i !== invItem);
  return { success: true, gold: price * count };
}

function sellEquip(player, itemUid) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  const idx = player.equips.findIndex(e => e.uid === itemUid);
  if (idx === -1) return { success: false, message: '装备不存在' };
  const price = EQUIP_SELL_PRICES[player.equips[idx].quality] || 20;
  grantGold(player, price);
  player.equips.splice(idx, 1);
  return { success: true, gold: price };
}

// ====== 种族进化 ======
function evolveRace(player) {
  player = migratePlayer(player);
  const raceData = RACE_EVOLUTION[player.race];
  if (!raceData || !raceData.nextEvolution) return { success: false, message: '已达到最高种族形态' };
  const next = RACE_EVOLUTION[raceData.nextEvolution];
  if (player.level < next.reqLevel) return { success: false, message: `需要 Lv.${next.reqLevel} 才能进化` };
  if (next.reqMaterial) {
    const mat = player.inventory.find(i => i.name === next.reqMaterial.name);
    if (!mat || mat.count < next.reqMaterial.count) {
      return { success: false, message: `需要 ${next.reqMaterial.name} ×${next.reqMaterial.count}` };
    }
    mat.count -= next.reqMaterial.count;
    if (mat.count <= 0) player.inventory = player.inventory.filter(i => i !== mat);
  }
  player.race = next.name;
  player.raceStage = next.stage;
  recalcMaxStats(player);
  player.logs.push({ time: getNow(), type: 'evolve', text: `种族进化！你已蜕变为 ${next.name}！${next.bonusText}` });
  return { success: true };
}

// ====== 附魔装备 ======
function enchantItem(player, itemUid, recipeId) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  const item = player.equips.find(e => e.uid === itemUid) || Object.values(player.equipped).find(e => e && e.uid === itemUid);
  if (!item) return { success: false, message: '装备不存在' };
  const recipe = ENCHANT_RECIPES.find(r => r.id === recipeId);
  if (!recipe) return { success: false, message: '附魔配方不存在' };
  if (item.slot !== recipe.slot) return { success: false, message: `此附魔仅适用于${recipe.slot === 'weapon' ? '武器' : recipe.slot === 'armor' ? '护甲' : '饰品'}` };
  if (!item.enchants) item.enchants = [];
  if (item.enchants.length >= MAX_ENCHANT_SLOTS) return { success: false, message: '附魔槽已满（最多3个）' };
  if (item.enchants.includes(recipeId)) return { success: false, message: '已有相同附魔' };
  if (player.gold < recipe.cost) return { success: false, message: `需要 ${recipe.cost} 金币` };
  for (const mat of recipe.materials) {
    const inv = player.inventory.find(i => i.name === mat.name);
    if (!inv || inv.count < mat.count) return { success: false, message: `需要 ${mat.name} ×${mat.count}` };
  }
  player.gold -= recipe.cost;
  for (const mat of recipe.materials) {
    const inv = player.inventory.find(i => i.name === mat.name);
    inv.count -= mat.count;
    if (inv.count <= 0) player.inventory = player.inventory.filter(i => i !== inv);
  }
  item.enchants.push(recipeId);
  recalcMaxStats(player);
  player.logs.push({ time: getNow(), type: 'enchant', text: `附魔成功！${item.name} 获得 ${recipe.name}效果` });
  updateDailyProgress(player, 'enchant1', 1);
  checkAchievements(player);
  return { success: true };
}

// ====== 学习法则 ======
function learnLaw(player, lawId) {
  player = migratePlayer(player);
  const law = LAWS.find(l => l.id === lawId);
  if (!law) return { success: false, message: '法则不存在' };
  if (player.level < law.reqLevel) return { success: false, message: `需要 Lv.${law.reqLevel}` };
  if (player.laws.includes(lawId)) return { success: false, message: '已学习此法则' };
  const mat = player.inventory.find(i => i.name === law.cost.name);
  if (!mat || mat.count < law.cost.count) return { success: false, message: `需要 ${law.cost.name} ×${law.cost.count}` };
  mat.count -= law.cost.count;
  if (mat.count <= 0) player.inventory = player.inventory.filter(i => i !== mat);
  player.laws.push(lawId);
  player.logs.push({ time: getNow(), type: 'law', text: `领悟了 ${law.name}！${law.desc}` });
  return { success: true };
}

// ====== 转生（为转生榜提供真实写入，最小可用；完整 T-010 后扩展） ======
function doReincarnate(player) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  if (player.level < 100) return { success: false, message: '需要 Lv.100 才能转生' };
  player.reincarnation = (player.reincarnation || 0) + 1;
  player.level = 1;
  player.exp = 0;
  player.attrPoints = 0;
  player.skillPoints = 0;
  // 重置属性为初始值，避免 2580/1040 残留
  player.attributes = { atk: 5, def: 4, hp: 5, agi: 8 };
  recalcMaxStats(player);
  player.hp = player.maxHp;
  player.mp = player.maxMp;
  player.lastTick = getNow();
  player.logs.push({ time: getNow(), type: 'reincarnate', text: `转生成功！第 ${player.reincarnation} 次轮回，属性已重置，战力将重新成长` });
  checkAchievements(player);
  return { success: true };
}

// ====== 登神 ======
function attemptAscension(player) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  if (player.godhood === 'god') return { success: false, message: '已是神灵' };

  const target = player.godhood === null ? 'demigod' : 'god';
  const asc = ASCENSION[target];
  const attrs = player.attributes;

  if (player.level < asc.reqLevel) return { success: false, message: `需要 Lv.${asc.reqLevel}` };
  const minAttr = Math.min(attrs.atk || 0, attrs.def || 0, attrs.hp || 0, attrs.agi || 0);
  const reqAttr = asc.reqAttr || 50;
  if (minAttr < reqAttr) {
    return { success: false, message: `每项属性需达到 ${reqAttr}（最低项当前 ${minAttr}）` };
  }
  if (player.laws.length < asc.reqLaws) return { success: false, message: `需学会至少 ${asc.reqLaws} 个法则` };
  if (asc.reqFaith && player.faith < asc.reqFaith) return { success: false, message: `需要信仰值 ${asc.reqFaith}（当前 ${player.faith}）` };

  player.godhood = target;
  recalcMaxStats(player);
  player.hp = player.maxHp;
  player.mp = player.maxMp;
  player.logs.push({ time: getNow(), type: 'ascend', text: `${asc.desc}！你已登临${asc.name}之位！${asc.bonusText}` });
  checkAchievements(player);
  return { success: true };
}

// ====== 获取角色完整信息 ======
function getPlayerView(player) {
  player = migratePlayer(player);
  refreshDailyIfNeeded(player);
  const stage = getStageFull(player.level, player.godhood);
  const area = AREAS[player.currentArea];
  const total = getTotalStats(player);
  const eqBonus = getEquipBonus(player);
  const lawBonus = getLawBonus(player);
  const raceData = RACE_EVOLUTION[player.race];
  const nextRace = raceData && raceData.nextEvolution ? RACE_EVOLUTION[raceData.nextEvolution] : null;
  const jobStage = getJobStage(player);
  const passiveSlots = getPassiveSlots(player);

  let jobInfo = null;
  if (player.jobPath) {
    const tree = JOB_TREE[player.jobPath];
    jobInfo = {
      path: tree.id, pathName: tree.name, desc: tree.desc, icon: tree.icon,
      growth: tree.growth, talents: tree.talents, mechanics: tree.mechanics,
      stages: tree.stages, currentStage: player.job,
      jobStage,
      nextStage: tree.stages.find(s => s.level > player.level)
    };
  }

  // 词条信息
  const availableAffixLevels = getAvailableAffixLevels(player);
  const affixData = {};
  for (const lv of availableAffixLevels) {
    affixData[lv] = {
      level: lv,
      config: AFFIX_LEVELS[lv],
      active: AFFIX_TREE[lv].filter(a => a.slot === 'active'),
      passive: AFFIX_TREE[lv].filter(a => a.slot === 'passive')
    };
  }

  const equippedAffixes = {
    active: player.affixes.active ? findAffix(player.affixes.active) : null,
    passive: player.affixes.passive.map(id => findAffix(id)).filter(Boolean)
  };

  // 附魔配方
  const enchantsBySlot = { weapon: [], armor: [], accessory: [] };
  for (const r of ENCHANT_RECIPES) {
    enchantsBySlot[r.slot].push(r);
  }

  // 法则信息
  const availableLaws = LAWS.map(l => ({
    ...l, learned: player.laws.includes(l.id),
    canLearn: player.level >= l.reqLevel && !player.laws.includes(l.id),
    locked: player.level < l.reqLevel
  }));

  // 登神信息
  const ascensionInfo = {
    godhood: player.godhood,
    faith: player.faith,
    demigod: { ...ASCENSION.demigod, canAscend: player.godhood === null },
    god: { ...ASCENSION.god, canAscend: player.godhood === 'demigod' },
    currentReq: player.godhood === null ? ASCENSION.demigod : ASCENSION.god
  };

  const strategy = player.strategy || 'balanced';
  const strategyChangedAt = Number.isFinite(player.strategyChangedAt) ? player.strategyChangedAt : 0;
  const strategyCdRemaining = strategyChangedAt === 0 ? 0 : Math.max(0, STRATEGY_CD_MS - (getNow() - strategyChangedAt));
  const strategies = Object.entries(STRATEGIES).map(([id, cfg]) => ({
    id, name: cfg.name, desc: cfg.desc, reqLevel: cfg.reqLevel,
    unlocked: player.level >= cfg.reqLevel,
    active: id === strategy
  }));

  // T-040 questView
  const dailyQuestsView = (player.dailyQuests || []).map(dq => {
    const tpl = DAILY_QUESTS.find(q => q.id === dq.id) || {};
    return { id: dq.id, name: tpl.name || dq.id, desc: tpl.desc || '', progress: dq.progress, target: dq.target, done: !!dq.done, claimed: !!dq.claimed, reward: tpl.reward || null };
  });
  const claimedCount = (player.dailyQuests || []).filter(q => q.claimed).length;
  const chestView = { need: DAILY_CHEST.need, claimed: !!player.dailyChestClaimed, canClaim: claimedCount >= DAILY_CHEST.need && !player.dailyChestClaimed, reward: null };
  const achievementsView = ACHIEVEMENTS.map(a => {
    const rec = (player.achievements || {})[a.id] || { unlocked: false, claimed: false };
    let title = a.title;
    if(a.id==='ascend'){
      title = rec.grantedTitle || (player.godhood==='god' ? '神灵' : '半神');
      if(rec.claimed && !rec.grantedTitle) title = (player.titles||[]).includes('神灵') ? '神灵' : '半神';
    }
    return { id: a.id, name: a.name, desc: a.desc, unlocked: !!rec.unlocked, claimed: !!rec.claimed, reward: a.reward, title };
  });
  const questView = { dailyQuests: dailyQuestsView, chest: chestView, achievements: achievementsView, titles: player.titles || [], currentTitle: player.currentTitle || null };

  return {
    username: player.username, name: player.name, race: player.race, raceStage: player.raceStage,
    level: player.level, exp: player.exp, expNeeded: expToNext(player.level),
    job: player.job, jobPath: player.jobPath, godhood: player.godhood, faith: player.faith,
    stage, attributes: player.attributes, attrPoints: player.attrPoints, skillPoints: player.skillPoints,
    hp: player.hp, maxHp: player.maxHp, mp: player.mp, maxMp: player.maxMp,
    gold: player.gold, killCount: player.killCount || 0, reincarnation: player.reincarnation || 0, bossKills: player.bossKills || 0, powerScore: getPowerScore(player), currentArea: player.currentArea, areaName: area ? area.name : '未知',
    inventory: player.inventory, equips: player.equips, equipped: player.equipped,
    affixes: player.affixes, equippedAffixes, affixData, passiveSlots,
    totalStats: total, equipBonus: eqBonus,
    laws: player.laws, lawBonus, availableLaws, ascensionInfo,
    raceInfo: { current: raceData, next: nextRace },
    enchantsBySlot,
    combatStats: getCombatStats(player),
    logs: player.logs.slice(-20).reverse(), lastTick: player.lastTick,
    canChooseJob: player.level >= 11 && !player.jobPath,
    canEvolve: nextRace ? (player.level >= nextRace.reqLevel) : false,
    jobInfo,
    strategy, strategyChangedAt, strategyCdRemaining, strategies,
    titles: player.titles || [], currentTitle: player.currentTitle || null,
    questView,
    tutorialStep: normalizeTutorialStep(player.tutorialStep), tutorialDone: normalizeTutorialStep(player.tutorialStep)===6
  };
}

// ====== 战力评分（用于排行榜） ======
// 口径：与 GAMEPLAY_GUIDE 保持一致，采用“总属性之和” = atk + def + hp + agi
// 如需调整权重，需同步更新 GAMEPLAY_TASKS.md 与接口文档
function getPowerScore(player) {
  const total = getTotalStats(player);
  return Math.floor(total.atk + total.def + total.hp + total.agi);
}

// 只读规范化：深拷贝后迁移，不污染原存档（供排行榜等 GET 使用）
function getReadonlyPlayer(player) {
  const clone = JSON.parse(JSON.stringify(player));
  return migratePlayer(clone);
}

module.exports = {
  createCharacter, calculateIdle, allocateAttributes, getPlayerView,
  migratePlayer, getReadonlyPlayer, chooseJob, equipItem, unequipItem,
  useConsumable, buyItem, recalcMaxStats, sellMaterial, sellEquip,
  evolveRace, enchantItem, learnLaw, attemptAscension, doReincarnate,
  simulateBattle, getCombatStats, getTotalStats, getPowerScore, getStageFull,
  getCurrentWeekKey, maybeResetWeeklyBossKills,
  equipAffix, unequipAffix, findAffix, getPassiveSlots, getJobStage,
  buildBattleMonster, shouldDrop, getActiveSkillCd, shouldTriggerActiveSkill,
  getNow, __setNow, __setRandom, __setDropRandom, __resetSeams,
  createDailyQuests, refreshDailyIfNeeded, updateDailyProgress, grantGold, grantExpWithLevelUp, checkAchievements,
  claimDaily, claimChest, claimAchievement, getTodayKey,
  normalizeTutorialStep, updateTutorialStep
};
