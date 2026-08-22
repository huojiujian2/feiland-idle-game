// ====== 战斗日志工具函数 ======
// @file components/map/battleLogUtils
// @module battle-log-utils
// @description 战斗日志渲染相关的纯函数：动词库、怪物类型、评级、连击处理

// 动词库
const VERBS = {
  high: ['粉碎', '湮灭', '碾压', '暴轰', '撕裂虚空'],
  mid: ['重击', '撕裂', '贯穿', '猛劈', '直击'],
  low: ['轻击', '擦伤', '划过', '掠过', '弹击'],
  dodge: ['侧身躲过', '残影规避', '相位穿梭', '飘然闪开', '鬼魅般避开'],
  monsterGeneric: ['猛击', '挥击', '扑袭', '冲撞', '挥爪'],
};
const MONSTER_TYPES = {
  dragon:   { match: ['龙'], verbs: ['龙息', '龙威', '甩尾', '利爪撕扯', '翼击'] },
  beast:    { match: ['狼', '熊', '蜥', '蛇', '兔', '猪', '虫', '蛛'], verbs: ['撕咬', '爪击', '扑袭', '冲撞', '尾鞭'] },
  machine:  { match: ['傀儡', '蒸汽', '地精', '机械', '魔像'], verbs: ['激光扫射', '过载冲击', '机械臂击', '齿轮碾压'] },
  undead:   { match: ['魔', '暗', '虚空', '深渊', '亡', '骷髅', '僵尸', '怨', '灵'], verbs: ['魂噬', '诅咒', '冰冷触摸', '暗影斩', '亡灵侵蚀'] },
  elemental:{ match: ['火', '水', '雷', '风', '冰', '岩', '光'], verbs: ['元素冲击', '能量爆发', '属性湮灭', '自然之力'] },
};
const ROUND_THEMES = ['试探交锋', '战意升腾', '鏖战正酣', '生死搏杀', '终极对决', '最后碰撞'];

function pick(arr, seed) { return arr[Math.abs(seed) % arr.length]; }

function getDamageVerb(damage, targetMaxHp, seed = 0) {
  const ratio = damage / Math.max(1, targetMaxHp);
  if (ratio > 0.3) return pick(VERBS.high, seed);
  if (ratio > 0.1) return pick(VERBS.mid, seed);
  return pick(VERBS.low, seed);
}

function getDodgeVerb(seed = 0) { return pick(VERBS.dodge, seed); }

function getMonsterVerb(monsterName, seed = 0) {
  for (const type of Object.values(MONSTER_TYPES)) {
    if (type.match.some(k => monsterName.includes(k))) return pick(type.verbs, seed);
  }
  return pick(VERBS.monsterGeneric, seed);
}

function roundTheme(round, ri) {
  if (round.pActions >= 3) return '疾风连击';
  if (round.round >= 25) return '生死搏杀';
  if (ri === 0 && round.round === 1) return '雷霆之怒';
  return pick(ROUND_THEMES, ri + round.round);
}

function ratingLetter(log) {
  if (log.result === 'win' && log.rounds <= 5) return 'S';
  if (log.result === 'win' && log.rounds <= 15) return 'A';
  if (log.result === 'win') return 'B';
  return 'C';
}
function ratingDesc(log) {
  return { S: '摧枯拉朽！', A: '稳扎稳打', B: '苦战获胜', C: '险象环生' }[ratingLetter(log)];
}
function ratingClass(log) { return 'rating-' + ratingLetter(log).toLowerCase(); }
function resultText(result) { return ({ win: '胜利', lose: '战败', timeout: '超时' })[result] || result; }

// 连击处理（仅主动/普通 damage 进入 combo，passive 不计）
function processActions(actions) {
  const result = [];
  let combo = [];

  function flushCombo() {
    if (!combo.length) return;
    if (combo.length >= 2) {
      result.push({ isCombo: true, hits: [...combo], totalDamage: combo.reduce((s, a) => s + (a.damage || 0), 0) });
    } else {
      result.push(combo[0]);
    }
    combo = [];
  }

  for (const act of actions) {
    if (act.actor === 'player' && act.damage !== undefined && !act.dodge && act.type !== 'passive') {
      combo.push(act);
    } else {
      flushCombo();
      result.push(act);
    }
  }
  flushCombo();
  return result;
}

function actionClass(item) {
  if (item.type === 'skill') return 'skill-action';
  if (item.type === 'passive') {
    if (item.source === 'dodgeAtk') return 'player-dmg';
    if (item.source === 'deathShield') return 'player-shield';
    if (item.source === 'revive') return 'player-revive';
    if (item.shield) return 'player-shield';
    if (item.revive) return 'player-revive';
  }
  if (item.actor === 'player') {
    if (item.damage !== undefined && !item.dodge) return 'player-dmg';
    if (item.heal !== undefined) return 'player-heal';
    if (item.buff !== undefined) return 'player-buff';
    if (item.dodge) return 'player-dodge';
  }
  if (item.actor === 'monster') return 'monster-dmg';
  return '';
}

function maxDamage(log) {
  if (!log.detail) return 0;
  let max = 0;
  for (const r of log.detail) {
    for (const a of (r.actions || [])) {
      if (a.damage !== undefined && a.damage > max) max = a.damage;
    }
  }
  return max;
}

function maxCombo(log) {
  if (!log.detail) return 0;
  let max = 0;
  for (const r of log.detail) {
    const cmbs = processActions(r.actions || []);
    for (const c of cmbs) {
      if (c.isCombo && c.hits.length > max) max = c.hits.length;
    }
  }
  return max;
}

function dodgeCount(log) {
  if (!log.detail) return 0;
  let count = 0;
  for (const r of log.detail) {
    for (const a of (r.actions || [])) {
      if (a.dodge) count++;
    }
  }
  return count;
}

function pct(cur, max) { return Math.max(0, Math.min(100, Math.round(cur / Math.max(1, max) * 100))); }

function dropQuality(name) {
  if (!name) return 'normal';
  if (name.includes('传说')) return 'legend';
  if (name.includes('史诗')) return 'epic';
  if (name.includes('精良')) return 'fine';
  return 'normal';
}

export {
  VERBS, MONSTER_TYPES, ROUND_THEMES,
  pick, getDamageVerb, getDodgeVerb, getMonsterVerb,
  roundTheme, ratingLetter, ratingDesc, ratingClass, resultText,
  processActions, actionClass, maxDamage, maxCombo, dodgeCount, pct, dropQuality,
};
