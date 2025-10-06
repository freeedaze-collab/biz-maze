// src/App.tsx
// ルーティング定義：リロードに強い HashRouter を採用（以前の事象を回避）
// 既存ページ名は極力踏襲。新規ページは ./pages/ 以下に追加。
import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";

// Public
import Index from "@/pages/Index";
import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import Pricing from "@/pages/Pricing";

// Auth-only（既存）
import Dashboard from "@/pages/Dashboard";
import TransactionHistory from "@/pages/TransactionHistory";

// 新規/更新ページ
import Profile from "@/pages/Profile";
import WalletSelection from "@/pages/wallet/WalletSelection";
import PaymentGateway from "@/pages/payment/PaymentGateway";

// Transfer（新規）
import TransferHome from "@/pages/transfer/TransferHome";
import NewRecipient from "@/pages/transfer/NewRecipient";
import ExistingClientTransfer from "@/pages/transfer/ExistingClientTransfer";
import PayFromInvoice from "@/pages/transfer/PayFromInvoice";

// Guard
import { AuthGuard } from "@/components/AuthGuard";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function App() {
  return (
    <HashRouter>
      <ErrorBoundary>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Index />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/signup" element={<Signup />} />
          <Route path="/pricing" element={<Pricing />} />

          {/* Auth-only */}
          <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
          <Route path="/transaction-history" element={<AuthGuard><TransactionHistory /></AuthGuard>} />
          <Route path="/profile" element={<AuthGuard><Profile /></AuthGuard>} />
          <Route path="/wallet" element={<AuthGuard><WalletSelection /></AuthGuard>} />
          <Route path="/payment-gateway" element={<AuthGuard><PaymentGateway /></AuthGuard>} />

          {/* Transfer (ETH first) */}
          <Route path="/transfer" element={<AuthGuard><TransferHome /></AuthGuard>} />
          <Route path="/transfer/new" element={<AuthGuard><NewRecipient /></AuthGuard>} />
          <Route path="/transfer/existing" element={<AuthGuard><ExistingClientTransfer /></AuthGuard>} />
          <Route path="/transfer/from-invoice" element={<AuthGuard><PayFromInvoice /></AuthGuard>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </HashRouter>
  );
}
