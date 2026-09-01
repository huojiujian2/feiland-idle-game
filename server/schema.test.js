const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'), path=require('path'), os=require('os');

// 强制 schema.test.js 走 JSON 后端
process.env.DB_ENGINE = 'json';
delete require.cache[require.resolve('./store-sqlite')];
function tmpPath(){ return path.join(os.tmpdir(),`test-schema-${Date.now()}-${Math.random().toString(36).slice(2,4)}.json`); }
function clean(p){ try{fs.unlinkSync(p)}catch(_){} try{fs.unlinkSync(p+'.tmp')}catch(_){} try{fs.unlinkSync(p+'.bak')}catch(_){} }
const _oST=global.setTimeout,_oCT=global.clearTimeout; let _fake=new Map(),_fid=0;
function installFake(){ global.setTimeout=(fn,ms)=>{const id=++_fid;_fake.set(id,{fn,ms});return id;}; global.clearTimeout=(id)=>{_fake.delete(id);};}
function restoreFake(){ global.setTimeout=_oST; global.clearTimeout=_oCT; _fake.clear();}
describe('schema validation',()=>{
  let store;
  before(()=>installFake()); after(()=>restoreFake());
  beforeEach(()=>{ _fake.clear(); delete require.cache[require.resolve('./store')]; store=require('./store'); store.__setDisableSave(false); });
  afterEach(()=>{ store.cancelSaveTimer(); store.__resetStore(); _fake.clear(); });

  it('valid root passes',()=>{
    const p=tmpPath(); store.__setDbPath(p); store.__resetStore();
    const valid={accounts:{a:{username:'a'}},players:{a:{username:'a'}},meta:{}};
    fs.writeFileSync(p,JSON.stringify(valid)); store.load();
    assert.equal(store.getAccount('a').username,'a'); clean(p);
  });
  it('null root fallback to .bak',()=>{
    const p=tmpPath(); store.__setDbPath(p); store.__resetStore();
    fs.writeFileSync(p,'null'); fs.writeFileSync(p+'.bak',JSON.stringify({accounts:{b:{username:'b'}},players:{},meta:{}}));
    store.load(); assert.equal(store.getAccount('b').username,'b'); clean(p);
  });
  it('accounts not plain object fallback',()=>{
    const p=tmpPath(); store.__setDbPath(p); store.__resetStore();
    fs.writeFileSync(p,JSON.stringify({accounts:[],players:{},meta:{}}));
    fs.writeFileSync(p+'.bak',JSON.stringify({accounts:{c:{username:'c'}},players:{},meta:{}}));
    store.load(); assert.equal(store.getAccount('c').username,'c'); clean(p);
  });
  it('players null fallback',()=>{
    const p=tmpPath(); store.__setDbPath(p); store.__resetStore();
    fs.writeFileSync(p,JSON.stringify({accounts:{},players:null,meta:{}}));
    fs.writeFileSync(p+'.bak',JSON.stringify({accounts:{d:{username:'d'}},players:{},meta:{}}));
    store.load(); assert.equal(store.getAccount('d').username,'d'); clean(p);
  });
  it('meta not plain object fallback',()=>{
    const p=tmpPath(); store.__setDbPath(p); store.__resetStore();
    fs.writeFileSync(p,JSON.stringify({accounts:{},players:{},meta:'bad'}));
    fs.writeFileSync(p+'.bak',JSON.stringify({accounts:{e:{username:'e'}},players:{},meta:{}}));
    store.load(); assert.equal(store.getAccount('e').username,'e'); clean(p);
  });
  it('both main and bak corrupted resets to empty',()=>{
    const p=tmpPath(); store.__setDbPath(p); store.__resetStore();
    fs.writeFileSync(p,'bad'); fs.writeFileSync(p+'.bak','also bad'); store.load();
    assert.deepEqual(store.__getRawData().accounts,{}); assert.deepEqual(store.__getRawData().players,{});
    clean(p);
  });
  it('both logical corruption resets to empty',()=>{
    const p=tmpPath(); store.__setDbPath(p); store.__resetStore();
    fs.writeFileSync(p,JSON.stringify({accounts:null,players:null,meta:null}));
    fs.writeFileSync(p+'.bak',JSON.stringify({accounts:'x',players:'y',meta:'z'}));
    store.load(); assert.deepEqual(store.__getRawData().accounts,{}); clean(p);
  });
  it('arenaRewards retention trimming',()=>{
    const p=tmpPath(); store.__setDbPath(p); store.__resetStore(); store.__setDisableSave(false);
    const d=store.__getRawData(); d.meta.arenaRewards={daily:{},weekly:{},monthly:{}}; d.meta.arenaSkipped={daily:{},weekly:{},monthly:{}};
    for(let i=0;i<35;i++){ const k=`2025-01-${String(i+1).padStart(2,'0')}`; d.meta.arenaRewards.daily[k]={}; }
    for(let i=0;i<14;i++){ const k=`2025-${String(i+1).padStart(2,'0')}`; d.meta.arenaRewards.monthly[k]={}; }
    for(let i=0;i<15;i++){ const dt=new Date(2025,0,1); dt.setDate(dt.getDate()+i*7); const ks=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`; d.meta.arenaRewards.weekly[ks]={}; }
    store.save(); store.load();
    assert.equal(Object.keys(store.getMeta().arenaRewards.daily).length,30);
    assert.equal(Object.keys(store.getMeta().arenaRewards.weekly).length,12);
    assert.equal(Object.keys(store.getMeta().arenaRewards.monthly).length,12);
    clean(p); store.cancelSaveTimer();
  });
  it('players array not plain triggers fallback',()=>{
    const p=tmpPath(); store.__setDbPath(p); store.__resetStore();
    fs.writeFileSync(p,JSON.stringify({accounts:{},players:[],meta:{}}));
    fs.writeFileSync(p+'.bak',JSON.stringify({accounts:{f:{username:'f'}},players:{},meta:{}}));
    store.load(); assert.equal(store.getAccount('f').username,'f'); clean(p);
  });
});
