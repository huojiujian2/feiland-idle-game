// 游戏静态数据 - 区域、怪物、装备、技能、职业进阶树

// ====== 怪物技能模板 ======
const MONSTER_SKILLS = {
  bite:      { name: '撕咬',   chance: 0.25, mult: 1.5, desc: '凶猛撕咬' },
  charge:    { name: '冲撞',   chance: 0.20, mult: 1.4, desc: '全力冲撞' },
  claw:      { name: '利爪',   chance: 0.20, mult: 1.3, desc: '利爪撕裂' },
  roar:      { name: '咆哮',   chance: 0.15, mult: 1.6, desc: '震慑咆哮' },
  magic_bolt:{ name: '魔力冲击',chance: 0.15, mult: 1.8, desc: '魔法弹' },
  poison:    { name: '毒液',   chance: 0.18, mult: 1.3, desc: '喷吐毒液' },
  tail_sweep:{ name: '尾扫',   chance: 0.20, mult: 1.4, desc: '巨尾横扫' },
  fire_breath:{name: '龙息',   chance: 0.12, mult: 2.0, desc: '烈焰吐息' },
  ice_breath:{ name: '冰息',   chance: 0.12, mult: 1.8, desc: '极寒吐息' },
  dark_slash:{ name: '暗影斩', chance: 0.18, mult: 1.7, desc: '暗影斩击' },
  void_tear: { name: '虚空撕裂',chance: 0.10, mult: 2.5, desc: '撕裂空间' },
  soul_drain:{ name: '灵魂吞噬',chance: 0.08, mult: 2.2, desc: '吞噬灵魂' },
  steam_blast:{name: '蒸汽爆破',chance: 0.15, mult: 1.6, desc: '蒸汽爆炸' },
  holy_smite:{ name: '圣光击', chance: 0.15, mult: 1.7, desc: '光属性打击' },
  serpent_bite:{name:'蛇毒噬咬',chance: 0.22, mult: 1.5, desc: '蛇毒噬咬' },
  wing_blade:{ name: '翼刃斩', chance: 0.18, mult: 1.6, desc: '翼羽如刃' }
};

// ====== 挂机区域（8个，覆盖前期到后期） ======
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
      { type: 'material', name: '兽皮', rate: 0.15 },
      { type: 'equip', template: 'wooden_spear', rate: 0.02 }
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
      { type: 'material', name: '草药', rate: 0.12 },
      { type: 'material', name: '兽骨', rate: 0.08 },
      { type: 'equip', template: 'bronze_sword', rate: 0.015 },
      { type: 'equip', template: 'leather_armor', rate: 0.012 }
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
      { type: 'material', name: '泰坦之血碎片', rate: 0.05 },
      { type: 'material', name: '青铜矿', rate: 0.10 },
      { type: 'material', name: '飞龙鳞片', rate: 0.03 },
      { type: 'equip', template: 'iron_spear', rate: 0.01 },
      { type: 'equip', template: 'iron_armor', rate: 0.008 }
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
      { type: 'material', name: '海灵石', rate: 0.08 },
      { type: 'material', name: '铁矿', rate: 0.12 },
      { type: 'material', name: '深海水晶', rate: 0.02 },
      { type: 'equip', template: 'thunder_lance', rate: 0.008 },
      { type: 'equip', template: 'sea_armor', rate: 0.006 }
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
      { type: 'material', name: '风羽玉露', rate: 0.06 },
      { type: 'material', name: '光明晶', rate: 0.04 },
      { type: 'material', name: '天使之羽', rate: 0.01 },
      { type: 'equip', template: 'holy_blade', rate: 0.005 },
      { type: 'equip', template: 'light_wings', rate: 0.003 }
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
      { type: 'material', name: '附魔卷轴', rate: 0.06 },
      { type: 'material', name: '炼金材料', rate: 0.10 },
      { type: 'equip', template: 'knight_blade', rate: 0.005 },
      { type: 'equip', template: 'golem_armor', rate: 0.004 }
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
      { type: 'material', name: '龙鳞', rate: 0.08 },
      { type: 'material', name: '龙血', rate: 0.03 },
      { type: 'equip', template: 'dragon_slayer', rate: 0.003 },
      { type: 'equip', template: 'dragon_armor', rate: 0.002 }
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
      { type: 'material', name: '法则碎片', rate: 0.05 },
      { type: 'material', name: '深渊之石', rate: 0.08 },
      { type: 'equip', template: 'void_blade', rate: 0.002 },
      { type: 'equip', template: 'abyss_cloak', rate: 0.0015 }
    ]
  }
};

// ====== 装备模板表 ======
const EQUIP_TEMPLATES = {
  // 武器
  wooden_spear:    { name: '木矛',       slot: 'weapon',    quality: 'normal', reqLevel: 1,  stats: { atk: 3 } },
  bronze_sword:    { name: '青铜剑',     slot: 'weapon',    quality: 'fine',   reqLevel: 5,  stats: { atk: 8, str: 2 } },
  iron_spear:      { name: '铁制长矛',   slot: 'weapon',    quality: 'fine',   reqLevel: 15, stats: { atk: 18, str: 4 } },
  thunder_lance:   { name: '雷霆长枪',   slot: 'weapon',    quality: 'epic',   reqLevel: 30, stats: { atk: 40, str: 8, spi: 5 } },
  holy_blade:      { name: '圣光之刃',   slot: 'weapon',    quality: 'epic',   reqLevel: 50, stats: { atk: 80, str: 12, spi: 10 } },
  knight_blade:    { name: '骑士斩剑',   slot: 'weapon',    quality: 'epic',   reqLevel: 70, stats: { atk: 130, str: 18, con: 10 } },
  dragon_slayer:   { name: '屠龙者',     slot: 'weapon',    quality: 'legend', reqLevel: 90, stats: { atk: 220, str: 30, spi: 15 } },
  void_blade:      { name: '虚空之刃',   slot: 'weapon',    quality: 'legend', reqLevel: 100, stats: { atk: 350, str: 40, spi: 25, agi: 20 } },

  // 护甲
  leather_armor:   { name: '皮甲',       slot: 'armor',     quality: 'normal', reqLevel: 5,  stats: { def: 5, hp: 20 } },
  iron_armor:       { name: '铁甲',       slot: 'armor',     quality: 'fine',   reqLevel: 15, stats: { def: 15, hp: 50 } },
  sea_armor:       { name: '海灵胸甲',   slot: 'armor',     quality: 'epic',   reqLevel: 30, stats: { def: 35, hp: 120, con: 5 } },
  light_wings:     { name: '光之翼甲',   slot: 'armor',     quality: 'epic',   reqLevel: 50, stats: { def: 60, hp: 250, agi: 10 } },
  golem_armor:     { name: '傀儡重甲',   slot: 'armor',     quality: 'epic',   reqLevel: 70, stats: { def: 100, hp: 500, con: 15 } },
  dragon_armor:    { name: '龙鳞战甲',   slot: 'armor',     quality: 'legend', reqLevel: 90, stats: { def: 180, hp: 1000, con: 25 } },
  abyss_cloak:    { name: '深渊斗篷',   slot: 'armor',     quality: 'legend', reqLevel: 100, stats: { def: 280, hp: 2000, con: 35, agi: 15 } },

  // 饰品
  beast_tooth:     { name: '兽牙吊坠',   slot: 'accessory', quality: 'normal', reqLevel: 1,  stats: { atk: 2, gold: 0.05 } },
  crystal_ring:    { name: '水晶戒指',   slot: 'accessory', quality: 'fine',   reqLevel: 15, stats: { mp: 30, spi: 3 } },
  sea_amulet:     { name: '海灵护符',   slot: 'accessory', quality: 'epic',   reqLevel: 30, stats: { mp: 80, spi: 8, exp: 0.1 } },
  angel_feather:  { name: '天使之羽',   slot: 'accessory', quality: 'epic',   reqLevel: 50, stats: { hp: 200, mp: 100, exp: 0.15 } },
  dragon_eye:     { name: '龙之眼',     slot: 'accessory', quality: 'legend', reqLevel: 90, stats: { atk: 50, def: 50, exp: 0.25 } }
};

// 材质对应的颜色
const QUALITY_COLORS = {
  normal: '#9d9bb8',
  fine: '#5eda7a',
  epic: '#9d8cf0',
  legend: '#d4af5e'
};

