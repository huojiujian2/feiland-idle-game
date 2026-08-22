// ====== 词条库 4 级（大师）=====
// @file data/affixes/master
// @module data-affixes-master
// @description 词条等级 4（大师）下的所有词条：10 主动 + 40 被动

const AFFIX_TREE_4 = [
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
;

module.exports = { AFFIX_TREE_4 };
