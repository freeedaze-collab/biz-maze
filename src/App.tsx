// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AuthGuard } from "@/components/AuthGuard";

// 実在するアプリページ
import TransactionHistory from "@/pages/TransactionHistory";
import Accounting from "@/pages/Accounting";
import Profile from "@/pages/Profile";
// ウォレットは pages/wallet 配下
import WalletSelection from "@/pages/wallet/WalletSelection";

// 認証フロー（実体に合わせる）
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import Confirm from "@/pages/auth/Confirm";

/**
 * ルート("/")の挙動：
 *  - ログイン済み：アプリのトップ（ここでは /transactions）へ
 *  - 未ログイン　：/auth/login へ
 * ページ“削除”で直すのではなく、条件分岐で正しく分ける。
 */
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Loading...</div>;
  return user ? <Navigate to="/transactions" replace /> : <Navigate to="/auth/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* 認証前導線（既存ページを活かす） */}
      <Route path="/auth/login" element={<Login />} />
      <Route path="/auth/register" element={<Register />} />
      <Route path="/auth/confirm" element={<Confirm />} />

      {/* アプリページは AuthGuard で保護 */}
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

      {/* ルート：状態依存で分岐 */}
      <Route path="/" element={<RootRedirect />} />

      {/* 互換（/signup 等 → /auth/register）。不要なら後で削除可 */}
      <Route path="/signup" element={<Navigate to="/auth/register" replace />} />

      {/* Fallback */}
      <Route path="*" element={<div className="p-6">Not Found</div>} />
    </Routes>
  );
}
