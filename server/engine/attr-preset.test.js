// ====== T-008 属性预设应用测试（"先补齐再分配"两阶段算法） ======
// 验证 applyAttrPreset 走两阶段：先按比例补齐到对齐值，剩余按比例分配。
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../engine');
const { createCharacter, saveAttrPreset, applyAttrPreset, recalcMaxStats, __resetSeams } = engine;

describe('T-008 applyAttrPreset 两阶段补齐+分配', () => {
  beforeEach(() => __resetSeams());
  afterEach(() => __resetSeams());

  it('用户示例：30 点 / 当前 {3,1,2,1} / 预设 {8,4,4,4} → 先补齐再按比例', () => {
    const p = createCharacter('u1', 'n1');
    p.attributes = { atk: 3, def: 1, hp: 2, agi: 1 };
    p.attrPoints = 30;
    recalcMaxStats(p);
    p.attrPresets = [{
      id: 'preset_test_1', name: 'p1',
      attributes: { atk: 8, def: 4, hp: 4, agi: 4 },
      level: 1, slot: 0, createdAt: Date.now(),
    }];

    const r = applyAttrPreset(p, 'preset_test_1');
    assert.equal(r.success, true, r.message);
    // 总分配 = 30，attrPoints 全部用完
    const a = r.allocated;
    assert.equal(a.atk + a.def + a.hp + a.agi, 30);
    // 余数全给权重最大的 atk：atk 一定比其它非 0 项多
    assert.ok(a.atk > a.def, `atk(${a.atk}) 应该 > def(${a.def})`);
    assert.equal(p.attrPoints, 0);
  });

  it('第一阶段：低比例维度优先被补齐，缺口由所有维度分摊到对齐值', () => {
    // 当前 {10, 1, 1, 1}，预设比例 {8,4,4,4}（40/20/20/20%）
    // k = max(10/8, 1/4, 1/4, 1/4) = 1.25
    // 目标 {10, 5, 5, 5} → 缺口 {0, 4, 4, 4} = 12
    // 给 12 点正好补完，剩 0
    const p = createCharacter('u2', 'n2');
    p.attributes = { atk: 10, def: 1, hp: 1, agi: 1 };
    p.attrPoints = 12;
    recalcMaxStats(p);
    p.attrPresets = [{
      id: 'preset_test_2', name: 'p2',
      attributes: { atk: 8, def: 4, hp: 4, agi: 4 },
      level: 1, slot: 0, createdAt: Date.now(),
    }];

    const r = applyAttrPreset(p, 'preset_test_2');
    assert.equal(r.success, true);
    assert.equal(r.allocated.atk, 0);
    assert.equal(r.allocated.def, 4);
    assert.equal(r.allocated.hp,  4);
    assert.equal(r.allocated.agi, 4);
    assert.equal(p.attributes.atk, 10);
    assert.equal(p.attributes.def, 5);
    assert.equal(p.attributes.hp,  5);
    assert.equal(p.attributes.agi, 5);
    assert.equal(p.attrPoints, 0);
  });

  it('第二阶段：剩余按比例分配，余数全给预设权重最大的维度', () => {
    // 当前 {4,2,2,2}，预设 {8,4,4,4}（40/20/20/20%）
    // 阶段 A 补齐：k=0.5，缺口全 0，无补齐动作
    // 阶段 B 按 28 分配：m = {floor(28*0.4), floor(28*0.2)*3} = {11,5,5,5}
    // rem=2 全给 atk → {13,5,5,5}
    const p = createCharacter('u3', 'n3');
    p.attributes = { atk: 4, def: 2, hp: 2, agi: 2 };
    p.attrPoints = 28;
    recalcMaxStats(p);
    p.attrPresets = [{
      id: 'preset_test_3', name: 'p3',
      attributes: { atk: 8, def: 4, hp: 4, agi: 4 },
      level: 1, slot: 0, createdAt: Date.now(),
    }];

    const r = applyAttrPreset(p, 'preset_test_3');
    assert.equal(r.success, true);
    assert.deepEqual(r.allocated, { atk: 13, def: 5, hp: 5, agi: 5 });
    assert.equal(p.attributes.atk, 17);
    assert.equal(p.attributes.def, 7);
    assert.equal(p.attributes.hp, 7);
    assert.equal(p.attributes.agi, 7);
    assert.equal(p.attrPoints, 0);
  });

  it('边界：attrPoints=0 时报错', () => {
    const p = createCharacter('u4', 'n4');
    p.attrPresets = [{
      id: 'preset_test_4', name: 'p4',
      attributes: { atk: 8, def: 4, hp: 4, agi: 4 },
      level: 1, slot: 0, createdAt: Date.now(),
    }];
    const r = applyAttrPreset(p, 'preset_test_4');
    assert.equal(r.success, false);
    assert.match(r.message, /没有可分配/);
  });

  it('边界：presetId 不存在时返回失败', () => {
    const p = createCharacter('u5', 'n5');
    p.attrPresets = [];
    p.attrPoints = 10;
    const r = applyAttrPreset(p, 'nonexistent');
    assert.equal(r.success, false);
    assert.match(r.message, /预设不存在/);
  });
});
