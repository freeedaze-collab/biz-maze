// src/App.tsx
import { Routes, Route } from "react-router-dom";
import { AuthGuard } from "@/components/AuthGuard";

// Public pages
import Index from "@/pages/Index";
import Pricing from "@/pages/Pricing";
import NotFound from "@/pages/NotFound";

// Auth flow
import Login from "@/pages/auth/Login";
import EmailSignUp from "@/pages/auth/EmailSignUp"; // /signup
import Register from "@/pages/auth/Register";       // /signupform（初回プロファイル設定）
import Confirm from "@/pages/auth/Confirm";

// App pages
import Dashboard from "@/pages/Dashboard";
import TransactionHistory from "@/pages/TransactionHistory";
import Accounting from "@/pages/Accounting";
import Profile from "@/pages/Profile";
import WalletSelection from "@/pages/wallet/WalletSelection";
import SendMoney from "@/pages/SendMoney";
import CreateInvoice from "@/pages/CreateInvoice";


export default function App() {
  return (
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

{/* ── 互換（ダッシュボタンが別パスを向いている可能性に備える）── */}
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
  　　　element{
    　　　<AuthGuard>
      　　　<CreateInvoice />
    　　　</AuthGuard>
  　　　}
　　　/>


      {/* Fallback */}
     <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
