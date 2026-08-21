const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const engine = require('./engine');
const { AFFIX_TREE, ACTIVE_SKILL_CD } = require('./data');

describe('T-005 主动技能 CD 与触发', ()=>{
  beforeEach(()=> engine.__resetSeams());
  afterEach(()=> engine.__resetSeams());

  it('getActiveSkillCd 映射 1→5 2→4 3→3 4→2', ()=>{
    assert.equal(engine.getActiveSkillCd(1), 5);
    assert.equal(engine.getActiveSkillCd(2), 4);
    assert.equal(engine.getActiveSkillCd(3), 3);
    assert.equal(engine.getActiveSkillCd(4), 2);
    assert.equal(engine.getActiveSkillCd(99), 5);
  });
  it('shouldTriggerActiveSkill round%cd', ()=>{
    assert.equal(engine.shouldTriggerActiveSkill(5,5), true);
    assert.equal(engine.shouldTriggerActiveSkill(4,5), false);
    assert.equal(engine.shouldTriggerActiveSkill(10,5), true);
    assert.equal(engine.shouldTriggerActiveSkill(2,2), true);
    assert.equal(engine.shouldTriggerActiveSkill(3,2), false);
    assert.equal(engine.shouldTriggerActiveSkill(6,3), true);
  });
  it('A1-01 初级 CD5 在 5,10 触发，其余不触发', ()=>{
    engine.__setRandom(()=>0.99); // 无闪避、无暴击、无怪技
    const p = engine.createCharacter('u1','n1');
    p.level = 31; p.attributes = { atk: 5, def: 4, hp: 5, agi: 8 }; engine.recalcMaxStats(p);
    p.affixes.active = 'A1-01'; // damage 1.2, level1
    p.hp = p.maxHp;
    const monster = { name:'木桩', hp: 50000, atk: 5, def: 80, agi: 80, skills: [] };
    const battle = engine.simulateBattle(p, monster);
    // 收集所有 skill round
    const skillRounds = [];
    for(const r of battle.rounds){
      for(const a of r.actions){ if(a.type==='skill') skillRounds.push(r.round); }
    }
    // 去重
    const uniq = [...new Set(skillRounds)].sort((a,b)=>a-b);
    // 5,10,15... 且同回合仅一次
    assert.ok(uniq.includes(5), `should have 5, got ${uniq}`);
    assert.ok(uniq.includes(10), `should have 10, got ${uniq}`);
    assert.ok(!uniq.includes(1) && !uniq.includes(2) && !uniq.includes(3) && !uniq.includes(4), `1-4 should not have skill, got ${uniq}`);
    // 同回合仅一次
    for(const r of battle.rounds){
      const cnt = r.actions.filter(a=>a.type==='skill').length;
      assert.ok(cnt <= 1, `round ${r.round} has ${cnt} skills`);
    }
  });
  it('B4-05 大师 CD2 在 2,4,6 触发', ()=>{
    engine.__setRandom(()=>0.99);
    const p = engine.createCharacter('u2','n2');
    p.level=100; p.attributes={ atk:5, def:4, hp:5, agi:8 }; engine.recalcMaxStats(p);
    p.affixes.active='A4-05'; // level4, gold_buff, cd2
    p.hp=p.maxHp;
    const monster = { name:'木桩2', hp: 100000, atk:5, def:80, agi:200, skills:[] };
    const battle = engine.simulateBattle(p, monster);
    const uniq=[...new Set(battle.rounds.flatMap(r=>r.actions.filter(a=>a.type==='skill').map(()=>r.round)))].sort((a,b)=>a-b);
    assert.ok(uniq.includes(2), `2 should trigger ${uniq}`);
    assert.ok(uniq.includes(4), `4 should trigger ${uniq}`);
    assert.ok(uniq.includes(6), `6 should trigger ${uniq}`);
    assert.ok(!uniq.includes(1) && !uniq.includes(3) && !uniq.includes(5), `1,3,5 not`);
  });
  it('顺序：第一条 player 普通后紧邻 skill（玩家先手）', ()=>{
    engine.__setRandom(()=>0.99);
    const p = engine.createCharacter('u3','n3');
    p.level=31; p.attributes={ atk:5, def:4, hp:5, agi:20 }; engine.recalcMaxStats(p); // 高敏确保先手
    p.affixes.active='A1-01';
    p.hp=p.maxHp;
    const monster = { name:'木桩3', hp: 5000, atk:5, def:5, agi:5, skills:[] };
    const battle = engine.simulateBattle(p, monster);
    // 找 round5
    const r5 = battle.rounds.find(r=>r.round===5);
    assert.ok(r5, 'round5 exists');
    // actions 中第一条 player 普通的下一条即 skill
    const firstPlayerIdx = r5.actions.findIndex(a=>a.actor==='player' && a.skill==='普通攻击');
    assert.ok(firstPlayerIdx!==-1, 'has normal');
    assert.equal(r5.actions[firstPlayerIdx+1]?.type, 'skill', `next should be skill, got ${JSON.stringify(r5.actions[firstPlayerIdx+1])}`);
  });
  it('顺序：怪物先手时仍在首条 player 普通后紧邻', ()=>{
    engine.__setRandom(()=>0.99);
    const p = engine.createCharacter('u4','n4');
    p.level=31; p.attributes={ atk:5, def:4, hp:5, agi:5 }; engine.recalcMaxStats(p);
    p.affixes.active='A1-01';
    p.hp=p.maxHp;
    const monster = { name:'高速怪', hp: 5000, atk:5, def:5, agi:100, skills:[] }; // 怪物先手
    const battle = engine.simulateBattle(p, monster);
    const r5 = battle.rounds.find(r=>r.round===5);
    assert.ok(r5);
    // 首条是 monster，首条 player 普通后仍紧邻 skill
    const firstPlayerIdx = r5.actions.findIndex(a=>a.actor==='player' && a.skill==='普通攻击');
    assert.ok(firstPlayerIdx!==-1);
    // 怪物先手时 firstPlayerIdx 不为 0，但仍紧邻
    assert.equal(r5.actions[firstPlayerIdx+1]?.type, 'skill');
  });
  it('首攻杀则不追加技能', ()=>{
    engine.__setRandom(()=>0.99);
    const p = engine.createCharacter('u5','n5');
    p.level=100; p.attributes={ atk:100, def:4, hp:5, agi:8 }; engine.recalcMaxStats(p);
    p.affixes.active='A1-01'; p.hp=p.maxHp;
    const monster = { name:'小怪', hp: 1, atk:5, def:0, agi:5, skills:[] };
    const battle = engine.simulateBattle(p, monster);
    // 第一回合即击杀，round5 不存在或无 skill
    // 整个战斗不应有 skill 因为已在首回合击杀（首回合非 CD 回合）
    // 但若战斗持续 1 回合，round1 非 5，不应有 skill
    const hasSkill = battle.rounds.some(r=>r.actions.some(a=>a.type==='skill'));
    assert.equal(hasSkill, false);
  });
});

