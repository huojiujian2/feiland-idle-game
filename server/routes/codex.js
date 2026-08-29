// ====== 图鉴 + 区域路由 ======
const { getPlayerView } = require('../engine');
const { AREAS, EQUIP_TEMPLATES, JOB_TREE, MONSTER_SKILLS, ENCHANT_RECIPES, MATERIAL_PRICES, SHOP_ITEMS } = require('../data');
const { ok, fail } = require('./_helpers');

function buildCodexData(store) {
  const materials = [];
  const equipMap = new Map();
  const consumables = SHOP_ITEMS.filter(s => s.type === 'consumable').map(s => ({
    id: s.id, name: s.name, desc: s.desc, price: s.price
  }));

  for (const areaId in AREAS) {
    const area = AREAS[areaId];
    for (const drop of area.drops || []) {
      if (drop.type === 'material') {
        const existing = materials.find(m => m.name === drop.name);
        const src = { area: area.id, areaName: area.name, rate: drop.rate };
        if (existing) existing.sources.push(src);
        else materials.push({
          name: drop.name,
          price: MATERIAL_PRICES[drop.name] || 5,
          sources: [src],
          uses: [],
        });
      } else if (drop.type === 'equip') {
        const tpl = EQUIP_TEMPLATES[drop.template];
        if (tpl && !equipMap.has(drop.template)) {
          equipMap.set(drop.template, {
            templateId: drop.template,
            ...tpl,
            sources: [{ area: area.id, areaName: area.name, rate: drop.rate }],
            shopPrice: null,
          });
        }
      }
    }
  }
  // 商店装备
  for (const s of SHOP_ITEMS.filter(s => s.type === 'equip')) {
    const tpl = EQUIP_TEMPLATES[s.id];
    if (tpl) {
      const ex = equipMap.get(s.id);
      if (ex) ex.shopPrice = s.price;
    }
  }
  // 材料用途（附魔/法则/进化）
  for (const r of ENCHANT_RECIPES) {
    for (const m of r.materials || []) {
      const mat = materials.find(x => x.name === m.name);
      if (mat && !mat.uses.includes(r.name)) mat.uses.push(r.name);
    }
  }
  const monsters = [];
  for (const areaId in AREAS) {
    const area = AREAS[areaId];
    for (const m of area.monsters || []) {
      monsters.push({
        name: m.name,
        area: area.id, areaName: area.name, areaLevel: area.minLevel,
        hp: m.hp, atk: m.atk, def: m.def, agi: m.agi,
        exp: m.exp, gold: m.gold,
        skills: m.skills || [],
        skillDetails: (m.skills || []).map(sid => {
          const sk = MONSTER_SKILLS[sid];
          return sk ? { id: sid, name: sk.name, desc: sk.desc, mult: sk.mult } : null;
        }).filter(Boolean),
        isBoss: !!m.isBoss,
      });
    }
  }

  // 注入自创内容（创世系统：meta.genesis）
  const meta = store && store.getMeta && store.getMeta();
  const genesis = meta && meta.genesis;
  if (genesis) {
    // 自创装备（id 在 EQUIP_TEMPLATES 里一定有；这里只覆盖 sources 为该自创者投放的地图）
    //   v2.6：rate 不再硬编码 0 —— 从 monsters 列表里反查"绑定了这件装备的自创怪"的真实掉率
    //   同一件装备可能被多个怪物绑定，sources 列出来源怪物 + 各自掉率
    for (const e of (genesis.equips || [])) {
      const tpl = EQUIP_TEMPLATES[e.id];
      if (tpl) {
        const sources = [];
        // 找到所有"装备 id === e.id"的自创怪（按 kind='equip' 匹配）
        for (const m of (genesis.monsters || [])) {
          for (const drop of (m.drops || [])) {
            if (drop.kind === 'equip' && drop.name === e.id) {
              sources.push({
                area: m.areaId,
                areaName: AREAS[m.areaId]?.name || m.areaId,
                rate: drop.rate,
                monster: m.name,         // v2.6：告诉玩家来自哪只怪
                monsterCreator: m.creator,
              });
            }
          }
        }
        // 兜底：装备投放了但还没怪物绑定（worldState='pending' 阶段）
        if (sources.length === 0) {
          sources.push({
            area: e.areaId,
            areaName: AREAS[e.areaId]?.name || e.areaId,
            rate: 0,
            monster: null,              // 还没怪物绑定
            monsterCreator: null,
          });
        }
        equipMap.set(e.id, {
          templateId: e.id,
          ...tpl,
          sources,
          shopPrice: null,
          creator: e.creator,
          creatorUsername: e.creatorUsername,   // v2.2：方便前端解析真名
          customDesc: e.desc,
        });
      }
    }
    // 自创怪物
    for (const m of (genesis.monsters || [])) {
      monsters.push({
        name: m.name,
        area: m.areaId,
        areaName: AREAS[m.areaId]?.name || m.areaId,
        areaLevel: AREAS[m.areaId]?.minLevel || 0,
        hp: m.hp, atk: m.atk, def: m.def, agi: m.agi,
        exp: m.exp, gold: m.gold,
        skills: m.skills || [],
        skillDetails: (m.skills || []).map(sid => {
          const sk = MONSTER_SKILLS[sid];
          return sk ? { id: sid, name: sk.name, desc: sk.desc, mult: sk.mult } : null;
        }).filter(Boolean),
        isBoss: false,
        creator: m.creator,
        creatorUsername: m.creatorUsername,    // v2.2：方便前端解析真名
        customDesc: m.desc,
      });
    }
  }

  // v2.8：混沌图鉴（全服共享）——被抹除的创世生物/装备历史
  const chaos = { monsters: [], equips: [] };
  if (genesis && genesis.chaos) {
    for (const m of (genesis.chaos.monsters || [])) {
      chaos.monsters.push({
        id: m.id,
        name: m.name,
        area: m.areaId,
        areaName: AREAS[m.areaId]?.name || m.areaId,
        areaLevel: AREAS[m.areaId]?.minLevel || 0,
        hp: m.hp, atk: m.atk, def: m.def, agi: m.agi,
        exp: m.exp, gold: m.gold,
        skills: m.skills || [],
        skillDetails: (m.skills || []).map(sid => {
          const sk = MONSTER_SKILLS[sid];
          return sk ? { id: sid, name: sk.name, desc: sk.desc, mult: sk.mult } : null;
        }).filter(Boolean),
        creator: m.creator,
        creatorUsername: m.creatorUsername,
        customDesc: m.desc,
        erasedAt: m.erasedAt,
        erasedBy: m.erasedBy,
        erasedReason: m.erasedReason,
      });
    }
    for (const e of (genesis.chaos.equips || [])) {
      chaos.equips.push({
        templateId: e.id,
        id: e.id,
        name: e.name,
        slot: e.slot,
        quality: e.quality,
        reqLevel: e.reqLevel,
        stats: e.stats || {},
        area: e.areaId,
        areaName: AREAS[e.areaId]?.name || e.areaId,
        creator: e.creator,
        creatorUsername: e.creatorUsername,
        customDesc: e.desc,
        erasedAt: e.erasedAt,
        erasedBy: e.erasedBy,
        erasedReason: e.erasedReason,
      });
    }
  }

  return { materials, equips: Array.from(equipMap.values()), consumables, monsters, chaos };
}

function registerCodexRoutes(app, store) {
  // 区域列表
  app.get('/api/areas', (req, res) => {
    const areas = Object.values(AREAS).map(a => ({
      id: a.id, name: a.name, desc: a.desc, minLevel: a.minLevel,
      monsters: a.monsters.map(m => m.name),
    }));
    res.json({ success: true, data: areas });
  });

  // 图鉴（聚合材料/装备/消耗品/怪物 + 自创内容）
  app.get('/api/codex', (req, res) => res.json({ success: true, data: buildCodexData(store) }));

  // 静态：附魔配方
  app.get('/api/data/enchants', (req, res) => res.json({ success: true, data: ENCHANT_RECIPES }));
}

module.exports = { registerCodexRoutes, buildCodexData };
