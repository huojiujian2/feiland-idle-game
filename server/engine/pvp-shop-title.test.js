// ====== 竞技场商店：永久称号（不朽星灵 / 轮回之主） ======
// 规则：
//   1) 商店新增 2 个称号商品：arena_title_immortal（不朽星灵）、arena_title_samsara（轮回之主）
//   2) 价格均为 10000 竞技币
//   3) 购买后写入 player.titles[key] = true（无 titleExpiry → 永久）
//   4) 已拥有后不能重复购买
//   5) 称号 key 合法（ALL_TITLES 包含），佩戴校验走 getOwnedPermanentTitles
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../engine');
const { ARENA_TITLES, ARENA_EQUIPMENT } = require('../data');
const { ALL_TITLES, isValidTitleKey, getOwnedPermanentTitles } = require('../data');

describe('竞技场商店永久称号', () => {
  beforeEach(() => engine.__resetSeams());
  afterEach(() => engine.__resetSeeds ? engine.__resetSeeds() : null);

  function makePlayer(username, coins = 10000) {
    const p = engine.createCharacter(username, username);
    p.arenaCoins = coins;
    p.titles = {};
    return p;
  }

  describe('商品数据', () => {
    it('1) ARENA_TITLES 有 2 个称号商品，价格均为 10000', () => {
      assert.equal(ARENA_TITLES.length, 2, '正好 2 个称号商品');
      for (const t of ARENA_TITLES) {
        assert.equal(t.type, 'title');
        assert.equal(t.price, 10000);
      }
      const names = ARENA_TITLES.map(t => t.name);
      assert.ok(names.includes('不朽星灵'), '包含 不朽星灵');
      assert.ok(names.includes('轮回之主'), '包含 轮回之主');
    });

    it('2) 称号商品不污染装备列表（ARENA_EQUIPMENT 仍是 15 件装备）', () => {
      assert.equal(ARENA_EQUIPMENT.length, 15);
      assert.ok(ARENA_EQUIPMENT.every(e => e.slot), '装备都有 slot 字段');
    });

    it('3) 称号 key 合法（在 ALL_TITLES 里）', () => {
      for (const t of ARENA_TITLES) {
        assert.ok(isValidTitleKey(t.titleKey), `${t.titleKey} 应是合法称号 key`);
        assert.equal(ALL_TITLES[t.titleKey].name, t.name);
      }
    });
  });

  describe('购买流程 buyArenaItem', () => {
    it('4) 购买 不朽星灵：扣 10000 币，titles 写入，无过期时间（永久）', () => {
      const p = makePlayer('t_shop_1');
      const item = ARENA_TITLES.find(t => t.name === '不朽星灵');
      const r = engine.buyArenaItem(p, item.id);
      assert.equal(r.success, true, '购买成功');
      assert.equal(p.arenaCoins, 0, '扣除 10000 竞技币');
      assert.equal(p.titles[item.titleKey], true, 'titles 写入');
      assert.equal((p.titleExpiry || {})[item.titleKey], undefined, '无过期时间 = 永久');
    });

    it('5) 竞技币不足 → 失败', () => {
      const p = makePlayer('t_shop_2', 9999);
      const item = ARENA_TITLES.find(t => t.name === '轮回之主');
      const r = engine.buyArenaItem(p, item.id);
      assert.equal(r.success, false);
      assert.equal(p.arenaCoins, 9999, '不扣币');
      assert.equal(p.titles[item.titleKey], undefined, '不发称号');
    });

    it('6) 重复购买 → 失败（已拥有）', () => {
      const p = makePlayer('t_shop_3', 20000);
      const item = ARENA_TITLES[0];
      const r1 = engine.buyArenaItem(p, item.id);
      assert.equal(r1.success, true);
      const r2 = engine.buyArenaItem(p, item.id);
      assert.equal(r2.success, false, '已拥有不能再买');
      assert.equal(p.arenaCoins, 10000, '只扣一次');
    });
  });

  describe('永久称号归属', () => {
    it('7) getOwnedPermanentTitles 返回已购称号', () => {
      const p = makePlayer('t_shop_4', 10000);
      const item = ARENA_TITLES[0];
      engine.buyArenaItem(p, item.id);
      const owned = getOwnedPermanentTitles(p);
      assert.ok(owned.some(t => t.key === item.titleKey), '已购称号出现在永久列表');
    });

    it('8) 未购买 → 永久列表为空', () => {
      const p = makePlayer('t_shop_5');
      assert.equal(getOwnedPermanentTitles(p).length, 0);
    });
  });
});
