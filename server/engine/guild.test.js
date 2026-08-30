const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const store = require('../store');
const state = require('./state');
const eng = require('./index');

function mkPlayer(u, lv=20, gold=10000){
  const p = eng.createCharacter(u, u);
  p.level = lv;
  p.gold = gold;
  p.inventory.push({ name:'草药', count:100, type:'material' });
  const data = store.__getRawData();
  data.players[u]=p;
  data.accounts[u]={username:u,password:'',hasCharacter:true,createdAt:state.getNow()};
  return p;
}

describe('T-103 公会基础', ()=>{
  let tmp;
  let origDb;
  beforeEach(()=>{
    tmp = path.join(os.tmpdir(), 'test-guild-'+Date.now()+'-'+Math.random().toString(36).slice(2,6)+'.json');
    origDb = process.env.DB_PATH;
    store.__setDbPath(tmp);
    store.__setDisableSave(false);
    store.__resetStore();
    store.load();
    eng.setStore(store);
    state.__setNow(()=>1700000000000);
    state.__setRandom(()=>0.5);
  });
  afterEach(()=>{
    try{ fs.unlinkSync(tmp); }catch(_){}
    try{ fs.unlinkSync(tmp+'.bak'); }catch(_){}
    try{ fs.unlinkSync(tmp+'.tmp'); }catch(_){}
    store.__setDbPath(origDb || path.join(__dirname,'../db.json'));
    store.__setDisableSave(false);
    store.__resetStore();
    store.load();
    eng.setStore(store);
    state.__resetSeams();
  });

  it('创建/重名大小写不敏感/已在公会 409',()=>{
    mkPlayer('alice'); mkPlayer('bob');
    let r = store.withTransaction(d=>{ const p=d.players['alice']; const res=eng.createGuild(p,'Knights',d); if(!res.success) return {status:res.status,message:res.message}; return {status:200}; });
    assert.equal(r.status,200);
    let r2 = store.withTransaction(d=>{ const p=d.players['bob']; const res=eng.createGuild(p,'knights',d); if(!res.success) return {status:res.status,message:res.message}; return {status:200}; });
    assert.equal(r2.status,409);
    let r3 = store.withTransaction(d=>{ const p=d.players['alice']; const res=eng.createGuild(p,'Another',d); if(!res.success) return {status:res.status,message:res.message}; return {status:200}; });
    assert.equal(r3.status,409);
  });

  it('加入/满员/重复加入 409',()=>{
    mkPlayer('alice'); mkPlayer('bob');
    let gid;
    store.withTransaction(d=>{ const r=eng.createGuild(d.players['alice'],'GuildA',d); gid=r.guild.id; return {status:200}; });
    // 将 maxMembers 临时改小验证满员
    store.withTransaction(d=>{ const g=d.meta.guilds[gid]; g.exp=0; g.level=1; // 10
      // 伪造已满：塞 10 成员
      for(let i=0;i<9;i++){ g.members.push({username:'x'+i,name:'X'+i,level:1,role:'member',contribution:0,joinedAt:state.getNow()}); }
      return {status:200};
    });
    mkPlayer('charlie');
    let r = store.withTransaction(d=>{ const res=eng.joinGuild(d.players['charlie'],gid,d); if(!res.success) return {status:res.status,message:res.message}; return {status:200}; });
    assert.equal(r.status,409);
    // 正常加入未满
    const g2 = store.__getRawData().meta.guilds[gid];
    g2.members.splice(1); // 清回
    store.__getRawData().meta.guilds[gid]=g2;
    let r2 = store.withTransaction(d=>{ const res=eng.joinGuild(d.players['charlie'],gid,d); if(!res.success) return {status:res.status,message:res.message}; return {status:200}; });
    assert.equal(r2.status,200);
    let r3 = store.withTransaction(d=>{ const res=eng.joinGuild(d.players['charlie'],gid,d); if(!res.success) return {status:res.status,message:res.message}; return {status:200}; });
    assert.equal(r3.status,409);
  });

  it('四级权限：vice 仅可调 officer/member，限 1/2，自踢拦截',()=>{
    mkPlayer('alice'); mkPlayer('bob'); mkPlayer('charlie'); mkPlayer('dave'); mkPlayer('eve');
    let gid;
    store.withTransaction(d=>{ const r=eng.createGuild(d.players['alice'],'GuildX',d); gid=r.guild.id; return {status:200}; });
    store.withTransaction(d=>{ eng.joinGuild(d.players['bob'],gid,d); return {status:200}; });
    store.withTransaction(d=>{ eng.joinGuild(d.players['charlie'],gid,d); return {status:200}; });
    store.withTransaction(d=>{ eng.joinGuild(d.players['dave'],gid,d); return {status:200}; });
    // leader 升 bob 为 vice
    let r1 = store.withTransaction(d=>{ const res=eng.updateRole(d.players['alice'],'bob','vice',d); if(!res.success) return {status:res.status,message:res.message}; return {status:200}; });
    assert.equal(r1.status,200);
    // vice 限 1：再升 charlie 为 vice 应 409
    let r2 = store.withTransaction(d=>{ const res=eng.updateRole(d.players['alice'],'charlie','vice',d); if(!res.success) return {status:res.status,message:res.message}; return {status:200}; });
    assert.equal(r2.status,409);
    // leader 升 charlie/dave 为 officer 限2
    let r3 = store.withTransaction(d=>{ const res=eng.updateRole(d.players['alice'],'charlie','officer',d); if(!res.success) return {status:res.status,message:res.message}; return {status:200}; });
    assert.equal(r3.status,200);
    let r4 = store.withTransaction(d=>{ const res=eng.updateRole(d.players['alice'],'dave','officer',d); if(!res.success) return {status:res.status,message:res.message}; return {status:200}; });
    assert.equal(r4.status,200);
    mkPlayer('frank');
    store.withTransaction(d=>{ eng.joinGuild(d.players['frank'],gid,d); return {status:200}; });
    let r5 = store.withTransaction(d=>{ const res=eng.updateRole(d.players['alice'],'frank','officer',d); if(!res.success) return {status:res.status,message:res.message}; return {status:200}; });
    assert.equal(r5.status,409);
    // vice 只能调 officer/member：bob(vice) 升 frank 为 officer 应 200，升为 vice 应 403
    let r6 = store.withTransaction(d=>{ const res=eng.updateRole(d.players['bob'],'frank','officer',d); if(!res.success) return {status:res.status,message:res.message}; return {status:200}; });
    // frank 已是 member，vice 升 officer 合法，但已达上限2 应 409
    assert.equal(r6.status,409);
    // 自调拦截
    let r7 = store.withTransaction(d=>{ const res=eng.updateRole(d.players['bob'],'bob','officer',d); if(!res.success) return {status:res.status,message:res.message}; return {status:200}; });
    assert.equal(r7.status,409);
    // 不能调 leader
    let r8 = store.withTransaction(d=>{ const res=eng.updateRole(d.players['bob'],'alice','officer',d); if(!res.success) return {status:res.status,message:res.message}; return {status:200}; });
    assert.equal(r8.status,409);
    // 踢同级及以上拦截：bob(vice) 踢 alice(leader) 409
    let r9 = store.withTransaction(d=>{ const res=eng.kickMember(d.players['bob'],'alice',d); if(!res.success) return {status:res.status,message:res.message}; return {status:200}; });
    assert.equal(r9.status,409);
    // 自踢
    let r10 = store.withTransaction(d=>{ const res=eng.kickMember(d.players['bob'],'bob',d); if(!res.success) return {status:res.status,message:res.message}; return {status:200}; });
    assert.equal(r10.status,409);
  });

  it('捐献日限 5/3/5 且 viewer 同步',()=>{
    mkPlayer('alice');
    store.withTransaction(d=>{ eng.createGuild(d.players['alice'],'GuildX',d); return {status:200}; });
    for(let i=0;i<5;i++){
      let r=store.withTransaction(d=>{ const res=eng.donate(d.players['alice'],'gold_small',d); if(!res.success) return {status:res.status}; return {status:200,data:res}; });
      assert.equal(r.status,200);
      if(i===4) assert.equal(r.data.viewer.donateDaily.counts['gold_small'],5);
    }
    let r2=store.withTransaction(d=>{ const res=eng.donate(d.players['alice'],'gold_small',d); if(!res.success) return {status:res.status}; return {status:200}; });
    assert.equal(r2.status,409);
    // 跨日重置
    state.__setNow(()=>1700000000000 + 86400000 + 1000);
    // migrate 触发重置
    const p=store.getPlayer('alice');
    eng.migratePlayer(p);
    assert.equal(p.guildDonateDaily.counts['gold_small'], undefined);
    let r3=store.withTransaction(d=>{ const res=eng.donate(d.players['alice'],'gold_small',d); if(!res.success) return {status:res.status}; return {status:200}; });
    assert.equal(r3.status,200);
  });

  it('双向同步：role/name/level 与 lifetime/current 区分',()=>{
    mkPlayer('alice'); mkPlayer('bob');
    let gid;
    store.withTransaction(d=>{ const r=eng.createGuild(d.players['alice'],'GuildX',d); gid=r.guild.id; return {status:200}; });
    store.withTransaction(d=>{ eng.joinGuild(d.players['bob'],gid,d); return {status:200}; });
    // 升 bob 为 officer
    store.withTransaction(d=>{ eng.updateRole(d.players['alice'],'bob','officer',d); return {status:200}; });
    assert.equal(store.getPlayer('bob').guildRole,'officer');
    const g=store.getMeta().guilds[gid];
    assert.equal(g.members.find(m=>m.username==='bob').role,'officer');
    // name/level 投影
    store.getPlayer('bob').name='Bobby'; store.getPlayer('bob').level=99;
    const view = eng.getMyGuild(store.getPlayer('bob'), {meta:store.getMeta(), players:store.__getRawData().players});
    const m=view.data.guild.members.find(x=>x.username==='bob');
    assert.equal(m.name,'Bobby');
    assert.equal(m.level,99);
    // 捐献：current vs lifetime
    store.withTransaction(d=>{ eng.donate(d.players['bob'],'gold_small',d); return {status:200}; });
    const v=eng.getMyGuild(store.getPlayer('bob'), {meta:store.getMeta(), players:store.__getRawData().players}).data.viewer;
    assert.equal(v.currentContribution,10);
    assert.equal(v.lifetimeContribution,10);
    // 离会保留 lifetime，current 清
    store.withTransaction(d=>{ eng.leaveGuild(d.players['bob'],d); return {status:200}; });
    assert.equal(store.getPlayer('bob').guildContribution,10);
    assert.equal(store.getPlayer('bob').guildId,null);
    // 重入新公会 current 从0
    mkPlayer('charlie');
    let gid2;
    store.withTransaction(d=>{ const r=eng.createGuild(d.players['charlie'],'Guild2',d); gid2=r.guild.id; return {status:200}; });
    store.withTransaction(d=>{ eng.joinGuild(d.players['bob'],gid2,d); return {status:200}; });
    const v2=eng.getMyGuild(store.getPlayer('bob'), {meta:store.getMeta(), players:store.__getRawData().players}).data.viewer;
    assert.equal(v2.currentContribution,0);
    assert.equal(v2.lifetimeContribution,10);
  });

  it('自愈：无效 guildId/缺失成员/role 不一致',()=>{
    mkPlayer('alice'); mkPlayer('bob');
    let gid;
    store.withTransaction(d=>{ const r=eng.createGuild(d.players['alice'],'GuildX',d); gid=r.guild.id; eng.joinGuild(d.players['bob'],gid,d); return {status:200}; });
    // 坏投影：bob 指向不存在公会
    store.getPlayer('bob').guildId='bad-id';
    store.getPlayer('bob').guildRole='member';
    let healed = eng.migratePlayer(store.getPlayer('bob'));
    assert.equal(healed.guildId,null);
    assert.equal(healed.guildRole,null);
    // 恢复
    store.withTransaction(d=>{ eng.joinGuild(d.players['bob'],gid,d); return {status:200}; });
    // 坏投影：alice 在 members 但 role 不一致
    store.getPlayer('alice').guildRole='member';
    const ctx={meta:store.getMeta(), players:store.__getRawData().players};
    eng.ensureGuildConsistency(store.getPlayer('alice'), ctx);
    assert.equal(store.getPlayer('alice').guildRole,'leader');
    // 缺失成员：直接删 members 中 bob
    const g=store.getMeta().guilds[gid];
    g.members = g.members.filter(m=>m.username!=='bob');
    store.getPlayer('bob').guildId=gid; store.getPlayer('bob').guildRole='member';
    eng.ensureGuildConsistency(store.getPlayer('bob'), ctx);
    assert.equal(store.getPlayer('bob').guildId,null);
  });

  it('读路径自愈需事务落盘',async()=>{
    mkPlayer('alice');
    let gid;
    store.withTransaction(d=>{ const r=eng.createGuild(d.players['alice'],'GuildX',d); gid=r.guild.id; return {status:200}; });
    // 制造坏投影
    store.getPlayer('alice').guildRole='member'; // 应为 leader
    // 直接 getMyGuild（非事务）会返回修正后的 viewer，但不持久化到磁盘
    const ctx={meta:store.getMeta(), players:store.__getRawData().players};
    const direct=eng.getMyGuild(store.getPlayer('alice'), ctx);
    assert.equal(direct.data.viewer.role,'leader');
    // 此时内存已被 ensure 修正为 leader，但我们回滚以模拟未落盘：重置为坏值再验证事务落盘
    store.getPlayer('alice').guildRole='member';
    // 走事务 GET 应落盘
    const express=require('express');
    const { registerGuildRoutes } = require('../routes/guild');
    const app=express(); app.use(express.json()); eng.setStore(store); registerGuildRoutes(app, store);
    const http=require('http');
    await new Promise((resolve,reject)=>{
      const srv=http.createServer(app);
      srv.listen(0, async()=>{
        const port=srv.address().port;
        try{
          const res=await fetch(`http://127.0.0.1:${port}/api/player/alice/guild`);
          const body=await res.json();
          assert.equal(body.success,true);
          assert.equal(store.getPlayer('alice').guildRole,'leader');
          store.save();
          store.__resetStore(); store.load();
          assert.equal(store.getPlayer('alice').guildRole,'leader');
          srv.close(()=>resolve());
        }catch(e){ srv.close(()=>reject(e)); }
      });
    });
  });

  it('解散写日志且归档',()=>{
    mkPlayer('alice'); mkPlayer('bob');
    let gid;
    store.withTransaction(d=>{ const r=eng.createGuild(d.players['alice'],'MyGuild',d); gid=r.guild.id; eng.joinGuild(d.players['bob'],gid,d); return {status:200}; });
    store.withTransaction(d=>{ eng.donate(d.players['alice'],'gold_small',d); return {status:200}; });
    const beforeLogs = store.getMeta().guilds[gid].logs.length;
    // 单成员离会解散路径
    mkPlayer('solo');
    let gid2;
    store.withTransaction(d=>{ const r=eng.createGuild(d.players['solo'],'Solo',d); gid2=r.guild.id; return {status:200}; });
    store.withTransaction(d=>{ const res=eng.leaveGuild(d.players['solo'],d); if(!res.success) return {status:res.status}; return {status:200}; });
    assert.equal(store.getMeta().guilds[gid2], undefined);
    assert.ok(store.getMeta().guildArchive[gid2]);
    assert.ok(store.getMeta().guildArchive[gid2].logs.find(l=>l.action==='disband'));
    // 多成员解散
    let r=store.withTransaction(d=>{ const res=eng.disbandGuild(d.players['alice'],d); if(!res.success) return {status:res.status}; return {status:200}; });
    assert.equal(r.status,200);
    assert.equal(store.getMeta().guilds[gid], undefined);
    const arch=store.getMeta().guildArchive[gid];
    assert.ok(arch);
    assert.ok(arch.logs.find(l=>l.action==='disband'));
    assert.ok(arch.logs.find(l=>l.action==='donate'));
    assert.equal(arch.logs[arch.logs.length-1].action,'disband');
    assert.equal(store.getPlayer('alice').guildId,null);
    assert.equal(store.getPlayer('bob').guildId,null);
  });

  it('远征首次+10且重放不二次',()=>{
    mkPlayer('alice',20,10000);
    let gid;
    store.withTransaction(d=>{ const r=eng.createGuild(d.players['alice'],'GuildX',d); gid=r.guild.id; return {status:200}; });
    const p=store.getPlayer('alice');
    state.__setNow(()=>1700000000000);
    const dr=eng.dispatchExpedition(p,'verdant_border','30m');
    assert.equal(dr.success,true);
    state.__setNow(()=>1700000000000 + 31*60*1000);
    let cr=store.withTransaction(d=>{ const pp=d.players['alice']; const r=eng.claimExpedition(pp, pp.expedition.id, d); if(!r.success) return {status:r.code||400,message:r.message}; return {status:200, data:r}; });
    assert.equal(cr.status,200);
    const exp1=store.getMeta().guilds[gid].exp;
    // 重放同一 id
    const expId=cr.data.report.id;
    let replay=store.withTransaction(d=>{ const pp=d.players['alice']; const r=eng.claimExpedition(pp, expId, d); if(!r.success) return {status:r.code||400}; return {status:200, data:r}; });
    assert.equal(replay.status,200);
    assert.equal(replay.data.already,true);
    const exp2=store.getMeta().guilds[gid].exp;
    assert.equal(exp2,exp1);
  });

  it('pageSize 10-20 限制与 viewer DTO',()=>{
    mkPlayer('alice');
    for(let i=0;i<3;i++){ mkPlayer('u'+i); store.withTransaction(d=>{ eng.createGuild(d.players['u'+i],'Guild'+i,d); return {status:200}; }); }
    let r=eng.listGuilds({meta:store.getMeta(), players:store.__getRawData().players}, {pageSize:5});
    assert.equal(r.data.pageSize,10);
    let r2=eng.listGuilds({meta:store.getMeta(), players:store.__getRawData().players}, {pageSize:100});
    assert.equal(r2.data.pageSize,20);
    mkPlayer('bob');
    store.withTransaction(d=>{ eng.createGuild(d.players['bob'],'BGuild',d); return {status:200}; });
    store.withTransaction(d=>{ eng.donate(d.players['bob'],'gold_small',d); return {status:200}; });
    const my=eng.getMyGuild(store.getPlayer('bob'), {meta:store.getMeta(), players:store.__getRawData().players});
    assert.ok(my.data.viewer);
    assert.equal(typeof my.data.viewer.currentContribution,'number');
    assert.equal(typeof my.data.viewer.lifetimeContribution,'number');
    assert.ok(my.data.viewer.donateDaily);
  });

  it('轮询 DTO 不含 guildViewer 且为 summary',()=>{
    mkPlayer('alice');
    store.withTransaction(d=>{ eng.createGuild(d.players['alice'],'GuildX',d); return {status:200}; });
    const view=eng.getPlayerView(store.getPlayer('alice'));
    assert.ok(view.guild);
    assert.equal(view.guildViewer, undefined);
    assert.equal(view.guild.members, undefined);
    assert.ok(typeof view.guild.nextLevelExp === 'number' || view.guild.nextLevelExp===null);
  });

  it('日志写入即截断与等级循环',()=>{
    mkPlayer('alice');
    let gid;
    store.withTransaction(d=>{ const r=eng.createGuild(d.players['alice'],'GuildX',d); gid=r.guild.id; return {status:200}; });
    // 制造 40 条日志 via donate + announce
    for(let i=0;i<40;i++){
      store.getMeta().guilds[gid].logs.push({at:state.getNow(), by:'alice', action:'spam'+i});
    }
    // 下一次 donate 应截断至 30
    store.withTransaction(d=>{ eng.donate(d.players['alice'],'gold_small',d); return {status:200}; });
    assert.equal(store.getMeta().guilds[gid].logs.length,30);
    // 等级循环：设 490 再捐 10 -> 500 跨级
    store.getMeta().guilds[gid].exp=490; store.getMeta().guilds[gid].level=1;
    store.withTransaction(d=>{ eng.donate(d.players['alice'],'gold_small',d); return {status:200}; });
    assert.equal(store.getMeta().guilds[gid].level,2);
  });
});
