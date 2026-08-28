// ====== 通用长按手势（三段式加速度 + 单击支持） ======
// @file composables/useLongPress
// @module use-long-press
// @description
//   长按 +/- 按钮时，以"防误触 → 慢速 → 冲刺"三段式速率连续触发 onTick(direction, step)。
//   短按（单击）则立即触发 1 次 onTick(direction, 1) —— 确保 +/- 按钮的单击也能工作。
//   - direction =  1：长按 +
//   - direction = -1：长按 −
//   - step = 1：单击 / 短按（fallback），2：阶段 2 慢速，3：阶段 3 冲刺
//   - 松开 / 移出元素 立刻停止
//
// 三段式速度（默认参数，可通过 options 覆盖）：
//   阶段 1（防误触 0 ~ 350ms）       ：单击 → 松开时立即打 1 发（step=1）；按住不放则不主动 tick，等进入阶段 2
//   阶段 2（慢速 350ms ~ 1.5s）       ：每 120 ms 加 1 点 ≈ 每秒 ~8 点，肉眼可控
//   阶段 3（冲刺 ≥ 1.5s）           ：每  45 ms 加 1 点 ≈ 每秒 ~22 点，快速填满
//
// 用法（Vue 3 setup）：
//   const { bindHandlers } = useLongPress((direction) => addToStat(direction))
//   <button v-bind="bindHandlers('+')">+</button>
//
// 适配移动端 / PC：pointerdown / pointerup / pointerleave / pointercancel 全覆盖。
import { onBeforeUnmount } from 'vue'

// 阶段阈值（ms）
const PHASE_DELAY_MS = 350          // 阶段 1 结束
const PHASE_SLOW_MS = 1500          // 阶段 2 结束（从 350 起到 1500）
const INTERVAL_SLOW = 120           // 阶段 2 间隔
const INTERVAL_FAST = 45            // 阶段 3 间隔

export function useLongPress(onTick, options = {}) {
  const phase1Ms = options.phase1Ms ?? PHASE_DELAY_MS
  const phase2Ms = options.phase2Ms ?? PHASE_SLOW_MS
  const intervalSlow = options.intervalSlow ?? INTERVAL_SLOW
  const intervalFast = options.intervalFast ?? INTERVAL_FAST

  // 每个方向（+ / −）一套定时器栈
  //  state map: key -> { startTime, phase2Timer, fastTimer, firedPhase2, firedOnce }
  const state = new Map()

  function clearAll(key) {
    const s = state.get(key)
    if (!s) return
    if (s.phase2Timer) { clearTimeout(s.phase2Timer); s.phase2Timer = null }
    if (s.fastTimer)   { clearInterval(s.fastTimer);  s.fastTimer   = null }
    state.delete(key)
  }

  function dirOf(key) {
    // 支持 '+' / '-' / '+10' / '-10' / '+max' 等 key
    // '+10' / '+max' 走 onTick(direction, step)，direction = +1
    // '-10' 走 onTick(direction, step)，direction = -1
    // '+' / '−' 同理
    if (key.startsWith('-') || key.startsWith('−')) return -1
    return 1
  }

  function start(key) {
    if (state.has(key)) return
    const startTime = performance.now()
    const s = { startTime, phase2Timer: null, fastTimer: null, firedPhase2: false, firedOnce: false }
    state.set(key, s)
    const dir = dirOf(key)

    // 阶段 1：等 phase1Ms 后再触发第一次持续 tick（防误触）
    s.phase2Timer = setTimeout(() => {
      s.phase2Timer = null
      if (!state.has(key)) return        // 期间可能已松手
      s.firedPhase2 = true
      // 立刻打一发"阶段 2 慢速"首次（让玩家看到数字在跳）
      onTick(dir, 2)
      const slowUntilAt = startTime + phase2Ms
      // 阶段 2 慢速 tick
      const slowLoop = () => {
        if (!state.has(key)) return
        const now = performance.now()
        if (now >= slowUntilAt) {
          // 切到阶段 3 冲刺
          s.fastTimer = setInterval(() => {
            if (!state.has(key)) return
            onTick(dir, 3)
          }, intervalFast)
          return
        }
        onTick(dir, 2)
        setTimeout(slowLoop, intervalSlow)
      }
      setTimeout(slowLoop, intervalSlow)
    }, phase1Ms)
  }

  // 关键：松开时如果"阶段 2 还没触发过"，说明是单击 / 短按 → 立即补打一发 step=1
  //   这样 +/- 按钮的单击就能正常 +1 / -1，不用等满 350ms
  function stop(key) {
    const s = state.get(key)
    if (s && !s.firedPhase2) {
      const dir = dirOf(key)
      onTick(dir, 1)
      s.firedOnce = true
    }
    clearAll(key)
  }

  function stopAll() {
    for (const k of [...state.keys()]) {
      const s = state.get(k)
      if (s && !s.firedPhase2) {
        const dir = dirOf(k)
        onTick(dir, 1)
        s.firedOnce = true
      }
      clearAll(k)
    }
  }

  // 暴露给模板的事件绑定（v-bind 用）
  // 返回一个对象，对应 key 的所有事件 handler
  function bindHandlers(key) {
    const onDown = (e) => {
      // 阻止移动端浏览器误判 pinch 缩放
      if (e && e.cancelable) e.preventDefault?.()
      // 仅当目标元素真的支持 pointer capture 才调用（HTMLButtonElement 没有这方法，安全跳过）
      if (e && e.pointerId !== undefined && e.target && e.target.setPointerCapture) {
        try { e.target.setPointerCapture(e.pointerId) } catch (_) {}
      }
      start(key)
    }
    const onUp = () => stop(key)
    // 关键：pointerleave 不再等同于 pointerup。
    // 原因：在循环按钮组（属性 +/− 一行一个按钮）里，按住 + 时手稍微一动或
    // 浏览器重排就会触发 pointerleave，导致 350ms 阶段 2 永远进不去、长按完全失效。
    // 改为「leave 才 stop」必须满足两个条件：① 真的离开元素（relatedTarget 不在元素内）
    //              ② 没有正在 pointer capture（capture 后 pointerleave 不可靠，但
    //                 HTMLButtonElement 不支持 capture，所以这里 relatedTarget 就够用）
    // 兜底：pointercancel（系统打断，如来电、弹窗）仍走 stop。
    const onLeave = (e) => {
      const el = e?.currentTarget
      const rt = e?.relatedTarget
      if (el && rt && el.contains(rt)) return  // 移到子元素，不算离开
      onUp()
    }
    return {
      onPointerdown: onDown,
      onPointerup: onUp,
      // pointerleave：仅在真正移出按钮时停止（防止循环按钮组中途打断长按）
      onPointerleave: onLeave,
      onPointercancel: onUp,
      onTouchstart: (e) => { if (e && e.cancelable) e.preventDefault?.(); onDown(e) },
      onTouchend: (e) => { if (e && e.cancelable) e.preventDefault?.(); onUp(e) },
      onTouchcancel: (e) => { if (e && e.cancelable) e.preventDefault?.(); onUp(e) },
      // 键盘：按 space/enter 触发一次 + 持续按住可长按
      onKeydown: (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault?.(); onDown(e) } },
      onKeyup: (e) => { onUp(e) },
      onBlur: () => onUp(),
    }
  }

  onBeforeUnmount(() => stopAll())

  return { bindHandlers, stop: stopAll, start, stop: (key) => stop(key) }
}
