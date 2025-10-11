// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { wagmiConfig } from '@/config/wagmi'
import { AuthProvider } from '@/hooks/useAuth'
import { supabase } from "@/integrations/supabase/client";
import App from './App'

/**
 * Preview/CDN でも落ちないための自動フォールバック:
 *  - default: BrowserRouter
 *  - preview--*.lovable.app / file:// / VITE_FORCE_HASH="1" は HashRouter
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

window.supabase = supabase;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* ✅ あなたの順序に統一 */}
    <AuthProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={qc}>
          <Router>
            <App />
          </Router>
        </QueryClientProvider>
      </WagmiProvider>
    </AuthProvider>
  </React.StrictMode>
)
