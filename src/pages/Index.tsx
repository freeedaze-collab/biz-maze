// src/pages/Index.tsx
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Wallet,
  FileSpreadsheet,
  Calculator,
  CreditCard,
  Shield,
  Settings,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Globe,
  ShieldCheck,
  Zap,
  UserPlus,
  Link2,
  RefreshCw,
  BookOpen,
} from "lucide-react";
import dashboardScreenshot from "@/assets/dashboard-screenshot.png";
import financialStatementsScreenshot from "@/assets/financial-statements-screenshot.png";

const capabilities = [
  {
    icon: Wallet,
    title: "Wallet & Exchange Connections",
    description: "Securely connect on-chain wallets and exchange accounts with read-only APIs.",
  },
  {
    icon: FileSpreadsheet,
    title: "Automated Accounting Workflows",
    description: "Transform blockchain data into journal entries aligned with your chart of accounts.",
  },
  {
    icon: Calculator,
    title: "Tax Calculation",
    description: "Automated cost basis tracking and tax lot calculations.",
    badge: "Coming Soon",
  },
  {
    icon: CreditCard,
    title: "Payment Automation",
    description: "Streamline crypto payments with approval workflows and audit trails.",
    badge: "Coming Soon",
  },
  {
    icon: Shield,
    title: "Security & Access Control",
    description: "Role-based permissions, audit logs, and enterprise-grade security controls.",
    badge: "Coming Soon",
  },
  {
    icon: Settings,
    title: "Custom Workflow Development",
    description: "Tailored modules and integrations built for your specific requirements.",
    badge: "Coming Soon",
  },
];

const valueProps = [
  "Reliable on-chain → ledger automation",
  "GAAP-aligned accounting workflows",
  "Treasury controls & auditability",
  "Configurable for your internal processes",
];

