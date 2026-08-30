const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { __setNow, __setRandom } = require('./state');
const { createCharacter } = require('./player');
const { addActivePoints, getDailyActiveView, claimActive } = require('./active');
const { getPlayerView } = require('./view');

describe('T-104 每日活跃', () => {
  it('5 来源各 +5/+10/+15/+15/+20 累加至 65 且封顶100', () => {
    let now = Date.now();
    __setNow(()=> now);
    __setRandom(()=> 0.3);
    const p = createCharacter('t1','T1');
    addActivePoints(p, 'idle_claim', 1);
    addActivePoints(p, 'daily_claim', 1);
    addActivePoints(p, 'pvp', 1);
    addActivePoints(p, 'boss', 1);
    addActivePoints(p, 'expedition', 1);
    assert.equal(p.dailyActive.points, 65);
    addActivePoints(p, 'expedition', 5);
    assert.equal(p.dailyActive.points, 100);
  });
  it('幂等重放不二次加分且不二次发奖', () => {
    let now = Date.now();
    __setNow(()=> now);
    __setRandom(()=> 0.2);
    const p = createCharacter('t2','T2');
    addActivePoints(p, 'expedition', 5);
    const r1 = claimActive(p, 1);
    assert.equal(r1.success, true);
    const goldAfter = p.gold;
    const r2 = claimActive(p, 1);
    assert.equal(r2.already, true);
    assert.equal(p.gold, goldAfter);
    assert.deepEqual(r1.reward, r2.reward);
  });
  it('tier3 3次独立抽取合并且重放不变', () => {
    let now = Date.now();
    __setNow(()=> now);
    __setRandom(()=> 0.1);
    const p = createCharacter('t3','T3');
    addActivePoints(p, 'expedition', 5);
    const r1 = claimActive(p, 3);
    assert.equal(r1.success, true);
    assert.ok(r1.reward.materials.length >=1 && r1.reward.materials.length <=3);
    const sum = r1.reward.materials.reduce((a,m)=>a+m.count,0);
    assert.equal(sum, 3);
    const r2 = claimActive(p, 3);
    assert.deepEqual(r1.reward, r2.reward);
  });
  it('跨日重置与迁移保留', () => {
    let now = Date.now();
    __setNow(()=> now);
    const p = createCharacter('t4','T4');
    addActivePoints(p, 'pvp', 2);
    assert.equal(p.dailyActive.points, 30);
    // 非字符串 lastResetAt 仅规范化不清空
    p.dailyActive.lastResetAt = 123;
    getDailyActiveView(p);
    assert.equal(p.dailyActive.points, 30);
    // 次日
    now += 86400000 + 1000;
    __setNow(()=> now);
    const v = getDailyActiveView(p);
    assert.equal(v.points, 0);
    assert.deepEqual(v.claimed, []);
  });
  it('领取返回完整 view 且 questView 同步', () => {
    let now = Date.now();
    __setNow(()=> now);
    __setRandom(()=> 0.4);
    const p = createCharacter('t5','T5');
    addActivePoints(p, 'expedition', 5);
    claimActive(p, 1);
    const view = getPlayerView(p);
    assert.ok(view.questView.dailyActive);
    assert.equal(view.questView.dailyActive.points, view.dailyActive.points);
    assert.ok(view.questView.dailyActive.tiers.find(t=>t.tier===1).claimed);
  });
  it('五来源真实调用链（idle/daily/expedition + pvp/boss hook 存在性）', () => {
    let now = Date.now();
    __setNow(()=> now);
    __setRandom(()=> 0.3);
    const p = createCharacter('t6','T6');
    p.level = 5;
    p.lastTick = now - 4000;
    const { calculateIdle } = require('./idle');
    const { claimDaily } = require('./daily');
    const { dispatchExpedition, claimExpedition } = require('./expedition');
    const idleRes = calculateIdle(p);
    assert.ok(idleRes);
    assert.equal(p.dailyActive.points, 5);
    // daily via production claimDaily
    const dq = p.dailyQuests.find(q=>q.id==='battle20');
    dq.done = true;
    const rDaily = claimDaily(p, 'battle20');
    assert.equal(rDaily.success, true);
    assert.equal(p.dailyActive.points, 15);
    // pvp/boss hook 存在性（真实 HTTP 链路在下个用例单独覆盖）
    const fs2a = require('fs');
    const pvpSrcA = fs2a.readFileSync(require('path').join(__dirname, '../routes/pvp.js'), 'utf8');
    assert.ok(pvpSrcA.includes("addActivePoints(player, 'pvp'"), 'pvp hook missing');
    const bossSrc2 = fs2a.readFileSync(require('path').join(__dirname, '../routes/worldboss.js'), 'utf8');
    assert.ok(bossSrc2.includes("addActivePoints") && bossSrc2.includes("'boss'"), 'boss hook missing');
    const expSrc = fs2a.readFileSync(require('path').join(__dirname, './expedition.js'), 'utf8');
    assert.ok(expSrc.includes("addActivePoints") && expSrc.includes("'expedition'"), 'expedition hook missing');
    // expedition via真实 dispatch/claim
    __setRandom(()=> 0.4);
    const disp = dispatchExpedition(p, 'verdant_border', '30m');
    assert.equal(disp.success, true);
    now += 30*60*1000 + 1000;
    __setNow(()=> now);
    const rExp = claimExpedition(p, disp.expedition.id);
    assert.equal(rExp.success, true);
    assert.equal(p.dailyActive.points, 35);
  });
  it('PvP/Boss 真实 HTTP 链路计分', async () => {
    const store = require('../store');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');
    const tmp = path.join(os.tmpdir(), 'test-active-http-'+Date.now()+'.json');
    store.__setDbPath(tmp);
    store.__resetStore();
    store.load();
    const express = require('express');
    const { registerPvpRoutes } = require('../routes/pvp');
    const { registerWorldBossRoutes } = require('../routes/worldboss');
    const { registerActiveRoutes } = require('../routes/active');
    const http = require('http');
    const app = express();
    app.use(express.json());
    const eng = require('./index');
    eng.setStore(store);
    registerPvpRoutes(app, store);
    registerWorldBossRoutes(app, store);
    registerActiveRoutes(app, store);
    let now = Date.now();
    __setNow(()=> now);
    __setRandom(()=> 0.5);
    const p = createCharacter('httpT','HttpT');
    p.level = 10;
    store.setPlayer('httpT', p);
    store.setAccount('httpT', {username:'httpT', password:'x', hasCharacter:true});
    // 需要对手
    const q = createCharacter('httpOpp','Opp');
    q.level = 10;
    store.setPlayer('httpOpp', q);
    store.setAccount('httpOpp', {username:'httpOpp', password:'x', hasCharacter:true});
    await new Promise((resolve, reject)=>{
      const srv = http.createServer(app);
      srv.listen(0, async ()=>{
        const port = srv.address().port;
        try {
          // pvp
          const r1 = await fetch(`http://127.0.0.1:${port}/api/arena/challenge`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username:'httpT', targetUsername:'httpOpp', isBot:false, requestId:'req-http-1'})});
          const b1 = await r1.json();
          assert.equal(b1.success, true);
          assert.equal(store.getPlayer('httpT').dailyActive.points, 15);
          // boss — 必须成功且 +15（失败则测试失败，不放过）
          const r2 = await fetch(`http://127.0.0.1:${port}/api/player/httpT/worldboss/attack`, {method:'POST'});
          const b2 = await r2.json();
          assert.equal(b2.success, true, 'worldboss attack should succeed: '+JSON.stringify(b2));
          assert.equal(store.getPlayer('httpT').dailyActive.points, 30);
          srv.close(()=> resolve());
        } catch(e){ srv.close(()=> reject(e)); }
      });
    });
    try { fs.unlinkSync(tmp); fs.unlinkSync(tmp+'.bak'); } catch(_){}
    store.__setDbPath(path.join(__dirname, '../db.json'));
    store.__resetStore();
    store.load();
    eng.setStore(store);
  });
  it('旧存档 tier3 已领取但 rewards 缺失应回填', () => {
    let now = Date.now();
    __setNow(()=> now);
    __setRandom(()=> 0.5);
    const p = createCharacter('t7','T7');
    addActivePoints(p, 'expedition', 5);
    const r3 = claimActive(p, 3);
    assert.equal(r3.success, true);
    // 模拟 814 旧存档：claimed 含 3 但 rewards 未持久化
    delete p.dailyActive.rewards[3];
    assert.equal(p.dailyActive.rewards[3], undefined);
    const view = getDailyActiveView(p);
    const tier3 = view.tiers.find(t=>t.tier===3);
    assert.ok(tier3.claimed);
    assert.ok(tier3.reward.materials && tier3.reward.materials.length>0);
    assert.ok(p.dailyActive.rewards[3]);
  });
  it('save/reload 持久化与跨日及 ledger 淘汰', async () => {
    const store = require('../store');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');
    const tmp = path.join(os.tmpdir(), 'test-active-'+Date.now()+'.json');
    store.__setDbPath(tmp);
    store.__resetStore();
    store.load();
    let now = Date.now();
    __setNow(()=> now);
    __setRandom(()=> 0.2);
    const p = createCharacter('t8','T8');
    store.setPlayer('t8', p);
    store.setAccount('t8', {username:'t8', password:'x', hasCharacter:true});
    addActivePoints(p, 'pvp', 2);
    claimActive(p, 1);
    // tier3 随机奖励持久化
    addActivePoints(p, 'expedition', 5);
    const r3 = claimActive(p, 3);
    assert.ok(r3.reward.materials);
    const r3Reward = JSON.stringify(r3.reward);
    store.setPlayer('t8', p);
    store.save();
    // 模拟重启
    store.__resetStore();
    store.load();
    const reloaded = store.getPlayer('t8');
    assert.equal(reloaded.dailyActive.points, 100);
    assert.deepEqual(reloaded.dailyActive.claimed, [1,3]);
    assert.ok(reloaded.dailyActive.rewards[3]);
    assert.deepEqual(JSON.stringify(reloaded.dailyActive.rewards[3]), r3Reward);
    // ledger 100 条淘汰后仍可重放 tier3 且奖励一致（经 save/reload 持久化）
    const tier3Id = `daily_active:${reloaded.dailyActive.lastResetAt}:3`;
    assert.ok(reloaded.settlementLedger.find(e=>e.id===tier3Id));
    for(let i=0;i<110;i++) reloaded.settlementLedger.push({id:`dummy:${i}`, at:now+i, type:'daily', reward:{gold:1}, source:'x'});
    if (reloaded.settlementLedger.length>100) reloaded.settlementLedger.splice(0, reloaded.settlementLedger.length-100);
    // 经 save/reload 证明淘汰持久化
    store.setPlayer('t8', reloaded);
    store.save();
    store.__resetStore();
    store.load();
    const afterEvict = store.getPlayer('t8');
    assert.equal(afterEvict.settlementLedger.find(e=>e.id===tier3Id), undefined, 'tier3 ledger 应已被淘汰');
    assert.ok(afterEvict.dailyActive.claimed.includes(3));
    const viewEv = getDailyActiveView(afterEvict);
    assert.ok(viewEv.tiers.find(t=>t.tier===3).reward.materials);
    assert.deepEqual(JSON.stringify(viewEv.tiers.find(t=>t.tier===3).reward), r3Reward);
    const replay = claimActive(afterEvict, 3);
    assert.equal(replay.already, true);
    assert.deepEqual(JSON.stringify(replay.reward), r3Reward);
    // 跨日后重启落盘 — 需再次 save/reload 证明磁盘清零（非仅内存）
    now += 86400000 + 1000;
    __setNow(()=> now);
    // 先触发内存刷新
    const memView = getDailyActiveView(afterEvict);
    assert.equal(memView.points, 0);
    // 再落盘并重载验证
    store.setPlayer('t8', afterEvict);
    store.save();
    store.__resetStore();
    store.load();
    const afterDay = store.getPlayer('t8');
    const view2 = getDailyActiveView(afterDay);
    assert.equal(view2.points, 0);
    assert.deepEqual(view2.claimed, []);
    assert.equal(afterDay.dailyActive.rewards[3], undefined);
    // 二次落盘验证
    store.setPlayer('t8', afterDay);
    store.save();
    store.__resetStore();
    store.load();
    const afterDay2 = store.getPlayer('t8');
    assert.equal(afterDay2.dailyActive.points, 0);
    assert.deepEqual(afterDay2.dailyActive.claimed, []);
    // route 契约：POST /daily-active/claim 返回完整 view（走真实 HTTP 路由）
    const express = require('express');
    const { registerActiveRoutes } = require('../routes/active');
    const http = require('http');
    const app = express();
    app.use(express.json());
    // 需要 engine 的 getPlayerView 已包含 dailyActive，store 已注入
    const eng = require('./index');
    eng.setStore(store);
    registerActiveRoutes(app, store);
    // 准备新玩家走真实路由
    const p2 = createCharacter('t9','T9');
    store.setPlayer('t9', p2);
    store.setAccount('t9', {username:'t9', password:'x', hasCharacter:true});
    addActivePoints(p2, 'expedition', 1);
    store.setPlayer('t9', p2);
    await new Promise((resolve, reject)=>{
      const srv = http.createServer(app);
      srv.listen(0, async ()=>{
        const port = srv.address().port;
        try {
          const res = await fetch(`http://127.0.0.1:${port}/api/player/t9/daily-active/claim`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({tier:1})});
          const body = await res.json();
          assert.equal(body.success, true);
          assert.ok(body.data);
          assert.ok(body.data.questView);
          assert.ok(body.data.questView.dailyActive);
          assert.ok(body.data.dailyActive);
          assert.equal(body.data.questView.dailyActive.points, body.dailyActive.points);
          assert.equal(body.data.dailyActive.points, 20);
          assert.equal(body.data.dailyActive.claimed.includes(1), true);
          assert.equal(body.reward.gold, 100);
          // 完整 view 契约：data 应等价于 getPlayerView（除时间外）
          const expectedView = getPlayerView(store.getPlayer('t9'));
          assert.deepEqual(body.data.dailyActive, expectedView.dailyActive);
          assert.deepEqual(body.data.questView.dailyActive, expectedView.questView.dailyActive);
          assert.deepEqual(body.data.settlementLedger.slice(-1)[0].id, expectedView.settlementLedger.slice(-1)[0].id);
          assert.equal(body.data.questView.dailyActive.tiers.length, expectedView.questView.dailyActive.tiers.length);
          assert.ok(body.data.questView.dailyQuests);
          assert.ok(body.data.inventory);
          srv.close(()=> resolve());
        } catch(e){ srv.close(()=> reject(e)); }
      });
    });
    try { fs.unlinkSync(tmp); fs.unlinkSync(tmp+'.bak'); } catch(_){}
    store.__setDbPath(require('path').join(__dirname, '../db.json'));
    store.__resetStore();
    store.load();
  });
});
