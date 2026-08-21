// 内联 SVG 图标库（费兰德世界 - 暗黑奇幻主题）
// 所有图标 viewBox=0 0 24 24，描边色用 currentColor，由父容器控制颜色。

export const ICONS = {
  // ============ 资源 / 货币 ============
  gold: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M6 3h12l3 5-3 5v3l3 5-3 5H6l-3-5 3-5V8L3 8z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
      '<circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      '<path d="M12 11.8v-2M10.5 14h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'
    ]
  },
  gem: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M6 9l3-5h6l3 5-6 11z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
      '<path d="M6 9h12M9 9l3 11 3-11" fill="none" stroke="currentColor" stroke-width="1.4"/>'
    ]
  },

  // ============ 战斗 / 装备 / 属性 ============
  sword: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M14.5 4l5.5.5L19 9l-3-1-7 7-2-2 7-7-1-3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
      '<path d="M7 13l-3 3 4 4 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
    ]
  },
  shield: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M12 3l8 2.5v6c0 4.5-3.3 8-8 9.5-4.7-1.5-8-5-8-9.5v-6z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
      '<path d="M9 11.5l2.2 2.2L15.5 9.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
    ]
  },
  heart: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M12 19.5C7 16.5 3 13 3 9.2 3 6.5 5.1 4 7.8 4c1.7 0 3.3.8 4.2 2.4C12.9 4.8 14.5 4 16.2 4 18.9 4 21 6.5 21 9.2c0 3.8-4 7.3-9 10.3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
    ]
  },
  bolt: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M13 3L5 13h5l-1 8 8-10h-5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>'
    ]
  },
  feather: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M20 5c-7 0-13 5-13 12-1 1-2 2-2 4l3-1c2-7 7-11 12-12z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
      '<path d="M9 17l-3 3M11 14l-4 4M14 11l-5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'
    ]
  },
  skull: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M6 12c0-4 2.7-7 6-7s6 3 6 7v4l-1 1.5h-1V19h-2v-1H10v1H8v-1.5H7L6 16z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
      '<circle cx="9.5" cy="11.5" r="1.1" fill="currentColor"/><circle cx="14.5" cy="11.5" r="1.1" fill="currentColor"/>'
    ]
  },

  // ============ 导航 / Tab ============
  user: {
    viewBox: '0 0 24 24',
    paths: [
      '<circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/>',
      '<path d="M5 20c.5-3.5 3.5-6 7-6s6.5 2.5 7 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
    ]
  },
  bag: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M5 8h14l-1 12H6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
      '<path d="M9 8V6a3 3 0 016 0v2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
    ]
  },
  map: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M3 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
      '<path d="M8 4v14M14 6v14" stroke="currentColor" stroke-width="1.4"/>'
    ]
  },
  skill: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
      '<circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/>'
    ]
  },
  star: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M12 3l2.6 5.6 6.2.7-4.6 4.3 1.3 6.2L12 16.8 6.5 19.8l1.3-6.2L3.2 9.3l6.2-.7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
    ]
  },
  scroll: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M6 4h11a3 3 0 013 3v10a3 3 0 01-3 3H6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
      '<path d="M6 4a2 2 0 100 4h11v-1a3 3 0 00-3-3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
      '<path d="M9 11h6M9 14h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
    ]
  },
  crossedSwords: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M5 19l3-3M16 4l5 5-7 7-3-3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
      '<path d="M19 19l-3-3M8 4l-5 5 7 7 3-3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
      '<circle cx="12" cy="12" r="1.8" fill="currentColor"/>'
    ]
  },
  book: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M5 4h7v16H5zM12 4h7v16h-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
      '<path d="M7 7h3M7 10h3M14 7h3M14 10h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'
    ]
  },
  trophy: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M7 4h10v4a5 5 0 01-10 0z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
      '<path d="M5 4H3v2a3 3 0 003 3M19 4h2v2a3 3 0 01-3 3" fill="none" stroke="currentColor" stroke-width="1.4"/>',
      '<path d="M9 14h6v3H9zM7 19h10v1.5H7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
    ]
  },
  dna: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M6 3c3 4 9 4 12 0v6c-3 4-9 4-12 0z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
      '<path d="M6 15c3 4 9 4 12 0v6c-3 4-9 4-12 0z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
      '<path d="M8.5 6h7M8.5 18h7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>'
    ]
  },
  flag: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M6 21V4l9 3 4-1v8l-4 1-9-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
    ]
  },

  // ============ 操作 / 状态 ============
  shop: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M4 8h16l-1.4 11a2 2 0 01-2 1.7H7.4a2 2 0 01-2-1.7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
      '<path d="M9 8V6a3 3 0 016 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/>'
    ]
  },
  logout: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M14 7V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2h6a2 2 0 002-2v-2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
      '<path d="M20 12H10M16 8l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
    ]
  },
  chevronRight: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
    ]
  },
  close: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
    ]
  },
  plus: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
    ]
  },
  minus: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
    ]
  },
  sparkle: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" fill="currentColor"/>',
      '<path d="M19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7z" fill="currentColor"/>'
    ]
  },
  confirm: {
    viewBox: '0 0 24 24',
    paths: [
      '<path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
    ]
  }
}
