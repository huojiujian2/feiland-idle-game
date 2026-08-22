// ====== 职业进阶树 ======
// @file data/jobs
// @module data-jobs
// @description 5 大职业（雷霆/光明/风行/骑士/炼金）的成长系数、被动天赋、进阶机制、阶段

const JOB_TREE = {
  thunder: {
    id: 'thunder', name: '雷霆系', desc: '雷霆属性，高爆发高机动。主角姜尤所走之路', icon: 'bolt',
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
    id: 'light', name: '光明系', desc: '光属性，攻防一体，附带治愈能力', icon: 'sparkle',
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
    id: 'wind', name: '风行系', desc: '风属性，速度极快，侦察游击', icon: 'sparkle',
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
    id: 'knight', name: '骑士系', desc: '骑乘战斗，冲锋陷阵，地精传承', icon: 'shield',
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
    id: 'alchemy', name: '炼金系', desc: '生产辅助，制造药剂与附魔装备', icon: 'scroll',
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

module.exports = { JOB_TREE };
