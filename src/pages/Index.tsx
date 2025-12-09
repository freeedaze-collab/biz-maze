// src/pages/Index.tsx
import { Button } from "@/components/ui/button";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export default function Index() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-indigo-50 text-slate-900">
      <section className="px-6 py-20 max-w-5xl mx-auto text-center space-y-6">
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-600 font-semibold">Crypto finance workspace</p>
        <h1 className="text-5xl font-extrabold tracking-tight">
          A calmer home for wallets, exchanges, and accounting
        </h1>
        <p className="text-lg text-slate-600 max-w-3xl mx-auto">
          Sync every wallet and exchange, review transactions, and export clean statements without touching the backend.
        </p>

        <div className="flex justify-center gap-4">
          <Button asChild size="lg">
            <Link to="/signup">Sign up</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/auth/login">Sign in</Link>
          </Button>
        </div>
      </section>

      <section className="px-6 py-16 bg-white/80 border-t border-b">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-10 text-left">
          <div>
            <Sparkles className="h-8 w-8 text-indigo-500 mb-3" />
            <h3 className="text-xl font-bold mb-2">Automated Accounting</h3>
            <p className="text-slate-600">
              Turn wallet transactions into ledger entries with smart classification.
            </p>
          </div>

          <div>
            <CheckCircle2 className="h-8 w-8 text-indigo-500 mb-3" />
            <h3 className="text-xl font-bold mb-2">Crypto Tax Handling</h3>
            <p className="text-slate-600">
              Localized tax calculation, P/L and balance sheet ready for filing.
            </p>
          </div>

          <div>
            <Sparkles className="h-8 w-8 text-indigo-500 mb-3" />
            <h3 className="text-xl font-bold mb-2">Multi-Wallet Support</h3>
            <p className="text-slate-600">
              Connect multiple Web3 wallets and sync transactions in one click.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
