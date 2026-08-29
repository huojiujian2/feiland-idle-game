// ====== 混沌图鉴：创世抹除归档（全服共享） ======
// 规则：
//   1) deleteGenesis 抹除自创怪物/装备时，深拷贝快照归档到 meta.genesis.chaos（全服共享）
//   2) 快照含 erasedAt（时间戳）/ erasedBy（造物主账号）/ erasedReason（'creator_delete'）
//   3) 被抹除对象不再出现在 meta.genesis 对应数组，也不再注册于 EQUIP_TEMPLATES
//   4) 已有边界行为不回归：绑定装备的怪物删除→装备回 pending；被绑定的装备不可删
//   5) buildCodexData 在 chaos 下返回混沌历史，且混沌对象不回流普通图鉴
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../engine');
const { AREAS } = require('../data');
const { EQUIP_TEMPLATES } = require('../data/equipment');
const { buildCodexData } = require('../routes/codex');

describe('混沌图鉴：创世抹除归档', () => {
  beforeEach(() => engine.__resetSeams());
  afterEach(() => engine.__resetSeams());

  const AREA_ID = Object.keys(AREAS)[0];

  function makePlayer() {
    return engine.createCharacter('t_chaos', '混沌测试员');
  }

  // 直接手工构造全服创世 meta（绕过金币/预算流程，聚焦删除归档行为）
  function makeMeta() {
    return {
      genesis: {
        monsters: [{
          id: 'm_chaos_1', name: '湮灭之影', desc: '混沌测试怪',
          creator: 't_chaos', creatorUsername: 't_chaos', creatorName: '混沌测试员',
          areaId: AREA_ID, race: 'shadow', raceName: '暗影',
          skills: [], hp: 10, atk: 10, def: 10, agi: 10,
          exp: 10, gold: 10, drops: [], createdAt: 1000,
        }],
        equips: [{
          id: 'eq_chaos_1', name: '湮灭之刃', desc: '混沌测试装备',
          creator: 't_chaos', creatorUsername: 't_chaos',
          areaId: AREA_ID, slot: 'weapon', quality: 'epic', reqLevel: 1,
          stats: { atk: 10 }, worldState: 'pending', createdAt: 1000,
        }],
        equipsMax: {},
      },
    };
  }

  it('1) 抹除自创怪物 → 快照归档到 meta.genesis.chaos.monsters', () => {
    const p = makePlayer();
    const meta = makeMeta();
    const r = engine.deleteGenesis(p, 'monsters', 'm_chaos_1', meta);

    assert.equal(r.success, true, '删除成功');
    assert.equal(meta.genesis.monsters.length, 0, '原数组已移除');

    const chaos = meta.genesis.chaos;
    assert.ok(chaos, 'meta.genesis.chaos 已初始化');
    assert.ok(Array.isArray(chaos.monsters), 'chaos.monsters 是数组');
    assert.equal(chaos.monsters.length, 1, '归档 1 条混沌怪物');
    const snap = chaos.monsters[0];
    assert.equal(snap.id, 'm_chaos_1');
    assert.equal(snap.name, '湮灭之影');
    assert.equal(snap.creatorUsername, 't_chaos');
    assert.equal(typeof snap.erasedAt, 'number', '含抹除时间戳');
    assert.equal(snap.erasedBy, 't_chaos', '含抹除者账号');
    assert.equal(snap.erasedReason, 'creator_delete', '含抹除原因');
  });

  it('2) 抹除自创装备 → 快照归档到 meta.genesis.chaos.equips，并注销模板', () => {
    const p = makePlayer();
    const meta = makeMeta();
    const r = engine.deleteGenesis(p, 'equips', 'eq_chaos_1', meta);

    assert.equal(r.success, true, '删除成功');
    assert.equal(meta.genesis.equips.length, 0, '原数组已移除');
    assert.ok(!EQUIP_TEMPLATES['eq_chaos_1'], '动态模板已注销');

    const chaos = meta.genesis.chaos;
    assert.ok(chaos, 'meta.genesis.chaos 已初始化');
    assert.ok(Array.isArray(chaos.equips), 'chaos.equips 是数组');
    assert.equal(chaos.equips.length, 1, '归档 1 条混沌装备');
    const snap = chaos.equips[0];
    assert.equal(snap.id, 'eq_chaos_1');
    assert.equal(snap.name, '湮灭之刃');
    assert.equal(snap.slot, 'weapon');
    assert.equal(snap.stats.atk, 10, '原始属性保留');
    assert.equal(snap.erasedReason, 'creator_delete');
  });

  it('3) 非造物主不可抹除（回归）', () => {
    const other = engine.createCharacter('t_other', '路人');
    const meta = makeMeta();
    const r = engine.deleteGenesis(other, 'monsters', 'm_chaos_1', meta);
    assert.equal(r.success, false);
    assert.equal(meta.genesis.monsters.length, 1, '原数组未动');
  });

  it('4) 被怪物绑定的装备不可抹除（回归）', () => {
    const p = makePlayer();
    const meta = makeMeta();
    meta.genesis.monsters[0].drops = [{ kind: 'equip', name: 'eq_chaos_1', rate: 0.03 }];
    meta.genesis.equips[0].worldState = 'committed';

    const r = engine.deleteGenesis(p, 'equips', 'eq_chaos_1', meta);
    assert.equal(r.success, false);
    assert.equal(meta.genesis.equips.length, 1, '装备未被删除');
    const chaos = meta.genesis.chaos;
    assert.ok(!chaos || !chaos.equips || chaos.equips.length === 0, '失败删除不归档');
  });

  it('5) 删除挂载装备的怪物 → 装备恢复 pending（回归）', () => {
    const p = makePlayer();
    const meta = makeMeta();
    meta.genesis.monsters[0].drops = [{ kind: 'equip', name: 'eq_chaos_1', rate: 0.03 }];
    meta.genesis.equips[0].worldState = 'committed';

    const r = engine.deleteGenesis(p, 'monsters', 'm_chaos_1', meta);
    assert.equal(r.success, true);
    assert.equal(meta.genesis.equips[0].worldState, 'pending', '装备回 pending');
  });

  it('6) buildCodexData 返回混沌历史，且混沌对象不回流普通图鉴', () => {
    const p = makePlayer();
    const meta = makeMeta();
    engine.deleteGenesis(p, 'monsters', 'm_chaos_1', meta);
    engine.deleteGenesis(p, 'equips', 'eq_chaos_1', meta);

    const store = { getMeta: () => meta };
    const data = buildCodexData(store);

    assert.ok(data.chaos, 'codex 返回 chaos 分组');
    assert.ok(Array.isArray(data.chaos.monsters));
    assert.ok(Array.isArray(data.chaos.equips));
    assert.ok(data.chaos.monsters.some(m => m.id === 'm_chaos_1'), '混沌怪物可见');
    assert.ok(data.chaos.equips.some(e => e.id === 'eq_chaos_1'), '混沌装备可见');
    assert.equal(data.chaos.equips.find(e => e.id === 'eq_chaos_1').erasedReason, 'creator_delete');

    assert.ok(!data.monsters.some(m => m.creator === 't_chaos'), '普通怪物图鉴不含混沌对象');
    assert.ok(!data.equips.some(e => e.templateId === 'eq_chaos_1'), '普通装备图鉴不含混沌对象');
  });

  it('7) 空 meta 时 buildCodexData 返回空混沌分组（全服图鉴始终安全）', () => {
    const store = { getMeta: () => ({}) };
    const data = buildCodexData(store);
    assert.ok(data.chaos, 'chaos 分组始终存在');
    assert.deepEqual(data.chaos.monsters, []);
    assert.deepEqual(data.chaos.equips, []);
  });
});
