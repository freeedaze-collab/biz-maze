// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AuthGuard } from "@/components/AuthGuard";

// 実在ページ
import TransactionHistory from "@/pages/TransactionHistory";
import Accounting from "@/pages/Accounting";
import Profile from "@/pages/Profile";
import WalletSelection from "@/pages/wallet/WalletSelection";

// 認証フロー
import Login from "@/pages/auth/Login";
// 既存の Register.tsx は「プロフィール初期設定（国/種別）」として使う
import ProfileSetup from "@/pages/auth/Register";
import Confirm from "@/pages/auth/Confirm";
// 新規で追加するメールサインアップ画面
import EmailSignUp from "@/pages/auth/EmailSignUp";

/**
 * ルート("/")の挙動：
 *  - 未ログイン：/auth/login
 *  - ログイン済：/transactions
 */
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Loading...</div>;
  return user ? <Navigate to="/transactions" replace /> : <Navigate to="/auth/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* 認証前 */}
      <Route path="/auth/login" element={<Login />} />
      {/* 「Create account」はここへ遷移（メール/パスワードで登録） */}
      <Route path="/auth/register" element={<EmailSignUp />} />
      {/* メールの確認リンクから戻る先。確認後はプロフィール初期設定へ誘導 */}
      <Route path="/auth/confirm" element={<Confirm />} />
      {/* プロフィール初期設定（国/種別など）＝ 旧 Register.tsx を流用 */}
      <Route path="/auth/profile-setup" element={<ProfileSetup />} />

      {/* アプリ本体（ログイン必須） */}
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

      {/* ルート */}
      <Route path="/" element={<RootRedirect />} />

      {/* 互換（/signup → /auth/register） */}
      <Route path="/signup" element={<Navigate to="/auth/register" replace />} />

      {/* Fallback */}
      <Route path="*" element={<div className="p-6">Not Found</div>} />
    </Routes>
  );
}
