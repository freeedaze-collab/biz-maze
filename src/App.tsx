// src/App.tsx
import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Top from '@/pages/Top'
import Login from '@/pages/auth/Login'
import Dashboard from '@/pages/Dashboard'
import TransactionHistory from '@/pages/TransactionHistory'
import AccountingTaxScreen1 from '@/pages/accounting/AccountingTaxScreen1'
import Pricing from '@/pages/Pricing'
import TransferScreen3 from '@/pages/transfer/TransferScreen3'
import DebugEnv from '@/pages/_DebugEnv'
import { AuthGuard } from '@/components/AuthGuard'
import { GuestGuard } from '@/components/GuestGuard'
import { NavBar } from '@/components/NavBar'
import { ErrorBoundary } from '@/components/ErrorBoundary'

function Health() {
  return <div className="p-6 text-sm">OK</div>
}

export default function App() {
  const loc = useLocation()
  const isDebug = loc.pathname.startsWith('/_debug') || loc.pathname.startsWith('/_health')

  return (
    <div className="min-h-screen flex flex-col">
      {/* デバッグ時は NavBar を外して共通部のクラッシュを切り分け */}
      {!isDebug && <NavBar />}

      <main className="flex-1">
        <ErrorBoundary>
          <Routes>
            {/* ゲストOK */}
            <Route path="/" element={<Top />} />
            {/* ゲスト専用 */}
            <Route
              path="/login"
              element={
                <GuestGuard redirect="/dashboard">
                  <Login />
                </GuestGuard>
              }
            />
            {/* 認証必須 */}
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

            {/* デバッグ用（NavBar非表示） */}
            <Route path="/_debug" element={<DebugEnv />} />
            <Route path="/_health" element={<Health />} />

            {/* 不明URLはトップへ */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  )
}
