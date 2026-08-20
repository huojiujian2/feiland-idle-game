const { describe, it, before, after, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')

const engine = require('./engine')
const data = require('./data')
const store = require('./store')

// 隔离：使用临时 DB 文件，避免污染真实 server/db.json（Spec P2）
const tmpDbPath = path.join(os.tmpdir(), `test-feiland-${Date.now()}-${Math.random().toString(36).slice(2,6)}.json`)
store.__setDbPath(tmpDbPath)
store.__resetStore()
store.__setDisableSave(true) // 默认禁用定时落盘，单测按需启用并显式 save
const app = require('./index')

let server, base
before(async () => {
  await new Promise(res => {
    server = app.listen(0, () => {
      const addr = server.address()
      base = `http://127.0.0.1:${addr.port}`
      res()
    })
  })
})
after(() => new Promise(res => {
  server.close(() => {
    store.__setDisableSave(false)
    try{ fs.unlinkSync(tmpDbPath) }catch(e){}
    res()
  })
}))

function resetStore() {
  // 隔离：唯一用户名已足够，meta 清理交由 store.__resetStore 在需要时调用
}

beforeEach(() => {
  engine.__resetSeams()
  resetStore()
  store.__setDisableSave(true)
})
afterEach(() => {
  engine.__resetSeams()
  store.__setDisableSave(false)
})

async function postStrategy(username, strategy) {
  const res = await fetch(`${base}/api/player/${username}/strategy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strategy })
  })
  return res.json()
}

describe('POST /strategy 路由事务', () => {
  it('非法策略不结算不改 lastTick', async () => {
    const now = 1_700_000_000_000
    engine.__setNow(() => now)
    const p = engine.createCharacter('u_ill', 'U')
    p.lastTick = now - 10000
    const beforeTick = p.lastTick
    store.setPlayer('u_ill', p)
    store.setAccount('u_ill', { username:'u_ill', password:'p', hasCharacter:true })
    const res = await postStrategy('u_ill', '__proto__')
    assert.equal(res.success, false)
    assert.match(res.message, /不存在/)
    const after = store.getPlayer('u_ill')
    assert.equal(after.lastTick, beforeTick)
  })

  it('旧存档缺失 strategy 幂等 balanced 不结算不写日志', async () => {
    const now = 1_700_000_000_000
    engine.__setNow(() => now)
    // 模拟旧存档无 strategy 字段
    const raw = { username:'u_old', name:'U', level:5, exp:0, strategy: undefined, strategyChangedAt: undefined, lastTick: now - 1000, hp:100, maxHp:100, mp:50, maxMp:50, gold:0, currentArea:'gaomanshan', inventory:[], equips:[], equipped:{weapon:null,armor:null,accessory:null}, laws:[], logs:[], affixes:{active:null,passive:[]}, attributes:{atk:5,def:4,hp:5,agi:8}, attrPoints:0, skillPoints:0, race:'鹰人', raceStage:0, job:'无', jobPath:null, godhood:null, faith:0 }
    // 直接写入 store 绕过 migrate，模拟旧盘（经 API 以触发 dirty）
    store.setPlayer('u_old', raw)
    store.setAccount('u_old', { username:'u_old', password:'p', hasCharacter:true })
    // 确保 raw 引用仍指向 store 内的对象（setPlayer 存引用）
    const stored = store.getPlayer('u_old')
    stored.strategy = undefined
    stored.strategyChangedAt = undefined
    const beforeLogs = raw.logs.length
    const res = await postStrategy('u_old', 'balanced')
    assert.equal(res.success, true)
    assert.equal(res.data.strategy, 'balanced')
    const after = store.getPlayer('u_old')
    assert.equal(after.strategy, 'balanced')
    assert.equal(after.logs.length, beforeLogs) // 无新增日志
    assert.equal(after.strategyChangedAt, 0) // 幂等不刷新 CD
  })

  it('CD 内二次切换失败并返回剩余', async () => {
    const now = 1_700_000_000_000
    engine.__setNow(() => now)
    const p = engine.createCharacter('u_cd', 'U')
    p.level = 30
    p.lastTick = now - 5000
    engine.__setRandom(() => 0.9)
    engine.__setDropRandom(() => 1)
    store.setPlayer('u_cd', p)
    store.setAccount('u_cd', { username:'u_cd', password:'p', hasCharacter:true })
    const r1 = await postStrategy('u_cd', 'aggressive')
    assert.equal(r1.success, true)
    const r2 = await postStrategy('u_cd', 'defensive')
    assert.equal(r2.success, false)
    assert.match(r2.message, /冷却中/)
  })

  it('A→B→C 结算后等级复核：Lv19 未结算到 20 后可切 greedy', async () => {
    const now = 1_700_000_000_000
    engine.__setNow(() => now)
    engine.__setRandom(() => 0) // 选第一个怪
    engine.__setDropRandom(() => 1)
    const p = engine.createCharacter('u_lv', 'U')
    p.level = 19
    // exp 差 5 升级
    p.exp = data.expToNext(19) - 5
    p.lastTick = now - 5000
    // 让战斗胜利且经验足够升级：用高属性确保 win
    p.attributes = { atk:100, def:100, hp:100, agi:100 }
    engine.recalcMaxStats(p)
    p.hp = p.maxHp
    store.setPlayer('u_lv', p)
    store.setAccount('u_lv', { username:'u_lv', password:'p', hasCharacter:true })
    const res = await postStrategy('u_lv', 'greedy')
    assert.equal(res.success, true, JSON.stringify(res))
    assert.equal(res.data.level, 20)
    assert.equal(res.data.strategy, 'greedy')
  })

  it('C 失败仍落盘 B 的结算（重启可恢复）', async () => {
    const now = 1_700_000_000_000
    engine.__setNow(() => now)
    engine.__setRandom(() => 0)
    engine.__setDropRandom(() => 1)
    const p = engine.createCharacter('u_fail', 'U')
    p.level = 10
    p.exp = 0
    p.lastTick = now - 5000
    p.attributes = { atk:100, def:100, hp:100, agi:100 }
    engine.recalcMaxStats(p); p.hp = p.maxHp
    // 启用落盘以验证持久化
    store.__setDisableSave(false)
    store.setPlayer('u_fail', p)
    store.setAccount('u_fail', { username:'u_fail', password:'p', hasCharacter:true })
    store.save()
    const beforeExp = store.getPlayer('u_fail').exp
    const res = await postStrategy('u_fail', 'greedy') // req 20
    assert.equal(res.success, false)
    assert.match(res.message, /Lv\.20/)
    assert.ok(res.data, 'C 失败应返回 data')
    const after = store.getPlayer('u_fail')
    assert.ok(after.exp > beforeExp)
    assert.equal(after.strategy, 'balanced')
    // 显式落盘并模拟重启
    store.save()
    const savedExp = after.exp
    const savedTick = after.lastTick
    // 清内存后重载
    store.__resetStore()
    store.load()
    const reloaded = store.getPlayer('u_fail')
    assert.ok(reloaded, '重启后应仍存在')
    assert.equal(reloaded.exp, savedExp)
    assert.equal(reloaded.lastTick, savedTick)
    assert.equal(reloaded.strategy, 'balanced')
    // 恢复禁用以免后续测试污染
    store.__setDisableSave(true)
  })

  it('<3s 关窗：切换成功后 lastTick 推进', async () => {
    const now = 1_700_000_000_000
    engine.__setNow(() => now)
    const p = engine.createCharacter('u_win', 'U')
    p.level = 30
    p.lastTick = now - 1000 // <3s 无收益
    store.setPlayer('u_win', p)
    store.setAccount('u_win', { username:'u_win', password:'p', hasCharacter:true })
    const res = await postStrategy('u_win', 'aggressive')
    assert.equal(res.success, true)
    const after = store.getPlayer('u_win')
    assert.equal(after.lastTick, now)
  })
})
