// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { wagmiConfig } from '@/config/wagmi'
import { AuthProvider } from '@/hooks/useAuth'
import App from './App'

/**
 * プレビュー/CDNでも落ちないための自動フォールバック
 * - 既定: BrowserRouter
 * - Lovable preview 等で 404 が出る環境は HashRouter へ
 * - .env で VITE_FORCE_HASH="1" でも強制ハッシュ
 */
function shouldUseHashRouter(): boolean {
  const force = import.meta.env.VITE_FORCE_HASH === '1'
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  const isPreview = host.startsWith('preview--')
  const isFile = typeof window !== 'undefined' && window.location.protocol === 'file:'
  return force || isPreview || isFile
}
const Router = shouldUseHashRouter() ? HashRouter : BrowserRouter

const qc = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <Router>
            <App />
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