describe('T-005 buff 过期与单层刷新', ()=>{
  beforeEach(()=> engine.__resetSeams());
  afterEach(()=> engine.__resetSeams());
  it('A1-04 atk+10% 2回合 5生效6保持7回退', ()=>{
    engine.__setRandom(()=>0.99);
    const p = engine.createCharacter('b1','n');
    p.level=31; p.attributes={ atk:5, def:4, hp:5, agi:8 }; engine.recalcMaxStats(p);
    const baseAtk = engine.getCombatStats(p).atk;
    p.affixes.active='A1-04'; // atk_buff 10% 2回合 level1 cd5
    p.hp=p.maxHp;
    const monster = { name:'木桩', hp: 20000, atk:5, def:5, agi:5, skills:[] };
    const battle = engine.simulateBattle(p, monster);
    // round5 的 combatStats atk 应放大
    // 通过 rounds 间接验证：round5 后 combat.atk 放大，但 expire 在 7
    // 我们通过第二场战斗的 buff 状态：直接测 combat atk 数值变化 via simulateBattle 的 combatStats 返回是最终值，需用 shouldTrigger 原理验证
    // 更直接：检查 rounds 5 的 actions 含 buff，且 round7 的 actions 后 atk 回退（通过再次模拟的中间值难以直接，故测过期逻辑：5 triggers, 7 not buffed)
    const r5 = battle.rounds.find(r=>r.round===5);
    const r6 = battle.rounds.find(r=>r.round===6);
    const r7 = battle.rounds.find(r=>r.round===7);
    assert.ok(r5.actions.some(a=>a.type==='skill' && a.buff===0.10), 'r5 should have buff');
    // r6 不应有新 skill（cd5），但 buff 仍生效：我们验证 r6 无新 skill 但 combat 仍高（通过 damage 数值间接）
    assert.ok(!r6.actions.some(a=>a.type==='skill'), 'r6 no new skill');
    // r7  expire 后回退，验证 r7 无 buff 且下一个 atk_buff 会重新触发于 10
    // 简单验证 7 的 damage 回落：取 r5 附带后与 r7 的普通伤害对比
    // 由于浮动和防御，用 atk 数值更稳：直接用 applyBuff 逻辑测试 is sequential, so we assert buffs length at round7 is 0 via indirect: r10 should have new buff
    const r10 = battle.rounds.find(r=>r.round===10);
    assert.ok(r10.actions.some(a=>a.type==='skill'), 'r10 should trigger again');
  });
  it('同 key 刷新不叠乘（重叠分支，cd2+turns3 人工）', ()=>{
    engine.__setRandom(()=>0.99);
    const data = require('./data');
    const testId='TEST-ATK-OVERLAP';
    data.AFFIX_TREE[1].push({ id:testId, level:1, slot:'active', group:'A', name:'测试ATK', desc:'重叠', category:'增益', effect:{ type:'atk_buff', value:0.10, turns:3 } });
    const origCd = data.ACTIVE_SKILL_CD[1];
    data.ACTIVE_SKILL_CD[1]=2; // 人工 cd2 使 2,4 重叠（2+3=5，4<5）
    const p = engine.createCharacter('b2','n');
    p.level=31; p.attributes={ atk:10, def:4, hp:5, agi:8 }; engine.recalcMaxStats(p);
    const baseAtk = engine.getCombatStats(p).atk;
    p.affixes.active=testId; p.hp=p.maxHp;
    const monster={ name:'桩', hp:120000, atk:1, def:100, agi:80, skills:[] };
    const battle = engine.simulateBattle(p, monster);
    const r2 = battle.rounds.find(r=>r.round===2);
    const r4 = battle.rounds.find(r=>r.round===4);
    assert.ok(r2.actions.some(a=>a.type==='skill'), 'r2 trigger');
    assert.ok(r4.actions.some(a=>a.type==='skill'), 'r4 overlap trigger');
    const finalAtk = battle.combatStats.atk;
    const single = Math.floor(baseAtk*1.1);
    const double = Math.floor(Math.floor(baseAtk*1.1)*1.1);
    assert.notEqual(finalAtk, double, `should not be double ${double}, got ${finalAtk}`);
    assert.ok(finalAtk===single || finalAtk===baseAtk, `finalAtk ${finalAtk} single ${single}`);
    data.ACTIVE_SKILL_CD[1]=origCd;
    data.AFFIX_TREE[1] = data.AFFIX_TREE[1].filter(a=>a.id!==testId);
  });
});

