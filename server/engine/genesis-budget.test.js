// ====== 创世预算边界测试 · v1.03 · 2026-08-31 ======
// 修复 P0 1.4：百分比属性 vs 总预算口径一致性
//   核心防御点：forgeEquip 校验口径 = commitEquipToWorld 的 equipStatTotal
//   历史 bug：forgeEquip 用 sum(raw) 校验，但装备写世界时用 equipStatTotal (权重和)
//   当前数据层 EQUIP_STAT_KEYS 不含百分比属性，但 PERCENT_STAT_WEIGHTS 仍存在（处理旧数据/怪物 drops）
//   此测试集确保：
//     1) equipStatTotal 函数本身的正确性（基础 + 权重）
//     2) forgeEquip 校验口径 = equipStatTotal（即使将来扩白名单也安全）
//     3) 边界值（=budget/-1/+1）

const test = require('node:test');
const assert = require('node:assert');
const engine = require('./index');
const genesis = require('./genesis');
const { getEquipBudget } = require('../data/genesis');

function makeReincarnatedPlayer(username) {
  const p = engine.createCharacter(username, 'Tester');
  p.reincarnation = 2;
  p.gold = 999999;
  return p;
}

// ===== 1. equipStatTotal 函数正确性（核心约束） =====

test('equipStatTotal: 普通属性按原值计入', () => {
  // atk/def/hp/mp/str/spi/agi/con 不在 PERCENT_STAT_WEIGHTS → w=undefined → 加 v 原值
  const cases = [
    { stats: { atk: 100 }, expected: 100 },
    { stats: { def: 50 }, expected: 50 },
    { stats: { hp: 200 }, expected: 200 },
    { stats: { atk: 100, def: 50, hp: 200 }, expected: 350 },
    { stats: { atk: 0 }, expected: 0 },
    { stats: {}, expected: 0 },
  ];
  for (const tc of cases) {
    assert.strictEqual(genesis.equipStatTotal(tc.stats), tc.expected,
      `普通属性 ${JSON.stringify(tc.stats)} 应等于 ${tc.expected}`);
  }
});

test('equipStatTotal: 百分比属性按权重 ×100 计入', () => {
  // PERCENT_STAT_WEIGHTS: exp:2, gold:1.5, crit:40, critDmg:12, allAttr:70,
  //                     ignoreDef:18, lifesteal:25, dodge:25, dmgTaken:80
  // 公式: sum += w ? Math.abs(v) * 100 * w : v
  const cases = [
    { stats: { exp: 1 }, expected: 200 },      // 1*100*2
    { stats: { gold: 1 }, expected: 150 },     // 1*100*1.5
    { stats: { crit: 1 }, expected: 4000 },     // 1*100*40
    { stats: { critDmg: 1 }, expected: 1200 },  // 1*100*12
    { stats: { allAttr: 1 }, expected: 7000 },  // 1*100*70
    { stats: { ignoreDef: 1 }, expected: 1800 }, // 1*100*18
    { stats: { lifesteal: 1 }, expected: 2500 },// 1*100*25
    { stats: { dodge: 1 }, expected: 2500 },    // 1*100*25
    { stats: { dmgTaken: 1 }, expected: 8000 }, // 1*100*80
  ];
  for (const tc of cases) {
    assert.strictEqual(genesis.equipStatTotal(tc.stats), tc.expected,
      `百分比属性 ${JSON.stringify(tc.stats)} 应等于 ${tc.expected}`);
  }
});

test('equipStatTotal: 混合属性正确求和', () => {
  // atk:100 + crit:1 → 100 + 4000 = 4100
  const stats = { atk: 100, crit: 1 };
  assert.strictEqual(genesis.equipStatTotal(stats), 4100);
});

test('equipStatTotal: 负数用 abs（防御类百分比可能为负）', () => {
  // dmgTaken 通常为负数（受到的伤害减少），用 Math.abs
  // 例如 dmgTaken: -5 → 5*100*80 = 40000
  const stats = { dmgTaken: -5 };
  assert.strictEqual(genesis.equipStatTotal(stats), 40000);
});

// ===== 2. forgeEquip 校验口径必须 = equipStatTotal =====

test('forgeEquip 校验口径: 普通属性 atk=300 应等于 budget.totalBudget 时通过', () => {
  const meta = {};
  meta.genesis = { monsters: [], equips: [], equipsMax: {} };
  const player = makeReincarnatedPlayer('budgetOK');
  const budget = getEquipBudget('gaomanshan', 'weapon', 'epic', {});
  // 用 atk = budget.totalBudget → equipStatTotal = budget.totalBudget → 通过
  const result = genesis.forgeEquip(player, {
    name: 'OKAtk',
    desc: '',
    slot: 'weapon',
    areaId: 'gaomanshan',
    quality: 'epic',
    stats: { atk: budget.totalBudget },
  }, meta);
  assert.strictEqual(result.success, true, `边界值 atk=budget 应通过，实际: ${JSON.stringify(result)}`);
});

test('forgeEquip 校验口径: atk=budget+1 应被拒', () => {
  const meta = {};
  meta.genesis = { monsters: [], equips: [], equipsMax: {} };
  const player = makeReincarnatedPlayer('budgetOver');
  const budget = getEquipBudget('gaomanshan', 'weapon', 'epic', {});
  const result = genesis.forgeEquip(player, {
    name: 'OverBy1',
    desc: '',
    slot: 'weapon',
    areaId: 'gaomanshan',
    quality: 'epic',
    stats: { atk: budget.totalBudget + 1 },
  }, meta);
  assert.strictEqual(result.success, false);
  assert.match(result.message || '', /超出预算/);
});