// ====== 职业进阶树 ======
const JOB_TREE = {
  thunder: {
    id: 'thunder', name: '雷霆系', desc: '雷霆属性，高爆发高机动。主角姜尤所走之路', icon: '⚡',
    growth: { hp: 1.0, atk: 1.2, def: 0.8, agi: 1.1, exp: 0.05, gold: 0 },
    talents: [
      { name: '雷霆意志', desc: '暴击伤害 +15%', effect: { critDmg: 0.15 } },
      { name: '经验共鸣', desc: '每次击杀额外获得 EXP（等级×2）', effect: { killExp: 'level*2' } }
    ],
    mechanics: [
      { level: 1, name: '雷光初现', desc: '暴击率 +3%', effect: { crit: 0.03 } },
      { level: 2, name: '雷殛深化', desc: '暴击伤害 +10%', effect: { critDmg: 0.10 } },
      { level: 3, name: '雷劫掠夺', desc: '暴击时额外获得 EXP（伤害×0.5）', effect: { critExp: 0.5 } },
      { level: 4, name: '雷动追击', desc: '暴击可触发一次追击（伤害 50%）', effect: { critChase: 0.5 } }
    ],
    stages: [
      { level: 11, name: '御雷者',   desc: '觉醒雷霆之力，投掷雷电攻击' },
      { level: 31, name: '雷霆之翼', desc: '雷霆与飞行融合，战斗效率大增' },
      { level: 61, name: '圣翼行者', desc: '光与雷双系融合，踏入英雄阶' },
      { level: 100, name: '圣雷之炽', desc: '传奇职业，觉醒双传奇特性：圣心+神威' }
    ]
  },
  light: {
    id: 'light', name: '光明系', desc: '光属性，攻防一体，附带治愈能力', icon: '✨',
    growth: { hp: 1.2, atk: 1.0, def: 1.2, agi: 0.8, exp: 0, gold: 0 },
    talents: [
      { name: '圣光庇护', desc: '受到的治疗效果 +20%', effect: { healTaken: 0.20 } },
      { name: '净化之躯', desc: '负面状态持续时间 -1 回合', effect: { debuffCut: 1 } }
    ],
    mechanics: [
      { level: 1, name: '光愈亲和', desc: '每回合回血 1%', effect: { regen: 0.01 } },
      { level: 2, name: '圣盾强化', desc: '护盾吸收量 +15%', effect: { shieldBoost: 0.15 } },
      { level: 3, name: '治疗余晖', desc: '治疗时附加 1 回合减伤 5%', effect: { healGuard: 0.05 } },
      { level: 4, name: '圣光复生', desc: '死亡时复活一次（HP 30%）', effect: { revive: 0.30 } }
    ],
    stages: [
      { level: 11, name: '光明剑士',   desc: '光属性近战，攻防均衡' },
      { level: 31, name: '圣光骑士',   desc: '光与防御融合' },
      { level: 61, name: '光翼审判者', desc: '光翼展翅，审判之力' },
      { level: 100, name: '炽天使',     desc: '传奇天使，光之化身' }
    ]
  },
  wind: {
    id: 'wind', name: '风行系', desc: '风属性，速度极快，侦察游击', icon: '🌪',
    growth: { hp: 0.9, atk: 1.0, def: 0.8, agi: 1.3, exp: 0.03, gold: 0 },
    talents: [
      { name: '风之优雅', desc: '闪避率 +8%', effect: { dodge: 0.08 } },
      { name: '先手权', desc: '每场战斗第一回合 AGI+20%', effect: { firstTurnAgi: 0.20 } }
    ],
    mechanics: [
      { level: 1, name: '轻身如风', desc: '闪避率 +3%', effect: { dodge: 0.03 } },
      { level: 2, name: '闪避连击', desc: '闪避后下次攻击必暴击', effect: { dodgeCrit: true } },
      { level: 3, name: '周流不息', desc: '闪避时回复 HP 3%', effect: { dodgeHeal: 0.03 } },
      { level: 4, name: '风势无穷', desc: '每回合 AGI 额外 +5%（无限叠加）', effect: { stackAgi: 0.05 } }
    ],
    stages: [
      { level: 11, name: '信使',     desc: '风之信使，速度加成' },
      { level: 31, name: '风之使者', desc: '掌控风元素' },
      { level: 61, name: '风行者',   desc: '风之行者，来去如风' },
      { level: 100, name: '风暴领主', desc: '传奇，风暴的主宰' }
    ]
  },
  knight: {
    id: 'knight', name: '骑士系', desc: '骑乘战斗，冲锋陷阵，地精传承', icon: '🛡',
    growth: { hp: 1.1, atk: 1.0, def: 1.3, agi: 0.8, exp: 0, gold: 0 },
    talents: [
      { name: '钢铁壁垒', desc: '受到的所有伤害 -8%', effect: { dmgTaken: -0.08 } },
      { name: '不屈', desc: 'HP 低于 30% 时，DEF+20%', effect: { lowHpDef: 0.20 } }
    ],
    mechanics: [
      { level: 1, name: '格挡反击', desc: '防御时减伤 +5%', effect: { guardCut: 0.05 } },
      { level: 2, name: '以战养战', desc: '每受击一次 ATK+2%（上限 20%）', effect: { hitStackAtk: 0.02 } },
      { level: 3, name: '守护誓言', desc: 'HP 低于 50% 时嘲讽敌人', effect: { lowHpTaunt: true } },
      { level: 4, name: '不灭壁垒', desc: '获得一次免死护盾（吸收 HP 50%）', effect: { deathShield: 0.50 } }
    ],
    stages: [
      { level: 11, name: '见习骑士',   desc: '初入骑士之道' },
      { level: 31, name: '天空骑士',   desc: '可骑乘飞行魔兽' },
      { level: 61, name: '龙骑士',     desc: '骑龙作战' },
      { level: 100, name: '血骑士',     desc: '半神骑士，血脉觉醒' }
    ]
  },
  alchemy: {
    id: 'alchemy', name: '炼金系', desc: '生产辅助，制造药剂与附魔装备', icon: '⚗',
    growth: { hp: 1.0, atk: 0.9, def: 1.0, agi: 1.0, exp: 0.03, gold: 0.10 },
    talents: [
      { name: '财富嗅觉', desc: '所有 GOLD 获取 +15%', effect: { goldGain: 0.15 } },
      { name: '药剂大师', desc: '所有 HP/EXP/GOLD 类词条效果 +10%', effect: { potionBoost: 0.10 } }
    ],
    mechanics: [
      { level: 1, name: '点石成金', desc: 'GOLD 获取 +10%', effect: { goldGain: 0.10 } },
      { level: 2, name: '余烬鉴定', desc: '使用主动技能后 GOLD+5%', effect: { skillGold: 0.05 } },
      { level: 3, name: '贤者之思', desc: '每场战斗 EXP 获取 +10%', effect: { battleExp: 0.10 } },
      { level: 4, name: '造物极致', desc: '击杀敌人获得双倍 GOLD 和 EXP', effect: { doubleKill: true } }
    ],
    stages: [
      { level: 11, name: '学徒',         desc: '炼金入门' },
      { level: 31, name: '炼金师',       desc: '可制造中级药剂' },
      { level: 61, name: '附魔师',       desc: '附魔装备，最受欢迎' },
      { level: 100, name: '大炼金术士', desc: '传奇炼金，造物之极' }
    ]
  }
};

// ====== 词条等级配置 ======
const AFFIX_LEVELS = {
  1: { name: '初级', icon: '🔰', color: '#9d9bb8', reqLevel: 1 },
  2: { name: '中级', icon: '⚙️', color: '#5eda7a', reqLevel: 31 },
  3: { name: '高级', icon: '🔥', color: '#9d8cf0', reqLevel: 61 },
  4: { name: '大师', icon: '💎', color: '#d4af5e', reqLevel: 100 }
};

