// ====== 灵鸡斗场：静态数据 ======
// 完全独立玩法：不消耗主游戏任何资源，唯一产出斗鸡积分（仅换外观称号）
// 每局从 8 只固定灵鸡中随机出 6 只，押注冠军（擂台赛 1v1 逐场 5 回合）

// 8 只灵鸡（3 条文字线索 + 5 项隐藏数值）
const CHICKENS = [
  { id: 'chi_feather', name: '赤羽烈火鸡', clues: ['羽毛倒竖', '眼神凌厉', '不停扑翅'], atk: 1.3, def: 0.8, spd: 1.0, hp: 100, crit: 0.10 },
  { id: 'chi_ice',     name: '玄冰铁爪鸡', clues: ['缩成一团', '闭目养神', '爪上有霜'], atk: 0.9, def: 1.5, spd: 0.7, hp: 120, crit: 0.05 },
  { id: 'chi_wind',    name: '青风灵雉',   clues: ['来回踱步', '脚步无声', '偶尔轻鸣'], atk: 0.7, def: 0.9, spd: 1.5, hp: 90,  crit: 0.15 },
  { id: 'chi_stone',   name: '金喙石敢当', clues: ['纹丝不动', '喙带血迹', '目光呆滞'], atk: 1.1, def: 1.2, spd: 0.6, hp: 110, crit: 0.40 },
  { id: 'chi_crane',   name: '银羽白鹤',   clues: ['昂首挺胸', '羽毛光亮', '鸣声清亮'], atk: 1.0, def: 1.0, spd: 1.1, hp: 100, crit: 0.10 },
  { id: 'chi_purple',  name: '紫冠铁嘴',   clues: ['低头刨地', '时不时抬头', '冠子发紫'], atk: 1.4, def: 0.7, spd: 1.0, hp: 95, crit: 0.20 },
  { id: 'chi_raven',   name: '黑风玄鸦',   clues: ['缩在阴影里', '偶尔低鸣', '眼神狡黠'], atk: 0.8, def: 1.1, spd: 1.4, hp: 85,  crit: 0.25 },
  { id: 'chi_phoenix', name: '金羽凤凰雏', clues: ['羽毛泛金光', '昂首傲立', '鸣声嘹亮'], atk: 1.2, def: 0.9, spd: 1.2, hp: 100, crit: 0.20 },
];

// 玩法参数
const COCKFIGHT_RULES = {
  DAILY_LIMIT: 20,       // 每日参赛次数
  ROUNDS_PER_DUEL: 5,    // 每场对决回合数
  BONUS_EVERY: 3,        // 连胜每 3 局额外 +1 分
  MANIAC_GAMES: 250,     // 累计参与 → 斗鸡狂魔
  LOSE_STREAK_MSG: 5,    // 连错 5 局 → 安慰文案
  CRIT_MULT: 2,          // 暴击伤害倍率
  BASE_DAMAGE: 20,       // 伤害 = 攻击 × 20 + 波动(-3~+3)
};

// 临场干预
const COCKFIGHT_INTERVENTIONS = [
  { id: 'feed',      label: '🍗 投喂仙豆', desc: '你押的鸡 攻击力 ×1.3（无风险）' },
  { id: 'caltrops',  label: '🧊 撒铁蒺藜', desc: '随机一只对手鸡 速度 ×0.6（30% 被发现：你的鸡速度 ×0.6）' },
  { id: 'provoke',   label: '🩸 激将法',   desc: '你押的鸡 暴击率 +50%（若本局输了，下局强制换掉这只鸡）' },
];

// 斗鸡称号（key 与 data/titles.js COCKFIGHT_TITLES 对应）
//   cost: 兑换所需积分；hidden: 隐藏称号；achievement: 成就自动获得（不可兑换）
const COCKFIGHT_TITLES = {
  cock_newbie: { key: 'cock_newbie', name: '斗鸡新人', cost: 5,  desc: '灵鸡斗场积分兑换（永久）' },
  cock_knight: { key: 'cock_knight', name: '灵鸡骑士', cost: 15, desc: '灵鸡斗场积分兑换（永久）' },
  cock_slayer: { key: 'cock_slayer', name: '百鸡斩',   cost: 30, desc: '灵鸡斗场积分兑换（永久）' },
  cock_saint:  { key: 'cock_saint',  name: '斗战圣鸡', cost: 50, desc: '灵鸡斗场积分兑换（永久）' },
  cock_king:   { key: 'cock_king',   name: '万鸡之王', cost: 80, hidden: true, desc: '灵鸡斗场积分兑换（永久）' },
  cock_maniac: { key: 'cock_maniac', name: '斗鸡狂魔', achievement: true, desc: '灵鸡斗场累计参与 250 局成就（永久）' },
};

module.exports = { CHICKENS, COCKFIGHT_RULES, COCKFIGHT_INTERVENTIONS, COCKFIGHT_TITLES };
