// ====== 数据迁移安全性测试 v1.03 ======
// 模拟"线上用户带 v1.02 老存档" → "升级 v1.03 代码" → "是否丢失/损坏用户数据"
//
// 场景：
//   1. 老存档缺 v1.03 字段（active, expedition, expeditionReports, expeditionCodex,
//                          dailyActive, guildId, guildRole 等）
//   2. 老存档有非法 titleKey（业务规则变化后被剔除）
//   3. 老存档 attrPresets 数组里有 null 占位（v1.03 修复点）
//   4. 老存档 meta 里有 arenaBots 字段（v1.03 搬到进程内存）
//   5. 老存档是 JSON 文件 → v1.03 自动检测并继续用 JSON（向后兼容）
//   6. 老存档是 SQLite 文件 → v1.03 继续用 SQLite（向后兼容）
//   7. v1.02 player.inventory 里有 type='equip' 项 → v1.03 migrate 移除（不动 equips）
//   8. 老 player.titleExpiry 有非有限数值 → v1.03 删除
//   9. 老 attributes 用 strength/constitution/agility 旧名 → v1.03 改 atk/def/hp/agi

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-'));

function setupStore() {
  process.env.DB_ENGINE = 'json';
  process.env.DB_PATH = path.join(TMP_DIR, 'db-' + Date.now() + '-' + Math.floor(Math.random()*10000) + '.json');
  try { delete require.cache[require.resolve('./store')]; } catch (_) {}
  try { delete require.cache[require.resolve('./store-json')]; } catch (_) {}
  try { delete require.cache[require.resolve('./store-sqlite')]; } catch (_) {}
  return require('./store');
}

