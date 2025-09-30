// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { WagmiProvider } from 'wagmi'
import { wagmiConfig } from '@/config/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import './index.css'

const qc = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        {/* ✅ Router はアプリ全体で 1 個だけ。ここで提供します */}
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
