// src/App.tsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Index from "@/pages/Index";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";

import Dashboard from "@/pages/Dashboard";
import TransactionHistory from "@/pages/TransactionHistory";
import Pricing from "@/pages/Pricing";
import Profile from "@/pages/Profile";
import PaymentGateway from "@/pages/PaymentGateway";
import WalletSetup from "@/pages/wallet/WalletSetup";

import AccountingTaxScreen1 from "@/pages/accounting/AccountingTaxScreen1";
import TransferScreen1 from "@/pages/transfer/TransferScreen1";
import NotFound from "@/pages/NotFound";
import Navigation from "@/components/Navigation";
import AuthGuard from "@/components/AuthGuard";

const App: React.FC = () => {
  return (
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
            <div className="space-y-4">
              <Navigation />
              <Dashboard />
            </div>
          </AuthGuard>
        }
      />
      <Route
        path="/transactions"
        element={
          <AuthGuard>
            <div className="space-y-4">
              <Navigation />
              <TransactionHistory />
            </div>
          </AuthGuard>
        }
      />
      <Route
        path="/pricing"
        element={
          <AuthGuard>
            <div className="space-y-4">
              <Navigation />
              <Pricing />
            </div>
          </AuthGuard>
        }
      />
      <Route
        path="/profile"
        element={
          <AuthGuard>
            <div className="space-y-4">
              <Navigation />
              <Profile />
            </div>
          </AuthGuard>
        }
      />
      <Route
        path="/payment-gateway"
        element={
          <AuthGuard>
            <div className="space-y-4">
              <Navigation />
              <PaymentGateway />
            </div>
          </AuthGuard>
        }
      />
      <Route
        path="/wallet"
        element={
          <AuthGuard>
            <div className="space-y-4">
              <Navigation />
              <WalletSetup />
            </div>
          </AuthGuard>
        }
      />
      <Route
        path="/accounting"
        element={
          <AuthGuard>
            <div className="space-y-4">
              <Navigation />
              <AccountingTaxScreen1 />
            </div>
          </AuthGuard>
        }
      />
      <Route
        path="/transfer"
        element={
          <AuthGuard>
            <div className="space-y-4">
              <Navigation />
              <TransferScreen1 />
            </div>
          </AuthGuard>
        }
      />

      {/* Fallback */}
      <Route path="/home" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default App;
