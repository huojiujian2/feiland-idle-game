const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs=require('fs'), path=require('path'), os=require('os');
const engine=require('./engine');

// 强制 timer-settlement.test.js 走 JSON 后端
process.env.DB_ENGINE = 'json';
delete require.cache[require.resolve('./store-sqlite')];
function tmpPath(){ return path.join(os.tmpdir(),`test-timer-${Date.now()}-${Math.random().toString(36).slice(2,4)}.json`); }
function clean(p){ try{fs.unlinkSync(p)}catch(_){} try{fs.unlinkSync(p+'.tmp')}catch(_){} try{fs.unlinkSync(p+'.bak')}catch(_){} }
const _origST=global.setTimeout, _origCT=global.clearTimeout; let _fake=new Map(), _fid=0;
function installFake(){ global.setTimeout=(fn,ms)=>{ const id=++_fid; _fake.set(id,{fn,ms}); return id; }; global.clearTimeout=(id)=>{_fake.delete(id);}; }
function restoreFake(){ global.setTimeout=_origST; global.clearTimeout=_origCT; _fake.clear(); }
describe('timer settlement',()=>{
  let store,db;
  before(()=>{ installFake(); db=tmpPath(); delete require.cache[require.resolve('./store')]; store=require('./store'); store.__setDbPath(db); store.__resetStore(); store.__setDisableSave(false); engine.setStore(store); });
  after(()=>{ store.cancelSaveTimer(); clean(db); engine.__resetSeams(); restoreFake(); });
  beforeEach(()=>{ _fake.clear(); engine.__resetSeams(); store.cancelSaveTimer(); });
  afterEach(()=>{ store.cancelSaveTimer(); store.clearLastSaveError(); _fake.clear(); });

  it('settleDuePeriods previous period settlement',()=>{
    store.__resetStore(); engine.__setNow(()=>Date.parse('2025-01-03T10:00:00'));
    const p=engine.createCharacter('alice','A'); p.pvpStats.rating=1500; store.setPlayer('alice',p);
    const meta=store.getMeta();
    meta.arenaRewards={daily:{},weekly:{},monthly:{}}; meta.arenaSkipped={daily:{},weekly:{},monthly:{}};
    meta.arenaCursors={daily:'2025-01-01',weekly:'2024-12-23',monthly:'2024-11'}; // 2 days ago for daily
    engine.settleDuePeriods(store);
    assert.ok(meta.arenaRewards.daily['2025-01-02']);
    assert.equal(meta.arenaCursors.daily,'2025-01-02');
    assert.equal(meta.arenaRewards.daily['2025-01-02'].alice.coins,300); // rank1 daily S 300
  });

  it('empty ranking placeholder',()=>{
    store.__resetStore(); engine.__setNow(()=>Date.parse('2025-01-03T10:00:00'));
    const meta=store.getMeta();
    meta.arenaRewards={daily:{},weekly:{},monthly:{}}; meta.arenaSkipped={daily:{},weekly:{},monthly:{}};
    meta.arenaCursors={daily:'2025-01-01',weekly:'2024-12-23',monthly:'2024-11'};
    // no players
    engine.settleDuePeriods(store);
    assert.deepEqual(meta.arenaRewards.daily['2025-01-02'],{});
    assert.equal(meta.arenaCursors.daily,'2025-01-02');
  });

  it('save failure not advance',()=>{
    store.__resetStore(); engine.__setNow(()=>Date.parse('2025-01-03T10:00:00'));
    const p=engine.createCharacter('bob','B'); store.setPlayer('bob',p);
    const m=store.getMeta();
    m.arenaRewards={daily:{},weekly:{},monthly:{}}; m.arenaSkipped={daily:{},weekly:{},monthly:{}};
    m.arenaCursors={daily:'2025-01-01',weekly:'2024-12-23',monthly:'2024-11'};
    const orig=fs.writeFileSync; fs.writeFileSync=()=>{throw new Error('disk');};
    try{ engine.settleDuePeriods(store); } finally{ fs.writeFileSync=orig; }
    assert.equal(store.getMeta().arenaCursors.daily,'2025-01-01');
    assert.equal(store.getMeta().arenaRewards.daily['2025-01-02'],undefined);
  });

  it('startup multi-period compensation 7/4/2',()=>{
    store.__resetStore(); engine.__setNow(()=>Date.parse('2025-01-10T10:00:00'));
    const meta=store.getMeta();
    meta.arenaRewards={daily:{},weekly:{},monthly:{}}; meta.arenaSkipped={daily:{},weekly:{},monthly:{}};
    meta.arenaCursors={daily:'2025-01-01',weekly:'2024-12-02',monthly:'2024-11'}; // 9 days gap daily
    const p=engine.createCharacter('c1','C'); store.setPlayer('c1',p);
    engine.settleDuePeriods(store);
    // daily limit 7, gap 8? from 2025-01-01 to 2025-01-10: pending 2025-01-02..2025-01-09 =8, limit7 => 1 skipped, 7 settled
    assert.ok(meta.arenaSkipped.daily['2025-01-02']);
    assert.ok(meta.arenaRewards.daily['2025-01-03']); // first settled after skip
    assert.equal(meta.arenaCursors.daily,'2025-01-09');
  });

  it('super-boundary skip writes arenaSkipped',()=>{
    store.__resetStore(); engine.__setNow(()=>Date.parse('2025-01-20T10:00:00'));
    const meta=store.getMeta();
    meta.arenaRewards={daily:{},weekly:{},monthly:{}}; meta.arenaSkipped={daily:{},weekly:{},monthly:{}};
    meta.arenaCursors={daily:'2025-01-01',weekly:'2024-12-02',monthly:'2024-11'};
    engine.settleDuePeriods(store);
    // first few should be skipped with source skip:gap
    assert.equal(meta.arenaSkipped.daily['2025-01-02'].source,'skip:gap');
    assert.deepEqual(meta.arenaRewards.daily['2025-01-02'],{});
    // skipped should not have ledger for players
    const p=store.getPlayer('c1'); // from previous? we reset, so no player
    // ensure arenaRewards has empty placeholder and not skipped source in rewards
    assert.ok(!meta.arenaRewards.daily['2025-01-02'].source);
  });

  it('settleArenaRewards requires periodKey and already true',()=>{
    store.__resetStore();
    const meta=store.getMeta(); meta.arenaRewards={daily:{},weekly:{},monthly:{}}; meta.arenaSkipped={daily:{},weekly:{},monthly:{}};
    assert.throws(()=>engine.settleArenaRewards(store,'daily',[],''),/periodKey/);
    const r1=engine.settleArenaRewards(store,'daily',[{username:'x',rating:1000}],'2025-01-01');
    assert.equal(r1.rewarded,1);
    const r2=engine.settleArenaRewards(store,'daily',[{username:'x',rating:1000}],'2025-01-01');
    assert.equal(r2.already,true);
    // skipped already
    meta.arenaSkipped.daily['2025-01-02']={at:Date.now(),source:'skip:gap'};
    const r3=engine.settleArenaRewards(store,'daily',[],'2025-01-02'); assert.equal(r3.already,true);
  });
});
