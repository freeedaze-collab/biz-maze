// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { WagmiProvider } from '@/providers/WagmiProvider'
import { BrowserRouter } from 'react-router-dom'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </WagmiProvider>
  </React.StrictMode>
)
