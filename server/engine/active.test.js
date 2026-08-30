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
  it('五来源真实调用链（idle/daily/pvp/boss/expedition）', () => {
    let now = Date.now();
    __setNow(()=> now);
    __setRandom(()=> 0.3);
    const p = createCharacter('t6','T6');
    p.level = 5;
    p.lastTick = now - 4000;
    const { calculateIdle } = require('./idle');
    const { claimDaily } = require('./daily');
    const idleRes = calculateIdle(p);
    assert.ok(idleRes);
    assert.equal(p.dailyActive.points, 5);
    // daily
    const dq = p.dailyQuests.find(q=>q.id==='battle20');
    dq.done = true;
    const rDaily = claimDaily(p, 'battle20');
    assert.equal(rDaily.success, true);
    assert.equal(p.dailyActive.points, 15);
    // pvp / boss / expedition via addActivePoints as production埋点
    addActivePoints(p, 'pvp', 1);
    assert.equal(p.dailyActive.points, 30);
    addActivePoints(p, 'boss', 1);
    assert.equal(p.dailyActive.points, 45);
    addActivePoints(p, 'expedition', 1);
    assert.equal(p.dailyActive.points, 65);
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
  it('save/reload 持久化与跨日', () => {
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
    const p = createCharacter('t8','T8');
    store.setPlayer('t8', p);
    store.setAccount('t8', {username:'t8', password:'x', hasCharacter:true});
    addActivePoints(p, 'pvp', 2);
    claimActive(p, 1);
    store.setPlayer('t8', p);
    store.save();
    // 模拟重启
    store.__resetStore();
    store.load();
    const reloaded = store.getPlayer('t8');
    assert.equal(reloaded.dailyActive.points, 30);
    assert.deepEqual(reloaded.dailyActive.claimed, [1]);
    try { fs.unlinkSync(tmp); fs.unlinkSync(tmp+'.bak'); } catch(_){}
    store.__setDbPath(require('path').join(__dirname, '../db.json'));
    store.__resetStore();
    store.load();
  });
});
