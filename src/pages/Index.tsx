// src/pages/Index.tsx
import { Button } from "@/components/ui/button";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export default function Index() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-slate-50 text-slate-900">
      {/* Hero Section */}
      <section className="px-6 py-24 max-w-6xl mx-auto flex flex-col gap-12 lg:flex-row lg:items-center">
        <div className="flex-1 space-y-6">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Web3 finance OS</p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Make crypto accounting and compliance feel effortless.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Reconcile wallets, exchanges, and payments in one clear workspace. Stay investor-ready with
            automated statements and real-time portfolio health.
          </p>

          <div className="flex flex-wrap gap-4">
            <Button asChild size="lg">
              <Link to="/signup">Create account</Link>
            </Button>

            <Button asChild variant="outline" size="lg">
              <Link to="/auth/login">Sign in</Link>
            </Button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white/80 border border-border/70 shadow-md p-4">
            <Sparkles className="h-6 w-6 text-primary mb-2" />
            <p className="font-semibold">Autopilot bookkeeping</p>
            <p className="text-sm text-muted-foreground">
              Smart classification of trades, transfers, and staking income.
            </p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-border/70 shadow-md p-4">
            <CheckCircle2 className="h-6 w-6 text-primary mb-2" />
            <p className="font-semibold">Audit-ready tax packs</p>
            <p className="text-sm text-muted-foreground">Profit & loss, cash flow, and filings-ready exports.</p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-border/70 shadow-md p-4">
            <Sparkles className="h-6 w-6 text-primary mb-2" />
            <p className="font-semibold">Wallet + exchange sync</p>
            <p className="text-sm text-muted-foreground">Securely connect Web3 wallets and read-only APIs.</p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-border/70 shadow-md p-4">
            <CheckCircle2 className="h-6 w-6 text-primary mb-2" />
            <p className="font-semibold">Collaboration ready</p>
            <p className="text-sm text-muted-foreground">Share reliable numbers with finance, founders, and auditors.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
