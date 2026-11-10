import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3007,
    proxy: {
      '/api/anthropic': { target: 'https://api.anthropic.com', changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/anthropic/, '') },
      '/api/openai': { target: 'https://api.openai.com', changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/openai/, '') },
      '/api/deepseek': { target: 'https://api.deepseek.com', changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/deepseek/, '') },
    },
  },
})
