const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const { PassThrough } = require('node:stream')
const engine = require('./engine')
const store = require('./store')
const app = require('./index')
const fs = require('fs')
const os = require('os')
const path = require('path')

const tmpDbPath = path.join(os.tmpdir(), `test-quest-route-${Date.now()}-${Math.random().toString(36).slice(2,6)}.json`)
store.__setDbPath(tmpDbPath)
store.__resetStore()
store.__setDisableSave(true)

function mockApp(method, url){
  return new Promise((resolve, reject)=>{
    const socket = new PassThrough()
    const req = new http.IncomingMessage(socket)
    req.method = method
    req.url = url
    req.headers = {}
    // Express will parse params from url, no body needed
    const res = new http.ServerResponse(req)
    const chunks = []
    const origWrite = res.write.bind(res)
    const origEnd = res.end.bind(res)
    const origWriteHead = res.writeHead.bind(res)
    // Capture JSON via write/end
    res.write = (chunk, enc, cb)=>{
      if(chunk) chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk))
      return true
    }
    res.end = (chunk, enc, cb)=>{
      if(chunk) chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk))
      const body = Buffer.concat(chunks).toString()
      let data
      try{ data = body ? JSON.parse(body) : null }catch(e){ data = body }
      resolve({ status: res.statusCode, data })
      if(cb) cb()
    }
    // Need to ensure Express can set statusCode via res.status()
    // http.ServerResponse already has statusCode, and Express adds res.status()
    app.handle(req, res, (err)=>{
      if(err) reject(err)
    })
    // Need to emit 'end' for body parser? No body, so just end
    socket.end()
  })
}

describe('POST /quest routes HTTP (via app.handle)', ()=>{
  beforeEach(()=>{
    engine.__resetSeams()
    store.__resetStore()
    store.__setDisableSave(true)
  })
  afterEach(()=>{
    engine.__resetSeams()
    store.__setDisableSave(false)
  })

  it('daily unknown id 404 via HTTP', async ()=>{
    const p = engine.createCharacter('qr1','R')
    store.setPlayer('qr1', p)
    store.setAccount('qr1',{username:'qr1',password:'p',hasCharacter:true})
    const {status, data} = await mockApp('POST','/api/player/qr1/quest/daily/notexist/claim')
    assert.equal(status,404)
    assert.equal(data.success,false)
  })
  it('daily not done 409 via HTTP', async ()=>{
    const p = engine.createCharacter('qr2','R')
    store.setPlayer('qr2', p)
    store.setAccount('qr2',{username:'qr2',password:'p',hasCharacter:true})
    const {status} = await mockApp('POST','/api/player/qr2/quest/daily/battle20/claim')
    assert.equal(status,409)
  })
  it('daily done -> 200 and already 200 via HTTP', async ()=>{
    const p = engine.createCharacter('qr3','R')
    const dq = p.dailyQuests.find(q=>q.id==='alloc1')
    dq.done=true
    store.setPlayer('qr3', p)
    store.setAccount('qr3',{username:'qr3',password:'p',hasCharacter:true})
    let r = await mockApp('POST','/api/player/qr3/quest/daily/alloc1/claim')
    assert.equal(r.status,200)
    assert.equal(r.data.success,true)
    r = await mockApp('POST','/api/player/qr3/quest/daily/alloc1/claim')
    assert.equal(r.status,200)
    assert.equal(r.data.already||r.data.success,true)
  })
  it('chest need 5 -> 409 then 200 via HTTP', async ()=>{
    const p = engine.createCharacter('qr4','R')
    store.setPlayer('qr4', p)
    store.setAccount('qr4',{username:'qr4',password:'p',hasCharacter:true})
    let r = await mockApp('POST','/api/player/qr4/quest/chest/claim')
    assert.equal(r.status,409)
    for(let i=0;i<5;i++){ p.dailyQuests[i].done=true; p.dailyQuests[i].claimed=true }
    store.setPlayer('qr4', p)
    r = await mockApp('POST','/api/player/qr4/quest/chest/claim')
    assert.equal(r.status,200)
  })
  it('achievement unknown 404, not unlocked 409, already 200 via HTTP', async ()=>{
    const p = engine.createCharacter('qr5','R')
    store.setPlayer('qr5', p)
    store.setAccount('qr5',{username:'qr5',password:'p',hasCharacter:true})
    let r = await mockApp('POST','/api/player/qr5/quest/achievement/unknown/claim')
    assert.equal(r.status,404)
    r = await mockApp('POST','/api/player/qr5/quest/achievement/kill1000/claim')
    assert.equal(r.status,409)
    // unlock first
    p.achievements['first'].unlocked=true
    store.setPlayer('qr5', p)
    r = await mockApp('POST','/api/player/qr5/quest/achievement/first/claim')
    assert.equal(r.status,200)
    r = await mockApp('POST','/api/player/qr5/quest/achievement/first/claim')
    assert.equal(r.status,200)
  })
})
