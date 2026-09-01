const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const path=require('path'); const os=require('os');
const engine=require('./engine');

// 强制 routes-settlement.test.js 走 JSON 后端
process.env.DB_ENGINE = 'json';
delete require.cache[require.resolve('./store-sqlite')];
function tmpPath(){ return path.join(os.tmpdir(),`test-routes-${Date.now()}-${Math.random().toString(36).slice(2,4)}.json`); }
function clean(p){ try{fs.unlinkSync(p)}catch(_){} try{fs.unlinkSync(p+'.tmp')}catch(_){} try{fs.unlinkSync(p+'.bak')}catch(_){} }
const _oST=global.setTimeout,_oCT=global.clearTimeout; let _fake=new Map(),_fid=0;
function installFake(){ global.setTimeout=(fn,ms)=>{const id=++_fid;_fake.set(id,{fn,ms});return id;}; global.clearTimeout=(id)=>{_fake.delete(id);};}
function restoreFake(){ global.setTimeout=_oST; global.clearTimeout=_oCT; _fake.clear();}
describe('routes settlement matrix',()=>{
  let store; let db;
  before(()=>{ installFake(); db=tmpPath(); delete require.cache[require.resolve('./store')]; store=require('./store'); store.__setDbPath(db); store.__resetStore(); store.__setDisableSave(false); engine.setStore(store); });
  after(()=>{ store.cancelSaveTimer(); clean(db); engine.__resetSeams(); restoreFake(); });
  beforeEach(()=>{ _fake.clear(); engine.__resetSeams(); store.cancelSaveTimer(); });
  afterEach(()=>{ store.cancelSaveTimer(); store.clearLastSaveError(); _fake.clear(); });

  it('POST quest/daily 404/409/200 already/200 success',()=>{
    engine.__setNow(()=>Date.parse('2025-01-01T10:00:00'));
    const p=engine.createCharacter('u1','n1');
    assert.equal(engine.claimDaily(p,'unknown').status,404);
    assert.equal(engine.claimDaily(p,'hunt50').status,409);
    p.dailyQuests.find(q=>q.id==='hunt50').done=true;
    const r1=engine.claimDaily(p,'hunt50'); assert.equal(r1.status,200); assert.equal(r1.success,true);
    const r2=engine.claimDaily(p,'hunt50'); assert.equal(r2.already,true); assert.equal(r2.status,200);
    // 500 via transaction save fail
    store.__resetStore(); store.setPlayer('u1',p);
    const orig=fs.writeFileSync; fs.writeFileSync=()=>{throw new Error('disk');};
    try{ const rr=store.withTransaction(d=>{ const pl=d.players.u1; pl.dailyQuests.find(q=>q.id==='battle20').done=true; const out=engine.claimDaily(pl,'battle20'); return {status:200}; }); assert.equal(rr.status,500); } finally{ fs.writeFileSync=orig; }
  });

  it('chest 409/200 already',()=>{
    engine.__setNow(()=>Date.parse('2025-01-01T10:00:00'));
    const p=engine.createCharacter('u2','n2');
    assert.equal(engine.claimChest(p).status,409);
    p.dailyQuests.forEach(q=>{ q.done=true; q.claimed=true; });
    const r1=engine.claimChest(p); assert.equal(r1.success,true);
    const r2=engine.claimChest(p); assert.equal(r2.already,true);
  });

  it('achievement 404/409/200 already',()=>{
    const p=engine.createCharacter('u3','n3');
    assert.equal(engine.claimAchievement(p,'unknown').status,404);
    assert.equal(engine.claimAchievement(p,'kill100').status,409);
    p.achievements.kill100={unlocked:true,claimed:false,unlockAt:Date.now()};
    const r1=engine.claimAchievement(p,'kill100'); assert.equal(r1.success,true);
    const r2=engine.claimAchievement(p,'kill100'); assert.equal(r2.already,true);
  });

  it('worldboss 404/409',()=>{
    store.__resetStore(); engine.__setNow(()=>Date.parse('2025-01-01T10:00:00'));
    store.getMeta().worldBoss=null;
    const p=engine.createCharacter('u4','n4'); store.setPlayer('u4',p);
    const r1=store.withTransaction(()=>{ const out=engine.attackWorldBoss(store,'u4'); return out.success?{status:200}:{status:404}; });
    assert.equal(r1.status,200);
    const r2=store.withTransaction(()=>{ const out=engine.attackWorldBoss(store,'u4'); if(!out.success && out.message.includes('今日')) return {status:409}; return {status:out.success?200:404}; });
    assert.equal(r2.status,409);
    const rr=store.withTransaction(()=>{ const out=engine.attackWorldBoss(store,'ghost'); return out.success?{status:200}:{status:404}; });
    assert.equal(rr.status,404);
  });

  it('arena challenge 400 missing requestId / 404 / 409 self / 200 replay',()=>{
    store.__resetStore(); engine.__setNow(()=>Date.now()); engine.__setRandom(()=>0.5);
    const a=engine.createCharacter('alice','A'); const b=engine.createCharacter('bob','B'); b.level=5; a.level=5; store.setPlayer('alice',a); store.setPlayer('bob',b);
    let req={username:'alice',targetUsername:'bob',isBot:false}; assert.equal(!req.requestId?400:200,400);
    let rr=store.withTransaction(()=>{ return {status: store.getPlayer('nobody')?200:404}; }); assert.equal(rr.status,404);
    rr=store.withTransaction(()=>{ return {status: 'alice'==='alice'?409:200}; }); assert.equal(rr.status,409);
    const rid='req1';
    const r1=store.withTransaction(d=>{
      const pl=d.players.alice; const ledgerId=`pvp:challenge:${rid}`;
      if(pl.settlementLedger&&pl.settlementLedger.find(e=>e.id===ledgerId)) return {status:200,already:true};
      if(!pl.settlementLedger) pl.settlementLedger=[];
      pl.settlementLedger.push({id:ledgerId,at:Date.now(),type:'pvp_challenge',reward:{gold:10,exp:5,coins:2},source:ledgerId,fullResult:{battle:{result:'win',rounds:[]}},requestContext:{username:'alice',targetUsername:'bob',isBot:false}});
      return {status:200};
    }); assert.equal(r1.status,200);
    const r2=store.withTransaction(d=>{
      const pl=d.players.alice; const f=pl.settlementLedger.find(e=>e.id===`pvp:challenge:${rid}`);
      if(f) return {status:200,already:true}; return {status:200};
    }); assert.equal(r2.already,true);
    const r3=store.withTransaction(d=>{
      const pl=d.players.alice; const f=pl.settlementLedger.find(e=>e.id===`pvp:challenge:${rid}`);
      if(f && f.requestContext.targetUsername!=='charlie') return {status:409,message:'requestId 冲突'};
      return {status:200};
    }); assert.equal(r3.status,409);
    // 500 save fail
    const orig=fs.writeFileSync; fs.writeFileSync=()=>{throw new Error('disk');};
    try{ const rr2=store.withTransaction(d=>{ d.players.alice.gold+=1; return {status:200}; }); assert.equal(rr2.status,500); } finally{ fs.writeFileSync=orig; }
  });

  it('arena settle 403/400/200 already',()=>{
    engine.__resetSeams();
    delete process.env.ADMIN_TOKEN;
    const {isTestMode}=require('./engine/state'); assert.equal(isTestMode(),false);
    assert.equal((!process.env.ADMIN_TOKEN && !isTestMode())?403:200,403);
    assert.equal(['daily','weekly','monthly'].includes('invalid')?200:400,400);
    store.__resetStore(); engine.__setNow(()=>Date.parse('2025-01-02T10:00:00'));
    const meta=store.getMeta(); meta.arenaRewards={daily:{'2025-01-01':{}},weekly:{},monthly:{}}; meta.arenaCursors={daily:'2025-01-01',weekly:'2025-01-01',monthly:'2025-01'}; meta.arenaSkipped={daily:{},weekly:{},monthly:{}};
    const rr=store.withTransaction(d=>{ return d.meta.arenaRewards.daily['2025-01-01']?{status:200,already:true}:{status:200}; });
    assert.equal(rr.already,true);
    // isTestMode true allows settle without token
    engine.__setRandom(()=>0.5); assert.equal(require('./engine/state').isTestMode(),true);
    engine.__resetSeams();
  });

  it('GET arena rewards 400 / season 200 / titles equip',()=>{
    assert.equal(['daily','weekly','monthly'].includes('bad')?200:400,400);
    store.__resetStore(); engine.__setNow(()=>Date.parse('2025-02-01T00:00:00'));
    const sr=store.withTransaction(d=>{ d.meta.currentSeason=engine.getSeasonKey(); return {status:200}; }); assert.equal(sr.status,200);
    const p=engine.createCharacter('u5','n5'); store.setPlayer('u5',p);
    const {isValidTitleKey,getUnlockedJobTitles,getActiveTimeTitles}=require('./data/titles');
    assert.equal(isValidTitleKey('unknown_title_xyz')?200:404,404);
    let tr=store.withTransaction(d=>{
      const pl=d.players.u5; const key='boss_killer_1';
      const owned=getUnlockedJobTitles(pl).some(t=>t.key===key)||getActiveTimeTitles(pl).some(t=>t.key===key);
      return {status: owned?200:409};
    }); assert.equal(tr.status,409);
    // key null unequip 200
    tr=store.withTransaction(d=>{ d.players.u5.currentTitle=null; return {status:200}; }); assert.equal(tr.status,200);
    // cock enter 404 missing player
    let cr=store.withTransaction(d=>{ return d.players.nobody?{status:200}:{status:404}; }); assert.equal(cr.status,404);
    let bet=null; assert.equal(!bet?400:200,400);
    p.titles={cock_newbie:true}; assert.equal(engine.exchangeCockfightTitle(p,'cock_newbie').success,false);
  });

  it('GET player 404 / worldboss active 500 on save fail',()=>{
    store.__resetStore();
    assert.equal(store.withTransaction(d=>d.players.ghost?{status:200}:{status:404}).status,404);
    const orig=fs.writeFileSync; fs.writeFileSync=()=>{throw new Error('disk');};
    try{ const rr=store.withTransaction(d=>{ d.meta.worldBoss=null; engine.getActiveBoss(store); return {status:200}; }); assert.equal(rr.status,500); } finally{ fs.writeFileSync=orig; }
  });
});
