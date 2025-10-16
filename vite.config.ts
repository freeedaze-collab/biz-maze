// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 8080,
    strictPort: true,
    open: true,
    // hmr: { overlay: false },
  },
  preview: {
    host: true,
    port: 8080,
    strictPort: true,
  },
})