// ====== 词条库（4级，每级10主动+40被动） ======
// 主动主词条 type: attack(纯攻击) / heal(恢复) / agi(敏捷) / buff(增益) / gold(金币) / control(控制) / def(防御) / crit(暴击)
// 被动副词条 effect 为具体加成对象
const AFFIX_TREE = {
  // ========== 初级（等级1） ==========
  1: [
    // 主动主词条 A组
    { id: 'A1-01', level: 1, slot: 'active', group: 'A', name: '雷霆冲击', desc: '对敌方造成 ATK×1.2 伤害', category: '攻击', effect: { type: 'damage', mult: 1.2 } },
    { id: 'A1-02', level: 1, slot: 'active', group: 'A', name: '光愈术',   desc: '恢复自身 HP 上限 10%', category: '恢复', effect: { type: 'heal', value: 0.10 } },
    { id: 'A1-03', level: 1, slot: 'active', group: 'A', name: '风驰',     desc: '自身 AGI+10%，持续 2 回合', category: '敏捷', effect: { type: 'agi_buff', value: 0.10, turns: 2 } },
    { id: 'A1-04', level: 1, slot: 'active', group: 'A', name: '战意',     desc: '自身 ATK+10%，持续 2 回合', category: '攻击', effect: { type: 'atk_buff', value: 0.10, turns: 2 } },
    { id: 'A1-05', level: 1, slot: 'active', group: 'A', name: '炼金拾取', desc: '本场战斗 GOLD 获取 +10%', category: '金币', effect: { type: 'gold_buff', value: 0.10 } },
    // 主动主词条 B组
    { id: 'B1-01', level: 1, slot: 'active', group: 'B', name: '电击',     desc: '单体 ATK×1.1，10% 概率麻痹（AGI-20% 1回合）', category: '攻击/控制', effect: { type: 'damage', mult: 1.1, paralyze: { chance: 0.10, agi: 0.20, turns: 1 } } },
    { id: 'B1-02', level: 1, slot: 'active', group: 'B', name: '小治愈',   desc: '恢复 HP 8%', category: '恢复', effect: { type: 'heal', value: 0.08 } },
    { id: 'B1-03', level: 1, slot: 'active', group: 'B', name: '快速突进', desc: 'AGI+8%，持续 2 回合', category: '敏捷', effect: { type: 'agi_buff', value: 0.08, turns: 2 } },
    { id: 'B1-04', level: 1, slot: 'active', group: 'B', name: '破甲斩',   desc: 'ATK×1.0，目标 DEF-5% 持续 2 回合', category: '攻击/减防', effect: { type: 'damage', mult: 1.0, reduceDef: 0.05, turns: 2 } },
    { id: 'B1-05', level: 1, slot: 'active', group: 'B', name: '幸运一击', desc: '本次攻击暴击率 +15%', category: '暴击', effect: { type: 'crit_buff', value: 0.15 } },
    // 被动副词条 P组
    { id: 'P1-01', level: 1, slot: 'passive', group: 'P', name: '力量祝福', desc: 'ATK+2%', effect: { atk: 0.02 } },
    { id: 'P1-02', level: 1, slot: 'passive', group: 'P', name: '护甲祝福', desc: 'DEF+2%', effect: { def: 0.02 } },
    { id: 'P1-03', level: 1, slot: 'passive', group: 'P', name: '生命祝福', desc: 'HP+2%', effect: { hp: 0.02 } },
    { id: 'P1-04', level: 1, slot: 'passive', group: 'P', name: '敏捷祝福', desc: 'AGI+2%', effect: { agi: 0.02 } },
    { id: 'P1-05', level: 1, slot: 'passive', group: 'P', name: '经验祝福', desc: 'EXP+2%', effect: { exp: 0.02 } },
    { id: 'P1-06', level: 1, slot: 'passive', group: 'P', name: '财富祝福', desc: 'GOLD+2%', effect: { gold: 0.02 } },
    { id: 'P1-07', level: 1, slot: 'passive', group: 'P', name: '自愈', desc: '每回合回复 HP 1%', effect: { regen: 0.01 } },
    { id: 'P1-08', level: 1, slot: 'passive', group: 'P', name: '铁壁', desc: '受到伤害 -1%', effect: { dmgTaken: -0.01 } },
    { id: 'P1-09', level: 1, slot: 'passive', group: 'P', name: '精准', desc: '暴击率 +1%', effect: { crit: 0.01 } },
    { id: 'P1-10', level: 1, slot: 'passive', group: 'P', name: '轻灵', desc: '闪避率 +1%', effect: { dodge: 0.01 } },
    { id: 'P1-11', level: 1, slot: 'passive', group: 'P', name: '狂气', desc: 'ATK+3%，DEF-1%', effect: { atk: 0.03, def: -0.01 } },
    { id: 'P1-12', level: 1, slot: 'passive', group: 'P', name: '稳固体魄', desc: 'DEF+2%，HP+1%', effect: { def: 0.02, hp: 0.01 } },
    { id: 'P1-13', level: 1, slot: 'passive', group: 'P', name: '迅捷反应', desc: 'AGI+2%，闪避 +1%', effect: { agi: 0.02, dodge: 0.01 } },
    { id: 'P1-14', level: 1, slot: 'passive', group: 'P', name: '贪婪', desc: 'GOLD+3%', effect: { gold: 0.03 } },
    { id: 'P1-15', level: 1, slot: 'passive', group: 'P', name: '求知', desc: 'EXP+3%', effect: { exp: 0.03 } },
    { id: 'P1-16', level: 1, slot: 'passive', group: 'P', name: '热血', desc: 'ATK+2%，暴击 +1%', effect: { atk: 0.02, crit: 0.01 } },
    { id: 'P1-17', level: 1, slot: 'passive', group: 'P', name: '厚皮', desc: 'DEF+3%', effect: { def: 0.03 } },
    { id: 'P1-18', level: 1, slot: 'passive', group: 'P', name: '生机', desc: 'HP+3%', effect: { hp: 0.03 } },
    { id: 'P1-19', level: 1, slot: 'passive', group: 'P', name: '灵巧', desc: 'AGI+3%', effect: { agi: 0.03 } },
    { id: 'P1-20', level: 1, slot: 'passive', group: 'P', name: '活力', desc: '每回合回复 HP 2%', effect: { regen: 0.02 } },
    // 被动副词条 Q组
    { id: 'Q1-01', level: 1, slot: 'passive', group: 'Q', name: '基础攻击', desc: 'ATK+1.5%', effect: { atk: 0.015 } },
    { id: 'Q1-02', level: 1, slot: 'passive', group: 'Q', name: '基础防御', desc: 'DEF+1.5%', effect: { def: 0.015 } },
    { id: 'Q1-03', level: 1, slot: 'passive', group: 'Q', name: '基础生命', desc: 'HP+1.5%', effect: { hp: 0.015 } },
    { id: 'Q1-04', level: 1, slot: 'passive', group: 'Q', name: '基础敏捷', desc: 'AGI+1.5%', effect: { agi: 0.015 } },
    { id: 'Q1-05', level: 1, slot: 'passive', group: 'Q', name: '基础经验', desc: 'EXP+1.5%', effect: { exp: 0.015 } },
    { id: 'Q1-06', level: 1, slot: 'passive', group: 'Q', name: '基础金币', desc: 'GOLD+1.5%', effect: { gold: 0.015 } },
    { id: 'Q1-07', level: 1, slot: 'passive', group: 'Q', name: '微弱吸血', desc: '造成伤害的 1% 转化为 HP', effect: { lifesteal: 0.01 } },
    { id: 'Q1-08', level: 1, slot: 'passive', group: 'Q', name: '微弱反伤', desc: '受到伤害的 1% 反弹给攻击者', effect: { thorns: 0.01 } },
    { id: 'Q1-09', level: 1, slot: 'passive', group: 'Q', name: '弱点洞察', desc: '对 DEF 低于自己的敌人 ATK+2%', effect: { weakAtk: 0.02 } },
    { id: 'Q1-10', level: 1, slot: 'passive', group: 'Q', name: '战斗喘息', desc: '每回合回复 HP 0.5%', effect: { regen: 0.005 } },
    { id: 'Q1-11', level: 1, slot: 'passive', group: 'Q', name: '护甲强化', desc: 'DEF+2%，HP+1%', effect: { def: 0.02, hp: 0.01 } },
    { id: 'Q1-12', level: 1, slot: 'passive', group: 'Q', name: '敏捷思维', desc: 'AGI+2%，EXP+1%', effect: { agi: 0.02, exp: 0.01 } },
    { id: 'Q1-13', level: 1, slot: 'passive', group: 'Q', name: '财富嗅觉', desc: 'GOLD+2%，暴击率 +0.5%', effect: { gold: 0.02, crit: 0.005 } },
    { id: 'Q1-14', level: 1, slot: 'passive', group: 'Q', name: '耐久', desc: 'HP 低于 30% 时 DEF+3%', effect: { lowHpDef: 0.03 } },
    { id: 'Q1-15', level: 1, slot: 'passive', group: 'Q', name: '先手', desc: '战斗开始时 AGI+3% 持续 1 回合', effect: { firstTurnAgi: 0.03 } },
    { id: 'Q1-16', level: 1, slot: 'passive', group: 'Q', name: '节俭', desc: 'GOLD+1%，且消耗类效果消耗 -5%', effect: { gold: 0.01, consumeCut: 0.05 } },
    { id: 'Q1-17', level: 1, slot: 'passive', group: 'Q', name: '学习', desc: 'EXP+1%，每场额外 +2 EXP', effect: { exp: 0.01, flatExp: 2 } },
    { id: 'Q1-18', level: 1, slot: 'passive', group: 'Q', name: '斗魂', desc: 'ATK+1%，每回合攻击 +0.5%（上限 3%）', effect: { atk: 0.01, stackAtk: 0.005 } },
    { id: 'Q1-19', level: 1, slot: 'passive', group: 'Q', name: '守护', desc: 'DEF+1%，受到暴击伤害 -5%', effect: { def: 0.01, critTaken: -0.05 } },
    { id: 'Q1-20', level: 1, slot: 'passive', group: 'Q', name: '轻快', desc: 'AGI+1%，闪避 +0.5%', effect: { agi: 0.01, dodge: 0.005 } }
  ],
  // ========== 中级（等级2） ==========
  2: [
    // 主动主词条 A组
    { id: 'A2-01', level: 2, slot: 'active', group: 'A', name: '雷暴术', desc: '对敌方造成 ATK×1.5 伤害', category: '攻击', effect: { type: 'damage', mult: 1.5 } },
    { id: 'A2-02', level: 2, slot: 'active', group: 'A', name: '圣光屏障', desc: '自身 DEF+15%，持续 2 回合', category: '防御', effect: { type: 'def_buff', value: 0.15, turns: 2 } },
    { id: 'A2-03', level: 2, slot: 'active', group: 'A', name: '风刃术', desc: '对敌方造成 ATK×1.3 伤害，自身 AGI+5% 持续 2 回合', category: '攻击', effect: { type: 'damage', mult: 1.3, agi_buff: 0.05, turns: 2 } },
    { id: 'A2-04', level: 2, slot: 'active', group: 'A', name: '骑士壁垒', desc: '自身 DEF+15%，HP 恢复 5%', category: '防御', effect: { type: 'def_buff', value: 0.15, turns: 2, heal: 0.05 } },
    { id: 'A2-05', level: 2, slot: 'active', group: 'A', name: '药剂增效', desc: '自身 ATK+15%，持续 2 回合', category: '增益', effect: { type: 'atk_buff', value: 0.15, turns: 2 } },
    // 主动主词条 B组
    { id: 'B2-01', level: 2, slot: 'active', group: 'B', name: '雷光斩', desc: 'ATK×1.4，自身 ATK+5% 持续 2 回合', category: '攻击', effect: { type: 'damage', mult: 1.4, atk_buff: 0.05, turns: 2 } },
    { id: 'B2-02', level: 2, slot: 'active', group: 'B', name: '圣盾术', desc: '自身 DEF+12%，并获得护盾（吸收 HP 5% 伤害）', category: '防御', effect: { type: 'def_buff', value: 0.12, turns: 2, shield: 0.05 } },
    { id: 'B2-03', level: 2, slot: 'active', group: 'B', name: '风缚', desc: '对敌 ATK×1.2，目标 AGI-10% 持续 2 回合', category: '控制', effect: { type: 'damage', mult: 1.2, reduceAgi: 0.10, turns: 2 } },
    { id: 'B2-04', level: 2, slot: 'active', group: 'B', name: '骑士冲锋', desc: 'ATK×1.3，自身暴击率 +5% 持续 2 回合', category: '攻击', effect: { type: 'damage', mult: 1.3, crit_buff: 0.05, turns: 2 } },
    { id: 'B2-05', level: 2, slot: 'active', group: 'B', name: '炼金强化', desc: '本场 ATK+8%，GOLD+8%', category: '增益', effect: { type: 'all_buff', atk: 0.08, gold: 0.08 } },
    // 被动副词条 P组
    { id: 'P2-01', level: 2, slot: 'passive', group: 'P', name: '力量祝福 II', desc: 'ATK+5%', effect: { atk: 0.05 } },
    { id: 'P2-02', level: 2, slot: 'passive', group: 'P', name: '护甲祝福 II', desc: 'DEF+5%', effect: { def: 0.05 } },
    { id: 'P2-03', level: 2, slot: 'passive', group: 'P', name: '生命祝福 II', desc: 'HP+5%', effect: { hp: 0.05 } },
    { id: 'P2-04', level: 2, slot: 'passive', group: 'P', name: '敏捷祝福 II', desc: 'AGI+5%', effect: { agi: 0.05 } },
    { id: 'P2-05', level: 2, slot: 'passive', group: 'P', name: '经验祝福 II', desc: 'EXP+5%', effect: { exp: 0.05 } },
    { id: 'P2-06', level: 2, slot: 'passive', group: 'P', name: '财富祝福 II', desc: 'GOLD+5%', effect: { gold: 0.05 } },
    { id: 'P2-07', level: 2, slot: 'passive', group: 'P', name: '自愈 II', desc: '每回合回复 HP 2%', effect: { regen: 0.02 } },
    { id: 'P2-08', level: 2, slot: 'passive', group: 'P', name: '铁壁 II', desc: '受到伤害 -3%', effect: { dmgTaken: -0.03 } },
    { id: 'P2-09', level: 2, slot: 'passive', group: 'P', name: '精准 II', desc: '暴击率 +3%', effect: { crit: 0.03 } },
    { id: 'P2-10', level: 2, slot: 'passive', group: 'P', name: '轻灵 II', desc: '闪避率 +3%', effect: { dodge: 0.03 } },
    { id: 'P2-11', level: 2, slot: 'passive', group: 'P', name: '狂气 II', desc: 'ATK+6%，DEF-2%', effect: { atk: 0.06, def: -0.02 } },
    { id: 'P2-12', level: 2, slot: 'passive', group: 'P', name: '稳固体魄 II', desc: 'DEF+5%，HP+3%', effect: { def: 0.05, hp: 0.03 } },
    { id: 'P2-13', level: 2, slot: 'passive', group: 'P', name: '迅捷反应 II', desc: 'AGI+5%，闪避 +2%', effect: { agi: 0.05, dodge: 0.02 } },
    { id: 'P2-14', level: 2, slot: 'passive', group: 'P', name: '贪婪 II', desc: 'GOLD+6%', effect: { gold: 0.06 } },
    { id: 'P2-15', level: 2, slot: 'passive', group: 'P', name: '求知 II', desc: 'EXP+6%', effect: { exp: 0.06 } },
    { id: 'P2-16', level: 2, slot: 'passive', group: 'P', name: '热血 II', desc: 'ATK+5%，暴击 +2%', effect: { atk: 0.05, crit: 0.02 } },
    { id: 'P2-17', level: 2, slot: 'passive', group: 'P', name: '厚皮 II', desc: 'DEF+6%', effect: { def: 0.06 } },
    { id: 'P2-18', level: 2, slot: 'passive', group: 'P', name: '生机 II', desc: 'HP+6%', effect: { hp: 0.06 } },
    { id: 'P2-19', level: 2, slot: 'passive', group: 'P', name: '灵巧 II', desc: 'AGI+6%', effect: { agi: 0.06 } },
    { id: 'P2-20', level: 2, slot: 'passive', group: 'P', name: '活力 II', desc: '每回合回复 HP 3%', effect: { regen: 0.03 } },
    // 被动副词条 Q组
    { id: 'Q2-01', level: 2, slot: 'passive', group: 'Q', name: '攻击增幅 II', desc: 'ATK+4%', effect: { atk: 0.04 } },
    { id: 'Q2-02', level: 2, slot: 'passive', group: 'Q', name: '防御增幅 II', desc: 'DEF+4%', effect: { def: 0.04 } },
    { id: 'Q2-03', level: 2, slot: 'passive', group: 'Q', name: '生命增幅 II', desc: 'HP+4%', effect: { hp: 0.04 } },
    { id: 'Q2-04', level: 2, slot: 'passive', group: 'Q', name: '敏捷增幅 II', desc: 'AGI+4%', effect: { agi: 0.04 } },
    { id: 'Q2-05', level: 2, slot: 'passive', group: 'Q', name: '经验增幅 II', desc: 'EXP+4%', effect: { exp: 0.04 } },
    { id: 'Q2-06', level: 2, slot: 'passive', group: 'Q', name: '金币增幅 II', desc: 'GOLD+4%', effect: { gold: 0.04 } },
    { id: 'Q2-07', level: 2, slot: 'passive', group: 'Q', name: '吸血 II', desc: '伤害的 2% 回血', effect: { lifesteal: 0.02 } },
    { id: 'Q2-08', level: 2, slot: 'passive', group: 'Q', name: '反伤 II', desc: '反弹 2% 伤害', effect: { thorns: 0.02 } },
    { id: 'Q2-09', level: 2, slot: 'passive', group: 'Q', name: '破防', desc: '攻击时无视目标 3% DEF', effect: { ignoreDef: 0.03 } },
    { id: 'Q2-10', level: 2, slot: 'passive', group: 'Q', name: '暴击伤害', desc: '暴击伤害 +5%', effect: { critDmg: 0.05 } },
    { id: 'Q2-11', level: 2, slot: 'passive', group: 'Q', name: '护盾之躯', desc: '每回合获得 HP 1% 护盾（可叠加）', effect: { shieldRegen: 0.01 } },
    { id: 'Q2-12', level: 2, slot: 'passive', group: 'Q', name: '嗜血', desc: 'HP 低于 40% 时 ATK+6%', effect: { lowHpAtk: 0.06 } },
    { id: 'Q2-13', level: 2, slot: 'passive', group: 'Q', name: '坚韧', desc: 'HP 低于 40% 时 DEF+6%', effect: { lowHpDef: 0.06 } },
    { id: 'Q2-14', level: 2, slot: 'passive', group: 'Q', name: '闪避反击', desc: '闪避后下次攻击 ATK+4%', effect: { dodgeAtk: 0.04 } },
    { id: 'Q2-15', level: 2, slot: 'passive', group: 'Q', name: '经验掠夺', desc: '击杀敌人额外获得 EXP+5%', effect: { killExp: 0.05 } },
    { id: 'Q2-16', level: 2, slot: 'passive', group: 'Q', name: '金币掠夺', desc: '击杀敌人额外获得 GOLD+5%', effect: { killGold: 0.05 } },
    { id: 'Q2-17', level: 2, slot: 'passive', group: 'Q', name: '能量循环', desc: '每回合回复 HP 1.5%', effect: { regen: 0.015 } },
    { id: 'Q2-18', level: 2, slot: 'passive', group: 'Q', name: '铁血', desc: 'ATK+3%，DEF+2%', effect: { atk: 0.03, def: 0.02 } },
    { id: 'Q2-19', level: 2, slot: 'passive', group: 'Q', name: '疾风', desc: 'AGI+3%，闪避 +1.5%', effect: { agi: 0.03, dodge: 0.015 } },
    { id: 'Q2-20', level: 2, slot: 'passive', group: 'Q', name: '福星', desc: 'GOLD+3%，EXP+3%', effect: { gold: 0.03, exp: 0.03 } }
  ],
  // ========== 高级（等级3） ==========
  3: [
    // 主动主词条 A组
    { id: 'A3-01', level: 3, slot: 'active', group: 'A', name: '圣雷降临', desc: '对敌方造成 ATK×2 伤害', category: '攻击', effect: { type: 'damage', mult: 2.0 } },
    { id: 'A3-02', level: 3, slot: 'active', group: 'A', name: '炽天使之焰', desc: '对敌方附加灼烧，每回合 HP-5%，持续 2 回合', category: '攻击', effect: { type: 'burn', value: 0.05, turns: 2 } },
    { id: 'A3-03', level: 3, slot: 'active', group: 'A', name: '风暴之眼', desc: '自身 AGI+20%，ATK+10%，持续 3 回合', category: '增益', effect: { type: 'agi_atk_buff', agi: 0.20, atk: 0.10, turns: 3 } },
    { id: 'A3-04', level: 3, slot: 'active', group: 'A', name: '龙吼威慑', desc: '自身 ATK+20%，DEF+10%，持续 3 回合', category: '增益', effect: { type: 'atk_def_buff', atk: 0.20, def: 0.10, turns: 3 } },
    { id: 'A3-05', level: 3, slot: 'active', group: 'A', name: '大炼金术', desc: '本场战斗 EXP+15%，GOLD+15%', category: '金币', effect: { type: 'exp_gold_buff', exp: 0.15, gold: 0.15 } },
    // 主动主词条 B组
    { id: 'B3-01', level: 3, slot: 'active', group: 'B', name: '雷霆裂空', desc: 'ATK×1.9，附带 20% 概率眩晕（目标无法行动 1 回合）', category: '攻击/控制', effect: { type: 'damage', mult: 1.9, stun: { chance: 0.20, turns: 1 } } },
    { id: 'B3-02', level: 3, slot: 'active', group: 'B', name: '神圣领域', desc: '自身 DEF+18%，且每回合恢复 HP 3%，持续 3 回合', category: '防御', effect: { type: 'def_regen_buff', def: 0.18, regen: 0.03, turns: 3 } },
    { id: 'B3-03', level: 3, slot: 'active', group: 'B', name: '风暴之怒', desc: 'ATK×1.7，自身 AGI+15% 持续 3 回合', category: '攻击', effect: { type: 'damage', mult: 1.7, agi_buff: 0.15, turns: 3 } },
    { id: 'B3-04', level: 3, slot: 'active', group: 'B', name: '龙骑突袭', desc: 'ATK×1.8，自身暴击率 +10% 持续 3 回合', category: '攻击', effect: { type: 'damage', mult: 1.8, crit_buff: 0.10, turns: 3 } },
    { id: 'B3-05', level: 3, slot: 'active', group: 'B', name: '秘金转化', desc: '本场 EXP+12%，GOLD+12%，且每击杀一名敌人额外 +5%', category: '金币', effect: { type: 'exp_gold_kill', exp: 0.12, gold: 0.12, killBonus: 0.05 } },
    // 被动副词条 P组
    { id: 'P3-01', level: 3, slot: 'passive', group: 'P', name: '力量祝福 III', desc: 'ATK+10%', effect: { atk: 0.10 } },
    { id: 'P3-02', level: 3, slot: 'passive', group: 'P', name: '护甲祝福 III', desc: 'DEF+10%', effect: { def: 0.10 } },
    { id: 'P3-03', level: 3, slot: 'passive', group: 'P', name: '生命祝福 III', desc: 'HP+10%', effect: { hp: 0.10 } },
    { id: 'P3-04', level: 3, slot: 'passive', group: 'P', name: '敏捷祝福 III', desc: 'AGI+10%', effect: { agi: 0.10 } },
    { id: 'P3-05', level: 3, slot: 'passive', group: 'P', name: '经验祝福 III', desc: 'EXP+10%', effect: { exp: 0.10 } },
    { id: 'P3-06', level: 3, slot: 'passive', group: 'P', name: '财富祝福 III', desc: 'GOLD+10%', effect: { gold: 0.10 } },
    { id: 'P3-07', level: 3, slot: 'passive', group: 'P', name: '自愈 III', desc: '每回合回复 HP 3%', effect: { regen: 0.03 } },
    { id: 'P3-08', level: 3, slot: 'passive', group: 'P', name: '铁壁 III', desc: '受到伤害 -5%', effect: { dmgTaken: -0.05 } },
    { id: 'P3-09', level: 3, slot: 'passive', group: 'P', name: '精准 III', desc: '暴击率 +5%', effect: { crit: 0.05 } },
    { id: 'P3-10', level: 3, slot: 'passive', group: 'P', name: '轻灵 III', desc: '闪避率 +5%', effect: { dodge: 0.05 } },
    { id: 'P3-11', level: 3, slot: 'passive', group: 'P', name: '狂气 III', desc: 'ATK+12%，DEF-3%', effect: { atk: 0.12, def: -0.03 } },
    { id: 'P3-12', level: 3, slot: 'passive', group: 'P', name: '稳固体魄 III', desc: 'DEF+10%，HP+5%', effect: { def: 0.10, hp: 0.05 } },
    { id: 'P3-13', level: 3, slot: 'passive', group: 'P', name: '迅捷反应 III', desc: 'AGI+10%，闪避 +3%', effect: { agi: 0.10, dodge: 0.03 } },
    { id: 'P3-14', level: 3, slot: 'passive', group: 'P', name: '贪婪 III', desc: 'GOLD+12%', effect: { gold: 0.12 } },
    { id: 'P3-15', level: 3, slot: 'passive', group: 'P', name: '求知 III', desc: 'EXP+12%', effect: { exp: 0.12 } },
    { id: 'P3-16', level: 3, slot: 'passive', group: 'P', name: '热血 III', desc: 'ATK+10%，暴击 +3%', effect: { atk: 0.10, crit: 0.03 } },
    { id: 'P3-17', level: 3, slot: 'passive', group: 'P', name: '厚皮 III', desc: 'DEF+12%', effect: { def: 0.12 } },
    { id: 'P3-18', level: 3, slot: 'passive', group: 'P', name: '生机 III', desc: 'HP+12%', effect: { hp: 0.12 } },
    { id: 'P3-19', level: 3, slot: 'passive', group: 'P', name: '灵巧 III', desc: 'AGI+12%', effect: { agi: 0.12 } },
    { id: 'P3-20', level: 3, slot: 'passive', group: 'P', name: '活力 III', desc: '每回合回复 HP 4%', effect: { regen: 0.04 } },
    // 被动副词条 Q组
    { id: 'Q3-01', level: 3, slot: 'passive', group: 'Q', name: '攻击增幅 III', desc: 'ATK+9%', effect: { atk: 0.09 } },
    { id: 'Q3-02', level: 3, slot: 'passive', group: 'Q', name: '防御增幅 III', desc: 'DEF+9%', effect: { def: 0.09 } },
    { id: 'Q3-03', level: 3, slot: 'passive', group: 'Q', name: '生命增幅 III', desc: 'HP+9%', effect: { hp: 0.09 } },
    { id: 'Q3-04', level: 3, slot: 'passive', group: 'Q', name: '敏捷增幅 III', desc: 'AGI+9%', effect: { agi: 0.09 } },
    { id: 'Q3-05', level: 3, slot: 'passive', group: 'Q', name: '经验增幅 III', desc: 'EXP+9%', effect: { exp: 0.09 } },
    { id: 'Q3-06', level: 3, slot: 'passive', group: 'Q', name: '金币增幅 III', desc: 'GOLD+9%', effect: { gold: 0.09 } },
    { id: 'Q3-07', level: 3, slot: 'passive', group: 'Q', name: '吸血 III', desc: '伤害的 3% 回血', effect: { lifesteal: 0.03 } },
    { id: 'Q3-08', level: 3, slot: 'passive', group: 'Q', name: '反伤 III', desc: '反弹 3% 伤害', effect: { thorns: 0.03 } },
    { id: 'Q3-09', level: 3, slot: 'passive', group: 'Q', name: '破防 III', desc: '无视 6% DEF', effect: { ignoreDef: 0.06 } },
    { id: 'Q3-10', level: 3, slot: 'passive', group: 'Q', name: '暴击伤害 III', desc: '暴击伤害 +10%', effect: { critDmg: 0.10 } },
    { id: 'Q3-11', level: 3, slot: 'passive', group: 'Q', name: '护盾之躯 III', desc: '每回合获得 HP 2% 护盾', effect: { shieldRegen: 0.02 } },
    { id: 'Q3-12', level: 3, slot: 'passive', group: 'Q', name: '嗜血 III', desc: 'HP<50% 时 ATK+10%', effect: { lowHpAtk: 0.10 } },
    { id: 'Q3-13', level: 3, slot: 'passive', group: 'Q', name: '坚韧 III', desc: 'HP<50% 时 DEF+10%', effect: { lowHpDef: 0.10 } },
    { id: 'Q3-14', level: 3, slot: 'passive', group: 'Q', name: '闪避反击 III', desc: '闪避后 ATK+8%', effect: { dodgeAtk: 0.08 } },
    { id: 'Q3-15', level: 3, slot: 'passive', group: 'Q', name: '经验掠夺 III', desc: '击杀额外 EXP+10%', effect: { killExp: 0.10 } },
    { id: 'Q3-16', level: 3, slot: 'passive', group: 'Q', name: '金币掠夺 III', desc: '击杀额外 GOLD+10%', effect: { killGold: 0.10 } },
    { id: 'Q3-17', level: 3, slot: 'passive', group: 'Q', name: '能量循环 III', desc: '每回合回血 2.5%', effect: { regen: 0.025 } },
    { id: 'Q3-18', level: 3, slot: 'passive', group: 'Q', name: '铁血 III', desc: 'ATK+6%，DEF+4%', effect: { atk: 0.06, def: 0.04 } },
    { id: 'Q3-19', level: 3, slot: 'passive', group: 'Q', name: '疾风 III', desc: 'AGI+6%，闪避 +3%', effect: { agi: 0.06, dodge: 0.03 } },
    { id: 'Q3-20', level: 3, slot: 'passive', group: 'Q', name: '福星 III', desc: 'GOLD+6%，EXP+6%', effect: { gold: 0.06, exp: 0.06 } }
  ],
  // ========== 大师（等级4） ==========
  4: [
    // 主动主词条 A组
    { id: 'A4-01', level: 4, slot: 'active', group: 'A', name: '雷霆万钧', desc: '对敌方造成 ATK×3 伤害，自身暴击 +10% 持续 2 回合', category: '攻击', effect: { type: 'damage', mult: 3.0, crit_buff: 0.10, turns: 2 } },
    { id: 'A4-02', level: 4, slot: 'active', group: 'A', name: '圣光审判', desc: '对敌方造成 ATK×2.5 伤害，自身 HP 恢复 15%', category: '攻击', effect: { type: 'damage', mult: 2.5, heal: 0.15 } },
    { id: 'A4-03', level: 4, slot: 'active', group: 'A', name: '风神之怒', desc: '对敌方造成 ATK×2.5 伤害，自身 AGI+30% 持续 2 回合', category: '攻击', effect: { type: 'damage', mult: 2.5, agi_buff: 0.30, turns: 2 } },
    { id: 'A4-04', level: 4, slot: 'active', group: 'A', name: '血脉狂暴', desc: '自身 ATK+30%，DEF-10%，持续 3 回合', category: '增益', effect: { type: 'atk_def_buff', atk: 0.30, def: -0.10, turns: 3 } },
    { id: 'A4-05', level: 4, slot: 'active', group: 'A', name: '贤者之石', desc: '本场战斗 EXP+20%，GOLD+20%', category: '金币', effect: { type: 'exp_gold_buff', exp: 0.20, gold: 0.20 } },
    // 主动主词条 B组
    { id: 'B4-01', level: 4, slot: 'active', group: 'B', name: '雷神降临', desc: 'ATK×2.8，目标麻痹（AGI-30%）2 回合', category: '攻击/控制', effect: { type: 'damage', mult: 2.8, paralyze: { chance: 1.0, agi: 0.30, turns: 2 } } },
    { id: 'B4-02', level: 4, slot: 'active', group: 'B', name: '大圣光术', desc: 'ATK×2.2，自身恢复 HP 20%，且清除所有负面状态', category: '攻击/恢复', effect: { type: 'damage', mult: 2.2, heal: 0.20, cleanse: true } },
    { id: 'B4-03', level: 4, slot: 'active', group: 'B', name: '风神裂破', desc: 'ATK×2.4，自身 AGI+25% 持续 3 回合，并附加撕裂（每回合 HP-3%）', category: '攻击', effect: { type: 'damage', mult: 2.4, agi_buff: 0.25, turns: 3, bleed: 0.03 } },
    { id: 'B4-04', level: 4, slot: 'active', group: 'B', name: '龙魂觉醒', desc: 'ATK+25%，DEF+15%，持续 3 回合，且免疫一次死亡', category: '增益', effect: { type: 'atk_def_buff', atk: 0.25, def: 0.15, turns: 3, deathImmune: true } },
    { id: 'B4-05', level: 4, slot: 'active', group: 'B', name: '贤者之石·极', desc: '本场 EXP+18%，GOLD+18%，且所有收益再 +5%（乘法）', category: '金币', effect: { type: 'exp_gold_mult', exp: 0.18, gold: 0.18, mult: 0.05 } },
    // 被动副词条 P组
    { id: 'P4-01', level: 4, slot: 'passive', group: 'P', name: '力量祝福 IV', desc: 'ATK+15%', effect: { atk: 0.15 } },
    { id: 'P4-02', level: 4, slot: 'passive', group: 'P', name: '护甲祝福 IV', desc: 'DEF+15%', effect: { def: 0.15 } },
    { id: 'P4-03', level: 4, slot: 'passive', group: 'P', name: '生命祝福 IV', desc: 'HP+15%', effect: { hp: 0.15 } },
    { id: 'P4-04', level: 4, slot: 'passive', group: 'P', name: '敏捷祝福 IV', desc: 'AGI+15%', effect: { agi: 0.15 } },
    { id: 'P4-05', level: 4, slot: 'passive', group: 'P', name: '经验祝福 IV', desc: 'EXP+15%', effect: { exp: 0.15 } },
    { id: 'P4-06', level: 4, slot: 'passive', group: 'P', name: '财富祝福 IV', desc: 'GOLD+15%', effect: { gold: 0.15 } },
    { id: 'P4-07', level: 4, slot: 'passive', group: 'P', name: '自愈 IV', desc: '每回合回复 HP 5%', effect: { regen: 0.05 } },
    { id: 'P4-08', level: 4, slot: 'passive', group: 'P', name: '铁壁 IV', desc: '受到伤害 -10%', effect: { dmgTaken: -0.10 } },
    { id: 'P4-09', level: 4, slot: 'passive', group: 'P', name: '精准 IV', desc: '暴击率 +8%', effect: { crit: 0.08 } },
    { id: 'P4-10', level: 4, slot: 'passive', group: 'P', name: '轻灵 IV', desc: '闪避率 +8%', effect: { dodge: 0.08 } },
    { id: 'P4-11', level: 4, slot: 'passive', group: 'P', name: '狂气 IV', desc: 'ATK+18%，DEF-5%', effect: { atk: 0.18, def: -0.05 } },
    { id: 'P4-12', level: 4, slot: 'passive', group: 'P', name: '稳固体魄 IV', desc: 'DEF+15%，HP+8%', effect: { def: 0.15, hp: 0.08 } },
    { id: 'P4-13', level: 4, slot: 'passive', group: 'P', name: '迅捷反应 IV', desc: 'AGI+15%，闪避 +5%', effect: { agi: 0.15, dodge: 0.05 } },
    { id: 'P4-14', level: 4, slot: 'passive', group: 'P', name: '贪婪 IV', desc: 'GOLD+18%', effect: { gold: 0.18 } },
    { id: 'P4-15', level: 4, slot: 'passive', group: 'P', name: '求知 IV', desc: 'EXP+18%', effect: { exp: 0.18 } },
    { id: 'P4-16', level: 4, slot: 'passive', group: 'P', name: '热血 IV', desc: 'ATK+15%，暴击 +5%', effect: { atk: 0.15, crit: 0.05 } },
    { id: 'P4-17', level: 4, slot: 'passive', group: 'P', name: '厚皮 IV', desc: 'DEF+18%', effect: { def: 0.18 } },
    { id: 'P4-18', level: 4, slot: 'passive', group: 'P', name: '生机 IV', desc: 'HP+18%', effect: { hp: 0.18 } },
    { id: 'P4-19', level: 4, slot: 'passive', group: 'P', name: '灵巧 IV', desc: 'AGI+18%', effect: { agi: 0.18 } },
    { id: 'P4-20', level: 4, slot: 'passive', group: 'P', name: '活力 IV', desc: '每回合回复 HP 6%', effect: { regen: 0.06 } },
    // 被动副词条 Q组
    { id: 'Q4-01', level: 4, slot: 'passive', group: 'Q', name: '攻击增幅 IV', desc: 'ATK+14%', effect: { atk: 0.14 } },
    { id: 'Q4-02', level: 4, slot: 'passive', group: 'Q', name: '防御增幅 IV', desc: 'DEF+14%', effect: { def: 0.14 } },
    { id: 'Q4-03', level: 4, slot: 'passive', group: 'Q', name: '生命增幅 IV', desc: 'HP+14%', effect: { hp: 0.14 } },
    { id: 'Q4-04', level: 4, slot: 'passive', group: 'Q', name: '敏捷增幅 IV', desc: 'AGI+14%', effect: { agi: 0.14 } },
    { id: 'Q4-05', level: 4, slot: 'passive', group: 'Q', name: '经验增幅 IV', desc: 'EXP+14%', effect: { exp: 0.14 } },
    { id: 'Q4-06', level: 4, slot: 'passive', group: 'Q', name: '金币增幅 IV', desc: 'GOLD+14%', effect: { gold: 0.14 } },
    { id: 'Q4-07', level: 4, slot: 'passive', group: 'Q', name: '吸血 IV', desc: '伤害的 5% 回血', effect: { lifesteal: 0.05 } },
    { id: 'Q4-08', level: 4, slot: 'passive', group: 'Q', name: '反伤 IV', desc: '反弹 5% 伤害', effect: { thorns: 0.05 } },
    { id: 'Q4-09', level: 4, slot: 'passive', group: 'Q', name: '破防 IV', desc: '无视 10% DEF', effect: { ignoreDef: 0.10 } },
    { id: 'Q4-10', level: 4, slot: 'passive', group: 'Q', name: '暴击伤害 IV', desc: '暴击伤害 +15%', effect: { critDmg: 0.15 } },
    { id: 'Q4-11', level: 4, slot: 'passive', group: 'Q', name: '护盾之躯 IV', desc: '每回合获得 HP 3% 护盾', effect: { shieldRegen: 0.03 } },
    { id: 'Q4-12', level: 4, slot: 'passive', group: 'Q', name: '嗜血 IV', desc: 'HP<60% 时 ATK+15%', effect: { lowHpAtk: 0.15 } },
    { id: 'Q4-13', level: 4, slot: 'passive', group: 'Q', name: '坚韧 IV', desc: 'HP<60% 时 DEF+15%', effect: { lowHpDef: 0.15 } },
    { id: 'Q4-14', level: 4, slot: 'passive', group: 'Q', name: '闪避反击 IV', desc: '闪避后 ATK+12%', effect: { dodgeAtk: 0.12 } },
    { id: 'Q4-15', level: 4, slot: 'passive', group: 'Q', name: '经验掠夺 IV', desc: '击杀额外 EXP+15%', effect: { killExp: 0.15 } },
    { id: 'Q4-16', level: 4, slot: 'passive', group: 'Q', name: '金币掠夺 IV', desc: '击杀额外 GOLD+15%', effect: { killGold: 0.15 } },
    { id: 'Q4-17', level: 4, slot: 'passive', group: 'Q', name: '能量循环 IV', desc: '每回合回血 4%', effect: { regen: 0.04 } },
    { id: 'Q4-18', level: 4, slot: 'passive', group: 'Q', name: '铁血 IV', desc: 'ATK+9%，DEF+6%', effect: { atk: 0.09, def: 0.06 } },
    { id: 'Q4-19', level: 4, slot: 'passive', group: 'Q', name: '疾风 IV', desc: 'AGI+9%，闪避 +5%', effect: { agi: 0.09, dodge: 0.05 } },
    { id: 'Q4-20', level: 4, slot: 'passive', group: 'Q', name: '福星 IV', desc: 'GOLD+9%，EXP+9%', effect: { gold: 0.09, exp: 0.09 } }
  ]
};

