import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  BarChart2,
  BookOpenCheck,
  CreditCard,
  LayoutGrid,
  Shield,
  Wallet,
  UserCircle,
  Building2,
} from "lucide-react";

const navLinks = [
  { to: "/dashboard", label: "Dashboard", icon: <LayoutGrid className="h-4 w-4" /> },
  { to: "/transactions", label: "Transactions", icon: <BarChart2 className="h-4 w-4" /> },
  { to: "/accounting", label: "Accounting", icon: <BookOpenCheck className="h-4 w-4" /> },
  { to: "/vce", label: "Virtual Custody", icon: <Shield className="h-4 w-4" /> },
  { to: "/wallets", label: "Wallets", icon: <Wallet className="h-4 w-4" /> },
  { to: "/payment-gateway", label: "Payment Gateway", icon: <CreditCard className="h-4 w-4" /> },
  { to: "/profile", label: "Profile", icon: <UserCircle className="h-4 w-4" /> },
];

const quickLinks = [
  { to: "/profile", label: "Profile", icon: <UserCircle className="h-4 w-4" /> },
  { to: "/wallets", label: "Wallets", icon: <Wallet className="h-4 w-4" /> },
  { to: "/vce", label: "Virtual Custody", icon: <Building2 className="h-4 w-4" /> },
];

export function AppLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const location = useLocation();
  const displayName =
    user?.user_metadata?.name || user?.email || (user ? `User ${user.id.slice(0, 6)}` : "");

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-indigo-50 text-slate-900">
      <header className="sticky top-0 z-20 backdrop-blur bg-white/80 border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 text-white grid place-items-center font-bold">
              B
            </div>
            <div>
              <div className="text-lg font-semibold">Biz Maze</div>
              <div className="text-xs text-slate-500">Unified crypto operations</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {navLinks.map((link) => {
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full border transition hover:-translate-y-0.5 hover:shadow-sm ${
                    active
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white/70 text-slate-700"
                  }`}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700">
              <UserCircle className="h-4 w-4" />
              <span className="text-sm font-medium truncate max-w-[180px]">{displayName}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
            {subtitle && <p className="text-sm text-slate-600 mt-1">{subtitle}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center gap-2 px-3 py-2 rounded-full bg-white border shadow-sm text-slate-700 hover:-translate-y-0.5 transition"
              >
                {link.icon}
                <span className="text-sm font-semibold">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr]">
          <div className="bg-white/90 backdrop-blur rounded-2xl border shadow-sm p-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
