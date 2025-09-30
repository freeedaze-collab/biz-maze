// src/App.tsx
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Index from '@/pages/Index'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import Dashboard from '@/pages/Dashboard'
import TransactionHistory from '@/pages/TransactionHistory'
import AccountingTaxScreen1 from '@/pages/accounting/AccountingTaxScreen1'
import Pricing from '@/pages/Pricing'
import TransferScreen3 from '@/pages/transfer/TransferScreen3'
import { AuthGuard } from '@/components/AuthGuard'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <Routes>
          {/* Public */}
          <Route path="/" element={<Index />} />
          {/* Auth */}
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/register" element={<Register />} />
          {/* 以下は認証必須 */}
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <Dashboard />
              </AuthGuard>
            }
          />
          <Route
            path="/transactions"
            element={
              <AuthGuard>
                <TransactionHistory />
              </AuthGuard>
            }
          />
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
          {/* 不明URLはトップへ */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
