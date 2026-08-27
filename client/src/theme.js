// ====== v2.9 换肤系统：主题管理（纯前端，不涉及后端数值） ======
// 主题通过 html 标签的 data-theme 属性切换，themes.css 提供样式定义

const THEME_KEY = 'ferland-theme';

// colors 用于设置弹窗里的色卡预览：[背景, 面板, 强调, 次强调]
export const THEMES = [
  {
    key: 'default',
    name: '原·星夜风',
    desc: '紫夜城堡 · 金紫辉光（默认）',
    colors: ['#0a0b14', '#1c1e36', '#9d8cf0', '#d4af5e'],
  },
  {
    key: 'dark-gold',
    name: '暗金风',
    desc: '玄黑鎏金 · 熔金脉络',
    colors: ['#0b0805', '#221809', '#e6c06a', '#d9a648'],
  },
  {
    key: 'parchment',
    name: '羊皮纸风',
    desc: '古卷羊皮 · 褐墨铭文',
    colors: ['#e7dbc0', '#f6eedb', '#8a5d24', '#7a5230'],
  },
];

export function getTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return THEMES.some((x) => x.key === t) ? t : 'default';
  } catch (_) {
    return 'default';
  }
}

export function applyTheme(key) {
  if (key === 'default') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', key);
  }
  try { localStorage.setItem(THEME_KEY, key); } catch (_) {}
}

// 应用启动时调用（main.js），恢复上次选择的主题
export function initTheme() {
  const t = getTheme();
  if (t !== 'default') applyTheme(t);
}
