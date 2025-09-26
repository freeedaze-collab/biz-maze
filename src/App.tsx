import './App.css'
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AuthGuard } from "@/components/AuthGuard";
import Index from "./pages/Index";
import Register from "./pages/auth/Register";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import TransferScreen1 from "./pages/transfer/TransferScreen1";
import TransferScreen2 from "./pages/transfer/TransferScreen2";
import TransferScreen2_1 from "./pages/transfer/TransferScreen2_1";
import TransferScreen2_2 from "./pages/transfer/TransferScreen2_2";
import TransferScreen3 from "./pages/transfer/TransferScreen3";
import InvoiceConfirmScreen from "./pages/transfer/InvoiceConfirmScreen";
import RequestScreen1 from "./pages/request/RequestScreen1";
import RequestScreen2 from "./pages/request/RequestScreen2";
import RequestScreen2_2 from "./pages/request/RequestScreen2_2";
import ExistingRecipientsScreen from "./pages/request/ExistingRecipientsScreen";
import PaymentGatewayScreen1 from "./pages/payment/PaymentGatewayScreen1";
import PaymentGatewayScreen2 from "./pages/payment/PaymentGatewayScreen2";
import PaymentGatewayScreen1_1 from "./pages/payment/PaymentGatewayScreen1_1";
import ManagementScreen1 from "./pages/management/ManagementScreen1";
import PortfolioScreen from "./pages/management/PortfolioScreen";
import ExchangeImplementScreen from "./pages/management/ExchangeImplementScreen";
import ExchangeConnectScreen from "./pages/management/ExchangeConnectScreen";
import ExchangeServices from "./pages/management/ExchangeServices";
import Login from "./pages/auth/Login";
import AccountTypeSelection from "./pages/auth/AccountTypeSelection";
import PaymentGatewayComingSoon from "./pages/payment/PaymentGatewayComingSoon";
import WalletSetup from "./pages/wallet/WalletSetup";
import AccountingTaxScreen1 from "./pages/accounting/AccountingTaxScreen1";
import WalletCreationScreen1 from "./pages/wallet/WalletCreationScreen1";
import WalletConnect from "./pages/wallet/WalletConnect";
import WalletScreen3 from "./pages/wallet/WalletScreen3";
import Pricing from "./pages/Pricing";
import TransactionHistoryScreen1 from "./pages/transaction/TransactionHistoryScreen1";
import TransactionHistory from "./pages/TransactionHistory";
import InvoicePayment from "./pages/invoice/InvoicePayment";
import CountryCompanySettings from "./pages/settings/CountryCompanySettings";
import './App.css';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/register" element={<Register />} />
            <Route path="/auth/account-setup" element={<AccountTypeSelection />} />
            <Route path="/pricing" element={<Pricing />} />
            
            {/* Protected routes */}
            <Route path="/dashboard" element={<AuthGuard><Home /></AuthGuard>} />
            <Route path="/transfer" element={<AuthGuard><TransferScreen1 /></AuthGuard>} />
            <Route path="/transfer/manual" element={<AuthGuard><TransferScreen2 /></AuthGuard>} />
            <Route path="/transfer/confirm" element={<AuthGuard><TransferScreen2_1 /></AuthGuard>} />
            <Route path="/transfer/complete" element={<AuthGuard><TransferScreen2_2 /></AuthGuard>} />
            <Route path="/transfer/invoice" element={<AuthGuard><TransferScreen3 /></AuthGuard>} />
            <Route path="/transfer/invoice-confirm" element={<AuthGuard><InvoiceConfirmScreen /></AuthGuard>} />
            <Route path="/request" element={<AuthGuard><RequestScreen1 /></AuthGuard>} />
            <Route path="/request/new" element={<AuthGuard><RequestScreen2 /></AuthGuard>} />
            <Route path="/request/existing" element={<AuthGuard><RequestScreen2_2 /></AuthGuard>} />
            <Route path="/request/recipients" element={<AuthGuard><ExistingRecipientsScreen /></AuthGuard>} />
            <Route path="/payment-gateway" element={<AuthGuard><PaymentGatewayScreen1 /></AuthGuard>} />
            <Route path="/payment-gateway/implement" element={<AuthGuard><PaymentGatewayScreen2 /></AuthGuard>} />
            <Route path="/payment-gateway/integrate" element={<AuthGuard><PaymentGatewayScreen2 /></AuthGuard>} />
            <Route path="/payment-gateway/connect" element={<AuthGuard><PaymentGatewayScreen1_1 /></AuthGuard>} />
            <Route path="/management" element={<AuthGuard><ManagementScreen1 /></AuthGuard>} />
            <Route path="/management/portfolio" element={<AuthGuard><PortfolioScreen /></AuthGuard>} />
            <Route path="/management/exchange/implement" element={<AuthGuard><ExchangeImplementScreen /></AuthGuard>} />
            <Route path="/management/exchange/integrate" element={<AuthGuard><ExchangeImplementScreen /></AuthGuard>} />
            <Route path="/management/exchange/connect" element={<AuthGuard><ExchangeConnectScreen /></AuthGuard>} />
            <Route path="/management/exchange/services" element={<AuthGuard><ExchangeServices /></AuthGuard>} />
            <Route path="/wallet/setup/:walletId" element={<AuthGuard><WalletSetup /></AuthGuard>} />
            <Route path="/accounting-tax" element={<AuthGuard><AccountingTaxScreen1 /></AuthGuard>} />
            <Route path="/wallet-creation" element={<AuthGuard><WalletCreationScreen1 /></AuthGuard>} />
            <Route path="/wallet/connect" element={<AuthGuard><WalletConnect /></AuthGuard>} />
            <Route path="/wallet/success" element={<AuthGuard><WalletScreen3 /></AuthGuard>} />
            <Route path="/transaction-history" element={<AuthGuard><TransactionHistoryScreen1 /></AuthGuard>} />
            <Route path="/transactions" element={<AuthGuard><TransactionHistory /></AuthGuard>} />
            <Route path="/settings/country-company" element={<AuthGuard><CountryCompanySettings /></AuthGuard>} />
            
            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
    </AuthProvider>
  </TooltipProvider>
</QueryClientProvider>
);

export default App;
