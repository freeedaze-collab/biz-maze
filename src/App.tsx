// src/App.tsx
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Public pages
import Index from '@/pages/Index'
import Login from '@/pages/auth/Login'

// Dashboard (requires auth)
import Dashboard from '@/pages/Dashboard'

// Feature pages (requires auth)
import TransactionHistory from '@/pages/TransactionHistory'
import SynthesisStatus from '@/pages/SynthesisStatus'
import InvoiceStatusCheck from '@/pages/invoice/InvoiceStatusCheck'
import WalletSelection from '@/pages/wallet/WalletSelection'
import WithdrawalRequest from '@/pages/withdrawal/WithdrawalRequest'
import AccountingTaxScreen1 from '@/pages/accounting/AccountingTaxScreen1'
import Pricing from '@/pages/Pricing'
import TransferScreen3 from '@/pages/transfer/TransferScreen3'

// Billing（請求書作成）
import Billing from '@/pages/Billing'

// Guard & Dev tools
import { AuthGuard } from '@/components/AuthGuard'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import DevAuthPanel from '@/components/DevAuthPanel' // ← 既存

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <main className="flex-1">
          <ErrorBoundary>
            <Routes>
              {/* Public */}
              <Route path="/" element={<Index />} />
              <Route path="/auth/login" element={<Login />} />

              {/* Auth required */}
              <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
              <Route path="/transactions" element={<AuthGuard><TransactionHistory /></AuthGuard>} />
              <Route path="/transaction-history" element={<AuthGuard><TransactionHistory /></AuthGuard>} />
              <Route path="/synthesis-status" element={<AuthGuard><SynthesisStatus /></AuthGuard>} />
              <Route path="/invoice-status" element={<AuthGuard><InvoiceStatusCheck /></AuthGuard>} />
              <Route path="/wallet" element={<AuthGuard><WalletSelection /></AuthGuard>} />
              <Route path="/withdrawal" element={<AuthGuard><WithdrawalRequest /></AuthGuard>} />

              {/* Billing */}
              <Route path="/billing" element={<AuthGuard><Billing /></AuthGuard>} />

              {/* Optional features */}
              <Route path="/pricing" element={<AuthGuard><Pricing /></AuthGuard>} />
              <Route path="/accounting" element={<AuthGuard><AccountingTaxScreen1 /></AuthGuard>} />
              <Route path="/transfer" element={<AuthGuard><TransferScreen3 /></AuthGuard>} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>

        {/* DEV のときだけ小さなデバッグパネルを表示（本番では出ません） */}
        {import.meta.env.DEV && <DevAuthPanel />}
      </div>
    </BrowserRouter>
  )
}
