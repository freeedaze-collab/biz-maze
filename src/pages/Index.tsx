import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Sparkles, Wallet, FileText, ArrowRight } from 'lucide-react';

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-foreground">
            Biz Maze
          </Link>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth/login">Sign In</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/signup">Create Account</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight mb-6">
            Simplify Your Crypto Business Accounting
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Automated bookkeeping, tax handling, and wallet tracking — built for Web3 founders and crypto businesses.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button asChild size="lg" className="text-base">
              <Link to="/signup">
                Create Account
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-base">
              <Link to="/auth/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
              Everything You Need
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Comprehensive tools for managing your crypto finances
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="card-elevated p-6">
              <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Automated Accounting</h3>
              <p className="text-muted-foreground text-sm">
                Turn wallet transactions into ledger entries with smart classification based on IFRS standards.
              </p>
            </div>

            <div className="card-elevated p-6">
              <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Tax Handling</h3>
              <p className="text-muted-foreground text-sm">
                Localized tax calculation with P&L and balance sheet reports ready for filing.
              </p>
            </div>

            <div className="card-elevated p-6">
              <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Wallet className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Multi-Wallet Support</h3>
              <p className="text-muted-foreground text-sm">
                Connect multiple Web3 wallets and exchanges to sync transactions automatically.
              </p>
            </div>

            <div className="card-elevated p-6">
              <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Financial Reports</h3>
              <p className="text-muted-foreground text-sm">
                Generate professional financial statements including P&L, balance sheet, and cash flow.
              </p>
            </div>

            <div className="card-elevated p-6">
              <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Exchange Integration</h3>
              <p className="text-muted-foreground text-sm">
                Connect Binance, Bybit, OKX and more to automatically import your trading history.
              </p>
            </div>

            <div className="card-elevated p-6">
              <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Secure & Private</h3>
              <p className="text-muted-foreground text-sm">
                Your data is encrypted and secured. We only use read-only access to your exchanges.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 sm:px-6 lg:px-8 py-8 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2024 Biz Maze. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
