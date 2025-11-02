// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";

// 既存のページ群（実プロジェクトのパスに合わせてください）
import TransactionHistory from "@/pages/TransactionHistory";
import Accounting from "@/pages/Accounting";
import Profile from "@/pages/Profile";
import Wallets from "@/pages/Wallets";

// 先日お渡ししたサインアップフロー（作っていれば有効）
import EmailSignUp from "@/pages/auth/EmailSignUp";
import Confirm from "@/pages/auth/Confirm";

export default function App() {
  return (
    <Routes>
      {/* 認証前導線（メールサインアップ） */}
      <Route path="/auth/register" element={<EmailSignUp />} />
      <Route path="/auth/confirm" element={<Confirm />} />

      {/* アプリページ */}
      <Route path="/wallets" element={<Wallets />} />
      <Route path="/transactions" element={<TransactionHistory />} />
      <Route path="/accounting" element={<Accounting />} />
      <Route path="/profile" element={<Profile />} />

      {/* ルート */}
      <Route path="/" element={<Navigate to="/auth/register" replace />} />
      <Route path="*" element={<div className="p-6">Not Found</div>} />
    </Routes>
  );
}