// 力量等阶表
function getStage(level) {
  if (level <= 10) return { name: '凡人', color: '#9d9bb8' };
  if (level <= 30) return { name: '超凡·正式阶', color: '#9d8cf0' };
  if (level <= 60) return { name: '超凡·大师阶', color: '#7c6ef0' };
  if (level <= 100) return { name: '超凡·英雄阶', color: '#6c5ef0' };
  return { name: '传奇', color: '#d4af5e' };
}

// 升级所需经验
function expToNext(level) {
  return Math.floor(50 * Math.pow(level, 1.5));
}

// 生成一件装备实例（uid 走可注入时钟/随机，便于测试 seam）
let _dataNow = () => Date.now();
let _dataRand = Math.random;
function _setDataNow(fn){ _dataNow = fn; }
function _setDataRand(fn){ _dataRand = fn; }
function _resetDataSeams(){ _dataNow = () => Date.now(); _dataRand = Math.random; }
function createEquipItem(templateId) {
  const t = EQUIP_TEMPLATES[templateId];
  if (!t) return null;
  return {
    uid: _dataNow() + '_' + _dataRand().toString(36).substr(2, 6),
    templateId,
    name: t.name,
    slot: t.slot,
    quality: t.quality,
    reqLevel: t.reqLevel,
    stats: { ...t.stats }
  };
}

