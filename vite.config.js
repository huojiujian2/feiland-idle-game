import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Vite 配置：前端在 3000 端口，API 请求代理到后端 3000 端口
export default defineConfig({
  plugins: [vue()],
  root: 'client',
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})
