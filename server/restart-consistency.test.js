const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'), path=require('path'), os=require('os');
const engine=require('./engine');
function tmpPath(){ return path.join(os.tmpdir(),`test-restart-${Date.now()}-${Math.random().toString(36).slice(2,4)}.json`); }
function clean(p){ try{fs.unlinkSync(p)}catch(_){} try{fs.unlinkSync(p+'.tmp')}catch(_){} try{fs.unlinkSync(p+'.bak')}catch(_){} }
const _oST=global.setTimeout,_oCT=global.clearTimeout; let _fake=new Map(),_fid=0;
function installFake(){ global.setTimeout=(fn,ms)=>{const id=++_fid;_fake.set(id,{fn,ms});return id;}; global.clearTimeout=(id)=>{_fake.delete(id);};}
function restoreFake(){ global.setTimeout=_oST; global.clearTimeout=_oCT; _fake.clear();}
describe('restart consistency',()=>{
  let store; let db;
  before(()=>installFake()); after(()=>restoreFake());
  beforeEach(()=>{ _fake.clear(); db=tmpPath(); delete require.cache[require.resolve('./store')]; store=require('./store'); store.__setDbPath(db); store.__resetStore(); store.__setDisableSave(false); engine.setStore(store); engine.__resetSeams(); });
  afterEach(()=>{ store.cancelSaveTimer(); clean(db); engine.__resetSeams(); _fake.clear(); });
  it('create+save+load persists',()=>{
    const p=engine.createCharacter('hero','Hero'); p.gold=123; store.setPlayer('hero',p); store.save();
    assert.ok(fs.existsSync(db));
    store.__resetStore(); assert.equal(store.getPlayer('hero'),undefined);
    store.load();
    const loaded=store.getPlayer('hero'); assert.ok(loaded); assert.equal(loaded.gold,123); assert.equal(loaded.name,'Hero');
  });
  it('withTransaction success persists after restart',()=>{
    const p=engine.createCharacter('u1','U1'); store.setPlayer('u1',p);
    const r=store.withTransaction(d=>{ d.players.u1.gold=999; return {status:200}; });
    assert.equal(r.status,200);
    store.__resetStore(); store.load();
    assert.equal(store.getPlayer('u1').gold,999);
  });
  it('withTransaction failure rollback not persisted',()=>{
    const p=engine.createCharacter('u2','U2'); p.gold=10; store.setPlayer('u2',p); store.save();
    const r=store.withTransaction(d=>{ d.players.u2.gold=9999; return {status:409,message:'conflict'}; });
    assert.equal(r.status,409); assert.equal(store.getPlayer('u2').gold,10);
    store.__resetStore(); store.load();
    assert.equal(store.getPlayer('u2').gold,10);
  });
  it('exception rollback not persisted',()=>{
    const p=engine.createCharacter('u3','U3'); p.gold=5; store.setPlayer('u3',p); store.save();
    const r=store.withTransaction(()=>{ throw new Error('boom'); });
    assert.equal(r.status,500); assert.equal(store.getPlayer('u3').gold,5);
    store.__resetStore(); store.load();
    assert.equal(store.getPlayer('u3').gold,5);
  });
  it('__setDbPath isolation',()=>{
    const db2=tmpPath();
    store.__setDbPath(db); store.__resetStore(); const p1=engine.createCharacter('a1','A1'); store.setPlayer('a1',p1); store.save();
    delete require.cache[require.resolve('./store')]; const store2=require('./store'); store2.__setDbPath(db2); store2.__resetStore(); store2.__setDisableSave(false);
    const p2=engine.createCharacter('b1','B1'); store2.setPlayer('b1',p2); store2.save();
    assert.ok(fs.existsSync(db)); assert.ok(fs.existsSync(db2));
    store.__resetStore(); store.load(); assert.ok(store.getPlayer('a1')); assert.equal(store.getPlayer('b1'),undefined);
    store2.__resetStore(); store2.load(); assert.ok(store2.getPlayer('b1')); assert.equal(store2.getPlayer('a1'),undefined);
    store2.cancelSaveTimer(); clean(db2);
  });
  it('save failure does not corrupt file',()=>{
    const p=engine.createCharacter('u4','U4'); p.gold=77; store.setPlayer('u4',p); store.save();
    const before=fs.readFileSync(db,'utf8');
    const orig=fs.writeFileSync; fs.writeFileSync=()=>{throw new Error('disk');};
    try{ try{store.save()}catch(_){}} finally{ fs.writeFileSync=orig; }
    const after=fs.readFileSync(db,'utf8'); assert.equal(before,after);
    store.__resetStore(); store.load(); assert.equal(store.getPlayer('u4').gold,77);
  });
});
