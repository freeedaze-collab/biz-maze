import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import TransferScreen1 from "./pages/transfer/TransferScreen1";
import TransferScreen2 from "./pages/transfer/TransferScreen2";
import TransferScreen2_1 from "./pages/transfer/TransferScreen2_1";
import TransferScreen2_2 from "./pages/transfer/TransferScreen2_2";
import TransferScreen3 from "./pages/transfer/TransferScreen3";
import RequestScreen1 from "./pages/request/RequestScreen1";
import RequestScreen2 from "./pages/request/RequestScreen2";
import RequestScreen2_2 from "./pages/request/RequestScreen2_2";
import PaymentGatewayScreen1 from "./pages/payment/PaymentGatewayScreen1";
import PaymentGatewayScreen2 from "./pages/payment/PaymentGatewayScreen2";
import PaymentGatewayScreen1_1 from "./pages/payment/PaymentGatewayScreen1_1";
import ManagementScreen1 from "./pages/management/ManagementScreen1";
import AccountingTaxScreen1 from "./pages/accounting/AccountingTaxScreen1";
import WalletCreationScreen1 from "./pages/wallet/WalletCreationScreen1";
import WalletScreen2 from "./pages/wallet/WalletScreen2";
import WalletScreen3 from "./pages/wallet/WalletScreen3";
import TransactionHistoryScreen1 from "./pages/transaction/TransactionHistoryScreen1";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/transfer" element={<TransferScreen1 />} />
          <Route path="/transfer/manual" element={<TransferScreen2 />} />
          <Route path="/transfer/confirm" element={<TransferScreen2_1 />} />
          <Route path="/transfer/complete" element={<TransferScreen2_2 />} />
          <Route path="/transfer/invoice" element={<TransferScreen3 />} />
          <Route path="/request" element={<RequestScreen1 />} />
          <Route path="/request/new" element={<RequestScreen2 />} />
          <Route path="/request/existing" element={<RequestScreen2_2 />} />
          <Route path="/payment-gateway" element={<PaymentGatewayScreen1 />} />
          <Route path="/payment-gateway/implement" element={<PaymentGatewayScreen2 />} />
          <Route path="/payment-gateway/integrate" element={<PaymentGatewayScreen2 />} />
          <Route path="/payment-gateway/connect" element={<PaymentGatewayScreen1_1 />} />
          <Route path="/management" element={<ManagementScreen1 />} />
          <Route path="/accounting-tax" element={<AccountingTaxScreen1 />} />
          <Route path="/wallet-creation" element={<WalletCreationScreen1 />} />
          <Route path="/wallet/connect" element={<WalletScreen2 />} />
          <Route path="/wallet/success" element={<WalletScreen3 />} />
          <Route path="/transaction-history" element={<TransactionHistoryScreen1 />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
