import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // 允许外部访问（移动设备）
    port: 5173,
    strictPort: true, // 如果端口被占用，不尝试其他端口
  },
})






