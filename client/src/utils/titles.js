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

/**
 * @param {string|null} key       player.currentTitle
 * @param {object|null} player    player 对象（含 jobInfo / jobPath）
 * @param {object|null} cacheRef  ref({}) 形式的 title 缓存（来自 api.getTitles）
 */
export function resolveTitleName(key, player, cacheRef) {
  if (!key) return null
  if (TIME_TITLE_NAMES[key]) return TIME_TITLE_NAMES[key]
  if (cacheRef?.value?.[key]) return cacheRef.value[key].name
  if (player?.jobInfo?.stages) {
    const found = player.jobInfo.stages.find(s => `${player.jobPath}:${s.name}` === key)
    if (found) return found.name
  }
  if (key.startsWith('thunder:'))  return key.slice(8)
  if (key.startsWith('light:'))    return key.slice(6)
  if (key.startsWith('wind:'))     return key.slice(5)
  if (key.startsWith('knight:'))   return key.slice(7)
  if (key.startsWith('alchemy:'))  return key.slice(8)
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
  if (cacheRef?.value?.[key]) return cacheRef.value[key].color
  return '#9d8cf0'
}