test('forgeEquip 校验口径: 大数值 atk=99999 应被拒', () => {
  const meta = {};
  meta.genesis = { monsters: [], equips: [], equipsMax: {} };
  const player = makeReincarnatedPlayer('budgetHuge');
  const result = genesis.forgeEquip(player, {
    name: 'Huge',
    desc: '',
    slot: 'weapon',
    areaId: 'gaomanshan',
    quality: 'epic',
    stats: { atk: 99999 },
  }, meta);
  assert.strictEqual(result.success, false);
});

// ===== 3. 防御未来扩展：百分比属性接口预留 + 暴露 equipStatTotal 复用 =====

test('forgeEquip 当前白名单不含百分比属性（防 P0 1.4 漏洞）', () => {
  // 当前 EQUIP_STAT_KEYS 不包含 exp/gold/crit/...等百分比属性
  // 此测试确保：未来扩白名单时，必须先扩 forgeEquip 校验口径
  const meta = {};
  meta.genesis = { monsters: [], equips: [], equipsMax: {} };
  const player = makeReincarnatedPlayer('budgetPct');
  const percentKeys = ['exp', 'gold', 'crit', 'critDmg', 'allAttr', 'ignoreDef', 'lifesteal', 'dodge', 'dmgTaken'];
  for (const k of percentKeys) {
    const r = genesis.forgeEquip(player, {
      name: 'p' + k.slice(0, 3), // 短名字（≤12 字限制）
      desc: '',
      slot: 'weapon',
      areaId: 'gaomanshan',
      quality: 'epic',
      stats: { [k]: 1 },
    }, meta);
    assert.strictEqual(r.success, false, `百分比属性 ${k} 不应被 forgeEquip 接受（白名单限制）`);
    // 若将来扩白名单，必须改成 equipStatTotal 校验口径
    assert.match(r.message || '', /不可锻造|超出预算/);
  }
});

// ===== 4. 装备 attributes 类型校验 =====

test('forgeEquip: 非数字 stats[k] 应被 coerce 到 0 / NaN 安全', () => {
  // v1.03 P0 1.4 修复：Number('abc')=NaN 必须被显式拒绝
  //   修复前：NaN → Math.floor(NaN)=NaN → 进 cleanStats → 绕过预算校验
  //   修复后：第一个 NaN 出现时立即返回 400 + '属性 xxx 必须是有限数字'
  const meta = {};
  meta.genesis = { monsters: [], equips: [], equipsMax: {} };
  const player = makeReincarnatedPlayer('budgetNaN');
  const result = genesis.forgeEquip(player, {
    name: 'NaNTest',
    desc: '',
    slot: 'weapon',
    areaId: 'gaomanshan',
    quality: 'epic',
    stats: { atk: 'abc', def: null, hp: undefined, agi: '' }, // 全部非法
  }, meta);
  // 应被拒（"属性 atk 必须是有限数字"）
  assert.strictEqual(result.success, false);
  assert.match(result.message || '', /有限数字/);
});

test('forgeEquip: 负数 atk 应被钳为 0', () => {
  const meta = {};
  meta.genesis = { monsters: [], equips: [], equipsMax: {} };
  const player = makeReincarnatedPlayer('budgetNeg');
  const result = genesis.forgeEquip(player, {
    name: 'NegAtk',
    desc: '',
    slot: 'weapon',
    areaId: 'gaomanshan',
    quality: 'epic',
    stats: { atk: -100 },
  }, meta);
  // atk=-100 → Math.max(0, floor(-100)) = 0 → "至少赋予一种非零属性"
  assert.strictEqual(result.success, false);
  assert.match(result.message || '', /至少赋予一种非零属性/);
});

test('forgeEquip: 属性种类数 > MAX_EQUIP_STATS 应被拒', () => {
  const meta = {};
  meta.genesis = { monsters: [], equips: [], equipsMax: {} };
  const player = makeReincarnatedPlayer('budgetTooMany');
  const stats = { atk: 10, def: 10, hp: 10, agi: 10, str: 10 }; // 5 种，MAX_EQUIP_STATS=4
  const result = genesis.forgeEquip(player, {
    name: 'TooMany',
    desc: '',
    slot: 'weapon',
    areaId: 'gaomanshan',
    quality: 'epic',
    stats,
  }, meta);
  assert.strictEqual(result.success, false);
  assert.match(result.message || '', /最多/);
});

// ===== 5. 品质 × slot × area 预算梯度 =====

test('budget 梯度: epic < legend < mythic（高品更高）', () => {
  const meta = {};
  meta.genesis = { monsters: [], equips: [], equipsMax: {} };
  const bE = getEquipBudget('gaomanshan', 'weapon', 'epic', {});
  const bL = getEquipBudget('gaomanshan', 'weapon', 'legend', {});
  const bM = getEquipBudget('gaomanshan', 'weapon', 'mythic', {});
  // 通常：epic < legend < mythic（具体高值由 data 决定，但量级应有别）
  assert.ok(bE.totalBudget > 0 && bL.totalBudget >= bE.totalBudget,
    `epic=${bE.totalBudget} legend=${bL.totalBudget}`);
  assert.ok(bM.totalBudget >= bL.totalBudget,
    `legend=${bL.totalBudget} mythic=${bM.totalBudget}`);
});

test('budget 受 worldEquipsMax 影响（自创装备推高后基准应上升）', () => {
  // 自创装备入世界后，equipsMax 应被推高（Forge 提交）
  const b1 = getEquipBudget('gaomanshan', 'weapon', 'epic', {});
  const b2 = getEquipBudget('gaomanshan', 'weapon', 'epic', {
    gaomanshan: { weapon: 1000 }, // 已有世界最强 1000 点
  });
  assert.ok(b2.totalBudget >= b1.totalBudget,
    `有装备时预算应不小于空预算: b1=${b1.totalBudget} b2=${b2.totalBudget}`);
});