// 商店物品（可用金币购买）
const SHOP_ITEMS = [
  { id: 'hp_potion', name: '生命药剂', price: 50, desc: '恢复100HP', type: 'consumable' },
  { id: 'mp_potion', name: '法力药剂', price: 50, desc: '恢复50MP', type: 'consumable' },
  { id: 'exp_scroll', name: '经验卷轴', price: 200, desc: '获得500经验', type: 'consumable' },
  { id: 'wooden_spear', name: '木矛', price: 100, desc: '攻击+3', type: 'equip' },
  { id: 'leather_armor', name: '皮甲', price: 150, desc: '防御+5 HP+20', type: 'equip' },
  { id: 'beast_tooth', name: '兽牙吊坠', price: 80, desc: '攻击+2 金币+5%', type: 'equip' }
];

// ====== 种族进化表 ======
const RACE_EVOLUTION = {
 鹰人: {
    name: '鹰人', stage: 0, desc: '凡尘大陆的低等种族，拥有飞行的天赋',
    bonusText: '初始种族，无额外加成',
    nextEvolution: '翼人'
  },
  翼人: {
    name: '翼人', stage: 1, desc: '鹰人进化而成，光属性亲和，拥有更强的飞行能力',
    bonus: { str: 5, con: 5, spi: 10, agi: 10, cha: 10 },
    bonusText: '全属性+5~10，光属性亲和',
    reqLevel: 30,
    reqMaterial: { name: '天使之羽', count: 1 },
    nextEvolution: '天使'
  },
  天使: {
    name: '天使', stage: 2, desc: '翼人的终极进化形态，神圣属性的化身',
    bonus: { str: 20, con: 20, spi: 30, agi: 20, cha: 30 },
    bonusText: '全属性大幅提升，神圣属性，经验+20%',
    reqLevel: 80,
    reqMaterial: { name: '光明晶', count: 5 },
    nextEvolution: null
  }
};

