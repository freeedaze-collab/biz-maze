// src/App.tsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Public
import Index from "@/pages/Index";
import Login from "@/pages/auth/Login";

// Auth pages
import Dashboard from "@/pages/Dashboard";
import TransactionHistory from "@/pages/TransactionHistory";
import SynthesisStatus from "@/pages/SynthesisStatus";
import InvoiceStatusCheck from "@/pages/invoice/InvoiceStatusCheck";
import WalletSelection from "@/pages/wallet/WalletSelection";
import WithdrawalRequest from "@/pages/withdrawal/WithdrawalRequest";
import AccountingTaxScreen1 from "@/pages/accounting/AccountingTaxScreen1";
import Pricing from "@/pages/Pricing";

// Billing (Invoices)
import Billing from "@/pages/Billing";

// Transfer (New)
import TransferMenu from "@/pages/transfer/TransferMenu";
import TransferNew from "@/pages/transfer/TransferNew";
import TransferExisting from "@/pages/transfer/TransferExisting";
import PayFromInvoice from "@/pages/transfer/PayFromInvoice";

// Guard & debug
import { AuthGuard } from "@/components/AuthGuard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import DevAuthPanel from "@/components/DevAuthPanel";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <ErrorBoundary>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Index />} />
            <Route path="/auth/login" element={<Login />} />

            {/* Auth required */}
            <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
            <Route path="/transactions" element={<AuthGuard><TransactionHistory /></AuthGuard>} />
            <Route path="/transaction-history" element={<AuthGuard><TransactionHistory /></AuthGuard>} />
            <Route path="/synthesis-status" element={<AuthGuard><SynthesisStatus /></AuthGuard>} />
            <Route path="/invoice-status" element={<AuthGuard><InvoiceStatusCheck /></AuthGuard>} />
            <Route path="/wallet" element={<AuthGuard><WalletSelection /></AuthGuard>} />
            <Route path="/withdrawal" element={<AuthGuard><WithdrawalRequest /></AuthGuard>} />
            <Route path="/billing" element={<AuthGuard><Billing /></AuthGuard>} />
            <Route path="/pricing" element={<AuthGuard><Pricing /></AuthGuard>} />
            <Route path="/accounting" element={<AuthGuard><AccountingTaxScreen1 /></AuthGuard>} />

            {/* Transfer Hub */}
            <Route path="/transfer" element={<AuthGuard><TransferMenu /></AuthGuard>} />
            <Route path="/transfer/new" element={<AuthGuard><TransferNew /></AuthGuard>} />
            <Route path="/transfer/existing" element={<AuthGuard><TransferExisting /></AuthGuard>} />
            <Route path="/transfer/invoice" element={<AuthGuard><PayFromInvoice /></AuthGuard>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>

      {import.meta.env.DEV && <DevAuthPanel />}
    </div>
  );
}
