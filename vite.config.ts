import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
      '/oss-upload': {
        target: 'https://czlrs-bucket.oss-cn-beijing.aliyuncs.com',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/',
      },
    },
  },
})