// ====== 附魔配方表 ======
// 消耗材料+金币给装备附加额外属性
const ENCHANT_RECIPES = [
  { id: 'atk_enchant', name: '攻击附魔', desc: '装备攻击+5', slot: 'weapon',
    cost: 200, materials: [{ name: '青铜矿', count: 3 }], bonus: { atk: 5 } },
  { id: 'def_enchant', name: '防御附魔', desc: '装备防御+5', slot: 'armor',
    cost: 200, materials: [{ name: '铁矿', count: 3 }], bonus: { def: 5 } },
  { id: 'hp_enchant', name: '生命附魔', desc: '装备HP+50', slot: 'armor',
    cost: 300, materials: [{ name: '草药', count: 5 }], bonus: { hp: 50 } },
  { id: 'str_enchant', name: '力量附魔', desc: '装备力量+3', slot: 'weapon',
    cost: 500, materials: [{ name: '飞龙鳞片', count: 2 }], bonus: { str: 3 } },
  { id: 'spi_enchant', name: '精神附魔', desc: '装备精神+3', slot: 'accessory',
    cost: 500, materials: [{ name: '海灵石', count: 2 }], bonus: { spi: 3 } },
  { id: 'agi_enchant', name: '敏捷附魔', desc: '装备敏捷+3', slot: 'accessory',
    cost: 500, materials: [{ name: '风羽玉露', count: 2 }], bonus: { agi: 3 } },
  { id: 'exp_enchant', name: '经验附魔', desc: '经验获取+10%', slot: 'accessory',
    cost: 1000, materials: [{ name: '附魔卷轴', count: 1 }], bonus: { exp: 0.10 } },
  { id: 'gold_enchant', name: '贪婪附魔', desc: '金币获取+15%', slot: 'weapon',
    cost: 1000, materials: [{ name: '炼金材料', count: 3 }], bonus: { gold: 0.15 } },
  { id: 'legend_atk', name: '传说·破灭', desc: '攻击+20 力量+10', slot: 'weapon',
    cost: 5000, materials: [{ name: '龙血', count: 1 }, { name: '附魔卷轴', count: 3 }], bonus: { atk: 20, str: 10 } },
  { id: 'legend_def', name: '传说·不朽', desc: '防御+20 体质+10 HP+200', slot: 'armor',
    cost: 5000, materials: [{ name: '龙鳞', count: 2 }, { name: '附魔卷轴', count: 3 }], bonus: { def: 20, con: 10, hp: 200 } }
];
const MAX_ENCHANT_SLOTS = 3;

