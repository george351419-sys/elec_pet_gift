import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@fdv/client': path.resolve(__dirname, '../full-duplex-voice/client/index.ts'),
      '@volcengine/rtc': path.resolve(__dirname, 'node_modules/@volcengine/rtc/index.esm.min.js'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
