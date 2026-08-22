// ====== 图鉴 + 区域路由 ======
const { getPlayerView } = require('../engine');
const { AREAS, EQUIP_TEMPLATES, JOB_TREE, MONSTER_SKILLS, ENCHANT_RECIPES, MATERIAL_PRICES, SHOP_ITEMS } = require('../data');
const { ok, fail } = require('./_helpers');

function buildCodexData() {
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
  return { materials, equips: Array.from(equipMap.values()), consumables, monsters };
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

  // 图鉴（聚合材料/装备/消耗品/怪物）
  app.get('/api/codex', (req, res) => res.json({ success: true, data: buildCodexData() }));

  // 静态：附魔配方
  app.get('/api/data/enchants', (req, res) => res.json({ success: true, data: ENCHANT_RECIPES }));
}

module.exports = { registerCodexRoutes, buildCodexData };
