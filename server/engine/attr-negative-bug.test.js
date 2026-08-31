// ====== 属性预设 负数/NaN/超大数 攻击面防御测试 ======
// 攻击场景：API 注入 attributes={atk:-999, ...} 写入预设 → 应用时把 player.attributes 拉成负数 / NaN
// v1.03 修复：saveAttrPreset 入口 sanitize + delta 拒绝负数 + allocateAttributes 钳单维度
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../engine');
const { createCharacter, saveAttrPreset, applyAttrPreset, applyAttrPresetByRatio,
  allocateAttributes, recalcMaxStats, __resetSeams } = engine;

describe('属性预设负数/NaN/超大数 攻击面', () => {
  beforeEach(() => __resetSeams());
  afterEach(() => __resetSeams());

  // ===== 修复点 #1：saveAttrPreset slot 路径 attributes 入口 sanitize =====
  it('saveAttrPreset slot 路径: 负数 attributes 应被 sanitize 为 0', () => {
    const p = createCharacter('u', 'n');
    const r = saveAttrPreset(p, 'evil', 0, { atk: -999, def: 100, hp: 100, agi: 100 });
    assert.equal(r.success, true);
    // 写入的 atk 应该是 0（被 sanitize），不是 -999
    assert.equal(p.attrPresets[0].attributes.atk, 0);
    assert.equal(p.attrPresets[0].attributes.def, 100);
  });

  it('saveAttrPreset slot 路径: NaN/Infinity attributes 应被 sanitize 为 0', () => {
    const p = createCharacter('u', 'n');
    saveAttrPreset(p, 'nan', 0, { atk: NaN, def: 1, hp: 1, agi: 1 });
    saveAttrPreset(p, 'inf', 1, { atk: Infinity, def: 1, hp: 1, agi: 1 });
    saveAttrPreset(p, 'str', 2, { atk: 'evil_string', def: 1, hp: 1, agi: 1 });
    assert.equal(p.attrPresets[0].attributes.atk, 0);
    assert.equal(p.attrPresets[1].attributes.atk, 0);
    assert.equal(p.attrPresets[2].attributes.atk, 0);
  });

  it('saveAttrPreset slot 路径: 超大数 attributes 应被 clamp 到 MAX_ATTR_VALUE', () => {
    const p = createCharacter('u', 'n');
    saveAttrPreset(p, 'huge', 0, { atk: Number.MAX_SAFE_INTEGER, def: 1, hp: 1, agi: 1 });
    assert.equal(p.attrPresets[0].attributes.atk, 100000);
  });

  // ===== 修复点 #2：applyAttrPreset 已经正确防御（保留旧测试） =====
  it('applyAttrPreset: 预设 atk 负数时，player.attributes 不变负（防御有效）', () => {
    const p = createCharacter('u', 'n');
    // 现在 saveAttrPreset 已经 sanitize，负数 → 0
    saveAttrPreset(p, 'evil', 0, { atk: -999, def: 4, hp: 4, agi: 4 });
    p.attrPoints = 30;
    p.attributes = { atk: 10, def: 2, hp: 2, agi: 2 };
    recalcMaxStats(p);
    const r = applyAttrPreset(p, p.attrPresets[0].id);
    assert.equal(r.success, true);
    // 预设 atk=0 → atk 维度"消失"，分配全给 def/hp/agi
    assert.ok(p.attributes.atk >= 0, 'player.attributes.atk 不应变负');
  });

  it('applyAttrPreset: 预设 4 维都为负时返回错误（不应允许全负预设）', () => {
    const p = createCharacter('u', 'n');
    // 现在全负 → 全 0 → rsum=0 → 错误
    saveAttrPreset(p, 'all_negative', 0, { atk: -1, def: -1, hp: -1, agi: -1 });
    p.attrPoints = 30;
    const r = applyAttrPreset(p, p.attrPresets[0].id);
    assert.equal(r.success, false);
    assert.match(r.message, /预设数据无效/);
  });

  // ===== 修复点 #3：saveAttrPreset delta 拒绝负数 =====
  it('saveAttrPreset delta: 负 delta 应被 sanitize，不增加 attrPoints', () => {
    // 关键防御：50 个 attrPoints 不应被恶意加成 1000+
    const p = createCharacter('u', 'n');
    p.attributes = { atk: 100, def: 50, hp: 50, agi: 50 };
    p.attrPoints = 50;
    const r = saveAttrPreset(p, 'evil_delta', 0, { atk: 1, def: 1, hp: 1, agi: 1 }, { atk: -999, def: 0, hp: 0, agi: 0 });
    assert.equal(r.success, true);
    // 关键：attrPoints 应保持不变（不能从负 used 反向加满）
    assert.ok(p.attrPoints <= 50, `attrPoints(${p.attrPoints}) 应 <= 50`);
    // atk 也不应变化（delta 负数被 sanitize 为 0）
    assert.equal(p.attributes.atk, 100);
  });

  it('saveAttrPreset delta: 正 delta 仍正常工作', () => {
    const p = createCharacter('u', 'n');
    p.attrPoints = 100;
    const r = saveAttrPreset(p, 'normal_delta', 0, { atk: 1, def: 1, hp: 1, agi: 1 }, { atk: 30, def: 20, hp: 20, agi: 20 });
    assert.equal(r.success, true);
    // used=90 → attrPoints=10
    assert.equal(p.attrPoints, 10);
    // atk += 30
    assert.equal(p.attributes.atk, 35); // 5 + 30
  });

  it('saveAttrPreset delta: delta > attrPoints 应被拒（防透支）', () => {
    const p = createCharacter('u', 'n');
    p.attrPoints = 10;
    const r = saveAttrPreset(p, 'overdraw', 0, { atk: 1, def: 1, hp: 1, agi: 1 }, { atk: 50, def: 0, hp: 0, agi: 0 });
    // 修复后：used > attrPoints → 返回错误，且不改 attributes
    assert.equal(r.success, false);
    assert.match(r.message, /属性点不足/);
    assert.equal(p.attributes.atk, 5);
    assert.equal(p.attrPoints, 10);
  });

  // ===== 修复点 #4：applyAttrPresetByRatio 已正确防御 =====
  it('applyAttrPresetByRatio: 比例全负数应返回错误', () => {
    const p = createCharacter('u', 'n');
    p.attrPoints = 30;
    const r = applyAttrPresetByRatio(p, { atk: -1, def: -1, hp: -1, agi: -1 });
    assert.equal(r.success, false);
    assert.match(r.message, /比例数值无效/);
  });

  it('applyAttrPresetByRatio: 部分负数（atk 负其它正）应被钳到 0', () => {
    const p = createCharacter('u', 'n');
    p.attrPoints = 30;
    p.attributes = { atk: 50, def: 10, hp: 10, agi: 10 };
    recalcMaxStats(p);
    const r = applyAttrPresetByRatio(p, { atk: -999, def: 4, hp: 4, agi: 4 });
    assert.equal(r.success, true);
    assert.ok(p.attributes.atk >= 0, `atk(${p.attributes.atk}) 应 >= 0`);
  });

  // ===== 修复点 #5：allocateAttributes 钳单维度 =====
  it('allocateAttributes: 纯负数 total<1 应被拒（已防御）', () => {
    const p = createCharacter('u', 'n');
    p.attrPoints = 100;
    const r = allocateAttributes(p, { atk: -999, def: 0, hp: 0, agi: 0 });
    assert.equal(r.success, false);
    assert.match(r.message, /至少分配1点/);
  });

  it('allocateAttributes: 负+正混合 total>0 但 atk 负，atk 应被钳到 0（防御有效）', () => {
    // 攻击剧本：atk:-100 + def:200 + hp:100 + agi:100 = total=300>0
    //   修复后：aAtk = max(0, -100) = 0，total = 400（0+200+100+100），照样通过校验
    //   player.attributes.atk += 0（不变）
    const p = createCharacter('u', 'n');
    p.attrPoints = 400; // 多给点以匹配 sanitize 后 total
    const r = allocateAttributes(p, { atk: -100, def: 200, hp: 100, agi: 100 });
    assert.equal(r.success, true);
    assert.ok(p.attributes.atk >= 0, `player.attributes.atk(${p.attributes.atk}) 应 >= 0`);
    // 玩家被恶意"送"的负分配 = 0，但其他维度能正常分配
    assert.equal(p.attributes.def, 4 + 200);
  });

  // ===== 边界场景 =====
  it('saveAttrPreset 老路径（无 slot）attributes 走 player 当前快照，防御有效', () => {
    const p = createCharacter('u', 'n');
    p.attributes = { atk: 10, def: 5, hp: 5, agi: 8 };
    const r = saveAttrPreset(p, 'normal');
    assert.equal(r.success, true);
    assert.deepEqual(p.attrPresets[0].attributes, { atk: 10, def: 5, hp: 5, agi: 8 });
  });

  it('saveAttrPreset: 浮点数 attributes 应被 floor', () => {
    const p = createCharacter('u', 'n');
    saveAttrPreset(p, 'float', 0, { atk: 10.7, def: 20.3, hp: 30.9, agi: 40.1 });
    assert.equal(p.attrPresets[0].attributes.atk, 10);
    assert.equal(p.attrPresets[0].attributes.def, 20);
    assert.equal(p.attrPresets[0].attributes.hp, 30);
    assert.equal(p.attrPresets[0].attributes.agi, 40);
  });

  it('综合攻击剧本：极端负数 + 超大数 + NaN 三连', () => {
    const p = createCharacter('u', 'n');
    p.attributes = { atk: 100, def: 50, hp: 50, agi: 50 };
    p.attrPoints = 50;
    // 一次性注入 attributes={atk:-1e6, def:NaN, hp:Infinity, agi:Number.MAX_SAFE_INTEGER}
    const r = saveAttrPreset(p, 'nuclear', 0,
      { atk: -1e6, def: NaN, hp: Infinity, agi: Number.MAX_SAFE_INTEGER },
      { atk: -99999, def: -88888, hp: -77777, agi: -66666 });
    assert.equal(r.success, true);
    // 写入预设：全 sanitize
    assert.equal(p.attrPresets[0].attributes.atk, 0);     // 负→0
    assert.equal(p.attrPresets[0].attributes.def, 0);     // NaN→0
    assert.equal(p.attrPresets[0].attributes.hp, 0);      // Infinity→0
    assert.equal(p.attrPresets[0].attributes.agi, 100000); // 超大→clamp
    // delta 全负：used=0 → attributes 不变 + attrPoints 不变
    assert.equal(p.attributes.atk, 100);
    assert.equal(p.attrPoints, 50);
  });
});