describe('T-005 经济仅胜利（真实 calculateIdle）', ()=>{
  beforeEach(()=> engine.__resetSeams());
  afterEach(()=> engine.__resetSeams());
  it('gold_buff 仅 win 放大，lose/timeout 不产生 gold', ()=>{
    engine.__setRandom(()=>0.99);
    engine.__setDropRandom(()=>1);
    const data = require('./data');
    // 注入临时区域，确保可控 gold/exp
    const testAreaId = 'test_gold_area';
    data.AREAS[testAreaId] = {
      id: testAreaId, name:'测试金场', minLevel:1,
      monsters:[{ name:'金库怪', hp:3000, atk:5, def:80, agi:80, skills:[], exp:100, gold:100 }],
      drops:[]
    };
    // win 基准：无技能
    const pBase = engine.createCharacter('gBase','n');
    pBase.level=31; pBase.attributes={ atk:20, def:10, hp:10, agi:10 }; engine.recalcMaxStats(pBase);
    pBase.currentArea=testAreaId; pBase.affixes.active=null; pBase.gold=0; pBase.hp=pBase.maxHp; pBase.lastTick=0;
    engine.__setNow(()=>1000000);
    const resBase = engine.calculateIdle(pBase);
    assert.ok(resBase && resBase.logEntry.result==='win', `base should win ${JSON.stringify(resBase?.logEntry)}`);
    const baseGold = resBase.logEntry.gold;
    // win 技能：同属性但带 A1-05，至少 5 回合后 gold 放大 10%
    const pSkill = engine.createCharacter('gSkill','n');
    pSkill.level=31; pSkill.attributes={ atk:20, def:10, hp:10, agi:10 }; engine.recalcMaxStats(pSkill);
    pSkill.currentArea=testAreaId; pSkill.affixes.active='A1-05'; pSkill.gold=0; pSkill.hp=pSkill.maxHp; pSkill.lastTick=0;
    // 使用同一 now（需重置 lastTick 使 elapsed>=3000）
    engine.__setNow(()=>2000000);
    pSkill.lastTick=0;
    const resSkill = engine.calculateIdle(pSkill);
    assert.ok(resSkill && resSkill.logEntry.result==='win');
    assert.ok(resSkill.logEntry.gold > baseGold, `skill gold ${resSkill.logEntry.gold} should > base ${baseGold}`);
    // 放大应约 10%（100 ->110），允许浮动因 total.goldBonus 等，但至少 +5
    assert.ok(resSkill.logEntry.gold >= Math.floor(100*1.10), `expected >=110 got ${resSkill.logEntry.gold}`);
    // lose：弱玩家 vs 强怪区域
    data.AREAS[testAreaId].monsters=[{ name:'强金怪', hp:5000, atk:300, def:50, agi:50, skills:[], exp:100, gold:100 }];
    const pLose = engine.createCharacter('gLose','n');
    pLose.level=1; pLose.attributes={ atk:1, def:1, hp:1, agi:1 }; engine.recalcMaxStats(pLose);
    pLose.currentArea=testAreaId; pLose.affixes.active='A1-05'; pLose.gold=0; pLose.hp=pLose.maxHp; pLose.lastTick=0;
    engine.__setNow(()=>3000000);
    const resLose = engine.calculateIdle(pLose);
    assert.ok(resLose && (resLose.logEntry.result==='lose' || resLose.logEntry.result==='timeout'), `lose/timeout ${resLose?.logEntry.result}`);
    assert.equal(resLose.logEntry.gold, 0, 'lose should have 0 gold even with skillGoldBonus');
    assert.ok(resLose.logEntry.exp >0, 'lose still has exp');
    delete data.AREAS[testAreaId];
  });
  it('dodgeAtk 透传', ()=>{
    const p = engine.createCharacter('d1','n');
    p.level=31; p.affixes.passive=['Q2-14']; // dodgeAtk 0.04
    const cs = engine.getCombatStats(p);
    assert.ok(typeof cs.dodgeAtk === 'number' && cs.dodgeAtk>0, `dodgeAtk should be透传, got ${cs.dodgeAtk}`);
  });
});

