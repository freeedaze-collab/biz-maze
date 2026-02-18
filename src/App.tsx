// src/App.tsx
import { Routes, Route, useLocation } from "react-router-dom";
import { AuthGuard } from "@/components/AuthGuard";
import { useEffect } from "react";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";

// Public pages
import Index from "@/pages/Index";
import Pricing from "@/pages/Pricing";
import NotFound from "@/pages/NotFound";

// Auth flow
import Login from "@/pages/auth/Login";
import EmailSignUp from "@/pages/auth/EmailSignUp"; // /signup
import Register from "@/pages/auth/Register";       // /signupform
import Confirm from "@/pages/auth/Confirm";

// App pages
import Dashboard from "@/pages/Dashboard";
import TransactionHistory from "@/pages/TransactionHistory";
import Accounting from "@/pages/Accounting";
import Profile from "@/pages/Profile"; // re-resolve
import WalletSelection from "@/pages/wallet/WalletSelection";
import EntityAndTax from "@/pages/onboarding/EntityAndTax"; // ★ 追加
import CryptoTaxCalculator from "@/pages/tax/CryptoTaxCalculator";

// Exchanges (VCE)
import VCE from "@/pages/exchange/VCE";
import ExchangeDiscovery from "@/pages/management/ExchangeDiscovery";

import SendMoney from "@/pages/SendMoney";
import CreateInvoice from "@/pages/CreateInvoice";
import PaymentGateway from "@/pages/PaymentGateway";
import Checkout from "@/pages/checkout/Checkout";

export default function App() {
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const params: Record<string, string> = {};
    let hasParams = false;

    searchParams.forEach((value, key) => {
      params[key] = value;
      hasParams = true;
    });

    if (hasParams) {
      const existingParams = JSON.parse(sessionStorage.getItem("entry_params") || "{}");
      const mergedParams = { ...existingParams, ...params };
      sessionStorage.setItem("entry_params", JSON.stringify(mergedParams));
    }
  }, [location]);

  return (
    <>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Index />} />
        <Route path="/pricing" element={<Pricing />} />

        {/* Auth */}
        <Route path="/auth/login" element={<Login />} />
        <Route path="/signup" element={<EmailSignUp />} />
        <Route path="/signupform" element={<Register />} />
        <Route path="/auth/confirm" element={<Confirm />} />

        {/* App (protected) */}
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
              <Accounting />
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
          path="/wallets"
          element={
            <AuthGuard>
              <WalletSelection />
            </AuthGuard>
          }
        />

        {/* ★ 追加: Onboarding route */}
        <Route
          path="/onboarding/entity-and-tax"
          element={
            <AuthGuard>
              <EntityAndTax />
            </AuthGuard>
          }
        />

        {/* Tax Calculator */}
        <Route
          path="/tax-calculator"
          element={
            <AuthGuard>
              <CryptoTaxCalculator />
            </AuthGuard>
          }
        />

        {/* Exchange Discovery — Universal Exchange Connector */}
        <Route
          path="/exchanges"
          element={
            <AuthGuard>
              <ExchangeDiscovery />
            </AuthGuard>
          }
        />

        {/* VCE: 本来のパス */}
        <Route
          path="/vce"
          element={
            <AuthGuard>
              <VCE />
            </AuthGuard>
          }
        />
        {/* VCE: 互換エイリアス（以前のリンク /exchange, /exchange/vce でも開けるように） */}
        <Route
          path="/exchange"
          element={
            <AuthGuard>
              <VCE />
            </AuthGuard>
          }
        />
        <Route
          path="/exchange/vce"
          element={
            <AuthGuard>
              <VCE />
            </AuthGuard>
          }
        />

        <Route
          path="/send-money"
          element={
            <AuthGuard>
              <SendMoney />
            </AuthGuard>
          }
        />
        <Route
          path="/create-invoice"
          element={
            <AuthGuard>
              <CreateInvoice />
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

        {/* Hosted Checkout (public for buyers) */}
        <Route path="/checkout/:id" element={<Checkout />} />

        {/* Aliases */}
        <Route
          path="/transfer"
          element={
            <AuthGuard>
              <SendMoney />
            </AuthGuard>
          }
        />
        <Route
          path="/invoice/create"
          element={
            <AuthGuard>
              <CreateInvoice />
            </AuthGuard>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      <FeedbackButton />
    </>
  );
}
