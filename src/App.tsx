// @ts-nocheck
// src/App.tsx
// ✅ ルーティング専用（プロバイダは main.tsx 側）
// ✅ Router は一箇所のみ（main.tsx）
// ✅ AuthGuard を使うルートは必ず AuthProvider の内側（main.tsx でラップ済み想定）
// ✅ wagmi v2 の設定は providers/WagmiProvider など main.tsx 側
// ✅ 既存機能を壊さないため、従来ページを維持しつつ重複ルート/重複インポートを整理

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// ====== Public pages ======
import Index from "@/pages/Index";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import Pricing from "@/pages/Pricing";

// ====== Core (after login) ======
import Dashboard from "@/pages/Dashboard";
import TransactionHistory from "@/pages/TransactionHistory";
import Profile from "@/pages/Profile";
import Billing from "@/pages/Billing";

// ====== Wallet ======
import WalletSetup from "@/pages/wallet/WalletSetup";
import WalletSelection from "@/pages/wallet/WalletSelection";
import WalletCreationScreen1 from "@/pages/wallet/WalletCreationScreen1";
import WalletConnect from "@/pages/wallet/WalletConnect";
import WalletSuccess from "@/pages/wallet/WalletSuccess";
import WalletScreen2 from "@/pages/wallet/WalletScreen2";
import WalletScreen3 from "@/pages/wallet/WalletScreen3";

// ====== Transfer (multi-step + MVP flow) ======
import TransferScreen1 from "@/pages/transfer/TransferScreen1";
import TransferScreen2 from "@/pages/transfer/TransferScreen2";
import TransferScreen2_1 from "@/pages/transfer/TransferScreen2_1";
import TransferScreen2_2 from "@/pages/transfer/TransferScreen2_2";
import TransferScreen3 from "@/pages/transfer/TransferScreen3";
import TransferStart from "@/pages/transfer/TransferStart";
import TransferConfirm from "@/pages/transfer/TransferConfirm";
import TransferDone from "@/pages/transfer/TransferDone";
import ManualTransfer from "@/pages/transfer/ManualTransfer";

// ====== Invoice ======
import InvoiceEditor from "@/pages/invoice/InvoiceEditor";

// ====== Accounting / Payments ======
import AccountingTaxScreen1 from "@/pages/accounting/AccountingTaxScreen1";
import PaymentGateway from "@/pages/PaymentGateway";
import Accounting from "@/pages/Accounting";


// ====== Misc ======
import NotFound from "@/pages/NotFound";
import Navigation from "@/components/Navigation";
import { AuthGuard } from "@/components/AuthGuard";
import DevAuthPanel from "@/components/DevAuthPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";


// ---- Layout with top navigation (for authenticated areas) ----
const WithNav: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="space-y-4">
    <Navigation />
    {children}
  </div>
);

export default function App() {
  return (
    <div className="min-h-dvh">
      <main>
        <ErrorBoundary>
          <Routes>
            {/* ===== Public routes (no guard) ===== */}
            <Route path="/" element={<Index />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/register" element={<Register />} />
            {/* Pricing はマーケ/プラン確認用として公開。ログイン後はメニューからも遷移可能 */}
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/accounting" element={<Accounting />} />
            {/* ===== Authenticated routes (guard + nav) ===== */}
            <Route
              path="/dashboard"
              element={
                <AuthGuard>
                  <WithNav>
                    <Dashboard />
                  </WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/transactions"
              element={
                <AuthGuard>
                  <WithNav>
                    <TransactionHistory />
                  </WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/profile"
              element={
                <AuthGuard>
                  <WithNav>
                    <Profile />
                  </WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/billing"
              element={
                <AuthGuard>
                  <WithNav>
                    <Billing />
                  </WithNav>
                </AuthGuard>
              }
            />

            {/* Wallet setup / linking */}
            <Route
              path="/wallet"
              element={
                <AuthGuard>
                  <WithNav>
                    <WalletSetup />
                  </WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/wallet/select"
              element={
                <AuthGuard>
                  <WithNav>
                    <WalletSelection />
                  </WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/wallet/create"
              element={
                <AuthGuard>
                  <WithNav>
                    <WalletCreationScreen1 />
                  </WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/wallet/connect"
              element={
                <AuthGuard>
                  <WithNav>
                    <WalletConnect />
                  </WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/wallet/success"
              element={
                <AuthGuard>
                  <WithNav>
                    <WalletSuccess />
                  </WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/wallet/s2"
              element={
                <AuthGuard>
                  <WithNav>
                    <WalletScreen2 />
                  </WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/wallet/s3"
              element={
                <AuthGuard>
                  <WithNav>
                    <WalletScreen3 />
                  </WithNav>
                </AuthGuard>
              }
            />

            {/* Transfer (legacy multi-step) */}
            <Route
              path="/transfer"
              element={
                <AuthGuard>
                  <WithNav>
                    <TransferScreen1 />
                  </WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/transfer/step2"
              element={
                <AuthGuard>
                  <WithNav>
                    <TransferScreen2 />
                  </WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/transfer/step2-1"
              element={
                <AuthGuard>
                  <WithNav>
                    <TransferScreen2_1 />
                  </WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/transfer/step2-2"
              element={
                <AuthGuard>
                  <WithNav>
                    <TransferScreen2_2 />
                  </WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/transfer/step3"
              element={
                <AuthGuard>
                  <WithNav>
                    <TransferScreen3 />
                  </WithNav>
                </AuthGuard>
              }
            />

            {/* Transfer (MVP new flow) */}
            <Route
              path="/transfer/start"
              element={
                <AuthGuard>
                  <WithNav>
                    <TransferStart />
                  </WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/transfer/confirm"
              element={
                <AuthGuard>
                  <WithNav>
                    <TransferConfirm />
                  </WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/transfer/done"
              element={
                <AuthGuard>
                  <WithNav>
                    <TransferDone />
                  </WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/transfer/manual"
              element={
                <AuthGuard>
                  <WithNav>
                    <ManualTransfer />
                  </WithNav>
                </AuthGuard>
              }
            />

            {/* Accounting / Payments */}
            <Route
              path="/accounting"
              element={
                <AuthGuard>
                  <WithNav>
                    <AccountingTaxScreen1 />
                  </WithNav>
                </AuthGuard>
              }
            />
            <Route
              path="/payment-gateway"
              element={
                <AuthGuard>
                  <WithNav>
                    <PaymentGateway />
                  </WithNav>
                </AuthGuard>
              }
            />

            {/* Invoice */}
            <Route
              path="/invoice/new"
              element={
                <AuthGuard>
                  <WithNav>
                    <InvoiceEditor />
                  </WithNav>
                </AuthGuard>
              }
            />

            {/* Back-compat & redirects */}
            <Route path="/home" element={<Navigate to="/dashboard" replace />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </main>

      {import.meta.env.DEV && <DevAuthPanel />}
    </div>
  );
}
