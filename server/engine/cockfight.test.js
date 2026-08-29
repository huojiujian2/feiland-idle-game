// ====== 灵鸡斗场：完全独立的押注玩法 ======
// 规则要点：
//   1) 不消耗主游戏任何资源，唯一产出斗鸡积分（仅换外观称号）
//   2) 每日 20 次参赛，北京时间 0:00（服务器本地日界，与日常任务一致）重置
//   3) 每局从 8 只固定灵鸡中随机出 6 只，玩家押 1~6 号
//   4) 下注后可选 1 项干预：投喂仙豆 / 撒铁蒺藜 / 激将法（或跳过）
//   5) 模拟擂台赛（1v1 逐场 5 回合），押中冠军 +1 分，连胜第 3/6/9…局额外 +1
//   6) 连错 5 局弹安慰文案并清零；累计 250 局自动获得"斗鸡狂魔"
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../engine');
const { CHICKENS, COCKFIGHT_TITLES } = require('../data/cockfight');

const LUCK_MSG = '今天手气不好，要不去挂会儿机？';

describe('灵鸡斗场', () => {
  beforeEach(() => { engine.__resetSeams(); engine.__setRandom(() => 0.5); });
  afterEach(() => engine.__resetSeams());

  function makePlayer() {
    return engine.createCharacter('t_cock', '斗鸡测试员');
  }

  // 进入斗场 → 押冠军（用与生产一致的确定性模拟预判冠军）
  function playChampion(p, intervention) {
    engine.enterCockArena(p);
    const lineup = p.cockfight.current.lineup;
    const sim = engine.__simulateLineup(lineup, {});
    const betNo = lineup.indexOf(sim.championId) + 1;
    return engine.resolveCockRound(p, betNo, intervention);
  }

  // 进入斗场 → 押错的编号
  function playLoser(p, intervention) {
    engine.enterCockArena(p);
    const lineup = p.cockfight.current.lineup;
    const sim = engine.__simulateLineup(lineup, {});
    const champIdx = lineup.indexOf(sim.championId);
    const betNo = champIdx === 0 ? 2 : 1;
    return engine.resolveCockRound(p, betNo, intervention);
  }

  it('1) enterCockArena 生成 6 只灵鸡：编号+名称+3 条线索，不泄露隐藏数值', () => {
    const p = makePlayer();
    const r = engine.enterCockArena(p);
    assert.equal(r.success, true);
    assert.equal(r.chickens.length, 6, '6 只灵鸡');
    for (const c of r.chickens) {
      assert.ok(c.no >= 1 && c.no <= 6, '编号 1~6');
      assert.equal(c.clues.length, 3, '3 条线索');
      for (const k of ['atk', 'def', 'spd', 'hp', 'crit']) {
        assert.equal(c[k], undefined, `不泄露隐藏数值 ${k}`);
      }
    }
    const lineup = p.cockfight.current.lineup;
    assert.equal(lineup.length, 6);
    assert.equal(new Set(lineup).size, 6, '6 只不重复');
    assert.ok(lineup.every(id => CHICKENS.some(c => c.id === id)), '都是合法灵鸡');
    assert.equal(p.cockfight.usedToday, 0, '进入斗场不消耗次数');
  });

  it('2) 每日 20 次限制：用完后无法进入', () => {
    const p = makePlayer();
    p.cockfight.usedToday = 20;
    p.cockfight.dayKey = engine.getTodayKey();
    const r = engine.enterCockArena(p);
    assert.equal(r.success, false);
    assert.ok(r.message.includes('次数'), '提示次数用完');
  });

  it('3) 押中冠军：+1 积分 / 胜场+1 / 连胜+1 / 参与+1 / 次数-1', () => {
    const p = makePlayer();
    const r = playChampion(p);
    assert.equal(r.win, true);
    assert.equal(r.pointsDelta, 1);
    assert.equal(p.cockfight.points, 1);
    assert.equal(p.cockfight.wins, 1);
    assert.equal(p.cockfight.streak, 1);
    assert.equal(p.cockfight.played, 1);
    assert.equal(p.cockfight.usedToday, 1, '结算时消耗次数');
  });

  it('4) 连胜奖励：第 3 局额外 +1（本局共 2 分）', () => {
    const p = makePlayer();
    p.cockfight.streak = 2;
    const r = playChampion(p);
    assert.equal(r.win, true);
    assert.equal(r.pointsDelta, 2, '连胜第 3 局额外 +1');
    assert.equal(p.cockfight.points, 2);
    assert.equal(p.cockfight.streak, 3);
  });

  it('5) 押错：积分不变 / 连胜归零 / 连败+1', () => {
    const p = makePlayer();
    p.cockfight.streak = 3;
    const r = playLoser(p);
    assert.equal(r.win, false);
    assert.equal(r.pointsDelta, 0);
    assert.equal(p.cockfight.points, 0);
    assert.equal(p.cockfight.streak, 0);
    assert.equal(p.cockfight.loseStreak, 1);
    assert.equal(p.cockfight.played, 1, '押错也算参与');
  });

  it('6) 连续猜错 5 局 → 安慰文案，计数归零', () => {
    const p = makePlayer();
    p.cockfight.loseStreak = 4;
    const r = playLoser(p);
    assert.equal(r.luckMessage, LUCK_MSG);
    assert.equal(p.cockfight.loseStreak, 0, '弹出后计数归零');
  });

  it('7) 累计参与 250 局 → 自动获得 斗鸡狂魔（不消耗积分）', () => {
    const p = makePlayer();
    p.cockfight.played = 249;
    const r = playChampion(p);
    assert.equal(r.newTitle, '斗鸡狂魔');
    assert.equal(p.titles.cock_maniac, true, '写入 titles');
    assert.ok(p.cockfight.points >= 1, '不扣积分');
  });

  it('8) 激将法 + 押错 → 下一局强制换掉这只鸡', () => {
    const p = makePlayer();
    engine.enterCockArena(p);
    const lineup = p.cockfight.current.lineup;
    const sim = engine.__simulateLineup(lineup, {});
    const champIdx = lineup.indexOf(sim.championId);
    const betNo = champIdx === 0 ? 2 : 1;
    const bannedId = lineup[betNo - 1];
    const bannedName = CHICKENS.find(c => c.id === bannedId).name;

    const r = engine.resolveCockRound(p, betNo, 'provoke');
    assert.equal(r.win, false);
    assert.equal(p.cockfight.banNext, bannedId, '标记下局替换');

    const r2 = engine.enterCockArena(p);
    assert.equal(r2.success, true);
    assert.ok(!r2.chickens.some(c => c.name === bannedName), '下局不再出现该鸡');
    assert.equal(p.cockfight.banNext, null, '替换标记一次性');
  });

  it('9) 投喂仙豆：自己押的鸡攻击 ×1.3，无风险', () => {
    const p = makePlayer();
    engine.enterCockArena(p);
    const first = p.cockfight.current.lineup[0];
    const base = CHICKENS.find(c => c.id === first).atk;
    const r = engine.resolveCockRound(p, 1, 'feed');
    assert.equal(r.success, true);
    const entry = r.interventionApplied.find(x => x.chicken === first);
    assert.ok(entry, '记录干预结果');
    assert.equal(entry.stat, '攻击');
    assert.equal(entry.from, base);
    assert.ok(Math.abs(entry.to - base * 1.3) < 1e-9, '攻击 ×1.3');
    assert.equal(r.interventionDiscovered, false, '投喂无风险');
  });

  it('10) 撒铁蒺藜：随机对手减速；被发现时自己也减速', () => {
    const p = makePlayer();
    engine.enterCockArena(p);
    const first = p.cockfight.current.lineup[0];
    const r = engine.resolveCockRound(p, 1, 'caltrops');
    assert.equal(r.interventionDiscovered, false, '0.5 不触发 30% 发现');
    const slowed = r.interventionApplied.filter(x => x.stat === '速度');
    assert.equal(slowed.length, 1, '随机一只对手减速');
    assert.notEqual(slowed[0].chicken, first, '不是自己的鸡');

    // 30% 被发现分支
    engine.__setRandom(() => 0.1);
    const p2 = makePlayer();
    engine.enterCockArena(p2);
    const mine = p2.cockfight.current.lineup[0];
    const baseSpd = CHICKENS.find(c => c.id === mine).spd;
    const r2 = engine.resolveCockRound(p2, 1, 'caltrops');
    assert.equal(r2.interventionDiscovered, true, '被发现');
    const own = r2.interventionApplied.find(x => x.chicken === mine && x.stat === '速度');
    assert.ok(own, '自己的鸡也被减速');
    assert.ok(Math.abs(own.to - baseSpd * 0.6) < 1e-9, '速度 ×0.6');
  });

  it('11) 称号兑换：成功扣分 / 积分不足 / 重复兑换拦截', () => {
    const p = makePlayer();
    p.cockfight.points = 5;
    const r = engine.exchangeCockfightTitle(p, 'cock_newbie');
    assert.equal(r.success, true);
    assert.equal(p.cockfight.points, 0);
    assert.equal(p.titles.cock_newbie, true);

    const r2 = engine.exchangeCockfightTitle(p, 'cock_newbie');
    assert.equal(r2.success, false, '重复兑换拦截');

    p.cockfight.points = 14;
    const r3 = engine.exchangeCockfightTitle(p, 'cock_knight');
    assert.equal(r3.success, false, '积分不足');

    const r4 = engine.exchangeCockfightTitle(p, 'cock_maniac');
    assert.equal(r4.success, false, '成就称号不可兑换');

    // 称号已注册进全局称号库（可佩戴）
    const { isValidTitleKey } = require('../data');
    assert.ok(isValidTitleKey('cock_king'), '斗鸡称号是合法 key');
    assert.equal(COCKFIGHT_TITLES.cock_king.cost, 80);
  });

  it('12) 战斗规则：伤害公式 / KO 淘汰 / 5 回合后体力高者胜', () => {
    // KO：atk 5 → 伤害 100（0.5 无波动），def 10 → 实伤 10 ≥ hp 1
    const a = { id: 'a', name: '甲', atk: 5, def: 1, spd: 1, hp: 100, crit: 0 };
    const b = { id: 'b', name: '乙', atk: 0.1, def: 10, spd: 0.5, hp: 1, crit: 0 };
    const r = engine.__battleOnce(a, b);
    assert.equal(r.winner.id, 'a');
    assert.ok(r.lines.some(l => l.includes('体力归零')), 'KO 淘汰战报');

    // 5 回合打不死：每回合双方各造成 0.2，体力高者胜
    const c = { id: 'c', name: '丙', atk: 0.05, def: 5, spd: 1, hp: 200, crit: 0 };
    const d = { id: 'd', name: '丁', atk: 0.05, def: 5, spd: 0.9, hp: 100, crit: 0 };
    const r2 = engine.__battleOnce(c, d);
    assert.equal(r2.winner.id, 'c', '体力高者获胜');
    assert.equal(r2.rounds, 5);
  });

  it('13) 跨天重置参赛次数', () => {
    const p = makePlayer();
    p.cockfight.usedToday = 20;
    p.cockfight.dayKey = '1999-01-01';
    const s = engine.getCockfightStatus(p);
    assert.equal(s.todayLeft, 20, '跨天后次数重置');
  });

  it('14) 与主游戏完全独立：金币/经验/等级/竞技币/转生点不变', () => {
    const p = makePlayer();
    const before = { gold: p.gold, exp: p.exp, level: p.level, arenaCoins: p.arenaCoins || 0, reincPoints: p.reincPoints || 0 };
    playChampion(p);
    playLoser(p);
    assert.equal(p.gold, before.gold);
    assert.equal(p.exp, before.exp);
    assert.equal(p.level, before.level);
    assert.equal(p.arenaCoins || 0, before.arenaCoins);
    assert.equal(p.reincPoints || 0, before.reincPoints);
  });

  it('15) 无进行中对局时结算失败', () => {
    const p = makePlayer();
    const r = engine.resolveCockRound(p, 1, null);
    assert.equal(r.success, false);
  });

  it('16) 状态视图包含积分/胜场/连胜/参与进度与商店', () => {
    const p = makePlayer();
    playChampion(p);
    const s = engine.getCockfightStatus(p);
    assert.equal(s.points, 1);
    assert.equal(s.wins, 1);
    assert.equal(s.streak, 1);
    assert.equal(s.played, 1);
    assert.equal(s.target, 250);
    assert.equal(s.todayLeft, 19);
    assert.ok(s.shop.some(t => t.key === 'cock_newbie' && t.cost === 5 && !t.owned));
    assert.ok(s.shop.some(t => t.key === 'cock_king' && t.hidden), '万鸡之王为隐藏称号');
    assert.ok(Array.isArray(s.history) && s.history.length === 1, '对局记录');
  });
});
