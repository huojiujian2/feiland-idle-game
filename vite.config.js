import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Vite 配置：前端在 3000 端口，API 请求代理到后端（PORT 端口，默认 3000）
export default defineConfig({
  plugins: [vue()],
  root: 'client',
  server: {
    port: 3000,
    proxy: {
      '/api': `http://localhost:${process.env.PORT || 3000}`
    }
  }
})
