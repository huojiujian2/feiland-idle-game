// ====== 词条库 2 级（中级）=====
// @file data/affixes/intermediate
// @module data-affixes-intermediate
// @description 词条等级 2（中级）下的所有词条：10 主动 + 40 被动

const AFFIX_TREE_2 = [
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
  ]
;

module.exports = { AFFIX_TREE_2 };