// ====== 法则系统 ======
// Lv.100+解锁，消耗法则碎片学习法则，获得被动加成
const LAWS = [
  { id: 'law_destruction', name: '破坏法则', desc: '理解破坏的本质，伤害+15%',
    reqLevel: 100, cost: { name: '法则碎片', count: 5 }, bonus: { damage: 0.15 } },
  { id: 'law_guardian', name: '守护法则', desc: '理解守护的意义，减伤+15%',
    reqLevel: 100, cost: { name: '法则碎片', count: 5 }, bonus: { defense: 0.15 } },
  { id: 'law_spacetime', name: '时空法则', desc: '触及时间与空间，经验+25%',
    reqLevel: 105, cost: { name: '法则碎片', count: 8 }, bonus: { exp: 0.25 } },
  { id: 'law_life', name: '生命法则', desc: '领悟生命真谛，自动回血+10%',
    reqLevel: 105, cost: { name: '法则碎片', count: 8 }, bonus: { heal: 0.10 } },
  { id: 'law_wealth', name: '财富法则', desc: '万物皆有价，金币+30%',
    reqLevel: 110, cost: { name: '法则碎片', count: 10 }, bonus: { gold: 0.30 } },
  { id: 'law_annihilation', name: '湮灭法则', desc: '终极法则，全属性加成10%',
    reqLevel: 120, cost: { name: '法则碎片', count: 20 }, bonus: { allAttr: 0.10 } }
];

