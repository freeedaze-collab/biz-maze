// src/App.tsx
import React, { Suspense } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";

// Public pages
import Index from "@/pages/Index";
import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import Pricing from "@/pages/Pricing";

// Auth-only pages
import Dashboard from "@/pages/Dashboard";
import TransactionHistory from "@/pages/TransactionHistory";
import Billing from "@/pages/Billing";
import Profile from "@/pages/Profile";
import WalletSelection from "@/pages/wallet/WalletSelection";
import PaymentGateway from "@/pages/payment/PaymentGateway";

// Transfer flows (ETH first)
import TransferHome from "@/pages/transfer/TransferHome";
import NewRecipient from "@/pages/transfer/NewRecipient";
import ExistingClientTransfer from "@/pages/transfer/ExistingClientTransfer";
import PayFromInvoice from "@/pages/transfer/PayFromInvoice";

// Guards / Error boundary
import { AuthGuard } from "@/components/AuthGuard";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ※ リロード時の白画面対策として HashRouter を採用（サーバ側のルーティング設定が不要）
export default function App() {
  return (
    <HashRouter>
      <ErrorBoundary>
        <Suspense fallback={<div className="p-6">Loading...</div>}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Index />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/signup" element={<Signup />} />
            <Route path="/pricing" element={<Pricing />} />

            {/* Auth-only */}
            <Route
              path="/dashboard"
              element={
                <AuthGuard>
                  <Dashboard />
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
              path="/billing"
              element={
                <AuthGuard>
                  <Billing />
                </AuthGuard>
              }
            />
            <Route
              path="/profile"
              element={
                <AuthGuard>
                  <Profile />
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
              path="/payment-gateway"
              element={
                <AuthGuard>
                  <PaymentGateway />
                </AuthGuard>
              }
            />

            {/* Transfer (ETH) */}
            <Route
              path="/transfer"
              element={
                <AuthGuard>
                  <TransferHome />
                </AuthGuard>
              }
            />
            <Route
              path="/transfer/new"
              element={
                <AuthGuard>
                  <NewRecipient />
                </AuthGuard>
              }
            />
            <Route
              path="/transfer/existing"
              element={
                <AuthGuard>
                  <ExistingClientTransfer />
                </AuthGuard>
              }
            />
            <Route
              path="/transfer/from-invoice"
              element={
                <AuthGuard>
                  <PayFromInvoice />
                </AuthGuard>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </HashRouter>
  );
}
