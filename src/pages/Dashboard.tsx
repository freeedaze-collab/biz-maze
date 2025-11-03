// src/pages/Dashboard.tsx
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();

  const displayName =
    user?.user_metadata?.name ||
    user?.email ||
    (user ? `User ${user.id.slice(0, 6)}` : "");

  const onSignOut = async () => {
    await supabase.auth.signOut();
    nav("/", { replace: true });
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          {/* User chip */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white grid place-items-center text-xs">
              {displayName?.[0]?.toUpperCase() ?? "U"}
            </div>
            <span className="text-sm text-muted-foreground max-w-[180px] truncate">
              {displayName}
            </span>
          </div>
          {/* Sign out */}
          <button
            onClick={onSignOut}
            className="px-3 py-1.5 rounded bg-red-600 text-white text-sm"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Money */}
        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-2">Money</h2>
          <div className="flex flex-col gap-2">
            <Link
              to="/send-money"
              className="px-3 py-2 rounded bg-blue-600 text-white text-center"
            >
              Send money
            </Link>
            <Link
              to="/create-invoice"
              className="px-3 py-2 rounded border text-center"
            >
              Create invoice
            </Link>
          </div>
        </div>

        {/* Records */}
        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-2">Records</h2>
          <div className="flex flex-col gap-2">
            <Link to="/transactions" className="px-3 py-2 rounded border text-center">
              Transaction History
            </Link>
            <Link to="/accounting" className="px-3 py-2 rounded border text-center">
              Accounting / Tax
            </Link>
          </div>
        </div>

        {/* Account */}
        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-2">Account</h2>
          <div className="flex flex-col gap-2">
            <Link to="/profile" className="px-3 py-2 rounded border text-center">
              Profile
            </Link>
            <Link to="/pricing" className="px-3 py-2 rounded border text-center">
              Upgrade Plan
            </Link>
          </div>
        </div>

        {/* Wallets */}
        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-2">Wallets</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Manage connected wallets and verification.
          </p>
          <Link
            to="/wallets"
            className="px-3 py-2 rounded bg-blue-600 text-white text-center inline-block"
          >
            Open Wallets
          </Link>
        </div>

        {/* Payment Gateway */}
        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-2">Payment Gateway</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Configure merchant settings and generate checkout links.
          </p>
          <Link
            to="/payment-gateway"
            className="px-3 py-2 rounded border text-center inline-block"
          >
            Open Payment Gateway
          </Link>
        </div>
      </div>
    </div>
  );
}