// ====== 登神系统 ======
// 半神→神灵的进阶
const ASCENSION = {
  demigod: {
    name: '半神', reqLevel: 100,
    reqAttr: 50,
    reqLaws: 3,
    desc: '凝聚法则之心，踏入半神领域。全属性+50，HP/MP翻倍',
    bonus: { atk: 50, def: 50, hp: 50, agi: 50 },
    bonusText: '全属性+50，HP/MP上限×2'
  },
  god: {
    name: '神灵', reqLevel: 120,
    reqAttr: 100,
    reqLaws: 5,
    reqFaith: 5000,
    desc: '点燃神火，登临神座。全属性+200，获得神威特性',
    bonus: { atk: 200, def: 200, hp: 200, agi: 200 },
    bonusText: '全属性+200，解锁信仰系统'
  }
};

// 材料出售价格表
const MATERIAL_PRICES = {
  '兽皮': 5, '石矛': 10, '草药': 8, '兽骨': 5, '青铜矿': 12,
  '泰坦之血碎片': 50, '飞龙鳞片': 30,
  '海灵石': 40, '铁矿': 15, '深海水晶': 60,
  '风羽玉露': 80, '光明晶': 100, '天使之羽': 200,
  '附魔卷轴': 150, '炼金材料': 80,
  '龙鳞': 300, '龙血': 500,
  '法则碎片': 1000, '深渊之石': 800
};

// 装备出售价格（按品质）
const EQUIP_SELL_PRICES = { normal: 20, fine: 80, epic: 300, legend: 1500 };

// ====== 战斗策略（T-004 单一数据源） ======
const STRATEGIES = {
  aggressive: { name: '全力进攻', desc: 'ATK+15% DEF-10%', reqLevel: 1, effects: { atk: 0.15, def: -0.10 } },
  defensive: { name: '稳健防守', desc: 'DEF+15% ATK-10% 回复+50%', reqLevel: 1, effects: { def: 0.15, atk: -0.10, regen: 0.50 } },
  balanced: { name: '平衡', desc: '无加成', reqLevel: 1, effects: {} },
  greedy: { name: '贪婪掠夺', desc: 'GOLD+30% EXP-20% 掉落+5%', reqLevel: 20, effects: { gold: 0.30, exp: -0.20, drop: 0.05 } },
  desperate: { name: '背水一战', desc: 'ATK+40% DEF-30% 低血再+20%', reqLevel: 40, effects: { atk: 0.40, def: -0.30, desperateAtk: 0.20, hpThreshold: 0.30 } },
  training: { name: '极限修炼', desc: 'EXP+50% GOLD-50% 怪物ATK+20%', reqLevel: 60, effects: { exp: 0.50, gold: -0.50, monsterAtk: 0.20 } }
};
const STRATEGY_CD_MS = 5 * 60 * 1000;

module.exports = {
  AREAS, EQUIP_TEMPLATES, QUALITY_COLORS, JOB_TREE, SHOP_ITEMS,
  MATERIAL_PRICES, EQUIP_SELL_PRICES,
  RACE_EVOLUTION, ENCHANT_RECIPES, MAX_ENCHANT_SLOTS, LAWS, ASCENSION,
  MONSTER_SKILLS,
  AFFIX_LEVELS, AFFIX_TREE,
  STRATEGIES, STRATEGY_CD_MS,
  getStage, expToNext, createEquipItem,
  _setDataNow, _setDataRand, _resetDataSeams
};