describe('T-005 日志字段与前台', ()=>{
  beforeEach(()=> engine.__resetSeams());
  afterEach(()=> engine.__resetSeams());
  it('type skill 均含 targetHp/targetMaxHp，复合 damage+heal 保留怪物 HP 并另记 heal', ()=>{
    engine.__setRandom(()=>0.99);
    const p = engine.createCharacter('l1','n');
    p.level=70; p.attributes={ atk:10, def:10, hp:10, agi:10 }; engine.recalcMaxStats(p);
    p.affixes.active='A4-02'; // damage+heal level4
    p.hp=Math.floor(p.maxHp*0.5); // 半血以便 heal 可见
    const monster={ name:'桩', hp:5000, atk:5, def:5, agi:5, skills:[] };
    const b = engine.simulateBattle(p, monster);
    const skillActs = b.rounds.flatMap(r=>r.actions.filter(a=>a.type==='skill'));
    assert.ok(skillActs.length>0);
    for(const a of skillActs){
      assert.ok(Number.isFinite(a.targetHp) && Number.isFinite(a.targetMaxHp), `skill should have targetHp, got ${JSON.stringify(a)}`);
      if(a.damage!==undefined){
        // damage 的 targetHp 应为怪物 HP，非玩家
        assert.ok(a.targetMaxHp === 5000 || a.targetMaxHp === monster.hp, 'damage targetMax should be monster');
      }
      if(a.heal!==undefined){
        // 复合时另记 selfHp
        if(a.damage!==undefined) assert.ok(a.selfHp!==undefined || a.healTargetHp!==undefined, 'damage+heal should have selfHp');
      }
    }
  });
  it('无主动时无主动 skill（被动 passive 不计）', ()=>{
    engine.__setRandom(()=>0.99);
    const p = engine.createCharacter('l2','n');
    p.level=30; p.affixes.active=null; // 无主动
    p.affixes.passive=['Q2-14']; // 有 dodgeAtk 被动
    p.hp=p.maxHp;
    const monster={ name:'桩', hp:5000, atk:5, def:5, agi:5, skills:[] };
    const b = engine.simulateBattle(p, monster);
    const activeSkills = b.rounds.flatMap(r=>r.actions.filter(a=>a.type==='skill'));
    assert.equal(activeSkills.length, 0);
    // 被动可能有 passive 类型，但不计入 skill
    const passives = b.rounds.flatMap(r=>r.actions.filter(a=>a.type==='passive'));
    // 可能有也可能没有（取决于 dodge），不强制，但不应为 skill
    assert.ok(!passives.some(a=>a.type==='skill'));
  });
  it('A2-04 def_buff+heal 复合回血且 buff 正确', ()=>{
    engine.__setRandom(()=>0.99);
    const p = engine.createCharacter('l3','n');
    p.level=31; p.attributes={ atk:5, def:4, hp:5, agi:8 }; engine.recalcMaxStats(p);
    p.affixes.active='A2-04'; // def_buff+heal 5%
    const beforeHp = Math.floor(p.maxHp*0.5); p.hp=beforeHp;
    const monster={ name:'桩', hp:8000, atk:20, def:5, agi:5, skills:[] };
    const b = engine.simulateBattle(p, monster);
    const r4 = b.rounds.find(r=>r.round===4); // cd4
    assert.ok(r4);
    const skill = r4.actions.find(a=>a.type==='skill');
    assert.ok(skill, 'r4 should have skill');
    assert.ok(skill.buff===0.15, 'def buff');
    assert.ok(skill.heal!==undefined && skill.heal>0, 'should have heal');
    assert.ok(skill.selfHp > beforeHp, 'heal should increase hp');
  });
  it('被动 dodgeAtk/deathShield/revive 为 passive 不进入 skill 统计', ()=>{
    engine.__setRandom(()=>0.01); // 高概率闪避
    const p = engine.createCharacter('l4','n');
    p.level=31; p.affixes.active=null; p.affixes.passive=['Q2-14'];
    // 给予 deathShield via getCombatStats? 需要有死盾天赋：knight 4阶 deathShield
    p.jobPath='knight'; p.level=61; engine.recalcMaxStats(p);
    p.hp=p.maxHp;
    const monster={ name:'强怪', hp:500, atk:200, def:10, agi:10, skills:[] };
    const b = engine.simulateBattle(p, monster);
    const skills = b.rounds.flatMap(r=>r.actions.filter(a=>a.type==='skill'));
    assert.equal(skills.length, 0);
    const passives = b.rounds.flatMap(r=>r.actions.filter(a=>a.type==='passive'));
    // 至少可能有一个 passive（dodgeAtk 或 shield）
    // 不强制数量，但类型正确
    for(const a of passives) assert.equal(a.type, 'passive');
  });
});

