// ====== 词条库 3 级（高级）=====
// @file data/affixes/advanced
// @module data-affixes-advanced
// @description 词条等级 3（高级）下的所有词条：10 主动 + 40 被动

const AFFIX_TREE_3 = [
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
  ]
;

module.exports = { AFFIX_TREE_3 };
