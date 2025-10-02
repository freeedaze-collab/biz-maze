// src/App.tsx
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

// Public
import Index from '@/pages/Index'
import Login from '@/pages/auth/Login'

// Auth pages
import Dashboard from '@/pages/Dashboard'
import TransactionHistory from '@/pages/TransactionHistory'
import SynthesisStatus from '@/pages/SynthesisStatus'
import InvoiceStatusCheck from '@/pages/invoice/InvoiceStatusCheck'
import WalletSelection from '@/pages/wallet/WalletSelection'
import WithdrawalRequest from '@/pages/withdrawal/WithdrawalRequest'
import Pricing from '@/pages/Pricing'
import AccountingTaxScreen1 from '@/pages/accounting/AccountingTaxScreen1'
import TransferScreen3 from '@/pages/transfer/TransferScreen3'

// ★ 新規: Billing（請求書作成）
import Billing from '@/pages/Billing'

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

          {/* Auth */}
          <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
          <Route path="/transactions" element={<AuthGuard><TransactionHistory /></AuthGuard>} />
          <Route path="/transaction-history" element={<AuthGuard><TransactionHistory /></AuthGuard>} />
          <Route path="/synthesis-status" element={<AuthGuard><SynthesisStatus /></AuthGuard>} />
          <Route path="/invoice-status" element={<AuthGuard><InvoiceStatusCheck /></AuthGuard>} />
          <Route path="/wallet" element={<AuthGuard><WalletSelection /></AuthGuard>} />
          <Route path="/withdrawal" element={<AuthGuard><WithdrawalRequest /></AuthGuard>} />

          {/* ★ 追加: Billing */}
          <Route path="/billing" element={<AuthGuard><Billing /></AuthGuard>} />

          {/* 既存・任意の機能 */}
          <Route path="/pricing" element={<AuthGuard><Pricing /></AuthGuard>} />
          <Route path="/accounting" element={<AuthGuard><AccountingTaxScreen1 /></AuthGuard>} />
          <Route path="/transfer" element={<AuthGuard><TransferScreen3 /></AuthGuard>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