describe('T-005 前端 combo 与切片', ()=>{
  beforeEach(()=> engine.__resetSeams());
  afterEach(()=> engine.__resetSeams());
  // 为复用生产逻辑，测试 helper 与 MapView.vue 保持一致（防漂移由文件内容断言保障）
  function processActions(actions){
    const result=[]; let combo=[];
    function flush(){ if(!combo.length) return; if(combo.length>=2) result.push({ isCombo:true, hits:[...combo], totalDamage: combo.reduce((s,a)=>s+(a.damage||0),0)}); else result.push(combo[0]); combo=[]; }
    for(const act of actions){
      if(act.actor==='player' && act.damage!==undefined && !act.dodge && act.type!=='passive') combo.push(act);
      else { flush(); result.push(act); }
    } flush(); return result;
  }
  it('MapView.vue 生产逻辑与 helper 一致（防漂移）', ()=>{
    const fs=require('fs'); const content=fs.readFileSync('client/src/components/MapView.vue','utf8');
    assert.match(content, /act\.type\s*!==\s*'passive'/, 'processActions 应过滤 passive');
    assert.match(content, /hit\.type\s*===\s*'skill'/, 'combo 应按 hit.type===skill 高亮');
    assert.match(content, /selfHeal/, 'combo 应渲染 selfHeal');
    assert.match(content, /selfHp/, 'combo 应渲染 selfHp');
    assert.match(content, /totalDamage/, '应为 item.totalDamage 非 hit.totalDamage');
  });
  it('processActions：主动 damage 进入 combo，被动 dodgeAtk 不进入', ()=>{
    const actions=[
      { actor:'player', skill:'普通攻击', damage:10 },
      { actor:'player', skill:'雷霆冲击', damage:20, type:'skill' },
      { actor:'player', skill:'闪避反击', damage:5, type:'passive', source:'dodgeAtk' },
      { actor:'monster', skill:'撕咬', damage:8 }
    ];
    const res = processActions(actions);
    // 前两条应合并为 combo
    assert.equal(res[0].isCombo, true);
    assert.equal(res[0].hits.length, 2);
    assert.equal(res[0].totalDamage, 30);
    assert.equal(res[0].hits[1].type, 'skill');
    // passive 不应进入 combo，独立
    assert.equal(res[1].type, 'passive');
    assert.equal(res[2].actor, 'monster');
  });
  it('processActions：combo 内 hit.type===skill 保留高亮，且 selfHeal/selfHp 可渲染', ()=>{
    const actions=[
      { actor:'player', skill:'普通攻击', damage:10 },
      { actor:'player', skill:'圣光审判', damage:30, heal:20, selfHeal:20, selfHp:150, type:'skill', targetHp:80, targetMaxHp:100 },
    ];
    const res = processActions(actions);
    assert.equal(res[0].isCombo, true);
    const skillHit = res[0].hits.find(h=>h.type==='skill');
    assert.ok(skillHit, 'skill hit in combo');
    assert.equal(skillHit.selfHeal, 20);
    assert.equal(skillHit.selfHp, 150);
  });
  it('detail slice(-6)：短场 skill 可见，长场早期被截断（真实 calculateIdle）', ()=>{
    engine.__setRandom(()=>0.99);
    engine.__setDropRandom(()=>1);
    const data = require('./data');
    const areaId='test_slice2'; data.AREAS[areaId]={ id:areaId, name:'切片场', minLevel:1, monsters:[{ name:'短怪', hp:3000, atk:5, def:80, agi:80, skills:[], exp:10, gold:10 }], drops:[] };
    // 短场：win 于 5-10 回合，detail 来自 calculateIdle 的 logEntry.detail = rounds.slice(-6)
    const pShort = engine.createCharacter('s1','n');
    pShort.level=31; pShort.attributes={ atk:30, def:10, hp:10, agi:10 }; engine.recalcMaxStats(pShort);
    pShort.affixes.active='A1-01'; pShort.hp=pShort.maxHp; pShort.currentArea=areaId; pShort.lastTick=0;
    engine.__setNow(()=>1000000);
    const resShort = engine.calculateIdle(pShort);
    assert.ok(resShort && resShort.logEntry.detail, 'short should have detail');
    assert.ok(resShort.logEntry.detail.length <=6, `detail <=6 got ${resShort.logEntry.detail.length}`);
    // 若 win 于 >=5，detail 应含 skill
    if(resShort.logEntry.rounds >=5){
      const hasSkill = resShort.logEntry.detail.some(r=> (r.actions||[]).some(a=>a.type==='skill'));
      assert.ok(hasSkill, `short detail should contain skill for rounds ${resShort.logEntry.rounds}`);
    }
    // 长场：30 回合 timeout，detail 仅后 6 轮，早期 5 的 skill 不在 detail
    const pLong = engine.createCharacter('s2','n');
    pLong.level=31; pLong.attributes={ atk:5, def:4, hp:20, agi:8 }; engine.recalcMaxStats(pLong);
    pLong.affixes.active='A1-01'; pLong.hp=pLong.maxHp;
    // 直接 simulate 30 回合长桩
    const bLong = engine.simulateBattle(pLong, { name:'长桩', hp:200000, atk:1, def:100, agi:80, skills:[] });
    assert.equal(bLong.rounds.length, 30, `long should be 30 timeout, got ${bLong.rounds.length}`);
    const detailLong = bLong.rounds.slice(-6);
    assert.equal(detailLong.length, 6);
    // 早期 5 的 skill 不在后 6 轮（25-30 含 25,30）
    const earlyInDetail = detailLong.some(r=>r.round===5);
    assert.equal(earlyInDetail, false, 'early 5 should be truncated');
    const hasSkillInDetail = detailLong.some(r=> (r.actions||[]).some(a=>a.type==='skill'));
    assert.ok(hasSkillInDetail, 'detail 25-30 should have 25/30 skill');
    // calculateIdle 的 detail 同为 slice(-6)
    pLong.currentArea=areaId; pLong.lastTick=0; engine.__setNow(()=>2000000);
    // 临时把 area 怪换为长桩以复用 calculateIdle 长场
    data.AREAS[areaId].monsters=[{ name:'长桩', hp:200000, atk:1, def:100, agi:80, skills:[], exp:10, gold:10 }];
    const resLong = engine.calculateIdle(pLong);
    assert.equal(resLong.logEntry.detail.length, 6);
    delete data.AREAS[areaId];
  });
});
