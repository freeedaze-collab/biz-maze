// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,  // 5173が塞がれていたらエラーにして気付けるように
    open: true,
    // HMRのオーバーレイで操作不能になるのを避けたい場合は次を有効化
    // hmr: { overlay: false },
  },
  preview: {
    host: true,
    port: 5173,
    strictPort: true,
  },
})


