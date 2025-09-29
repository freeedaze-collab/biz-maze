import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import { AuthGuard } from '@/components/AuthGuard';

// pages
import AccountingTaxScreen1 from '@/pages/accounting/AccountingTaxScreen1';
import TransactionHistory from '@/pages/TransactionHistory';
import TransferScreen3 from '@/pages/transfer/TransferScreen3';
import Pricing from '@/pages/Pricing';

// 認証フロー（例）
import Login from '@/pages/auth/Login';
import Signup from '@/pages/auth/Signup';
import AccountTypeSelection from '@/pages/auth/AccountTypeSelection';
import CountryCompanySettings from '@/pages/settings/CountryCompanySettings';

function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* 認証外ルート */}
      <Route path="/auth/login" element={<Login />} />
      <Route path="/auth/signup" element={<Signup />} />

      {/* セットアップ関連（必要に応じてガード外に） */}
      <Route path="/auth/account-setup" element={<AccountTypeSelection />} />
      <Route path="/settings" element={<CountryCompanySettings />} />

      {/* 認証必須領域 */}
      <Route
        path="/"
        element={
          <AuthGuard>
            <AuthedLayout>
              <div className="p-6">Welcome to Dashboard</div>
            </AuthedLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/accounting"
        element={
          <AuthGuard>
            <AuthedLayout>
              <AccountingTaxScreen1 />
            </AuthedLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/transactions"
        element={
          <AuthGuard>
            <AuthedLayout>
              <TransactionHistory />
            </AuthedLayout>
          </AuthGuard>
        }
      />
      {/* 旧パスは新パスへリダイレクト */}
      <Route path="/transaction-history" element={<Navigate to="/transactions" replace />} />

      <Route
        path="/transfer"
        element={
          <AuthGuard>
            <AuthedLayout>
              <TransferScreen3 />
            </AuthedLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/pricing"
        element={
          <AuthGuard>
            <AuthedLayout>
              <Pricing />
            </AuthedLayout>
          </AuthGuard>
        }
      />

      {/* フォールバック */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
