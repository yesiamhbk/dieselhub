import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  build: { sourcemap: false, minify: 'esbuild' },
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      // проксируем и /api, и /products → на сервер 10000 (IPv4!)
      '^/(api|products)(/|$)': {
        target: 'http://127.0.0.1:10000',
        changeOrigin: true,
        secure: false,
        // увеличить таймауты, чтобы большой JSON не ронял прокси
        proxyTimeout: 30000,
        timeout: 30000,
      }
    }
  }
})
