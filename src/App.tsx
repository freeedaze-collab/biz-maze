// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";

// 実在する画面に合わせて import（zip 内構成に準拠）
import TransactionHistory from "@/pages/TransactionHistory";
import Accounting from "@/pages/Accounting";
import Profile from "@/pages/Profile";

// 🟢 ウォレットは pages/wallet 配下（一覧/連携のメイン導線を Selection に設定）
import WalletSelection from "@/pages/wallet/WalletSelection";

// 認証フローは auth/Register と auth/Confirm が実体
import Register from "@/pages/auth/Register";
import Confirm from "@/pages/auth/Confirm";

// （必要なら）ログインを追加したい場合は ↓ を有効化
// import Login from "@/pages/auth/Login";

export default function App() {
  return (
    <Routes>
      {/* 認証前 */}
      <Route path="/auth/register" element={<Register />} />
      <Route path="/auth/confirm" element={<Confirm />} />
      {/* <Route path="/auth/login" element={<Login />} /> */}

      {/* アプリページ */}
      <Route path="/wallets" element={<WalletSelection />} />
      <Route path="/transactions" element={<TransactionHistory />} />
      <Route path="/accounting" element={<Accounting />} />
      <Route path="/profile" element={<Profile />} />

      {/* ルート */}
      <Route path="/" element={<Navigate to="/auth/register" replace />} />
      <Route path="*" element={<div className="p-6">Not Found</div>} />
    </Routes>
  );
}
