// ====== T-011 背包排序持久化（v1.02 后续：sort 同步到后端 + 新装备自动入位） ======
// 目标：sortInventory 排序后排序要持久化，新装备 push 到背包时会"插入到正确位置"而不是末尾
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../engine');

describe('T-011 背包排序持久化', () => {
  beforeEach(() => engine.__resetSeams());
  afterEach(() => engine.__resetSeams());

  // 工具：造一个玩家 + 多件装备
  function makePlayer(username) {
    const p = engine.createCharacter(username, username);
    p.equips = [];
    p.equipped = { weapon: null, armor: null, accessory: null };
    return p;
  }
  function makeEquip(slot, quality, name, stats) {
    return {
      uid: 'eq_' + slot + '_' + name + '_' + Math.random().toString(36).slice(2, 6),
      templateId: name,
      name: name,
      slot, quality, reqLevel: 1,
      stats: stats || {},
      upgradeLevel: 0, enchants: [],
    };
  }

  it('1) sortInventory 按 slot(武器→护甲→饰品) + 类别内 maxStat 降序 排序', () => {
    const p = makePlayer('u1');
    // 故意打乱顺序：先放低属性武器，再放高属性护甲
    p.equips = [
      makeEquip('weapon', 'fine', '木矛', { atk: 5 }),
      makeEquip('armor', 'epic', '皮甲', { def: 200 }),
      makeEquip('accessory', 'legend', '龙之眼', { atk: 80 }),
      makeEquip('weapon', 'epic', '雷霆长枪', { atk: 40 }),
      makeEquip('armor', 'fine', '铁甲', { def: 15 }),
    ];

    const r = engine.sortInventory(p);
    assert.equal(r.success, true);

    // 期望顺序：weapon(雷霆 40, 木矛 5) → armor(皮甲 200, 铁甲 15) → accessory(龙之眼)
    assert.equal(p.equips[0].name, '雷霆长枪', '武器类：maxStat 高的在前');
    assert.equal(p.equips[1].name, '木矛');
    assert.equal(p.equips[2].name, '皮甲', '护甲类：maxStat 高的在前');
    assert.equal(p.equips[3].name, '铁甲');
    assert.equal(p.equips[4].name, '龙之眼', '饰品类');
  });

  it('2) 排序后再次排序结果应一致（幂等）', () => {
    const p = makePlayer('u2');
    p.equips = [
      makeEquip('weapon', 'epic', '雷霆长枪', { atk: 40 }),
      makeEquip('weapon', 'fine', '木矛', { atk: 5 }),
    ];
    engine.sortInventory(p);
    const first = p.equips.map(e => e.name);
    engine.sortInventory(p);
    const second = p.equips.map(e => e.name);
    assert.deepEqual(first, second, '两次排序结果应相同');
  });

  it('3) 新装备 push 后即使不调 sort，equipItem 自动插入到正确排序位置（v1.02 关键）', () => {
    const p = makePlayer('u3');
    // 初始已排好序
    p.equips = [
      makeEquip('weapon', 'epic', '雷霆长枪', { atk: 40 }),
      makeEquip('weapon', 'fine', '木矛', { atk: 5 }),
      makeEquip('armor', 'epic', '皮甲', { def: 200 }),
      makeEquip('armor', 'fine', '铁甲', { def: 15 }),
    ];
    engine.sortInventory(p);
    // 现在新拿到一件武器"屠龙者"(legend, atk=220) — 应该插到武器类最前面
    // 先把木矛穿戴到 equipped.weapon，雷电长枪被退回 equips
    const woodenSpear = p.equips.find(e => e.name === '木矛');
    engine.equipItem(p, woodenSpear.uid);
    // 现在新获得一件传说武器"屠龙者"（atk=220）应自动插到武器类最前
    const newSword = makeEquip('weapon', 'legend', '屠龙者', { atk: 220 });
    engine.addEquipToSortedPosition(p, newSword);
    // 期望：武器类排序后 屠龙者(220) > 雷霆长枪(40)（木矛当前在 equipped.weapon）
    const weapons = p.equips.filter(e => e.slot === 'weapon');
    assert.equal(weapons[0].name, '屠龙者', '屠龙者应排在武器类第一');
    assert.equal(weapons[1].name, '雷霆长枪');
  });

  it('4) 持久化：sort 后 store 保存再读回，顺序不变', () => {
    const p = makePlayer('u4');
    p.equips = [
      makeEquip('weapon', 'fine', '木矛', { atk: 5 }),
      makeEquip('weapon', 'epic', '雷霆长枪', { atk: 40 }),
      makeEquip('armor', 'epic', '皮甲', { def: 200 }),
    ];
    engine.sortInventory(p);
    // 模拟持久化：转 JSON 再 parse
    const json = JSON.stringify({ equips: p.equips });
    const restored = JSON.parse(json);
    assert.equal(restored.equips[0].name, '雷霆长枪');
    assert.equal(restored.equips[1].name, '木矛');
    assert.equal(restored.equips[2].name, '皮甲');
  });

  it('5) 空背包 / 无装备时 sort 不会崩', () => {
    const p = makePlayer('u5');
    p.equips = [];
    const r = engine.sortInventory(p);
    assert.equal(r.success, true);
    assert.equal(p.equips.length, 0);
  });

  it('6) 排序不影响 equipped（穿戴中的装备不参与排序）', () => {
    const p = makePlayer('u6');
    const w1 = makeEquip('weapon', 'fine', '木矛', { atk: 5 });
    const w2 = makeEquip('weapon', 'epic', '雷霆长枪', { atk: 40 });
    p.equips = [w1, w2];
    // 玩家穿戴 w1
    engine.equipItem(p, w1.uid);
    // 排序：equips 里的 w2 应该正确排序
    engine.sortInventory(p);
    // equips 应该只剩 w2（w1 在 equipped.weapon 里）
    assert.equal(p.equips.length, 1);
    assert.equal(p.equips[0].name, '雷霆长枪');
    // 排序不应该影响 equipped 里的内容
    assert.equal(p.equipped.weapon.name, '木矛');
  });
});
