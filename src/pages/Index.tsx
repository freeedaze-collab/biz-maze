// src/pages/Index.tsx
import { Button } from "@/components/ui/button";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="px-6 py-24 text-center max-w-4xl mx-auto">
        <h1 className="text-5xl font-extrabold tracking-tight mb-6">
          Simplify Your Crypto Business Accounting
        </h1>
        <p className="text-xl text-muted-foreground mb-10">
          Automated bookkeeping, tax handling, and wallet tracking — built for Web3 founders.
        </p>

        <div className="flex justify-center gap-4">
          {/* ⬇️ 修正：/auth/login → /signup */}
          <Button asChild size="lg">
            <Link to="/signup">Get Started</Link>
          </Button>

          <Button asChild variant="outline" size="lg">
            <Link to="/auth/login">Sign In</Link>
          </Button>
        </div>

        <div className="mt-4">
          {/* ⬇️ 修正：/auth/register → /signup */}
          <Link to="/signup" className="text-sm text-muted-foreground underline">
            Create a free account →
          </Link>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="px-6 py-20 bg-muted/40">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-10 text-left">
          <div>
            <Sparkles className="h-8 w-8 text-primary mb-3" />
            <h3 className="text-xl font-bold mb-2">Automated Accounting</h3>
            <p className="text-muted-foreground">
              Turn wallet transactions into ledger entries with smart classification.
            </p>
          </div>

          <div>
            <CheckCircle2 className="h-8 w-8 text-primary mb-3" />
            <h3 className="text-xl font-bold mb-2">Crypto Tax Handling</h3>
            <p className="text-muted-foreground">
              Localized tax calculation, P/L and balance sheet ready for filing.
            </p>
          </div>

          <div>
            <Sparkles className="h-8 w-8 text-primary mb-3" />
            <h3 className="text-xl font-bold mb-2">Multi-Wallet Support</h3>
            <p className="text-muted-foreground">
              Connect multiple Web3 wallets and sync transactions in one click.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
