// src/pages/Index.tsx
import { Button } from "@/components/ui/button";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export default function Index() {
  return (
    <div className="app-shell">
      <section className="landing-hero">
        <div className="space-y-6">
          <span className="hero-pill">
            <Sparkles className="h-4 w-4" /> Web3 finance OS
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight text-slate-900">
            Make crypto accounting and compliance feel effortless.
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Reconcile wallets, exchanges, and payments in one vibrant workspace. Keep investors confident with automated
            statements and live portfolio health.
          </p>

          <div className="hero-actions">
            <Button asChild size="lg">
              <Link to="/signup">Create account</Link>
            </Button>

            <Button asChild variant="outline" size="lg">
              <Link to="/auth/login">Sign in</Link>
            </Button>
          </div>
        </div>

        <div className="feature-cards">
          <div className="feature-card">
            <Sparkles className="h-6 w-6 light-icon mb-2" />
            <p className="font-semibold">Autopilot bookkeeping</p>
            <p className="text-sm text-muted-foreground">Smart classification of trades, transfers, and staking income.</p>
          </div>
          <div className="feature-card">
            <CheckCircle2 className="h-6 w-6 light-icon mb-2" />
            <p className="font-semibold">Audit-ready tax packs</p>
            <p className="text-sm text-muted-foreground">Profit & loss, cash flow, and filings-ready exports.</p>
          </div>
          <div className="feature-card">
            <Sparkles className="h-6 w-6 light-icon mb-2" />
            <p className="font-semibold">Wallet + exchange sync</p>
            <p className="text-sm text-muted-foreground">Securely connect Web3 wallets and read-only APIs.</p>
          </div>
          <div className="feature-card">
            <CheckCircle2 className="h-6 w-6 light-icon mb-2" />
            <p className="font-semibold">Collaboration ready</p>
            <p className="text-sm text-muted-foreground">Share reliable numbers with finance, founders, and auditors.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
