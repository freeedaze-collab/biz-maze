import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowLeftRight,
  CreditCard,
  LayoutDashboard,
  ListOrdered,
  Table2,
  UserRound,
  Wallet2,
  Workflow,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface AppPageLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  heroContent?: ReactNode;
}

const mainLinks = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Transactions", href: "/transactions", icon: ListOrdered },
  { label: "Accounting", href: "/accounting", icon: Table2 },
  { label: "Wallets", href: "/wallets", icon: Wallet2 },
  { label: "Virtual Custody Exchange", href: "/vce", icon: ArrowLeftRight },
  { label: "Payment Gateway", href: "/payment-gateway", icon: CreditCard },
  { label: "Profile", href: "/profile", icon: UserRound },
];

const quickButtons = [
  { label: "Profile", href: "/profile", icon: UserRound },
  { label: "Wallets", href: "/wallets", icon: Wallet2 },
  { label: "Virtual Custody Exchange", href: "/vce", icon: Workflow },
];

export function AppPageLayout({ title, description, children, heroContent }: AppPageLayoutProps) {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-slate-50 text-slate-900">
      {user && (
        <div className="border-b bg-white/80 backdrop-blur shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-accent text-white font-semibold grid place-items-center shadow-sm">
                  {user.email?.[0]?.toUpperCase() ?? "U"}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Signed in</p>
                  <p className="font-semibold">{user.email || "Active account"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {quickButtons.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    to={href}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-sm font-medium shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <Icon className="h-4 w-4 text-primary" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {mainLinks.map(({ href, label, icon: Icon }) => {
                const isActive = location.pathname === href;
                return (
                  <Link
                    key={href}
                    to={href}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold border transition duration-200",
                      "bg-white/80 text-slate-700 hover:border-primary/50 hover:text-primary hover:-translate-y-0.5",
                      isActive && "border-primary text-primary shadow-sm"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-10 space-y-6">
        <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-accent/5 to-white border border-border/70 shadow-elegant p-6 md:p-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">Secure fintech workspace</p>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">{title}</h1>
            {description && <p className="text-muted-foreground max-w-2xl">{description}</p>}
          </div>
          {heroContent}
        </div>

        {children}
      </main>
    </div>
  );
}

export default AppPageLayout;
