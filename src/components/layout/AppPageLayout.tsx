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
    <div className="app-shell text-slate-900">
      {user && (
        <div className="top-rail">
          <div className="rail-inner">
            <div className="rail-top">
              <div className="identity-chip">
                <div className="identity-avatar">{user.email?.[0]?.toUpperCase() ?? "U"}</div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Signed in</p>
                  <p className="font-semibold">{user.email || "Active account"}</p>
                </div>
              </div>
              <div className="pill-actions">
                {quickButtons.map(({ href, label, icon: Icon }) => (
                  <Link key={href} to={href} className="pill-action">
                    <Icon className="h-4 w-4 text-primary" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            <nav className="nav-chips">
              {mainLinks.map(({ href, label, icon: Icon }) => {
                const isActive = location.pathname === href;
                return (
                  <Link key={href} to={href} className={cn("nav-chip", isActive && "active")}>
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      <main className="page-container">
        <section className="page-hero">
          <div className="hero-text space-y-2">
            <p className="section-title">Secure fintech workspace</p>
            <h1>{title}</h1>
            {description && <p className="max-w-2xl">{description}</p>}
          </div>
          {heroContent && <div className="surface-plain p-4">{heroContent}</div>}
        </section>

        <div className="space-y-6">{children}</div>
      </main>
    </div>
  );
}

export default AppPageLayout;
