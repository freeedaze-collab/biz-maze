// src/App.tsx
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Top from '@/pages/Top'
import Login from '@/pages/auth/Login'
import Dashboard from '@/pages/Dashboard'
import TransactionHistory from '@/pages/TransactionHistory'
import AccountingTaxScreen1 from '@/pages/accounting/AccountingTaxScreen1'
import Pricing from '@/pages/Pricing'
import TransferScreen3 from '@/pages/transfer/TransferScreen3'
import { AuthGuard } from '@/components/AuthGuard'
import { GuestGuard } from '@/components/GuestGuard'
import { NavBar } from '@/components/NavBar'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1">
        <Routes>
          {/* ゲストOK */}
          <Route path="/" element={<Top />} />
          {/* ゲスト専用（ログイン済みなら /dashboard へ） */}
          <Route
            path="/login"
            element={
              <GuestGuard redirect="/dashboard">
                <Login />
              </GuestGuard>
            }
          />
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
