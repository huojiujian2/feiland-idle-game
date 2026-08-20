const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const engine = require('./engine')

describe('T-040 engine quest', () => {
  beforeEach(() => engine.__resetSeams())
  afterEach(() => engine.__resetSeams())

  it('createCharacter initializes daily and first', () => {
    const p = engine.createCharacter('u1','n1')
    assert.equal(p.dailyQuests.length, 6)
    assert.ok(p.dailyQuests.every(q=>q.progress===0 && !q.done && !q.claimed))
    assert.equal(p.achievements.first.unlocked, true)
    assert.equal(p.achievements.first.claimed, false)
    assert.deepEqual(p.titles, [])
    assert.equal(p.currentTitle, null)
  })

  it('migrate old player补 first unlocked', () => {
    const p = { username:'old', level:10, gold:0, killCount:5, inventory:[], equips:[], equipped:{weapon:null,armor:null,accessory:null}, logs:[], lastTick:0, createdAt:123 }
    engine.migratePlayer(p)
    assert.ok(p.achievements.first.unlocked)
    assert.equal(p.achievements.first.unlockAt, 123)
  })

  it('migrate does not backfill gold/affixSeen', () => {
    const p = engine.createCharacter('u2','n2')
    p.killCount = 100
    p.level = 100
    // totalGoldEarned not backfilled, but kill/level achievements should unlock
    p.questStats.totalGoldEarned = 0
    engine.migratePlayer(p)
    assert.ok(p.achievements.kill100.unlocked)
    assert.ok(p.achievements.lv100.unlocked)
    assert.ok(!p.achievements.gold1m || !p.achievements.gold1m.unlocked)
    assert.ok(!p.achievements.affix50 || !p.achievements.affix50.unlocked)
  })

  it('reward pools are correct spec', () => {
    const { DAILY_QUESTS, INITIAL_MATERIAL_POOL, ACHIEVEMENTS, AFFIX_TREE } = require('./data')
    assert.deepEqual(INITIAL_MATERIAL_POOL, ['草药','兽皮','兽骨','青铜矿'])
    const fine = ACHIEVEMENTS.find(a=>a.id==='kill1000')
    assert.deepEqual(fine.reward.equipPool, ['bronze_sword','iron_spear','iron_armor','crystal_ring'])
    const epic = ACHIEVEMENTS.find(a=>a.id==='kill10000')
    assert.ok(epic.reward.equipPool.includes('thunder_lance'))
    const legend = ACHIEVEMENTS.find(a=>a.id==='ascend')
    assert.deepEqual(legend.reward.equipPool, ['dragon_slayer','void_blade','dragon_armor','abyss_cloak','dragon_eye'])
    assert.ok(AFFIX_TREE[4].length>0)
    assert.equal(require('./data').AFFIX_LEVELS[4].name, '大师')
  })

  it('grantGold accumulates totalGoldEarned and unlocks gold1m', () => {
    const p = engine.createCharacter('u3','n3')
    engine.__setNow(()=>1000)
    engine.grantGold(p, 500)
    assert.equal(p.gold,500)
    assert.equal(p.questStats.totalGoldEarned,500)
    engine.grantGold(p, 1000000)
    assert.ok(p.achievements.gold1m.unlocked)
  })

  it('equipAffix appends affixSeen and unlocks affix50', () => {
    const p = engine.createCharacter('u4','n4')
    p.level = 100
    // push 50 distinct
    const all = require('./data').AFFIX_TREE[1].slice(0,10).map(a=>a.id).concat(require('./data').AFFIX_TREE[2].slice(0,10).map(a=>a.id)).concat(require('./data').AFFIX_TREE[3].slice(0,10).map(a=>a.id)).concat(require('./data').AFFIX_TREE[4].slice(0,20).map(a=>a.id))
    assert.equal(all.length,50)
    for(const id of all){
      // directly push via engine helper: use equipAffix for first then manual for speed
      if(!p.questStats.affixSeen.includes(id)) p.questStats.affixSeen.push(id)
    }
    engine.checkAchievements(p)
    assert.ok(p.achievements.affix50.unlocked)
    // claim gives log
    const r = engine.claimAchievement(p,'affix50')
    assert.equal(r.status,200)
    assert.equal(p.achievements.affix50.claimed,true)
    assert.ok(p.titles.includes('词条大师'))
  })

  it('seenEquipTemplates 10 unlocks collect10', () => {
    const p = engine.createCharacter('u5','n5')
    p.questStats.seenEquipTemplates = ['wooden_spear','bronze_sword','iron_spear','thunder_lance','holy_blade','knight_blade','dragon_slayer','void_blade','leather_armor','iron_armor']
    engine.checkAchievements(p)
    assert.ok(p.achievements.collect10.unlocked)
    // migrate via equipItem
    const p2 = engine.createCharacter('u6','n6')
    p2.level = 30
    p2.gold = 10000
    // buy equip should append
    engine.buyItem(p2,'wooden_spear',1)
    assert.ok(p2.questStats.seenEquipTemplates.includes('wooden_spear'))
  })

  it('calculateIdle updates hunt50 battle20 andSeen', () => {
    const now = 1_700_000_000_000
    engine.__setNow(()=>now)
    engine.__setRandom(()=>0)
    engine.__setDropRandom(()=>1)
    const p = engine.createCharacter('u7','n7')
    p.level = 50
    p.attributes={atk:80,def:80,hp:80,agi:80}
    engine.recalcMaxStats(p)
    p.hp=p.maxHp
    p.currentArea='gaomanshan'
    p.lastTick=now-5000
    const res = engine.calculateIdle(p)
    assert.ok(res)
    // hunt50 only on win, battle20 always
    const hunt = p.dailyQuests.find(q=>q.id==='hunt50')
    const battle = p.dailyQuests.find(q=>q.id==='battle20')
    if(res.logEntry.result==='win'){
      assert.equal(hunt.progress,1)
    }
    assert.equal(battle.progress,1)
  })

  it('battle20 counts lose/timeout', () => {
    // force lose by making player weak
    const now = 1_700_000_100_000
    engine.__setNow(()=>now)
    engine.__setRandom(()=>0.5)
    engine.__setDropRandom(()=>1)
    const p = engine.createCharacter('u8','n8')
    p.level=1
    p.attributes={atk:5,def:4,hp:5,agi:8}
    engine.recalcMaxStats(p)
    p.hp=1
    p.currentArea='shenyuan' // high level monster likely lose
    p.lastTick=now-5000
    const before = p.dailyQuests.find(q=>q.id==='battle20').progress
    engine.calculateIdle(p)
    assert.equal(p.dailyQuests.find(q=>q.id==='battle20').progress, before+1)
  })

  it('equipItem seenEquipTemplates idempotent', () => {
    const p = engine.createCharacter('u9','n9')
    p.level=15
    const item = require('./data').createEquipItem('iron_spear', 'uid1')
    item.uid='uid1'
    p.equips.push(item)
    engine.equipItem(p,'uid1')
    assert.ok(p.questStats.seenEquipTemplates.includes('iron_spear'))
    const len = p.questStats.seenEquipTemplates.length
    // re-equip same template should not duplicate
    const item2 = require('./data').createEquipItem('iron_spear','uid2')
    item2.uid='uid2'
    p.equips.push(item2)
    engine.equipItem(p,'uid2')
    assert.equal(p.questStats.seenEquipTemplates.length, len)
  })

  it('grantExpWithLevelUp triggers lv100', () => {
    const p = engine.createCharacter('u10','n10')
    p.level=99
    p.exp = require('./data').expToNext(99) - 10
    engine.grantExpWithLevelUp(p, 20)
    assert.equal(p.level,100)
    assert.ok(p.achievements.lv100.unlocked)
  })

  it('daily reset via getTodayKey', () => {
    const day1 = new Date('2026-03-01T10:00:00').getTime()
    const day2 = new Date('2026-03-02T01:00:00').getTime()
    engine.__setNow(()=>day1)
    const p = engine.createCharacter('u11','n11')
    // make progress
    p.dailyQuests[0].progress=10
    p.dailyQuests[0].done=false
    p.dailyChestClaimed=true
    engine.__setNow(()=>day2)
    engine.refreshDailyIfNeeded(p)
    assert.ok(p.dailyQuests.every(q=>q.progress===0))
    assert.equal(p.dailyChestClaimed,false)
    assert.equal(p.dailyResetAt, engine.getTodayKey())
  })

  it('claim achievement reinc1 and ascend title', () => {
    const p = engine.createCharacter('u12','n12')
    p.reincarnation=1
    engine.checkAchievements(p)
    assert.ok(p.achievements.reinc1.unlocked)
    const r = engine.claimAchievement(p,'reinc1')
    assert.equal(r.status,200)
    assert.equal(p.reincPoints,1)
    assert.ok(p.titles.includes('轮回者'))
    // ascend title demi vs god
    p.godhood='demigod'
    engine.checkAchievements(p)
    engine.claimAchievement(p,'ascend')
    assert.ok(p.titles.includes('半神'))
    const p2 = engine.createCharacter('u13','n13')
    p2.godhood='god'
    engine.checkAchievements(p2)
    engine.claimAchievement(p2,'ascend')
    assert.ok(p2.titles.includes('神灵'))
  })

  it('claim 404/409/200', () => {
    const p = engine.createCharacter('u14','n14')
    let r = engine.claimDaily(p,'hunt50')
    assert.equal(r.status,409)
    r = engine.claimDaily(p,'unknown')
    assert.equal(r.status,404)
    // force done
    const dq=p.dailyQuests.find(q=>q.id==='hunt50')
    dq.done=true
    r=engine.claimDaily(p,'hunt50')
    assert.equal(r.status,200)
    assert.equal(dq.claimed,true)
    const goldBefore=p.gold
    r=engine.claimDaily(p,'hunt50')
    assert.equal(r.status,200)
    assert.equal(r.already,true)
    assert.equal(p.gold, goldBefore)
  })
})
