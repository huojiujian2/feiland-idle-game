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
    // v1.03 修复 Bug：余数改为按权重循环分配，不再"全给 atk"
    //   30 / 当前 {3,1,2,1} / 预设 {8,4,4,4}
    //   阶段 A 补齐：k=max(3/8,1/4,2/4,1/4)=0.5，目标 {4,2,2,2}，缺口 {1,1,0,1}=3
    //   给 3 点补齐到 {4,2,2,2}，剩 27
    //   阶段 B 按 27 分配：m = {floor(27*0.4), floor(27*0.2)*3} = {10,5,5,5}
    //   rem=2 循环给 atk(权重 8)、def(权重 4 并列) → {11,6,5,5}
    //   总分配：{1+11, 1+6, 0+5, 1+5} = {12, 7, 5, 6}
    assert.deepEqual(a, { atk: 12, def: 7, hp: 5, agi: 6 });
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

  it('第二阶段：剩余按比例分配，余数循环分配给权重最大的几个维度', () => {
    // 当前 {4,2,2,2}，预设 {8,4,4,4}（40/20/20/20%）
    // 阶段 A 补齐：k=0.5，缺口全 0，无补齐动作
    // 阶段 B 按 28 分配：m = {floor(28*0.4), floor(28*0.2)*3} = {11,5,5,5}
    // v1.03 修复 Bug：余数 rem=2 改为循环分配给权重最大的前 2 个维度
    //   修复前：rem 全给 atk → {13,5,5,5}
    //   修复后：rem 循环给 atk(权重 8 第 1)、def(权重 4 并列第 2) → {12,6,5,5}
    //   这样 def/hp/agi 同权时不会"全被 atk 吞掉"，更公平
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
    // 修复后：余数按权重循环分配
    assert.deepEqual(r.allocated, { atk: 12, def: 6, hp: 5, agi: 5 });
    assert.equal(p.attributes.atk, 16);
    assert.equal(p.attributes.def, 8);
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
