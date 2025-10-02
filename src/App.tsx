// src/App.tsx
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

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

// Others already inプロジェクト
import AccountingTaxScreen1 from '@/pages/accounting/AccountingTaxScreen1'
import Pricing from '@/pages/Pricing'
import TransferScreen3 from '@/pages/transfer/TransferScreen3'

// Guard
import { AuthGuard } from '@/components/AuthGuard'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <Routes>
          {/* Public */}
          <Route path="/" element={<Index />} />
          <Route path="/auth/login" element={<Login />} />

          {/* Auth required */}
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <Dashboard />
              </AuthGuard>
            }
          />

          {/* Navigation ボタンに対応するルートを追加 */}
          <Route
            path="/transactions"
            element={
              <AuthGuard>
                {/* 「取引一覧」は TransactionHistory を流用 */}
                <TransactionHistory />
              </AuthGuard>
            }
          />
          <Route
            path="/transaction-history"
            element={
              <AuthGuard>
                <TransactionHistory />
              </AuthGuard>
            }
          />
          <Route
            path="/synthesis-status"
            element={
              <AuthGuard>
                <SynthesisStatus />
              </AuthGuard>
            }
          />
          <Route
            path="/invoice-status"
            element={
              <AuthGuard>
                <InvoiceStatusCheck />
              </AuthGuard>
            }
          />
          <Route
            path="/wallet"
            element={
              <AuthGuard>
                <WalletSelection />
              </AuthGuard>
            }
          />
          <Route
            path="/withdrawal"
            element={
              <AuthGuard>
                <WithdrawalRequest />
              </AuthGuard>
            }
          />

          {/* 既存の機能ページ（必要に応じて） */}
          <Route
            path="/accounting"
            element={
              <AuthGuard>
                <AccountingTaxScreen1 />
              </AuthGuard>
            }
          />
          <Route
            path="/pricing"
            element={
              <AuthGuard>
                <Pricing />
              </AuthGuard>
            }
          />
          <Route
            path="/transfer"
            element={
              <AuthGuard>
                <TransferScreen3 />
              </AuthGuard>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
