// ====== 称号解析工具（单一数据源） ======
// @file utils/titles
// @module title-resolver
// @description
//   解析 player.currentTitle (key) → { name, color }
//   - TIME_TITLE_*    ：世界 BOSS 限时称号（24h）
//   - allTitleCache   ：调用 api.getTitles 后填入的字典 { key: { name, color, ... } }
//   - jobInfo.stages  ：角色当前职业路径上的阶段（每个阶段生成 key = "${jobPath}:${stageName}"）
//   - key 前缀兜底    ：thunder/light/wind/knight/alchemy → 截断前缀当 name
//
// 用法（Vue 3 setup）：
//   import { resolveTitleName, resolveTitleColor } from '../utils/titles.js'
//   const currentTitleName = computed(() => resolveTitleName(player.currentTitle, player))
//
// 注：allTitleCache / jobInfo 是「每组件实例独立」的状态（ref），调用方负责注入。
import { TIME_TITLE_NAMES, TIME_TITLE_COLORS } from './timeTitles.js'

// 竞技场商店永久称号本地兜底（缓存未加载时也绝不显示 key 字符串）
export const ARENA_TITLE_NAMES = {
  arena_immortal_star: '不朽星灵',
  arena_samsara_lord: '轮回之主',
}
export const ARENA_TITLE_COLORS = {
  arena_immortal_star: '#7fffd4',
  arena_samsara_lord: '#d4af5e',
}

// 灵鸡斗场称号本地兜底（缓存未加载时也绝不显示 key 字符串）
export const COCKFIGHT_TITLE_NAMES = {
  cock_newbie: '斗鸡新人',
  cock_knight: '灵鸡骑士',
  cock_slayer: '百鸡斩',
  cock_saint: '斗战圣鸡',
  cock_king: '万鸡之王',
  cock_maniac: '斗鸡狂魔',
}
export const COCKFIGHT_TITLE_COLORS = {
  cock_newbie: '#f5c542',
  cock_knight: '#5eda7a',
  cock_slayer: '#9d8cf0',
  cock_saint: '#d4af5e',
  cock_king: '#ff6738',
  cock_maniac: '#ff6738',
}

/**
 * @param {string|null} key       player.currentTitle
 * @param {object|null} player    player 对象（含 jobInfo / jobPath）
 * @param {object|null} cacheRef  ref({}) 形式的 title 缓存（来自 api.getTitles）
 */
export function resolveTitleName(key, player, cacheRef) {
  if (!key) return null
  if (TIME_TITLE_NAMES[key]) return TIME_TITLE_NAMES[key]
  if (ARENA_TITLE_NAMES[key]) return ARENA_TITLE_NAMES[key]
  if (COCKFIGHT_TITLE_NAMES[key]) return COCKFIGHT_TITLE_NAMES[key]
  if (cacheRef?.value?.[key]) return cacheRef.value[key].name
  if (player?.jobInfo?.stages) {
    const found = player.jobInfo.stages.find(s => `${player.jobPath}:${s.name}` === key)
    if (found) return found.name
  }
  if (key.startsWith('thunder:'))  return key.slice(8)
  if (key.startsWith('light:'))    return key.slice(6)
  if (key.startsWith('wind:'))     return key.slice(5)
  if (key.startsWith('knight:'))   return key.slice(7)
  if (key.startsWith('alchemy:')) return key.slice(8)
  return key
}

/**
 * @param {string|null} key       player.currentTitle
 * @param {object|null} cacheRef  ref({}) 形式的 title 缓存
 * @returns {string}              颜色字符串（默认紫）
 */
export function resolveTitleColor(key, cacheRef) {
  if (!key) return '#9d8cf0'
  if (TIME_TITLE_COLORS[key]) return TIME_TITLE_COLORS[key]
  if (ARENA_TITLE_COLORS[key]) return ARENA_TITLE_COLORS[key]
  if (COCKFIGHT_TITLE_COLORS[key]) return COCKFIGHT_TITLE_COLORS[key]
  if (cacheRef?.value?.[key]) return cacheRef.value[key].color
  return '#9d8cf0'
}