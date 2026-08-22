// ====== 怪物技能模板 + 怪物工具 ======
// @file data/monsters
// @module data-monsters
// @description 怪物技能配置和工具函数

// 怪物技能模板（key = skillId）
const MONSTER_SKILLS = {
  bite:        { name: '撕咬',     chance: 0.25, mult: 1.5, desc: '凶猛撕咬' },
  charge:      { name: '冲撞',     chance: 0.20, mult: 1.4, desc: '全力冲撞' },
  claw:        { name: '利爪',     chance: 0.20, mult: 1.3, desc: '利爪撕裂' },
  roar:        { name: '咆哮',     chance: 0.15, mult: 1.6, desc: '震慑咆哮' },
  magic_bolt:  { name: '魔力冲击', chance: 0.15, mult: 1.8, desc: '魔法弹' },
  poison:      { name: '毒液',     chance: 0.18, mult: 1.3, desc: '喷吐毒液' },
  tail_sweep:  { name: '尾扫',     chance: 0.20, mult: 1.4, desc: '巨尾横扫' },
  fire_breath: { name: '龙息',     chance: 0.12, mult: 2.0, desc: '烈焰吐息' },
  ice_breath:  { name: '冰息',     chance: 0.12, mult: 1.8, desc: '极寒吐息' },
  dark_slash:  { name: '暗影斩',   chance: 0.18, mult: 1.7, desc: '暗影斩击' },
  void_tear:   { name: '虚空撕裂', chance: 0.10, mult: 2.5, desc: '撕裂空间' },
  soul_drain:  { name: '灵魂吞噬', chance: 0.08, mult: 2.2, desc: '吞噬灵魂' },
  steam_blast: { name: '蒸汽爆破', chance: 0.15, mult: 1.6, desc: '蒸汽爆炸' },
  holy_smite:  { name: '圣光击',   chance: 0.15, mult: 1.7, desc: '光属性打击' },
  serpent_bite:{ name: '蛇毒噬咬', chance: 0.22, mult: 1.5, desc: '蛇毒噬咬' },
  wing_blade:  { name: '翼刃斩',   chance: 0.18, mult: 1.6, desc: '翼羽如刃' },
  // 高阶新技能
  void_nova:    { name: '虚空新星',   chance: 0.08, mult: 2.8, desc: '以自身为中心的虚空爆破' },
  time_stop:    { name: '时间停止',   chance: 0.06, mult: 3.0, desc: '冻结时空后全力一击' },
  star_arrow:   { name: '星辰箭',     chance: 0.10, mult: 2.4, desc: '凝聚星光的箭矢' },
  god_smash:    { name: '神怒一击',   chance: 0.05, mult: 3.5, desc: '诸神愤怒的一击' },
  element_storm:{ name: '元素风暴',   chance: 0.08, mult: 2.6, desc: '召唤元素乱流' },
  divine_judgment:{ name:'神圣审判', chance: 0.07, mult: 3.2, desc: '神的审判之光' },
  soul_split:   { name: '灵魂分裂',   chance: 0.10, mult: 2.3, desc: '分裂灵魂攻击' },
  realm_rift:   { name: '界域崩裂',   chance: 0.06, mult: 3.0, desc: '撕裂位面界限' },
};

module.exports = { MONSTER_SKILLS };
