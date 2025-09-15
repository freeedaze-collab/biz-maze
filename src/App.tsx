import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import InvoiceList from "./pages/invoice/InvoiceList";
import InvoiceDetails from "./pages/invoice/InvoiceDetails";
import InvoicePayment from "./pages/invoice/InvoicePayment";
import InvoiceCompletion from "./pages/invoice/InvoiceCompletion";
import TransactionList from "./pages/transaction/TransactionList";
import TransactionDetails from "./pages/transaction/TransactionDetails";
import TransactionPending from "./pages/transaction/TransactionPending";
import WithdrawalRequest from "./pages/withdrawal/WithdrawalRequest";
import WithdrawalConfirmation from "./pages/withdrawal/WithdrawalConfirmation";
import WalletSelection from "./pages/wallet/WalletSelection";
import WalletConnect from "./pages/wallet/WalletConnect";
import WalletSuccess from "./pages/wallet/WalletSuccess";
import TransactionHistory from "./pages/TransactionHistory";
import SynthesisStatus from "./pages/SynthesisStatus";
import InvoiceStatusCheck from "./pages/invoice/InvoiceStatusCheck";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/billing" element={<InvoiceList />} />
          <Route path="/invoice/:id" element={<InvoiceDetails />} />
          <Route path="/invoice/:id/payment" element={<InvoicePayment />} />
          <Route path="/invoice/:id/completion" element={<InvoiceCompletion />} />
          <Route path="/transactions" element={<TransactionList />} />
          <Route path="/transaction/:id" element={<TransactionDetails />} />
          <Route path="/transaction/:id/pending" element={<TransactionPending />} />
          <Route path="/withdrawal" element={<WithdrawalRequest />} />
          <Route path="/withdrawal/confirmation" element={<WithdrawalConfirmation />} />
          <Route path="/wallet" element={<WalletSelection />} />
          <Route path="/wallet/:id/connect" element={<WalletConnect />} />
          <Route path="/wallet/:id/success" element={<WalletSuccess />} />
          <Route path="/transaction-history" element={<TransactionHistory />} />
          <Route path="/synthesis-status" element={<SynthesisStatus />} />
          <Route path="/invoice-status" element={<InvoiceStatusCheck />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
