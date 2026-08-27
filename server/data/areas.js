// ====== 挂机区域配置 + 区域顺序 ======
// @file data/areas
// @module data-areas
// @description 所有挂机区域定义（高蛮山 → 创世核心）和区域等级顺序
//   v2.7：全局掉率再压缩——挂机放置类游戏，等级越高装备越稀有
//   装备掉率梯度：Lv1-30 ~1% → Lv200-250 ~0.05%（每升 1 级掉率约 ×0.85）
//   材料掉率统一砍半

const AREAS = {
  gaomanshan: {
    id: 'gaomanshan', name: '高蛮山', minLevel: 1,
    desc: '草原与森林交界处的山崖，鹰人部落起始地',
    monsters: [
      { name: '森林狼', exp: 8, gold: 2, hp: 30, atk: 4, def: 1, agi: 4, skills: ['bite'] },
      { name: '野猪', exp: 12, gold: 3, hp: 50, atk: 3, def: 2, agi: 2, skills: ['charge'] },
      { name: '草原兔', exp: 5, gold: 1, hp: 15, atk: 2, def: 0, agi: 6, skills: [] }
    ],
    drops: [
      { type: 'material', name: '兽皮', rate: 0.08 },
      { type: 'equip', template: 'wooden_spear', rate: 0.01 }
    ]
  },
  miyusenlin: {
    id: 'miyusenlin', name: '密语森林', minLevel: 5,
    desc: '高蛮山附近的茂密森林，猎物更丰富也更危险',
    monsters: [
      { name: '黑熊', exp: 20, gold: 4, hp: 80, atk: 10, def: 4, agi: 3, skills: ['roar','claw'] },
      { name: '森林狼', exp: 8, gold: 2, hp: 30, atk: 5, def: 1, agi: 5, skills: ['bite'] },
      { name: '低阶魔兽', exp: 25, gold: 6, hp: 100, atk: 8, def: 3, agi: 4, skills: ['magic_bolt'] }
    ],
    drops: [
      { type: 'material', name: '草药', rate: 0.06 },
      { type: 'material', name: '兽骨', rate: 0.04 },
      { type: 'equip', template: 'bronze_sword', rate: 0.008 },
      { type: 'equip', template: 'leather_armor', rate: 0.006 }
    ]
  },
  hanhaisenlin: {
    id: 'hanhaisenlin', name: '瀚海森林', minLevel: 15,
    desc: '泰坦与龙的领土接壤处，广袤如海，危机四伏',
    monsters: [
      { name: '双足飞龙', exp: 50, gold: 12, hp: 200, atk: 18, def: 7, agi: 10, skills: ['claw','tail_sweep'] },
      { name: '泰坦附属兵', exp: 60, gold: 15, hp: 250, atk: 22, def: 10, agi: 6, skills: ['charge','roar'] },
      { name: '巨蜥', exp: 35, gold: 8, hp: 150, atk: 15, def: 6, agi: 5, skills: ['poison','bite'] }
    ],
    drops: [
      { type: 'material', name: '泰坦之血碎片', rate: 0.025 },
      { type: 'material', name: '青铜矿', rate: 0.05 },
      { type: 'material', name: '飞龙鳞片', rate: 0.015 },
      { type: 'equip', template: 'iron_spear', rate: 0.005 },
      { type: 'equip', template: 'iron_armor', rate: 0.004 }
    ]
  },
  donghaizhibin: {
    id: 'donghaizhibin', name: '东海之滨', minLevel: 30,
    desc: '东方大海边缘的高山，资源丰富',
    monsters: [
      { name: '海滨魔兽', exp: 80, gold: 18, hp: 400, atk: 30, def: 12, agi: 14, skills: ['magic_bolt','claw'] },
      { name: '海族斥候', exp: 100, gold: 25, hp: 500, atk: 35, def: 14, agi: 18, skills: ['poison','charge'] },
      { name: '巨型海龟', exp: 120, gold: 30, hp: 600, atk: 28, def: 20, agi: 8, skills: ['tail_sweep','roar'] }
    ],
    drops: [
      { type: 'material', name: '海灵石', rate: 0.04 },
      { type: 'material', name: '铁矿', rate: 0.06 },
      { type: 'material', name: '深海水晶', rate: 0.01 },
      { type: 'equip', template: 'thunder_lance', rate: 0.004 },
      { type: 'equip', template: 'sea_armor', rate: 0.003 }
    ]
  },
  tiantangshan: {
    id: 'tiantangshan', name: '天堂山', minLevel: 50,
    desc: '翼人族的核心驻地，光属性能量充沛',
    monsters: [
      { name: '叛乱鹰人', exp: 150, gold: 35, hp: 800, atk: 45, def: 18, agi: 22, skills: ['wing_blade','claw'] },
      { name: '蛇人战士', exp: 180, gold: 45, hp: 1000, atk: 50, def: 22, agi: 16, skills: ['serpent_bite','charge'] },
      { name: '堕落翼人', exp: 220, gold: 55, hp: 1200, atk: 55, def: 20, agi: 25, skills: ['wing_blade','dark_slash'] }
    ],
    drops: [
      { type: 'material', name: '风羽玉露', rate: 0.03 },
      { type: 'material', name: '光明晶', rate: 0.02 },
      { type: 'material', name: '天使之羽', rate: 0.005 },
      { type: 'equip', template: 'holy_blade', rate: 0.0025 },
      { type: 'equip', template: 'light_wings', rate: 0.0015 },
      { type: 'equip', template: 'ranger_bow', rate: 0.004 },
      { type: 'equip', template: 'paladin_shield', rate: 0.003 },
      { type: 'equip', template: 'timekeeper_amulet', rate: 0.002 }
    ]
  },
  jingchengwaibi: {
    id: 'jingchengwaibi', name: '地精王城外围', minLevel: 70,
    desc: '地精帝国王城外围，蒸汽与附魔的气息弥漫',
    monsters: [
      { name: '地精士兵', exp: 300, gold: 60, hp: 1800, atk: 70, def: 30, agi: 28, skills: ['charge','claw'] },
      { name: '地精骑士', exp: 400, gold: 80, hp: 2500, atk: 80, def: 35, agi: 25, skills: ['charge','roar'] },
      { name: '蒸汽傀儡', exp: 350, gold: 70, hp: 3000, atk: 75, def: 45, agi: 15, skills: ['steam_blast','tail_sweep'] }
    ],
    drops: [
      { type: 'material', name: '附魔卷轴', rate: 0.03 },
      { type: 'material', name: '炼金材料', rate: 0.05 },
      { type: 'equip', template: 'knight_blade', rate: 0.0025 },
      { type: 'equip', template: 'golem_armor', rate: 0.002 },
      { type: 'equip', template: 'sage_robe', rate: 0.0025 }
    ]
  },
  longdao: {
    id: 'longdao', name: '龙岛', minLevel: 90,
    desc: '太古一战后巨龙归隐之地，龙威笼罩',
    monsters: [
      { name: '幼龙', exp: 600, gold: 120, hp: 5000, atk: 100, def: 50, agi: 35, skills: ['fire_breath','claw'] },
      { name: '成年巨龙', exp: 1000, gold: 250, hp: 12000, atk: 150, def: 80, agi: 40, skills: ['fire_breath','roar','tail_sweep'] },
      { name: '龙族守卫', exp: 800, gold: 180, hp: 8000, atk: 120, def: 70, agi: 30, skills: ['ice_breath','charge'] }
    ],
    drops: [
      { type: 'material', name: '龙鳞', rate: 0.04 },
      { type: 'material', name: '龙血', rate: 0.015 },
      { type: 'equip', template: 'dragon_slayer', rate: 0.0015 },
      { type: 'equip', template: 'dragon_armor', rate: 0.001 },
      { type: 'equip', template: 'warlord_blade', rate: 0.0025 }
    ]
  },
  shenyuan: {
    id: 'shenyuan', name: '深渊裂隙', minLevel: 100,
    desc: '世界的阴暗面，深渊魔物涌出的裂隙',
    monsters: [
      { name: '深渊魔物', exp: 2000, gold: 400, hp: 20000, atk: 180, def: 80, agi: 55, skills: ['dark_slash','void_tear'] },
      { name: '深渊领主', exp: 5000, gold: 1000, hp: 50000, atk: 300, def: 120, agi: 70, skills: ['soul_drain','void_tear','dark_slash'], isBoss: true },
      { name: '虚空行者', exp: 3000, gold: 600, hp: 30000, atk: 220, def: 90, agi: 80, skills: ['void_tear','dark_slash'] }
    ],
    drops: [
      { type: 'material', name: '法则碎片', rate: 0.025 },
      { type: 'material', name: '深渊之石', rate: 0.04 },
      { type: 'equip', template: 'void_blade', rate: 0.001 },
      { type: 'equip', template: 'abyss_cloak', rate: 0.00075 }
    ]
  },
  // ====== 高阶区域（Lv.130+）======
  elementshenyuan: {
    id: 'elementshenyuan', name: '元素深渊', minLevel: 130,
    desc: '六大元素失控之地，每一步都在与自然之力搏斗',
    monsters: [
      { name: '元素怨灵', exp: 5000, gold: 1000, hp: 40000, atk: 350, def: 150, agi: 80, skills: ['element_storm','void_nova'] },
      { name: '炎魔', exp: 7000, gold: 1500, hp: 60000, atk: 420, def: 180, agi: 60, skills: ['fire_breath','soul_split'] },
      { name: '冰霜女巫', exp: 6500, gold: 1300, hp: 50000, atk: 400, def: 200, agi: 90, skills: ['ice_breath','time_stop'] },
      { name: '雷霆巨像', exp: 8500, gold: 1800, hp: 80000, atk: 480, def: 250, agi: 50, skills: ['element_storm','realm_rift'], isBoss: true },
      { name: '虚空元素', exp: 7500, gold: 1600, hp: 70000, atk: 450, def: 220, agi: 100, skills: ['void_nova','star_arrow'] }
    ],
    drops: [
      { type: 'material', name: '法则碎片', rate: 0.04 },
      { type: 'material', name: '深渊之石', rate: 0.05 },
      { type: 'equip', template: 'starforged_blade', rate: 0.0025 },
      { type: 'equip', template: 'element_crown', rate: 0.002 },
      { type: 'equip', template: 'godheart_orb', rate: 0.0015 },
      { type: 'equip', template: 'abyss_devourer', rate: 0.002 },
      { type: 'equip', template: 'dragon_lord_plate', rate: 0.00175 },
      { type: 'equip', template: 'phoenix_feather', rate: 0.0015 }
    ]
  },
  xingjiezhanchang: {
    id: 'xingjiezhanchang', name: '星界战场', minLevel: 150,
    desc: '诸神黄昏的遗迹残骸，无数英雄的灵魂在此激荡',
    monsters: [
      { name: '星界骑士', exp: 12000, gold: 2500, hp: 100000, atk: 600, def: 280, agi: 90, skills: ['star_arrow','wing_blade'] },
      { name: '堕落天使', exp: 15000, gold: 3000, hp: 130000, atk: 700, def: 320, agi: 110, skills: ['divine_judgment','holy_smite'] },
      { name: '暗影巫王', exp: 18000, gold: 3500, hp: 160000, atk: 750, def: 350, agi: 100, skills: ['soul_drain','void_nova'] },
      { name: '星辰巨龙', exp: 25000, gold: 5000, hp: 250000, atk: 900, def: 450, agi: 80, skills: ['fire_breath','star_arrow','realm_rift'], isBoss: true }
    ],
    drops: [
      { type: 'material', name: '法则碎片', rate: 0.05 },
      { type: 'equip', template: 'realm_breaker', rate: 0.0015 },
      { type: 'equip', template: 'void_dragonscale', rate: 0.00125 },
      { type: 'equip', template: 'eternity_band', rate: 0.001 },
      { type: 'equip', template: 'realm_walker_boots', rate: 0.001 }
    ]
  },
  shenmodian: {
    id: 'shenmodian', name: '神魔殿', minLevel: 180,
    desc: '诸神的最终试炼之所，唯有真正的英雄方能进入',
    monsters: [
      { name: '神官祭司', exp: 30000, gold: 6000, hp: 300000, atk: 1200, def: 600, agi: 120, skills: ['divine_judgment','holy_smite'] },
      { name: '魔将', exp: 35000, gold: 7000, hp: 400000, atk: 1400, def: 700, agi: 100, skills: ['god_smash','realm_rift'] },
      { name: '时间操控者', exp: 40000, gold: 8000, hp: 500000, atk: 1600, def: 800, agi: 200, skills: ['time_stop','star_arrow'] },
      { name: '原初之神', exp: 80000, gold: 20000, hp: 1500000, atk: 2500, def: 1200, agi: 150, skills: ['god_smash','divine_judgment','time_stop','realm_rift'], isBoss: true }
    ],
    drops: [
      { type: 'material', name: '法则碎片', rate: 0.10 },
      { type: 'equip', template: 'creators_blade', rate: 0.001 },
      { type: 'equip', template: 'god_plate', rate: 0.00075 },
      { type: 'equip', template: 'origin_eye', rate: 0.0005 }
    ]
  },
  // ====== 终极区域（Lv.200+）======
  eternity_void: {
    id: 'eternity_void', name: '永恒虚空', minLevel: 200,
    desc: '超越神魔的禁地，时间在这里停止流动',
    monsters: [
      { name: '虚空行者·极', exp: 80000, gold: 15000, hp: 800000, atk: 2200, def: 1000, agi: 200, skills: ['void_nova','realm_rift'] },
      { name: '永恒守卫', exp: 90000, gold: 18000, hp: 1000000, atk: 2400, def: 1100, agi: 180, skills: ['time_stop','god_smash'] },
      { name: '虚空之主', exp: 150000, gold: 30000, hp: 3000000, atk: 3000, def: 1500, agi: 220, skills: ['god_smash','divine_judgment','realm_rift','time_stop'], isBoss: true }
    ],
    drops: [
      { type: 'material', name: '法则碎片', rate: 0.15 },
      { type: 'equip', template: 'infinity_edge', rate: 0.0015 }
    ]
  },
  chrono_realm: {
    id: 'chrono_realm', name: '时之境', minLevel: 220,
    desc: '时间与空间的交汇处，过去与未来在这里重叠',
    monsters: [
      { name: '时之精灵', exp: 120000, gold: 25000, hp: 1500000, atk: 3000, def: 1500, agi: 250, skills: ['time_stop','star_arrow'] },
      { name: '永恒骑士', exp: 150000, gold: 30000, hp: 2000000, atk: 3500, def: 1800, agi: 220, skills: ['divine_judgment','wing_blade'] },
      { name: '时之龙王', exp: 300000, gold: 60000, hp: 6000000, atk: 4500, def: 2200, agi: 250, skills: ['god_smash','realm_rift','time_stop'], isBoss: true }
    ],
    drops: [
      { type: 'material', name: '法则碎片', rate: 0.18 },
      { type: 'equip', template: 'chrono_armor', rate: 0.0015 }
    ]
  },
  genesis_core: {
    id: 'genesis_core', name: '创世核心', minLevel: 250,
    desc: '万物起源之处，全知全能者居住的最终领域',
    monsters: [
      { name: '造物者投影', exp: 300000, gold: 60000, hp: 5000000, atk: 5000, def: 2500, agi: 300, skills: ['god_smash','divine_judgment'] },
      { name: '原初之魂', exp: 400000, gold: 80000, hp: 8000000, atk: 6000, def: 3000, agi: 350, skills: ['time_stop','realm_rift'] },
      { name: '万界之眼', exp: 800000, gold: 200000, hp: 30000000, atk: 8000, def: 4000, agi: 400, skills: ['god_smash','divine_judgment','time_stop','realm_rift'], isBoss: true }
    ],
    drops: [
      { type: 'material', name: '法则碎片', rate: 0.20 },
      { type: 'equip', template: 'omni_eye', rate: 0.001 }
    ]
  }
};

// 区域顺序（按等级从低到高，用于通关进度判定）
const AREA_ORDER = [
  'gaomanshan', 'miyusenlin', 'hanhaisenlin', 'donghaizhibin',
  'tiantangshan', 'jingchengwaibi', 'longdao', 'shenyuan',
  'elementshenyuan', 'xingjiezhanchang', 'shenmodian',
  'eternity_void', 'chrono_realm', 'genesis_core'
];

module.exports = { AREAS, AREA_ORDER };
