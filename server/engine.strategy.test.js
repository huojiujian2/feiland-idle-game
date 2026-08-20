const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { STRATEGIES, STRATEGY_CD_MS } = require('./data')
const engine = require('./engine')

describe('T-004 strategy', () => {
  beforeEach(() => engine.__resetSeams())
  afterEach(() => engine.__resetSeams())

  it('migrate defaults balanced and finite timestamp', () => {
    const p = engine.migratePlayer({})
    assert.equal(p.strategy, 'balanced')
    assert.equal(p.strategyChangedAt, 0)
    const p2 = engine.migratePlayer({ strategy: '__proto__', strategyChangedAt: NaN })
    assert.equal(p2.strategy, 'balanced')
    assert.equal(p2.strategyChangedAt, 0)
    const p3 = engine.migratePlayer({ strategy: 'aggressive', strategyChangedAt: Date.now() })
    assert.equal(p3.strategy, 'aggressive')
  })

  it('rejects prototype pollution via Object.hasOwn', () => {
    assert.equal(Object.hasOwn(STRATEGIES, '__proto__'), false)
    assert.equal(Object.hasOwn(STRATEGIES, 'constructor'), false)
    assert.equal(Object.hasOwn(STRATEGIES, 'toString'), false)
    // engine migrate should fallback
    const p = engine.migratePlayer({ strategy: 'constructor' })
    assert.equal(p.strategy, 'balanced')
  })

  it('aggressive atk x1.15 def x0.90', () => {
    const p = engine.createCharacter('u1', 'n1')
    p.level = 10
    p.strategy = 'balanced'
    const base = engine.getTotalStats(p)
    p.strategy = 'aggressive'
    const aggr = engine.getTotalStats(p)
    // atk increased, def decreased vs balanced (allow floor variance)
    assert.ok(aggr.atk > base.atk)
    assert.ok(aggr.def < base.def)
    // approx ratios
    // baseAtk approx 10+(9*3)+5*2=47 + eq etc; with strategy 1.15 -> check ratio ~1.15
    const ratioAtk = aggr.atk / base.atk
    assert.ok(ratioAtk > 1.10 && ratioAtk < 1.20, `ratioAtk ${ratioAtk}`)
  })

  it('defensive regen x1.5', () => {
    const p = engine.createCharacter('u2', 'n2')
    p.level = 31
    // equip passive that gives regen? Use P1-07 regen 0.01
    p.affixes.passive = ['P1-07']
    p.strategy = 'balanced'
    const b = engine.getTotalStats(p).regen
    p.strategy = 'defensive'
    const d = engine.getTotalStats(p).regen
    assert.ok(Math.abs(d - b * 1.5) < 1e-9)
  })

  it('desperate stacking with lowHpAtk', () => {
    const p = engine.createCharacter('u3', 'n3')
    p.level = 40
    p.strategy = 'desperate'
    // give lowHpAtk 0.06 via Q2-12
    p.affixes.passive = ['Q2-12'] // lowHpAtk 0.06
    p.hp = 25; p.maxHp = 100 // 0.25 triggers both
    const total = engine.getTotalStats(p)
    const combatLow = engine.getCombatStats(p)
    // hp 0.25 -> word: 0.06 + 0.20 =0.26
    const expected = Math.floor(total.atk * 1.26)
    assert.equal(combatLow.atk, expected)
    // hp 0.40 -> only word 0.06
    p.hp = 40
    const combatMid = engine.getCombatStats(p)
    assert.equal(combatMid.atk, Math.floor(total.atk * 1.06))
    // hp 0.6 -> none
    p.hp = 60
    const combatHigh = engine.getCombatStats(p)
    assert.equal(combatHigh.atk, total.atk)
  })

  it('buildBattleMonster copy not polluting AREAS', () => {
    const { AREAS } = require('./data')
    const orig = AREAS.shenyuan.monsters.find(m=>m.name==='深渊领主').atk
    const monster = { name:'深渊领主', hp:50000, atk:100, def:120, agi:70, exp:5000, gold:1000, skills:[], isBoss:true }
    const copy = engine.buildBattleMonster(monster, 'training')
    assert.equal(copy.atk, 120)
    assert.equal(monster.atk, 100)
    assert.equal(AREAS.shenyuan.monsters.find(m=>m.name==='深渊领主').atk, orig)
  })

  it('calculateIdle training monster atk in log and not polluting', () => {
    const now = 1_700_000_000_000
    engine.__setNow(() => now)
    engine.__setRandom(() => 0) // pick first monster
    // use player with training, force win via high stats
    const p = engine.createCharacter('u4', 'n4')
    p.level = 90
    p.attributes = { atk:100, def:100, hp:100, agi:100 }
    engine.recalcMaxStats(p)
    p.hp = p.maxHp
    p.currentArea = 'gaomanshan'
    p.strategy = 'training'
    p.lastTick = now - 5000
    engine.__setDropRandom(() => 1) // no drops
    const beforeAtk = require('./data').AREAS.gaomanshan.monsters[0].atk
    const res = engine.calculateIdle(p)
    assert.ok(res)
    assert.equal(res.logEntry.monsterBaseAtk, beforeAtk)
    assert.equal(res.logEntry.monster.atk, Math.floor(beforeAtk * 1.20))
    assert.equal(require('./data').AREAS.gaomanshan.monsters[0].atk, beforeAtk)
    // exp/gold with training 1.5/0.5 applied (win)
    // monster is first gaomanshan forest wolf exp 8 gold 2
    // base expMult ~1, with training 1.5 -> exp 12
    // we can't assert exact due to other bonuses but should be >8
    assert.ok(res.logEntry.exp >= 10)
  })

  it('greedy drop rate via shouldDrop', () => {
    engine.__setDropRandom(() => 0.04)
    assert.equal(engine.shouldDrop(0.04, 'balanced'), false) // 0.04 <0.04 false
    engine.__setDropRandom(() => 0.039)
    assert.equal(engine.shouldDrop(0.04, 'balanced'), true)
    engine.__setDropRandom(() => 0.041)
    // greedy 0.04*1.05=0.042, 0.041 <0.042 true
    assert.equal(engine.shouldDrop(0.04, 'greedy'), true)
    engine.__setDropRandom(() => 0.043)
    assert.equal(engine.shouldDrop(0.04, 'greedy'), false)
  })

  it('getPlayerView strategy fields', () => {
    const p = engine.createCharacter('u5','n5')
    p.level = 25
    p.strategy = 'greedy'
    p.strategyChangedAt = 1000
    engine.__setNow(() => 1000 + 10000)
    const view = engine.getPlayerView(p)
    assert.equal(view.strategy, 'greedy')
    assert.equal(view.strategyChangedAt, 1000)
    assert.equal(view.strategies.length, 6)
    const greedy = view.strategies.find(s=>s.id==='greedy')
    assert.equal(greedy.unlocked, true)
    assert.equal(greedy.active, true)
    const training = view.strategies.find(s=>s.id==='training')
    assert.equal(training.unlocked, false)
  })

  it('benchmark p95 fresh snapshot', () => {
    const iterations = 1000
    const times = []
    for(let i=0;i<iterations;i++){
      const p = engine.createCharacter('bench'+i, 'b')
      p.level = 30
      p.strategy = 'aggressive'
      p.lastTick = 0
      let now = 4000 + i*4000
      engine.__setNow(() => now)
      // ensure elapsed >=3000 fresh
      p.lastTick = now - 4000
      engine.__setRandom(() => 0.5)
      engine.__setDropRandom(() => 1)
      const t0 = process.hrtime.bigint()
      engine.calculateIdle(p)
      const t1 = process.hrtime.bigint()
      times.push(Number(t1 - t0)/1e6)
    }
    times.sort((a,b)=>a-b)
    const p95 = times[Math.floor(times.length*0.95)]
    // should be <5ms
    assert.ok(p95 < 5, `p95 ${p95} ms`)
  })
})
