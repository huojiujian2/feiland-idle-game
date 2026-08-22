// ====== 词条库 1 级（初级）=====
// @file data/affixes/novice
// @module data-affixes-novice
// @description 词条等级 1（初级）下的所有词条：10 主动 + 40 被动

const AFFIX_TREE_1 = [
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
  ]
;

module.exports = { AFFIX_TREE_1 };
