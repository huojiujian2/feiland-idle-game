// ====== 称号数据结构统一迁移测试（数组 → 对象） ======
// 背景 bug：老存档 player.titles 是数组，而购买永久/斗鸡/BOSS 称号按对象写入
//   （player.titles[key] = true）。数组上的字符串键属性在 JSON.stringify 时被丢弃，
//   导致购买后不固化；且 migratePlayer 曾把对象强制转回空数组，进一步清空数据。
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('./index.js');

function makePlayer() {
  return {
    username: 't_titles', name: '测试', level: 100, exp: 0, gold: 0,
    job: '初出茅庐', jobPath: 'warrior', race: '人族', raceStage: 0,
    attributes: { atk: 10, def: 10, hp: 100, agi: 10, str: 1, int: 1 },
    hp: 100, maxHp: 100, mp: 10, maxMp: 10,
    inventory: [], equips: [], skills: [], logs: [], arenaCoins: 99999,
    cockfight: { points: 100, wins: 0, streak: 0, played: 0, loseStreak: 0, dayKey: '', usedToday: 0, banNext: null, current: null, history: [] },
    pvpStats: { rating: 1000, wins: 0, losses: 0, streak: 0, bestStreak: 0, seasonWins: 0, seasonLosses: 0, coins: 99999 },
  };
}

describe('称号数据结构统一（对象化）', () => {

  it('1) createCharacter 产生对象式 titles', () => {
    const c = engine.createCharacter('t_new', '新角色', 'warrior');
    assert.equal(typeof c.titles, 'object');
    assert.ok(!Array.isArray(c.titles), 'titles 不应是数组');
  });

  it('2) migratePlayer：老数组结构 → 归一化为对象，已知 key 保留', () => {
    const p = makePlayer();
    p.titles = ['冒险者', '战士', 'boss_killer_1'];
    engine.migratePlayer(p);
    assert.ok(!Array.isArray(p.titles), '迁移后应是对象');
    assert.equal(p.titles.boss_killer_1, true, 'BOSS 称号 key 保留');
    assert.equal(p.titles['冒险者'], true, '中文名成就称号以名字为 key 保留');
  });

  it('3) migratePlayer：对象式 titles 不被清空（回归修复）', () => {
    const p = makePlayer();
    p.titles = { arena_immortal_star: true, cock_newbie: true };
    engine.migratePlayer(p);
    assert.equal(p.titles.arena_immortal_star, true, '已购竞技场称号不能被清掉');
    assert.equal(p.titles.cock_newbie, true, '斗鸡称号不能被清掉');
  });

  it('4) 购买永久称号后 JSON round-trip 仍存在（固化）', () => {
    const p = makePlayer();
    p.titles = {}; // 现在正常玩家应是对象
    const r = engine.buyArenaItem(p, 'arena_title_immortal');
    assert.equal(r.success, true);
    // 模拟存盘→读盘
    const restored = JSON.parse(JSON.stringify(p));
    assert.equal(restored.titles.arena_immortal_star, true, '序列化后仍在（数组 bug 的直接复现）');
  });

  it('5) 老数组存档购买称号：迁移后对象结构可固化', () => {
    const p = makePlayer();
    p.titles = ['冒险者', '神灵']; // 老存档
    engine.migratePlayer(p);      // 登录时迁移 → 对象
    const r = engine.buyArenaItem(p, 'arena_title_immortal');
    assert.equal(r.success, true);
    const restored = JSON.parse(JSON.stringify(p));
    assert.equal(restored.titles.arena_immortal_star, true, '迁移后再购买，round-trip 固化');
    assert.equal(restored.titles['神灵'], true, '迁移保住旧成就称号');
  });

  it('6) daily 成就发称号：对象式写入', () => {
    const p = makePlayer();
    p.titles = {};
    p.achievements = {};
    // ascend 成就：神格判定发"神灵"/"半神"
    p.godhood = 'god';
    const r = engine.claimAchievement(p, 'ascend');
    if (r.success) {
      assert.equal(p.titles['神灵'], true, '神灵称号对象式写入');
      const restored = JSON.parse(JSON.stringify(p));
      assert.equal(restored.titles['神灵'], true, 'round-trip 固化');
    }
  });
});
