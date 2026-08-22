import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 端口约定（所有模式统一）：
//   前端 = 固定 3000（浏览器打开的地址）
//   后端 API = 固定 3001
// strictPort: true —— 3000 被占用时直接报错退出，
// 绝不自动跳到其他端口（防止悄悄挪到 3001 与后端冲突）。
const API_PORT = process.env.PORT || 3001;

export default defineConfig({
  plugins: [vue()],
  root: 'client',
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': `http://localhost:${API_PORT}`
    }
  }
})
