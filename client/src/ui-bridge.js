// ui-bridge.js — 全局 UI 桥接工具
// 用法：
//    import { toast, modalAlert, modalConfirm } from '@/ui-bridge'
//    toast('操作成功', 'success')
//    if (await modalConfirm('确认删除？')) { ... }
//    modalAlert('转生成功！第 3 轮回', { title: '转生', type: 'success' })
//
// 不需要 alert() / confirm() 这种浏览器原生破窗。
import { reactive, createApp, h } from 'vue'

// ====== 状态 ======
const state = reactive({
  toasts: [],         // { id, text, type, timer }
  modal: null,        // { id, title, body, type, onOk, onCancel, okText, cancelText, hideCancel }
})

let _toastId = 0
let _modalId = 0

// ====== Toast ======
function pushToast(text, type = 'info', duration = 2400) {
  const id = ++_toastId
  state.toasts.push({ id, text, type })
  setTimeout(() => {
    const i = state.toasts.findIndex(t => t.id === id)
    if (i >= 0) state.toasts.splice(i, 1)
  }, duration)
}

function toast(text, type = 'info') {
  pushToast(text, type, 2400)
}

// 兼容旧的字符串/对象用法
toast.success = (t) => pushToast(t, 'success', 2400)
toast.error = (t) => pushToast(t, 'error', 3200)
toast.warn = (t) => pushToast(t, 'warn', 2800)

// ====== Modal（取代 alert）======
function modalAlert(message, opts = {}) {
  return new Promise((resolve) => {
    const id = ++_modalId
    state.modal = {
      id,
      title: opts.title || '提示',
      body: message,
      type: opts.type || 'info',
      okText: opts.okText || '知道了',
      hideCancel: true,
      onOk: () => { state.modal = null; resolve(true) },
      onCancel: () => { state.modal = null; resolve(false) },
    }
  })
}

// ====== Modal（取代 confirm）======
function modalConfirm(message, opts = {}) {
  return new Promise((resolve) => {
    const id = ++_modalId
    state.modal = {
      id,
      title: opts.title || '确认',
      body: message,
      type: opts.type || 'warning',
      okText: opts.okText || '确定',
      cancelText: opts.cancelText || '取消',
      hideCancel: false,
      onOk: () => { state.modal = null; resolve(true) },
      onCancel: () => { state.modal = null; resolve(false) },
    }
  })
}

export { state, toast, modalAlert, modalConfirm }