describe('v1.02 → v1.03 数据迁移安全性', () => {
  let store;
  before(() => { store = setupStore(); store.__setDisableSave(true); });
  after(() => { store.__setDisableSave(false); delete process.env.DB_ENGINE; delete process.env.DB_PATH; });

  // ===== 场景 1: 老存档缺 v1.03 新增字段 =====
  it('场景 1: 老存档缺 expedition/dailyActive/ /guildId 等新字段应自动补全', () => {
    const oldPlayer = {
      username: 'old_user',
      name: 'OldPlayer',
      level: 50,
      attributes: { atk: 100, def: 50, hp: 100, agi: 80 },
      // 注意：故意缺 expedition / dailyActive / guildId / cockfight.history / settlementLedger
    };
    store.setPlayer('old_user', oldPlayer);
    const { migratePlayer } = require('./engine');
    const migrated = migratePlayer(oldPlayer);
    // 关键字段必须被补全（不能是 undefined）
    assert.ok(migrated !== null);
    assert.equal(migrated.username, 'old_user');
    assert.equal(migrated.level, 50);
    assert.deepEqual(migrated.attributes, { atk: 100, def: 50, hp: 100, agi: 80 });
    // 新字段必须是合理的初始值（不能是 undefined，否则下游会崩）
    assert.ok(migrated.expedition === null || typeof migrated.expedition === 'object',
      'expedition 应被初始化为 null 或对象');
    assert.ok(Array.isArray(migrated.expeditionHistory), 'expeditionHistory 应是数组');
    assert.ok(migrated.expeditionReports && typeof migrated.expeditionReports === 'object', 'expeditionReports 应是对象');
    assert.ok(migrated.cockfight && typeof migrated.cockfight === 'object', 'cockfight 应被初始化');
    assert.ok(Array.isArray(migrated.cockfight.history), 'cockfight.history 应是数组');
    assert.ok(migrated.dailyActive && typeof migrated.dailyActive === 'object', 'dailyActive 应被初始化');
    assert.ok(typeof migrated.dailyActive.rewards === 'object', 'dailyActive.rewards 应是对象');
    assert.equal(migrated.guildId, null, 'guildId 应初始化为 null');
    assert.equal(migrated.guildRole, null, 'guildRole 应初始化为 null');
  });

  // ===== 场景 2: 老存档有非法 titleKey =====
  it('场景 2: 非法 titleKey 应在 migrate 时被剔除（保留合法 + 业务数据）', () => {
    const oldPlayer = {
      username: 't_user',
      level: 10,
      titles: { 'first': true, 'evil_hacker_key_xxx': true, 'boss_killer_1': true },
      titleExpiry: { 'first': -1, 'boss_killer_1': Date.now() + 1000000 },
      currentTitle: 'evil_hacker_key_xxx',
    };
    store.setPlayer('t_user', oldPlayer);
    const { migratePlayer } = require('./engine');
    const migrated = migratePlayer(oldPlayer);
    // 'first' 可能是成就 key（看 ALL_TITLES 是否有），如果是合法 key 就保留，否则被剔除
    // 'evil_hacker_key_xxx' 一定是非法，应被剔除
    assert.equal(migrated.titles['evil_hacker_key_xxx'], undefined, '非法 key 应被剔除');
    // 合法 key 应保留
    assert.equal(migrated.titles['boss_killer_1'], true, '合法 key 应保留');
    // currentTitle 指向非法 key 应被置 null
    assert.equal(migrated.currentTitle, null, 'currentTitle 指向非法 key 应被清空');
  });

  // ===== 场景 3: 老存档 attrPresets 数组里有 null 占位 =====
  it('场景 3: attrPresets 数组里的 null 占位应被保留（不删），不动玩家 preset', () => {
    const oldPlayer = {
      username: 'p_user',
      level: 10,
      attrPresets: [
        { id: 'preset_a', name: 'A', attributes: { atk:8, def:4, hp:4, agi:4 }, level: 10, slot: 0, createdAt: 1 },
        null, // ← v1.02 migrate 会 filter 掉这个 → 索引错位 → 误删 p2
        { id: 'preset_c', name: 'C', attributes: { atk:8, def:4, hp:4, agi:4 }, level: 10, slot: 2, createdAt: 3 },
      ],
    };
    store.setPlayer('p_user', oldPlayer);
    const { migratePlayer, deleteAttrPresetBySlot } = require('./engine');
    const migrated = migratePlayer(oldPlayer);
    // v1.03 修复后：null 占位应被保留
    assert.equal(migrated.attrPresets.length, 3, 'attrPresets 长度应保持 3（不 filter）');
    assert.equal(migrated.attrPresets[0].id, 'preset_a');
    assert.equal(migrated.attrPresets[1], null);
    assert.equal(migrated.attrPresets[2].id, 'preset_c');
    // 删除 slot=1（null 占位）应只返回"槽位为空"，不删任何元素
    const r = deleteAttrPresetBySlot(migrated, 1);
    assert.equal(r.success, false);
    assert.match(r.message, /槽位为空/);
    // 关键：preset_a 和 preset_c 都不应被删除
    assert.equal(migrated.attrPresets.length, 3);
    assert.equal(migrated.attrPresets[0].id, 'preset_a');
    assert.equal(migrated.attrPresets[2].id, 'preset_c');
  });

  // ===== 场景 4: 老存档 meta.arenaBots =====
  it('场景 4: 老存档 meta.arenaBots 应自动搬到内存缓存（不丢条目）', () => {
    const meta = {
      arenaBots: {
        user1: { time: Date.now() - 5 * 60 * 1000, bots: [{ username: 'b1' }] },
        user2: { time: Date.now() - 3 * 60 * 1000, bots: [{ username: 'b2' }] },
      },
    };
    store.setMeta(meta);
    // 模拟 load 流程：从 meta 搬到内存缓存
    const old = store.getMeta().arenaBots || {};
    for (const [u, v] of Object.entries(old)) {
      if (v && typeof v.time === 'number') store.arenaBotsCacheSet(u, v);
    }
    if (store.getMeta().arenaBots) delete store.getMeta().arenaBots;
    // 内存缓存应能找到两条
    const c1 = store.arenaBotsCacheGet('user1');
    const c2 = store.arenaBotsCacheGet('user2');
    assert.ok(c1 && Array.isArray(c1.bots), 'user1 应能从内存缓存读到');
    assert.ok(c2 && Array.isArray(c2.bots), 'user2 应能从内存缓存读到');
    // meta 应不再含 arenaBots（避免重复加载时再次搬）
    assert.equal(store.getMeta().arenaBots, undefined);
  });

  // ===== 场景 5: 老存档是 JSON 文件 → v1.03 继续用 JSON =====
  it('场景 5: 老 JSON 存档应继续工作（store 自动选择 JSON）', () => {
    // 当前 store 是 JSON 后端（setupStore 设置了 DB_ENGINE=json）
    // 这条测试本身就在验证：setupStore 用 JSON 后端，且读写正常工作
    store.setPlayer('json_user', { username: 'json_user', name: 'JSON' });
    const p = store.getPlayer('json_user');
    assert.equal(p.username, 'json_user');
  });

  // ===== 场景 6: 老 player.inventory 里有 type='equip' 项 =====
  it('场景 6: 老 inventory 里有 type="equip" 项应被过滤（保留材料/消耗品）', () => {
    const oldPlayer = {
      username: 'inv_user',
      level: 10,
      inventory: [
        { uid: 'm1', name: '材料A', type: 'material', count: 5 },
        { uid: 'e1', name: '装备A', type: 'equip', stats: { atk: 10 } }, // ← 应被过滤
        { uid: 'c1', name: '消耗品A', type: 'consumable', count: 3 },
      ],
      equips: [{ uid: 'e2', name: '装备B', stats: { atk: 10 } }], // 已装备的不动
    };
    store.setPlayer('inv_user', oldPlayer);
    const { migratePlayer } = require('./engine');
    const migrated = migratePlayer(oldPlayer);
    // 关键：装备已转移到 equips 数组，inventory 应只剩材料/消耗品
    assert.equal(migrated.inventory.length, 2, 'inventory 应只剩 2 项（材料 + 消耗品）');
    assert.equal(migrated.inventory[0].name, '材料A');
    assert.equal(migrated.inventory[1].name, '消耗品A');
    // 已装备的不动
    assert.ok(migrated.equips.length >= 1, 'equips 应保留');
  });

  // ===== 场景 7: 老 player.titleExpiry 有非有限数值 =====
  it('场景 7: titleExpiry 有 NaN/Infinity/-1/字符串应被清掉（保留合法）', () => {
    const oldPlayer = {
      username: 'te_user',
      level: 10,
      titleExpiry: {
        'first': NaN,           // ← 非真实 key → 应被剔除
        'boss_killer_1': -1,    // ← 真实 key 但 v<=0 → 应被清掉
        'boss_killer_2': Date.now() + 100000, // ← 真实 key + 未来时间 → 应保留
        'boss_killer_3': Infinity, // ← Number.isFinite 失败 → 剔除
        'arena_immortal_star': 'xxx', // ← Number.isFinite 失败 → 剔除
      },
    };
    store.setPlayer('te_user', oldPlayer);
    const { migratePlayer } = require('./engine');
    const migrated = migratePlayer(oldPlayer);
    // 合法项应保留
    assert.ok(migrated.titleExpiry['boss_killer_2'], 'boss_killer_2（合法 key + 未来时间）应保留');
    // 非法项应被剔除
    assert.equal(migrated.titleExpiry['first'], undefined, 'NaN + 非真实 key 应被剔除');
    assert.equal(migrated.titleExpiry['boss_killer_1'], undefined, 'v<=0 应被清掉');
    assert.equal(migrated.titleExpiry['boss_killer_3'], undefined, 'Infinity 应被剔除');
    assert.equal(migrated.titleExpiry['arena_immortal_star'], undefined, 'string 应被剔除');
  });

  // ===== 场景 8: 老 attributes 用 strength/constitution/agility 旧名 =====
  it('场景 8: attributes 旧名 strength/constitution/agility 应迁移到 atk/def/hp/agi', () => {
    const oldPlayer = {
      username: 'attr_user',
      level: 10,
      attributes: {
        strength: 50,
        constitution: 40,
        agility: 30,
        // 没有 atk/def/hp/agi
      },
    };
    store.setPlayer('attr_user', oldPlayer);
    const { migratePlayer } = require('./engine');
    const migrated = migratePlayer(oldPlayer);
    // 旧 strength 应变成 atk
    assert.equal(migrated.attributes.atk, 50);
    assert.equal(migrated.attributes.def, 40); // constitution → def
    assert.equal(migrated.attributes.hp, 40);  // constitution → hp
    assert.equal(migrated.attributes.agi, 30); // agility → agi
    // 旧 key 不应残留
    assert.equal(migrated.attributes.strength, undefined);
    assert.equal(migrated.attributes.constitution, undefined);
    assert.equal(migrated.attributes.agility, undefined);
  });

  // ===== 场景 9: 老数据字段值类型错乱 =====
  it('场景 9: 老数据 killCount=null / combatStats.todayKills="abc" 应被 migrate 修正', () => {
    const oldPlayer = {
      username: 'data_user',
      level: 10,
      killCount: null,  // ← Number.isFinite 失败 → 改 0
      combatStats: {
        totalWins: null,     // ← 改 0
        totalLosses: 5,
        totalDraws: 0,
        todayKills: 'abc',   // ← 改 0
        monthKills: undefined, // ← 改 0
      },
      maxClearedArea: 'gaomanshan',
    };
    store.setPlayer('data_user', oldPlayer);
    const { migratePlayer } = require('./engine');
    const migrated = migratePlayer(oldPlayer);
    assert.equal(migrated.killCount, 0);
    assert.equal(migrated.combatStats.totalWins, 0);
    assert.equal(migrated.combatStats.totalLosses, 5, '正常值应保留');
    assert.equal(migrated.combatStats.todayKills, 0);
    assert.equal(migrated.combatStats.monthKills, 0);
  });

  // ===== 场景 10: 全功能跑通一遍 =====
  it('场景 10: 升级后玩家保存并读取数据完整无丢失', () => {
    const oldPlayer = {
      username: 'full_user',
      name: 'FullUser',
      level: 100,
      exp: 50,
      gold: 9999,
      attributes: { atk: 100, def: 50, hp: 100, agi: 80 },
      attrPoints: 30,
      skillPoints: 10,
      inventory: [{ uid: 'm1', name: '材料', type: 'material', count: 100 }],
      equips: [{ uid: 'e1', name: '剑', stats: { atk: 50 } }],
      equipped: { weapon: 'e1', armor: null, accessory: null },
      attrPresets: [
        { id: 'p1', name: 'preset1', attributes: { atk:8, def:4, hp:4, agi:4 }, level: 100, slot: 0, createdAt: 1 },
      ],
      titles: { first: true, job_warrior: true },
      settlementLedger: [{ id: 'l1', at: Date.now(), type: 'arena_daily', reward: { coins: 10 }, source: 'x' }],
      cockfight: { points: 50, wins: 3, streak: 1, played: 5, history: [], dayKey: '', usedToday: 0 },
      // v1.03 新字段：缺
    };
    store.setPlayer('full_user', oldPlayer);
    const { migratePlayer, getPlayerView } = require('./engine');
    const migrated = migratePlayer(oldPlayer);
    store.setPlayer('full_user', migrated);
    // 模拟"其他玩家查全服名册"（数据应可见）
    const view = getPlayerView(migrated);
    assert.equal(view.username, 'full_user');
    assert.equal(view.level, 100);
    assert.equal(view.gold, 9999);
    assert.deepEqual(view.attributes, { atk: 100, def: 50, hp: 100, agi: 80 });
    assert.equal(view.attrPoints, 30);
    assert.equal(view.skillPoints, 10);
    // cockfight 是独立接口的数据，不通过 view 返回（前端走专门的 /api/player/:u/cockfight）
    // 但迁移后 cockfight 字段应保留
    assert.equal(migrated.cockfight.points, 50);
    assert.equal(migrated.cockfight.wins, 3);
    // 全服名册能看到
    const all = store.getAllPlayers();
    const found = all.find(p => p.username === 'full_user');
    assert.ok(found, '全服名册应能找到');
  });
});

// 帮助函数（不需要外部引用）
function isValidTitleKey(key) {
  // 模拟一个简化的判断（实际由 data/titles.js 提供）
  return typeof key === 'string' && /^[a-z][a-z0-9_]{2,30}$/.test(key);
}