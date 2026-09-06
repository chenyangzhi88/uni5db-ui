import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/frontend/reactadmin/',
  server: {
    host: '0.0.0.0',
    port: 8082,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001/',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'reactadmin',
    minify: 'terser',
    chunkSizeWarningLimit: 1200,
  },
})
