// ====== 种族进化加成实装：翼人/天使的 spi→HP、cha→移速、天使 exp ======
// 规则（用户确认）：
//   1) 翼人 spi(10) → HP +100；天使 spi(30) → HP +200（种族加成 flat HP 进基础生命）
//   2) cha → 移速加成，每 2 点魅力 = 1% 移速（最终敏捷 ×(1 + cha×0.005)）
//        翼人 cha:10 → +5%；天使 cha:30 → +15%
//   3) 天使补上 exp: 0.20（描述里承诺的经验+20%，之前数据缺失从未生效）
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../engine');

describe('种族进化加成实装', () => {
  beforeEach(() => engine.__resetSeams());
  afterEach(() => engine.__resetSeams());

  function makePlayer(username, race) {
    const p = engine.createCharacter(username, username);
    p.race = race;
    p.level = 10;
    p.attributes = { atk: 10, def: 10, hp: 10, agi: 10 };
    p.equips = [];
    p.equipped = { weapon: null, armor: null, accessory: null };
    return p;
  }

  it('1) 翼人：种族加成包含 flat HP +100', () => {
    const p = makePlayer('rb1', '翼人');
    const raceBonus = engine.getRaceBonus(p);
    assert.equal(raceBonus.hp, 100, '翼人种族加成 hp = 100');
  });

  it('2) 翼人：最终生命包含 +100', () => {
    const p = makePlayer('rb2', '翼人');
    const t = engine.getTotalStats(p);
    // 基础生命 = 100 + 9×20 + 10×10 + con(5)×5 = 405；+100 种族 HP = 505
    assert.equal(t.hp, 505, '翼人 Lv.10 基础属性下总生命 505');
  });

  it('3) 翼人：移速 +5%（敏捷 ×1.05）', () => {
    const p = makePlayer('rb3', '翼人');
    const t = engine.getTotalStats(p);
    // 基础敏捷 = 10 + 9×2 + 10 + raceBonus.agi(10) = 48；×1.05 = 50.4 → 50
    assert.equal(t.agi, 50, '翼人敏捷 48 × 1.05 = 50');
  });

  it('4) 天使：种族加成包含 flat HP +200', () => {
    const p = makePlayer('rb4', '天使');
    const raceBonus = engine.getRaceBonus(p);
    assert.equal(raceBonus.hp, 200, '天使种族加成 hp = 200');
  });

  it('5) 天使：最终生命包含 +200', () => {
    const p = makePlayer('rb5', '天使');
    const t = engine.getTotalStats(p);
    // 基础生命 = 100 + 9×20 + 10×10 + con(20)×5 = 480；+200 种族 HP = 680
    assert.equal(t.hp, 680, '天使 Lv.10 基础属性下总生命 680');
  });

  it('6) 天使：移速 +15%（敏捷 ×1.15）', () => {
    const p = makePlayer('rb6', '天使');
    const t = engine.getTotalStats(p);
    // 基础敏捷 = 10 + 9×2 + 10 + raceBonus.agi(20) = 58；×1.15 = 66.7 → 66
    assert.equal(t.agi, 66, '天使敏捷 58 × 1.15 = 66');
  });

  it('7) 天使：种族加成包含 exp 0.20（经验+20% 数据补齐）', () => {
    const p = makePlayer('rb7', '天使');
    const raceBonus = engine.getRaceBonus(p);
    assert.equal(raceBonus.exp, 0.20, '天使 exp = 0.20');
  });

  it('8) 鹰人（初始种族）：无加成，hp/agi 不受影响', () => {
    const p = makePlayer('rb8', '鹰人');
    const t = engine.getTotalStats(p);
    // 基础生命 = 100 + 180 + 100 = 380；敏捷 = 10 + 18 + 10 = 38
    assert.equal(t.hp, 380);
    assert.equal(t.agi, 38);
  });
});
