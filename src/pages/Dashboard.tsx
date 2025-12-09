import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import {
  BarChart2,
  BookOpenCheck,
  CreditCard,
  PiggyBank,
  Shield,
  Wallet,
  LayoutDashboard,
  UserCircle,
} from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const displayName =
    user?.user_metadata?.name || user?.email || (user ? `User ${user.id.slice(0, 6)}` : "");

  const onSignOut = async () => {
    await supabase.auth.signOut();
    nav("/", { replace: true });
  };

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Quick access to every page and upcoming tools in one place."
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/transactions"
            className="group rounded-xl border p-4 bg-gradient-to-br from-white via-white to-indigo-50 hover:-translate-y-1 transition shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-700">Transactions</div>
              <BarChart2 className="h-6 w-6 text-slate-500 group-hover:text-indigo-600" />
            </div>
            <p className="text-sm text-slate-500 mt-2">Review history, sync, and label usage.</p>
          </Link>

          <Link
            to="/accounting"
            className="group rounded-xl border p-4 bg-gradient-to-br from-white via-white to-indigo-50 hover:-translate-y-1 transition shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-700">Accounting</div>
              <BookOpenCheck className="h-6 w-6 text-slate-500 group-hover:text-indigo-600" />
            </div>
            <p className="text-sm text-slate-500 mt-2">View statements and export-ready numbers.</p>
          </Link>

          <Link
            to="/payment-gateway"
            className="group rounded-xl border p-4 bg-gradient-to-br from-white via-white to-indigo-50 hover:-translate-y-1 transition shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-700">Payment Gateway</div>
              <CreditCard className="h-6 w-6 text-slate-500 group-hover:text-indigo-600" />
            </div>
            <p className="text-sm text-slate-500 mt-2">Create checkout links and test merchants.</p>
          </Link>

          <div className="rounded-xl border p-4 bg-slate-50 text-slate-500">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Payment</div>
              <PiggyBank className="h-6 w-6" />
            </div>
            <p className="text-sm mt-2">Coming soon</p>
          </div>

          <div className="rounded-xl border p-4 bg-slate-50 text-slate-500">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Tax calculator</div>
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <p className="text-sm mt-2">Coming soon</p>
          </div>

          <div className="rounded-xl border p-4 bg-slate-50 text-slate-500">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Security</div>
              <Shield className="h-6 w-6" />
            </div>
            <p className="text-sm mt-2">Coming soon</p>
          </div>

          <div className="rounded-xl border p-4 bg-slate-50 text-slate-500">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Get Investment</div>
              <PiggyBank className="h-6 w-6" />
            </div>
            <p className="text-sm mt-2">Coming soon</p>
          </div>

          <Link
            to="/vce"
            className="group rounded-xl border p-4 bg-gradient-to-br from-white via-white to-indigo-50 hover:-translate-y-1 transition shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-700">Virtual Custody / Exchanges</div>
              <Shield className="h-6 w-6 text-slate-500 group-hover:text-indigo-600" />
            </div>
            <p className="text-sm text-slate-500 mt-2">Link API keys and trigger syncs.</p>
          </Link>

          <Link
            to="/wallets"
            className="group rounded-xl border p-4 bg-gradient-to-br from-white via-white to-indigo-50 hover:-translate-y-1 transition shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-700">Wallets</div>
              <Wallet className="h-6 w-6 text-slate-500 group-hover:text-indigo-600" />
            </div>
            <p className="text-sm text-slate-500 mt-2">Link, verify, and review connected wallets.</p>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <details className="rounded-xl border p-4 bg-white shadow-sm" open>
            <summary className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <UserCircle className="h-5 w-5" /> Profile & linked accounts
              </div>
            </summary>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <div>Email: <span className="font-medium text-slate-800">{displayName}</span></div>
              <p className="text-slate-500">Manage your personal details and authentication in Profile.</p>
              <div className="flex flex-wrap gap-2">
                <Link to="/profile" className="px-3 py-1.5 rounded-full border text-xs font-semibold text-indigo-700">Open Profile</Link>
                <Link to="/pricing" className="px-3 py-1.5 rounded-full border text-xs">Plans</Link>
              </div>
            </div>
          </details>

          <details className="rounded-xl border p-4 bg-white shadow-sm" open>
            <summary className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <Wallet className="h-5 w-5" /> Wallets & Virtual Custody
              </div>
            </summary>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>Link on-chain wallets or exchange accounts from here.</p>
              <div className="flex flex-wrap gap-2">
                <Link to="/wallets" className="px-3 py-1.5 rounded-full border text-xs font-semibold text-indigo-700">Wallets</Link>
                <Link to="/vce" className="px-3 py-1.5 rounded-full border text-xs font-semibold text-indigo-700">Virtual Custody</Link>
              </div>
              <p className="text-xs text-slate-500">Use the Transactions page to verify synced activity after linking.</p>
            </div>
          </details>
        </div>

        <div className="flex items-center justify-end">
          <button
            onClick={onSignOut}
            className="px-4 py-2 rounded-full border text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
