// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { WagmiProvider } from 'wagmi'
import { wagmiConfig } from '@/config/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import SafeAppStandalone from '@/safe/SafeAppStandalone'
import './index.css'

const qc = new QueryClient()

/**
 * セーフモード：
 * - VITE_SAFE_MODE=1 のときは、外部依存（wagmi/Query/ガード/NavBar）をほぼ外して
 *   安全な最小ルートのみ表示（/_health, /_debug, /）
 * - 通常モードは従来通り App を描画
 */
const SAFE_MODE = String(import.meta.env.VITE_SAFE_MODE ?? '').toLowerCase() === '1'

const rootEl = document.getElementById('root')
if (!rootEl) {
  // ルート要素が無いと描画できない
  throw new Error('Missing <div id="root"></div> in index.html')
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    {SAFE_MODE ? (
      // ✅ セーフモード：Routerもこの中に含まれる（他のProviderは外す）
      <SafeAppStandalone />
    ) : (
      // ✅ 通常モード：AppをRouterで包む（Routerは全体で1つだけ）
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={qc}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </WagmiProvider>
    )}
  </React.StrictMode>
)
