import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 后台管理页独立构建：
//   base: '/admin/'   → 构建产物走 /admin 路径（后端在 /admin 下静态托管 + SPA 回退）
//   outDir: server/public/admin → 独立于 client/dist，避免被游戏前端构建（vite 默认清空 dist）误删
//   开发端口 4000     → 避免与游戏前端 3000 / 后端 3001 冲突
const API_PORT = process.env.PORT || 3001;

export default defineConfig({
  plugins: [vue()],
  base: '/admin/',
  server: {
    port: 4000,
    strictPort: true,
    proxy: {
      '/api': `http://localhost:${API_PORT}`
    }
  },
  build: {
    outDir: '../server/public/admin',
    emptyOutDir: true,
  }
})
