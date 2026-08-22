// ====== 词条统一入口 ======
// @file data/affixes/index
// @module data-affixes
// @description 词条等级配置 + 4 级词条库（每级 10 主动 + 40 被动）
//
// 本文件结构：
// 1. 等级配置 AFFIX_LEVELS（L1-L4 元信息）
// 2. 词条库 AFFIX_TREE 汇总（各等级 require 子模块）

const AFFIX_LEVELS = {
  1: { name: '初级', icon: 'star', color: '#9d9bb8', reqLevel: 1 },
  2: { name: '中级', icon: 'plus', color: '#5eda7a', reqLevel: 31 },
  3: { name: '高级', icon: 'sparkle', color: '#9d8cf0', reqLevel: 61 },
  4: { name: '大师', icon: 'gem', color: '#d4af5e', reqLevel: 100 }
};

const AFFIX_TREE = {
  1: require('./novice').AFFIX_TREE_1,
  2: require('./intermediate').AFFIX_TREE_2,
  3: require('./advanced').AFFIX_TREE_3,
  4: require('./master').AFFIX_TREE_4,
};

module.exports = { AFFIX_LEVELS, AFFIX_TREE };
