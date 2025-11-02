// src/App.tsx
import { Routes, Route } from "react-router-dom";
import { AuthGuard } from "@/components/AuthGuard";

// ---- Public pages (存在確認済み) ----
import Index from "@/pages/Index";              // ランディング（/）
import Home from "@/pages/Home";                // 必要なら /home でアクセス
import Pricing from "@/pages/Pricing";          // /pricing
import NotFound from "@/pages/NotFound";        // 最後のフォールバック

// ---- Auth flow (存在確認済み) ----
import Login from "@/pages/auth/Login";         // /auth/login
import Register from "@/pages/auth/Register";   // /auth/register（= プロフィール初期設定の画面として残す）
import Confirm from "@/pages/auth/Confirm";     // /auth/confirm

// ---- App pages (存在確認済み) ----
import TransactionHistory from "@/pages/TransactionHistory";
import Accounting from "@/pages/Accounting";
import Profile from "@/pages/Profile";
import WalletSelection from "@/pages/wallet/WalletSelection";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Index />} />
      <Route path="/home" element={<Home />} />
      <Route path="/pricing" element={<Pricing />} />

      {/* Auth */}
      <Route path="/auth/login" element={<Login />} />
      <Route path="/auth/register" element={<Register />} />
      <Route path="/auth/confirm" element={<Confirm />} />

      {/* App (protected) */}
      <Route
        path="/wallets"
        element={
          <AuthGuard>
            <WalletSelection />
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

      {/* 最後のフォールバック */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
