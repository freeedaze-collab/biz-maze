// src/App.tsx
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

// Public pages
import Index from '@/pages/Index'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'

// Protected pages
import Dashboard from '@/pages/Dashboard'
import TransactionHistory from '@/pages/TransactionHistory'
import Pricing from '@/pages/Pricing'
import Profile from '@/pages/Profile'
import WalletSetup from '@/pages/wallet/WalletSetup'
import AccountingTaxScreen1 from '@/pages/accounting/AccountingTaxScreen1'
import TransferScreen1 from '@/pages/transfer/TransferScreen1'
import NotFound from '@/pages/NotFound'

// Layout bits
import Navigation from '@/components/Navigation'
import AuthGuard from '@/components/AuthGuard'
import DevAuthPanel from '@/components/DevAuthPanel'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Optional stub page
import PaymentGateway from '@/pages/PaymentGateway'

const WithNav = ({ children }: { children: React.ReactNode }) => (
  <div className="space-y-4">
    <Navigation />
    {children}
  </div>
)

export default function App() {
  return (
    <div className="min-h-dvh">
      <main>
        <ErrorBoundary>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Index />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/register" element={<Register />} />

            {/* Protected */}
            <Route
              path="/dashboard"
              element={
                <AuthGuard>
                  <WithNav><Dashboard /></WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/transactions"
              element={
                <AuthGuard>
                  <WithNav><TransactionHistory /></WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/pricing"
              element={
                <AuthGuard>
                  <WithNav><Pricing /></WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/profile"
              element={
                <AuthGuard>
                  <WithNav><Profile /></WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/wallet"
              element={
                <AuthGuard>
                  <WithNav><WalletSetup /></WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/accounting"
              element={
                <AuthGuard>
                  <WithNav><AccountingTaxScreen1 /></WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/transfer"
              element={
                <AuthGuard>
                  <WithNav><TransferScreen1 /></WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/payment-gateway"
              element={
                <AuthGuard>
                  <WithNav><PaymentGateway /></WithNav>
                </AuthGuard>
              }
            />

            {/* Back-compat & 404 */}
            <Route path="/home" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </main>

      {/* DEV 専用の小パネル（本番では表示されません） */}
      {import.meta.env.DEV && <DevAuthPanel />}
    </div>
  )
}
