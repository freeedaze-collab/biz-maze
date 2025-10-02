// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ポートを 5173 に固定し、占有時はエラー(自動で別ポートに逃げない)
// Network アクセスも許可（モバイルWalletからのアクセス用途）
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // 0.0.0.0 で待受
    port: 5173,          // 固定
    strictPort: true,    // 使えなければ起動失敗
    open: true,
  },
  preview: {
    host: true,
    port: 5173,
    strictPort: true,
  },
})
