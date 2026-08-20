const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const app = require('./index')

function hasRoute(method, path){
  const stack = app._router ? app._router.stack : (app.router ? app.router.stack : [])
  return stack.some(layer=>{
    if(!layer.route) return false
    const route = layer.route
    const methods = Object.keys(route.methods || {}).map(m=>m.toUpperCase())
    return methods.includes(method.toUpperCase()) && route.path === path
  })
}

describe('POST /quest routes registration', ()=>{
  it('daily claim route exists', ()=>{
    assert.equal(hasRoute('POST','/api/player/:username/quest/daily/:id/claim'), true)
  })
  it('chest claim route exists', ()=>{
    assert.equal(hasRoute('POST','/api/player/:username/quest/chest/claim'), true)
  })
  it('achievement claim route exists', ()=>{
    assert.equal(hasRoute('POST','/api/player/:username/quest/achievement/:id/claim'), true)
  })
  it('routes return 404/409/200 via engine (already covered)', ()=>{
    const engine = require('./engine')
    const p = engine.createCharacter('http1','H')
    // 404 unknown
    let r = engine.claimDaily(p,'notexist')
    assert.equal(r.status,404)
    // 409 not done
    r = engine.claimDaily(p,'battle20')
    assert.equal(r.status,409)
    // 200 after done
    const dq = p.dailyQuests.find(q=>q.id==='alloc1'); dq.done=true
    r = engine.claimDaily(p,'alloc1')
    assert.equal(r.status,200)
  })
})
