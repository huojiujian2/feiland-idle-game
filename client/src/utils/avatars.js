// v1.02：玩家可选头像列表（5 个预设）
//   value/glyph 用 String.fromCodePoint 构造 emoji，避免写入工具转义丢失
//   "" 表示用首字母 fallback（不显式存）
export const AVATAR_OPTIONS = [
  { key: 'default', value: '', label: '首字母', glyph: 'Aa' },
  { key: 'eagle',   value: String.fromCodePoint(0x1F985), label: '雄鹰', glyph: String.fromCodePoint(0x1F985) },
  { key: 'angel',   value: String.fromCodePoint(0x1F607), label: '天使', glyph: String.fromCodePoint(0x1F607) },
  { key: 'dragon',  value: String.fromCodePoint(0x1F409), label: '巨龙', glyph: String.fromCodePoint(0x1F409) },
  { key: 'mage',    value: String.fromCodePoint(0x1F9D9), label: '法师', glyph: String.fromCodePoint(0x1F9D9) },
]

// 根据 player 算出当前头像显示字符：优先 player.avatar，否则取 name 首字
export function resolveAvatarDisplay(player) {
  if (!player) return ''
  if (player.avatar && player.avatar.length) return player.avatar
  return (player.name || '').charAt(0)
}

// 根据 player.avatar 拿到当前 option 的 key（找不到匹配 -> 'default'）
// v1.02.1：重写 resolveAvatarKey 以使用 AVATAR_OPTIONS.find 方式
export function resolveAvatarKey(player) {
  const v = (player && player.avatar) || ''
  const found = AVATAR_OPTIONS.find(o => o.value === v)
  return found ? found.key : 'default'
}
