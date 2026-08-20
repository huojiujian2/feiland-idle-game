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
    // 5->6 via skip always 200 (jobPath enforced by UI waiting, not server)
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

describe('T-050 tutorial HTTP (via app.handle)', ()=>{
  const http = require('node:http')
  const { PassThrough } = require('node:stream')
  const store = require('./store')
  const app = require('./index')
  const os = require('node:os')
  const path = require('node:path')
  const tmpDbPath = path.join(os.tmpdir(), `test-tutorial-http-${Date.now()}-${Math.random().toString(36).slice(2,6)}.json`)
  store.__setDbPath(tmpDbPath)
  store.__resetStore()
  store.__setDisableSave(true)
  function mockApp(method, url, body){
    return new Promise((resolve, reject)=>{
      const socket = new PassThrough()
      const req = new http.IncomingMessage(socket)
      req.method = method; req.url = url; req.headers = {}
      if(body !== undefined){
        req._body = true
        req.body = body
      }
      const res = new http.ServerResponse(req)
      const chunks=[]
      res.write = (c)=>{ if(c) chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c)); return true }
      res.end = (c)=>{ if(c) chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c)); const b=Buffer.concat(chunks).toString(); let d; try{ d=JSON.parse(b)}catch(e){d=b} resolve({status:res.statusCode,data:d}) }
      app.handle(req,res, (e)=>{ if(e) reject(e) })
      socket.end()
    })
  }
  beforeEach(()=>{
    engine.__resetSeams()
    store.__resetStore()
    store.__setDisableSave(true)
  })
  afterEach(()=>{
    engine.__resetSeams()
  })

  it('404 when player not exist', async ()=>{
    const r = await mockApp('POST','/api/player/nonexist/tutorial', {step:1})
    assert.equal(r.status,404)
    assert.equal(r.data.success,false)
  })

  it('400 when step missing/invalid via HTTP', async ()=>{
    const p = engine.createCharacter('http400','H')
    store.setPlayer('http400', p)
    store.setAccount('http400',{username:'http400',password:'p',hasCharacter:true})
    let r = await mockApp('POST','/api/player/http400/tutorial', {})
    assert.equal(r.status,400)
    r = await mockApp('POST','/api/player/http400/tutorial', {step:'a'})
    assert.equal(r.status,400)
    r = await mockApp('POST','/api/player/http400/tutorial', {step:99})
    assert.equal(r.status,400)
    r = await mockApp('POST','/api/player/http400/tutorial', {step:1.5})
    assert.equal(r.status,400)
  })

  it('409 non-monotonic and condition, 200 progression via HTTP', async ()=>{
    const p = engine.createCharacter('httpFlow','H')
    store.setPlayer('httpFlow', p)
    store.setAccount('httpFlow',{username:'httpFlow',password:'p',hasCharacter:true})
    // skip 0->2 should 409
    let r = await mockApp('POST','/api/player/httpFlow/tutorial', {step:2})
    assert.equal(r.status,409)
    // 0->1 200
    r = await mockApp('POST','/api/player/httpFlow/tutorial', {step:1})
    assert.equal(r.status,200)
    assert.equal(r.data.data.tutorialStep,1)
    // repeat 1 -> 409
    r = await mockApp('POST','/api/player/httpFlow/tutorial', {step:1})
    assert.equal(r.status,409)
    // 1->2 200
    r = await mockApp('POST','/api/player/httpFlow/tutorial', {step:2})
    assert.equal(r.status,200)
    // 2->3 without alloc1.done -> 409
    r = await mockApp('POST','/api/player/httpFlow/tutorial', {step:3})
    assert.equal(r.status,409)
    // make alloc1 done via direct engine (simulate allocate)
    const cur = store.getPlayer('httpFlow')
    const dq = cur.dailyQuests.find(q=>q.id==='alloc1')
    dq.done = true
    store.setPlayer('httpFlow', cur)
    r = await mockApp('POST','/api/player/httpFlow/tutorial', {step:3})
    assert.equal(r.status,200)
    // 3->4 200
    r = await mockApp('POST','/api/player/httpFlow/tutorial', {step:4})
    assert.equal(r.status,200)
    // 4->5 without level 5 -> 409
    const p2 = store.getPlayer('httpFlow')
    p2.level = 4
    store.setPlayer('httpFlow', p2)
    r = await mockApp('POST','/api/player/httpFlow/tutorial', {step:5})
    assert.equal(r.status,409)
    p2.level = 5
    store.setPlayer('httpFlow', p2)
    r = await mockApp('POST','/api/player/httpFlow/tutorial', {step:5})
    assert.equal(r.status,200)
    // 5->6 200
    r = await mockApp('POST','/api/player/httpFlow/tutorial', {step:6})
    assert.equal(r.status,200)
    assert.equal(r.data.data.tutorialStep,6)
    // 6 idempotent 200 from any (create fresh and skip)
    const p3 = engine.createCharacter('httpSkip','S')
    store.setPlayer('httpSkip', p3)
    store.setAccount('httpSkip',{username:'httpSkip',password:'p',hasCharacter:true})
    r = await mockApp('POST','/api/player/httpSkip/tutorial', {step:6})
    assert.equal(r.status,200)
    assert.equal(r.data.data.tutorialStep,6)
    r = await mockApp('POST','/api/player/httpSkip/tutorial', {step:6})
    assert.equal(r.status,200)
  })
})
