// src/App.tsx
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import EmailSignUp from "@/pages/auth/EmailSignUp";
import Confirm from "@/pages/auth/Confirm";

// 既存ページの import（必要に応じて実プロジェクトに合わせてください）
import TransactionHistory from "@/pages/TransactionHistory";
import Accounting from "@/pages/Accounting";
import Profile from "@/pages/Profile";
// ...他のページもここに

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* 新規: サインアップ */}
        <Route path="/auth/register" element={<EmailSignUp />} />
        {/* 新規: メールリンク着地（セッション確立→/profileへ） */}
        <Route path="/auth/confirm" element={<Confirm />} />

        {/* 既存 */}
        <Route path="/transactions" element={<TransactionHistory />} />
        <Route path="/accounting" element={<Accounting />} />
        <Route path="/profile" element={<Profile />} />

        {/* ルートや404などは適宜調整 */}
        <Route path="/" element={<Navigate to="/auth/register" replace />} />
        <Route path="*" element={<div className="p-6">Not Found</div>} />
      </Routes>
    </HashRouter>
  );
}