export default function Index() {
  const [showStickyButton, setShowStickyButton] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show sticky button when scrolled down 400px
      setShowStickyButton(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-card">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-xl font-semibold text-foreground tracking-tight">
            Dollar-biz
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#capabilities" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Capabilities
            </a>
            <a href="#platform" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Platform
            </a>
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth/login">Sign In</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/signup">Sign Up</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Crypto-themed background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-cyan-500/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-400/20 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />

        <div className="container mx-auto px-6 py-12 md:py-16 relative">
          <div className="max-w-6xl mx-auto">
            {/* Title */}
            <div className="text-center mb-8">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground tracking-tight leading-tight mb-6">
                Dollar-biz
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Digital Asset Finance Infrastructure
              </p>
            </div>

            {/* Key Features - Side by Side */}
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-8">
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30 p-6 hover:shadow-xl hover:shadow-primary/20 transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
                <div className="relative">
                  <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <TrendingUp className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-4">
                    📊 Auto Crypto Accounting
                  </h3>
                  <p className="text-lg font-semibold text-foreground/90 mb-2">
                    Real-time, Auditable Financial Statements
                  </p>
                  <p className="text-muted-foreground">
                    Instantly generate financial statements with real-time updates, full audit trails, and easy analysis capabilities
                  </p>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border-2 border-accent/30 p-6 hover:shadow-xl hover:shadow-accent/20 transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl" />
                <div className="relative">
                  <div className="w-14 h-14 rounded-xl bg-accent/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Globe className="h-7 w-7 text-accent" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-4">
                    🌐 Coverage
                  </h3>
                  <p className="text-lg font-semibold text-foreground/90 mb-2">
                    Multi-Chain & Multi-Exchange Support
                  </p>
                  <p className="text-muted-foreground">
                    Support for numerous cryptocurrencies, wallets, and exchanges — with continuous expansion
                  </p>
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" className="min-w-[200px] text-lg h-12">
                <Link to="/signup">
                  Sign Up
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="min-w-[200px] text-lg h-12">
                <Link to="/auth/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Early Access Benefits Section */}
      <section className="border-t border-border bg-gradient-to-b from-card to-background py-8 md:py-12">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">
                Early Access Benefits
              </h2>
              <p className="text-lg text-muted-foreground">
                Join now and unlock exclusive advantages
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-3 text-lg">
                  Rapid Feature Development
                </h3>
                <p className="text-muted-foreground">
                  Your feature requests will be implemented or refined within just a few days
                </p>
              </div>
              <div className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Calculator className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-3 text-lg">
                  Pricing Flexibility
                </h3>
                <p className="text-muted-foreground">
                  Participate in pricing discussions for the paid version before launch
                </p>
              </div>
              <div className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-3 text-lg">
                  Unlimited Support
                </h3>
                <p className="text-muted-foreground">
                  Free unlimited support and consultations — for as long as you use the platform
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Capabilities Section */}
      <section id="capabilities" className="border-t border-border bg-background py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">
              Core Capabilities
            </h2>
            <p className="text-lg text-muted-foreground">
              Enterprise-grade tools built for finance operations
            </p>
          </div>
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {capabilities.map((capability, index) => (
                <div
                  key={index}
                  className="group p-6 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                    <capability.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-foreground">{capability.title}</h3>
                    {capability.badge && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">
                        {capability.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {capability.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>



      {/* Auditable IFRS Crypto Accounting Section */}
      <section className="border-t border-border bg-card py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">
              Auditable IFRS Crypto Accounting
            </h2>
          </div>
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-6 rounded-xl bg-background border border-border hover:border-primary/30 transition-all">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Sync Blockchain Transactions</h3>
                <p className="text-sm text-muted-foreground">
                  Automatically sync all transactions from wallets, exchanges, and custodians
                </p>
              </div>
              <div className="p-6 rounded-xl bg-background border border-border hover:border-primary/30 transition-all">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Track Gains & Losses</h3>
                <p className="text-sm text-muted-foreground">
                  Automatically track realised and unrealised gains and losses with cost basis details, live market rates
                </p>
              </div>
              <div className="p-6 rounded-xl bg-background border border-border hover:border-primary/30 transition-all">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Consolidated Accounting</h3>
                <p className="text-sm text-muted-foreground">
                  Covering Consolidated and non-consolidated Accounting
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How-To Section */}
      <section className="border-t border-border bg-background py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">
              How to financial document with Dollar-biz
            </h2>
          </div>
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center p-6 rounded-xl bg-card border border-border hover:border-primary/30 transition-all">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <UserPlus className="h-7 w-7 text-primary" />
                </div>
                <div className="text-2xl font-bold text-primary mb-2">1</div>
                <h3 className="font-semibold text-foreground mb-2">Register and Set Profile</h3>
                <p className="text-sm text-muted-foreground">
                  Create your account and configure your company profile
                </p>
              </div>
              <div className="text-center p-6 rounded-xl bg-card border border-border hover:border-primary/30 transition-all">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Link2 className="h-7 w-7 text-primary" />
                </div>
                <div className="text-2xl font-bold text-primary mb-2">2</div>
                <h3 className="font-semibold text-foreground mb-2">Connect Wallet and VCE</h3>
                <p className="text-sm text-muted-foreground">
                  Link your crypto wallets and virtual currency exchanges
                </p>
              </div>
              <div className="text-center p-6 rounded-xl bg-card border border-border hover:border-primary/30 transition-all">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <RefreshCw className="h-7 w-7 text-primary" />
                </div>
                <div className="text-2xl font-bold text-primary mb-2">3</div>
                <h3 className="font-semibold text-foreground mb-2">Sync History</h3>
                <p className="text-sm text-muted-foreground">
                  Automatically import all transaction history
                </p>
              </div>
              <div className="text-center p-6 rounded-xl bg-card border border-border hover:border-primary/30 transition-all">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="h-7 w-7 text-primary" />
                </div>
                <div className="text-2xl font-bold text-primary mb-2">4</div>
                <h3 className="font-semibold text-foreground mb-2">Journalize Every History</h3>
                <p className="text-sm text-muted-foreground">
                  Generate accounting entries for all transactions
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Custom Development Section */}
      <section className="border-t border-border bg-card py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Settings className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-6">
              Built to adapt to your finance workflows
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              We can quickly adjust or develop modules based on your accounting, treasury, security, or reporting needs.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="border-t border-border bg-gradient-to-b from-background to-secondary/30 py-24 md:py-32">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-6">
              Sign Up Now
            </h2>
            <p className="text-muted-foreground mb-8">
              Get started with early access to explore the platform and shape its future.
            </p>
            <Button asChild size="lg" className="min-w-[220px] mb-6">
              <Link to="/signup">
                Sign Up
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <div className="max-w-xl mx-auto text-sm text-muted-foreground space-y-2">
              <p className="font-medium">If you access now you can get:</p>
              <ul className="space-y-1 text-left">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Features can be added or refined based on your requests in a few days</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Pricing discussions for the paid version</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Any additional questions or requests can be discussed freely, without cost — and this support will remain available for as long as you continue using the platform</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Dollar-biz
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Sticky Sign Up Button */}
      {showStickyButton && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <Button asChild size="lg" className="min-w-[200px] text-lg h-12 shadow-lg hover:shadow-xl transition-shadow">
            <Link to="/signup">
              Sign Up
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
