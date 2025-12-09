import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  BarChart3,
  Calculator,
  CreditCard,
  FileLock,
  PiggyBank,
  ShieldCheck,
  Wallet2,
  Waypoints,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import AppPageLayout from "@/components/layout/AppPageLayout";

interface TileConfig {
  label: string;
  description: string;
  icon: any;
  href?: string;
  status?: "live" | "coming";
}

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [walletCount, setWalletCount] = useState<number | null>(null);
  const [exchangeCount, setExchangeCount] = useState<number | null>(null);

  const displayName = useMemo(
    () => user?.user_metadata?.name || user?.email || (user ? `User ${user.id.slice(0, 6)}` : ""),
    [user]
  );

  useEffect(() => {
    const loadCounts = async () => {
      if (!user?.id) return;
      const [{ count: wallets }, { count: exchanges }] = await Promise.all([
        supabase.from("wallets").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("exchange_connections").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      setWalletCount(wallets ?? 0);
      setExchangeCount(exchanges ?? 0);
    };

    loadCounts();
  }, [user?.id]);

  const onSignOut = async () => {
    await supabase.auth.signOut();
    nav("/", { replace: true });
  };

  const tiles: TileConfig[] = [
    {
      label: "Transaction history",
      description: "Review synced trades, transfers, and ledger notes.",
      icon: Waypoints,
      href: "/transactions",
      status: "live",
    },
    {
      label: "Accounting",
      description: "Statements for P&L, balance sheet, and cash flow.",
      icon: BarChart3,
      href: "/accounting",
      status: "live",
    },
    {
      label: "Payment",
      description: "Collect payments and reconcile instantly.",
      icon: CreditCard,
      status: "coming",
    },
    {
      label: "Tax calculator",
      description: "Keep ahead of filing deadlines and estimates.",
      icon: Calculator,
      status: "coming",
    },
    {
      label: "Security",
      description: "Permissions, approvals, and audit trails.",
      icon: ShieldCheck,
      status: "coming",
    },
    {
      label: "Payment Gateway",
      description: "Host checkouts and share pay links.",
      icon: FileLock,
      status: "coming",
    },
    {
      label: "Get Investment",
      description: "Fundraise with clean financials and insights.",
      icon: PiggyBank,
      status: "coming",
    },
  ];

  return (
    <AppPageLayout
      title="Dashboard"
      description="See everything linked to your account and jump into the workflows you need."
      heroContent={
        <div className="rounded-2xl bg-white/80 border border-border/70 shadow-sm px-5 py-4 text-left min-w-[220px]">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Account owner</p>
          <p className="text-lg font-semibold text-slate-900">{displayName}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map(({ label, description, icon: Icon, href, status }) => {
          const isComing = status === "coming";
          const content = (
            <div
              className={
                "h-full rounded-2xl border border-border/80 bg-white/80 shadow-sm p-4 flex flex-col gap-2 transition hover:-translate-y-1 hover:shadow-md"
              }
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-muted p-2 text-slate-600">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{label}</p>
                    {isComing && (
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Coming soon</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
            </div>
          );

          if (isComing || !href) {
            return (
              <div key={label} className="opacity-80">
                {content}
              </div>
            );
          }

          return (
            <Link key={label} to={href} className="h-full">
              {content}
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border/80 bg-white/80 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">Account hub</p>
              <h2 className="text-xl font-bold">Profiles & Connections</h2>
            </div>
            <Button variant="outline" onClick={onSignOut} className="text-sm">
              Sign out
            </Button>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            <AccordionItem value="profile" className="border border-border rounded-xl px-4">
              <AccordionTrigger>Profile</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Manage tax residency, entity type, and compliance details.</p>
                <Link to="/profile" className="inline-flex items-center text-primary font-semibold">
                  Go to profile →
                </Link>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="wallets" className="border border-border rounded-xl px-4">
              <AccordionTrigger>Wallets</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <p className="text-muted-foreground">Linked wallets</p>
                  <span className="font-semibold">{walletCount ?? "–"}</span>
                </div>
                <Link to="/wallets" className="inline-flex items-center text-primary font-semibold">
                  Manage wallets →
                </Link>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="vce" className="border border-border rounded-xl px-4">
              <AccordionTrigger>Virtual Custody Exchange</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <p className="text-muted-foreground">Exchange connections</p>
                  <span className="font-semibold">{exchangeCount ?? "–"}</span>
                </div>
                <Link to="/vce" className="inline-flex items-center text-primary font-semibold">
                  Open VCE →
                </Link>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="rounded-2xl border border-border/80 bg-white/80 shadow-sm p-6 space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">What to do next</p>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              • Review <Link className="text-primary font-semibold" to="/transactions">Transaction history</Link> to confirm the
              latest sync and label usages.
            </p>
            <p>
              • Download statements from <Link className="text-primary font-semibold" to="/accounting">Accounting</Link> before
              sharing with stakeholders.
            </p>
            <p>
              • Keep wallets and exchanges current so your balances stay audit-ready.
            </p>
          </div>
        </div>
      </div>
    </AppPageLayout>
  );
}
