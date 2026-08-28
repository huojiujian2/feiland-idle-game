// ====== 角色页共享字典 ======
// @file components/character/labels
// @module character-labels
// @description 装备槽位 / 品质 / 属性 / 成长 4 个 label 字典，3 个子组件共用，避免重复

export const slots = [
  { key: 'weapon', label: '武器', iconName: 'sword' },
  { key: 'armor', label: '护甲', iconName: 'shield' },
  { key: 'accessory', label: '饰品', iconName: 'gem' },
];

export const qualityColors = {
  normal: '#9d9bb8',
  fine:   '#5eda7a',
  epic:   '#9d8cf0',
  legend: '#d4af5e',
  mythic: '#ff6738',
};

export const qualityLabels = {
  normal: '普通',
  fine:   '精良',
  epic:   '史诗',
  legend: '传说',
  mythic: '神话',
};

export const statLabels = {
  atk: '攻击',
  def: '防御',
  hp:  'HP',
  mp:  'MP',
  str: '力量',
  con: '体质',
  spi: '精神',
  agi: '敏捷',
  cha: '魅力',
  exp: '经验',
  gold: '金币',
};

export const slotLabels = {
  weapon: '武器',
  armor: '护甲',
  accessory: '饰品',
};

export const growthLabels = {
  hp: '生命',
  atk: '攻击',
  def: '防御',
  agi: '敏捷',
  exp: '经验',
  gold: '金币',
};

export const attrList = [
  { key: 'atk', label: '攻击', totalKey: 'atk' },
  { key: 'def', label: '防御', totalKey: 'def' },
  { key: 'hp',  label: '生命', totalKey: 'hp'  },
  { key: 'agi', label: '敏捷', totalKey: 'agi' },
];

export const jobIcons = {
  thunder:  '⚡',
  light:    '✶',
  wind:     '✦',
  knight:   '⚔',
  alchemy:  '✺',
};

export const FREE_ATTR_MAX = 30;       // 总自由点上限
export const FREE_ATTR_PER_KEY = 30;   // 单项自由点上限
export const PRESET_SLOTS = 3;          // 预设槽位数
