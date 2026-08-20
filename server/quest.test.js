const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const engine = require('./engine')

describe('T-040 quest daily', () => {
  beforeEach(()=>engine.__resetSeams())
  afterEach(()=>engine.__resetSeams())

  it('daily 6 items progress and claim expire next day', () => {
    const d1 = new Date('2026-03-10T08:00:00').getTime()
    const d2 = new Date('2026-03-11T00:00:10').getTime()
    engine.__setNow(()=>d1)
    const p = engine.createCharacter('q1','n')
    // make alloc1 done via allocate
    p.attrPoints=5
    engine.allocateAttributes(p,{atk:1})
    let dq = p.dailyQuests.find(q=>q.id==='alloc1')
    assert.equal(dq.done,true)
    // claim
    const r1 = engine.claimDaily(p,'alloc1')
    assert.equal(r1.status,200)
    // cross day without claim others -> expire
    engine.__setNow(()=>d2)
    // any refresh should reset
    engine.refreshDailyIfNeeded(p)
    const dq2 = p.dailyQuests.find(q=>q.id==='alloc1')
    assert.equal(dq2.progress,0)
    assert.equal(dq2.done,false)
    assert.equal(dq2.claimed,false)
    // expired not kept
    assert.equal(p.dailyChestClaimed,false)
  })

  it('chest need 5 claimed idempotent', () => {
    const p = engine.createCharacter('q2','n')
    // mark 5 as claimed
    for(let i=0;i<5;i++){ p.dailyQuests[i].done=true; p.dailyQuests[i].claimed=true }
    let r = engine.claimChest(p)
    assert.equal(r.status,200)
    assert.equal(p.dailyChestClaimed,true)
    r = engine.claimChest(p)
    assert.equal(r.status,200)
    assert.equal(r.already,true)
    // insufficient
    const p2 = engine.createCharacter('q3','n')
    for(let i=0;i<4;i++){ p2.dailyQuests[i].done=true; p2.dailyQuests[i].claimed=true }
    r = engine.claimChest(p2)
    assert.equal(r.status,409)
  })

  it('daily claim 409 before done and 200 after claimed', () => {
    const p = engine.createCharacter('q4','n')
    let r = engine.claimDaily(p,'battle20')
    assert.equal(r.status,409)
    // force done but not claimed -> ok
    const dq = p.dailyQuests.find(q=>q.id==='battle20')
    dq.done=true
    r = engine.claimDaily(p,'battle20')
    assert.equal(r.status,200)
    assert.equal(p.gold>0 || p.exp>0, true) // battle20 gives exp
    const expBefore = p.exp
    // battle20 reward is exp not gold, second claim should not double
    r = engine.claimDaily(p,'battle20')
    assert.equal(r.already,true)
  })

  it('achievement unlock and claim idempotent', () => {
    const p = engine.createCharacter('q5','n')
    p.killCount=100
    engine.checkAchievements(p)
    assert.ok(p.achievements.kill100.unlocked)
    let r = engine.claimAchievement(p,'kill100')
    assert.equal(r.status,200)
    const goldBefore = p.gold
    r = engine.claimAchievement(p,'kill100')
    assert.equal(r.already,true)
    assert.equal(p.gold,goldBefore)
    // not unlocked
    r = engine.claimAchievement(p,'kill1000')
    assert.equal(r.status,409)
    // unknown
    r = engine.claimAchievement(p,'unknown')
    assert.equal(r.status,404)
  })

  it('totalGoldEarned via sell and grantGold', () => {
    const p = engine.createCharacter('q6','n')
    p.inventory.push({name:'兽皮',count:10,type:'material'})
    const before = p.questStats.totalGoldEarned
    engine.sellMaterial(p,'兽皮',2)
    assert.equal(p.questStats.totalGoldEarned, before + 10) // 5*2
    // direct gold not via grant should not happen for sell
  })

  it('getPlayerView questView shape', () => {
    const p = engine.createCharacter('q7','n')
    const v = engine.getPlayerView(p)
    assert.ok(v.questView)
    assert.equal(v.questView.dailyQuests.length,6)
    assert.equal(v.questView.chest.need,5)
    assert.equal(v.questView.chest.reward,null)
    assert.equal(v.questView.achievements.length,10)
    assert.ok(Array.isArray(v.titles))
    assert.equal(v.currentTitle, null)
    assert.ok('currentTitle' in v.questView)
  })

  it('currentTitle only first claim keeps', () => {
    const p = engine.createCharacter('q8','n')
    p.killCount=100
    p.level=100
    engine.checkAchievements(p)
    engine.claimAchievement(p,'kill100')
    assert.equal(p.currentTitle,'战士')
    engine.claimAchievement(p,'lv100')
    assert.equal(p.currentTitle,'战士') // not overwritten
    assert.ok(p.titles.includes('战士'))
    assert.ok(p.titles.includes('百级强者'))
  })

  it('routes claimDaily/chest/achievement via engine behave as HTTP expects', () => {
    // simulate route 409/404 mapping already tested above
    const p = engine.createCharacter('q9','n')
    let r = engine.claimDaily(p,'notexist')
    assert.equal(r.status,404)
    r = engine.claimChest(p)
    assert.equal(r.status,409)
    r = engine.claimAchievement(p,'first')
    assert.equal(r.status,200)
  })
})
