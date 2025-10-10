// src/App.tsx
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

// Public
import Index from '@/pages/Index'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'

// Core
import Dashboard from '@/pages/Dashboard'
import TransactionHistory from '@/pages/TransactionHistory'
import Pricing from '@/pages/Pricing'
import Profile from '@/pages/Profile'
import Billing from '@/pages/Billing'

// Wallet
import WalletSetup from '@/pages/wallet/WalletSetup'
import WalletSelection from '@/pages/wallet/WalletSelection'
import WalletCreationScreen1 from '@/pages/wallet/WalletCreationScreen1'
import WalletConnect from '@/pages/wallet/WalletConnect'
import WalletSuccess from '@/pages/wallet/WalletSuccess'
import WalletScreen2 from '@/pages/wallet/WalletScreen2'
import WalletScreen3 from '@/pages/wallet/WalletScreen3'

// Transfer
import TransferScreen1 from '@/pages/transfer/TransferScreen1'
import TransferScreen2 from '@/pages/transfer/TransferScreen2'
import TransferScreen2_1 from '@/pages/transfer/TransferScreen2_1'
import TransferScreen2_2 from '@/pages/transfer/TransferScreen2_2'
import TransferScreen3 from '@/pages/transfer/TransferScreen3'

// Accounting
import AccountingTaxScreen1 from '@/pages/accounting/AccountingTaxScreen1'

// Misc
import NotFound from '@/pages/NotFound'
import Navigation from '@/components/Navigation'
import { AuthGuard } from '@/components/AuthGuard'   // ← ★ named import に修正
import DevAuthPanel from '@/components/DevAuthPanel'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import PaymentGateway from '@/pages/PaymentGateway'

const WithNav: React.FC<React.PropsWithChildren> = ({ children }) => (
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

            {/* Authenticated routes */}
            <Route path="/dashboard" element={<AuthGuard><WithNav><Dashboard /></WithNav></AuthGuard>} />
            <Route path="/transactions" element={<AuthGuard><WithNav><TransactionHistory /></WithNav></AuthGuard>} />
            <Route path="/pricing" element={<AuthGuard><WithNav><Pricing /></WithNav></AuthGuard>} />
            <Route path="/profile" element={<AuthGuard><WithNav><Profile /></WithNav></AuthGuard>} />
            <Route path="/billing" element={<AuthGuard><WithNav><Billing /></WithNav></AuthGuard>} />

            {/* Wallet */}
            <Route path="/wallet" element={<AuthGuard><WithNav><WalletSetup /></WithNav></AuthGuard>} />
            <Route path="/wallet/select" element={<AuthGuard><WithNav><WalletSelection /></WithNav></AuthGuard>} />
            <Route path="/wallet/create" element={<AuthGuard><WithNav><WalletCreationScreen1 /></WithNav></AuthGuard>} />
            <Route path="/wallet/connect" element={<AuthGuard><WithNav><WalletConnect /></WithNav></AuthGuard>} />
            <Route path="/wallet/success" element={<AuthGuard><WithNav><WalletSuccess /></WithNav></AuthGuard>} />
            <Route path="/wallet/s2" element={<AuthGuard><WithNav><WalletScreen2 /></WithNav></AuthGuard>} />
            <Route path="/wallet/s3" element={<AuthGuard><WithNav><WalletScreen3 /></WithNav></AuthGuard>} />

            {/* Transfer multi-step */}
            <Route path="/transfer" element={<AuthGuard><WithNav><TransferScreen1 /></WithNav></AuthGuard>} />
            <Route path="/transfer/step2" element={<AuthGuard><WithNav><TransferScreen2 /></WithNav></AuthGuard>} />
            <Route path="/transfer/step2-1" element={<AuthGuard><WithNav><TransferScreen2_1 /></WithNav></AuthGuard>} />
            <Route path="/transfer/step2-2" element={<AuthGuard><WithNav><TransferScreen2_2 /></WithNav></AuthGuard>} />
            <Route path="/transfer/step3" element={<AuthGuard><WithNav><TransferScreen3 /></WithNav></AuthGuard>} />

            {/* Accounting */}
            <Route path="/accounting" element={<AuthGuard><WithNav><AccountingTaxScreen1 /></WithNav></AuthGuard>} />

            {/* Optional stub */}
            <Route path="/payment-gateway" element={<AuthGuard><WithNav><PaymentGateway /></WithNav></AuthGuard>} />

            {/* Back-compat & 404 */}
            <Route path="/home" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </main>

      {import.meta.env.DEV && <DevAuthPanel />}
    </div>
  )
}
