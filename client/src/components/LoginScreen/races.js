// ====== 创世三族试听数据 ======
// @file components/LoginScreen/races
// @module login-screen-races
// @description 鹰人 / 翼人 / 天使 三族试听数据 —— 与文档 01-gameplay.md / 03-areas-and-equipment.md 一致
//              当前版本"建角色"永远落档鹰人，翼人/天使只能预览
export const races = [
  {
    id: 'eagle',
    name: '鹰人',
    tier: '起始血脉 · Lv.1',
    icon: 'feather',
    portrait: '/img/race-eagle.jpg',
    glyph: '⟁',
    poem: '「生于绝壁，长于风暴——翼未丰，心已远」',
    note: '凡尘大陆的低等种族，拥有飞行的天赋',
  },
  {
    id: 'winged',
    name: '翼人',
    tier: '进化形态 · Lv.30',
    icon: 'sparkle',
    portrait: '/img/race-winged.jpg',
    glyph: '⌬',
    poem: '「羽化登天，光在翼尖——夜为黎明之桥」',
    note: '受天使之羽祝福，凡俗与神圣之间的过渡血脉',
  },
  {
    id: 'angel',
    name: '天使',
    tier: '终末形态 · Lv.80',
    icon: 'book',
    portrait: '/img/race-angel.jpg',
    glyph: '✶',
    poem: '「光铸其身，律法其声——万界回响，皆为圣名」',
    note: '觉醒后属性剧增，可学习六大法则',
  },
];
