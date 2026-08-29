const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

function tmpPath(tag){ return path.join(os.tmpdir(), `test-store-${tag}-${Date.now()}-${Math.random().toString(36).slice(2,6)}.json`); }
function clean(p){ try{fs.unlinkSync(p)}catch(_){} try{fs.unlinkSync(p+'.tmp')}catch(_){} try{fs.unlinkSync(p+'.bak')}catch(_){} }
const _origST=global.setTimeout; const _origCT=global.clearTimeout;
let _fakeTimers=new Map(); let _fakeId=0;
function installFake(){ global.setTimeout=(fn,ms)=>{ const id=++_fakeId; _fakeTimers.set(id,{fn,ms}); return id; }; global.clearTimeout=(id)=>{ _fakeTimers.delete(id); }; }
function restoreFake(){ global.setTimeout=_origST; global.clearTimeout=_origCT; _fakeTimers.clear(); }
describe('store',()=>{
  let store;
  before(()=>installFake());
  after(()=>restoreFake());
  beforeEach(()=>{ _fakeTimers.clear(); delete require.cache[require.resolve('./store')]; store=require('./store'); store.__setDisableSave(false); });
  afterEach(()=>{ store.cancelSaveTimer(); store.clearLastSaveError(); store.__setDisableSave(false); store.__resetStore(); _fakeTimers.clear(); });

  it('atomic write .tmp+rename',()=>{
    const p=tmpPath('atomic');
    store.__setDbPath(p); store.__resetStore(); store.__setDisableSave(false);
    const d=store.__getRawData();
    d.accounts={a:{username:'a'}}; d.players={}; d.meta={ arenaRewards:{daily:{},weekly:{},monthly:{}}, arenaCursors:null, arenaSkipped:{daily:{},weekly:{},monthly:{}} };
    store.save();
    assert.ok(fs.existsSync(p)); assert.ok(!fs.existsSync(p+'.tmp'));
    const parsed=JSON.parse(fs.readFileSync(p,'utf8'));
    assert.equal(parsed.accounts.a.username,'a');
    clean(p); store.cancelSaveTimer();
  });

  it('corruption fallback to .bak',()=>{
    const p=tmpPath('bak');
    store.__setDbPath(p); store.__resetStore();
    fs.writeFileSync(p,'not-json{{{');
    fs.writeFileSync(p+'.bak', JSON.stringify({accounts:{b:{username:'b'}},players:{},meta:{}}));
    store.load();
    assert.equal(store.getAccount('b').username,'b');
    clean(p);
  });

  it('logical corruption null root fallback',()=>{
    const p=tmpPath('nullroot');
    store.__setDbPath(p); store.__resetStore();
    fs.writeFileSync(p, 'null');
    fs.writeFileSync(p+'.bak', JSON.stringify({accounts:{c:{username:'c'}},players:{},meta:{}}));
    store.load();
    assert.equal(store.getAccount('c').username,'c');
    clean(p);
  });

  it('logical corruption accounts not plain object',()=>{
    const p=tmpPath('accounts');
    store.__setDbPath(p); store.__resetStore();
    fs.writeFileSync(p, JSON.stringify({accounts:null,players:{},meta:{}}));
    fs.writeFileSync(p+'.bak', JSON.stringify({accounts:{d:{username:'d'}},players:{},meta:{}}));
    store.load();
    assert.equal(store.getAccount('d').username,'d');
    clean(p);
  });

  it('dual corruption reset to empty',()=>{
    const p=tmpPath('dual');
    store.__setDbPath(p); store.__resetStore();
    fs.writeFileSync(p,'bad json');
    fs.writeFileSync(p+'.bak','also bad');
    store.load();
    assert.deepEqual(store.__getRawData().accounts,{});
    assert.deepEqual(store.__getRawData().players,{});
    clean(p);
  });

  it('markDirty throttling single timer',()=>{
    const p=tmpPath('dirty'); store.__setDbPath(p); store.__resetStore(); store.__setDisableSave(false);
    store.cancelSaveTimer(); _fakeTimers.clear();
    store.setPlayer('u1',{username:'u1'}); store.setPlayer('u2',{username:'u2'});
    assert.equal(_fakeTimers.size,1);
    store.cancelSaveTimer(); clean(p);
  });

  it('lastSaveError on fs.writeFileSync throw',()=>{
    const p=tmpPath('err'); store.__setDbPath(p); store.__resetStore(); store.__setDisableSave(false);
    const orig=fs.writeFileSync; fs.writeFileSync=()=>{throw new Error('disk full');};
    try{ assert.throws(()=>store.save(),/disk full/); const e=store.getLastSaveError(); assert.ok(e); assert.match(e.message,/disk full/); } finally{ fs.writeFileSync=orig; }
    clean(p);
  });

  it('lastSaveError clear on success',()=>{
    const p=tmpPath('clear'); store.__setDbPath(p); store.__resetStore(); store.__setDisableSave(false);
    const orig=fs.writeFileSync; fs.writeFileSync=()=>{throw new Error('fail');};
    try{ try{store.save()}catch(_){} } finally{ fs.writeFileSync=orig; }
    assert.ok(store.getLastSaveError());
    store.save(); assert.equal(store.getLastSaveError(),null);
    clean(p);
  });

  it('withTransaction rollback on 404',()=>{
    const p=tmpPath('tx404'); store.__setDbPath(p); store.__resetStore(); store.__setDisableSave(false);
    store.__getRawData().players={a:{username:'a',gold:10}};
    const r=store.withTransaction((data)=>{ data.players.a.gold=999; return {status:404,message:'not found'}; });
    assert.equal(r.status,404); assert.equal(store.getPlayer('a').gold,10);
    assert.equal(store.getLastSaveError(),null);
    clean(p);
  });

  it('withTransaction rollback on 409',()=>{
    const p=tmpPath('tx409'); store.__setDbPath(p); store.__resetStore();
    store.__getRawData().players={b:{username:'b',gold:5}};
    const r=store.withTransaction((data)=>{ data.players.b.gold=999; return {status:409,message:'conflict'}; });
    assert.equal(r.status,409); assert.equal(store.getPlayer('b').gold,5);
    clean(p);
  });

  it('withTransaction exception ->500 and rollback',()=>{
    const p=tmpPath('txex'); store.__setDbPath(p); store.__resetStore();
    store.__getRawData().players={c:{username:'c',gold:1}};
    const r=store.withTransaction(()=>{ throw new Error('boom'); });
    assert.equal(r.status,500); assert.match(r.message,/boom/); assert.equal(store.getPlayer('c').gold,1);
    clean(p);
  });

  it('cancelSaveTimer in all branches',()=>{
    const p=tmpPath('cancel'); store.__setDbPath(p); store.__resetStore(); store.__setDisableSave(false);
    store.setPlayer('x',{username:'x'});
    let r=store.withTransaction((d)=>{ d.players.x.gold=2; return {status:200,data:{}}; });
    assert.equal(r.status,200);
    store.setPlayer('y',{username:'y'});
    r=store.withTransaction((d)=>{ d.players.y.gold=3; return {status:409,message:'n'}; });
    assert.equal(r.status,409);
    // timer should be null after each
    store.cancelSaveTimer();
    clean(p);
  });

  it('safeSave finally clears timer even on throw',()=>{
    const p=tmpPath('safe'); store.__setDbPath(p); store.__resetStore(); store.__setDisableSave(false);
    _fakeTimers.clear();
    store.setPlayer('z',{username:'z'}); assert.equal(_fakeTimers.size,1);
    const orig=fs.writeFileSync; fs.writeFileSync=()=>{throw new Error('fail2');};
    try{ store.safeSave(); assert.equal(store.getLastSaveError().message,'fail2'); } finally{ fs.writeFileSync=orig; }
    // safeSave nulls saveTimer, old fake timer still in map -> clear to simulate firing
    _fakeTimers.clear();
    store.setPlayer('z2',{username:'z2'}); assert.equal(_fakeTimers.size,1);
    store.cancelSaveTimer(); clean(p);
  });

  it('arenaRewards retention 30/12/12',()=>{
    const p=tmpPath('retain'); store.__setDbPath(p); store.__resetStore(); store.__setDisableSave(false);
    const d=store.__getRawData();
    d.meta.arenaRewards={daily:{},weekly:{},monthly:{}}; d.meta.arenaSkipped={daily:{},weekly:{},monthly:{}};
    for(let i=0;i<40;i++){ const k=`2025-01-${String(i+1).padStart(2,'0')}`; d.meta.arenaRewards.daily[k]={}; }
    for(let i=0;i<20;i++){ const k=`2025-${String(i+1).padStart(2,'0')}`; d.meta.arenaRewards.monthly[k]={}; }
    for(let i=0;i<20;i++){ const dt=new Date(2025,0,1); dt.setDate(dt.getDate()+i*7); const ks=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`; d.meta.arenaRewards.weekly[ks]={}; }
    store.save();
    store.load();
    assert.equal(Object.keys(store.getMeta().arenaRewards.daily).length,30);
    assert.equal(Object.keys(store.getMeta().arenaRewards.weekly).length,12);
    assert.equal(Object.keys(store.getMeta().arenaRewards.monthly).length,12);
    clean(p); store.cancelSaveTimer();
  });
});
