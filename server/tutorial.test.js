const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const engine = require('./engine')

describe('T-050 tutorial', ()=>{
  beforeEach(()=>engine.__resetSeams())
  afterEach(()=>engine.__resetSeams())

  it('createCharacter tutorialStep 0', ()=>{
    const p = engine.createCharacter('t1','N')
    assert.equal(p.tutorialStep,0)
    const v = engine.getPlayerView(p)
    assert.equal(v.tutorialStep,0)
    assert.equal(v.tutorialDone,false)
  })

  it('migrate normalizes', ()=>{
    const p = engine.createCharacter('t2','N')
    p.tutorialStep = 'bad'
    engine.migratePlayer(p)
    assert.equal(p.tutorialStep,0)
    p.tutorialStep = -1
    engine.migratePlayer(p)
    assert.equal(p.tutorialStep,0)
    p.tutorialStep = 7
    engine.migratePlayer(p)
    assert.equal(p.tutorialStep,6)
    p.tutorialStep = 2.9
    engine.migratePlayer(p)
    assert.equal(p.tutorialStep,2)
    // old save without field
    const q = { username:'old', name:'O', level:10, jobPath:'thunder', tutorialStep: undefined, attributes:{atk:5,def:4,hp:5,agi:8}, attrPoints:0, skillPoints:0, affixes:{active:null,passive:[]}, hp:100,maxHp:100,mp:50,maxMp:50,gold:0,killCount:0,reincarnation:0,bossKills:0,currentArea:'gaomanshan',inventory:[],equips:[],equipped:{weapon:null,armor:null,accessory:null}, laws:[], logs:[], lastTick:Date.now(), createdAt:Date.now(), strategy:'balanced', strategyChangedAt:0, dailyQuests:[], dailyResetAt:'', dailyChestClaimed:false, achievements:{}, questStats:{totalGoldEarned:0,affixSeen:[],seenEquipTemplates:[]}, titles:[], currentTitle:null, reincPoints:0 }
    engine.migratePlayer(q)
    assert.equal(q.tutorialStep,0)
  })

  it('updateTutorialStep 400/409/200', ()=>{
    const p = engine.createCharacter('t3','N')
    // 400 illegal
    let r = engine.updateTutorialStep(p, 'a')
    assert.equal(r.status,400)
    r = engine.updateTutorialStep(p, 8)
    assert.equal(r.status,400)
    // 409 non-monotonic
    r = engine.updateTutorialStep(p, 2)
    assert.equal(r.status,409)
    // 0->1 ok
    r = engine.updateTutorialStep(p, 1)
    assert.equal(r.status,200)
    assert.equal(p.tutorialStep,1)
    // repeat 1 -> 409
    r = engine.updateTutorialStep(p, 1)
    assert.equal(r.status,409)
    // 1->2 ok
    r = engine.updateTutorialStep(p, 2)
    assert.equal(r.status,200)
    // 2->3 needs alloc1.done
    r = engine.updateTutorialStep(p, 3)
    assert.equal(r.status,409)
    // make alloc1 done
    const dq = p.dailyQuests.find(q=>q.id==='alloc1')
    dq.done=true
    r = engine.updateTutorialStep(p, 3)
    assert.equal(r.status,200)
    // 3->4 ok
    r = engine.updateTutorialStep(p, 4)
    assert.equal(r.status,200)
    // 4->5 needs level>=5
    p.level = 4
    r = engine.updateTutorialStep(p, 5)
    assert.equal(r.status,409)
    p.level = 5
    r = engine.updateTutorialStep(p, 5)
    assert.equal(r.status,200)
    // 5->6 needs jobPath
    r = engine.updateTutorialStep(p, 6)
    assert.equal(r.status,409)
    p.jobPath = 'thunder'
    r = engine.updateTutorialStep(p, 6)
    assert.equal(r.status,200)
    assert.equal(p.tutorialStep,6)
    // skip idempotent 6->6 from any
    const p2 = engine.createCharacter('t4','N')
    r = engine.updateTutorialStep(p2, 6)
    assert.equal(r.status,200)
    assert.equal(p2.tutorialStep,6)
    r = engine.updateTutorialStep(p2, 6)
    assert.equal(r.status,200)
  })

  it('view派生 tutorialDone', ()=>{
    const p = engine.createCharacter('t5','N')
    let v = engine.getPlayerView(p)
    assert.equal(v.tutorialDone,false)
    p.tutorialStep = 6
    v = engine.getPlayerView(p)
    assert.equal(v.tutorialDone,true)
  })
})
