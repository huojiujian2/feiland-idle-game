// ====== 通用工具函数 ======
const { getRand, getDropRand, genUid } = require('./state');
const { STRATEGIES, ACTIVE_SKILL_CD } = require('../data');

function shouldDrop(rate, strategy) {
  const dropBonus = (STRATEGIES[strategy]?.effects?.drop) || 0;
  const eff = rate * (1 + dropBonus);
  return getDropRand()() < eff;
}

function buildBattleMonster(monster, strategy) {
  const atkBonus = (STRATEGIES[strategy]?.effects?.monsterAtk) || 0;
  if (atkBonus) return { ...monster, atk: Math.floor(monster.atk * (1 + atkBonus)) };
  return { ...monster };
}

function getActiveSkillCd(level) {
  return ACTIVE_SKILL_CD[level] || 5;
}

function shouldTriggerActiveSkill(round, cd) {
  return round % cd === 0;
}

module.exports = {
  shouldDrop,
  buildBattleMonster,
  getActiveSkillCd,
  shouldTriggerActiveSkill,
  genUid,
};
