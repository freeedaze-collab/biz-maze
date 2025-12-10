// src/pages/Index.tsx
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Wallet,
  FileSpreadsheet,
  Calculator,
  CreditCard,
  Shield,
  Settings,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

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
  },
  {
    icon: Shield,
    title: "Security & Access Control",
    description: "Role-based permissions, audit logs, and enterprise-grade security controls.",
  },
  {
    icon: Settings,
    title: "Custom Workflow Development",
    description: "Tailored modules and integrations built for your specific requirements.",
  },
];

const valueProps = [
  "Reliable on-chain → ledger automation",
  "GAAP-aligned accounting workflows",
  "Treasury controls & auditability",
  "Configurable for your internal processes",
];

export default function Index() {
  return (
    <div className="min-h-screen bg-card">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-xl font-semibold text-foreground tracking-tight">
            Digital Asset Finance
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
              <Link to="/signup">Request Access</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container mx-auto px-6 py-24 md:py-32 relative">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground tracking-tight leading-tight mb-6">
              Digital Asset Finance Infrastructure
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Automated workflows for accounting, treasury, and digital asset operations.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              <Button asChild size="lg" className="min-w-[200px]">
                <Link to="/signup">
                  Request Early Access
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="min-w-[200px]">
                <Link to="/auth/login">Sign In</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Complimentary evaluation access available
            </p>
          </div>

          {/* Hero Visual Placeholder */}
          <div className="mt-16 max-w-5xl mx-auto">
            <div className="relative rounded-xl border border-border bg-gradient-to-b from-secondary/50 to-muted/30 p-1 shadow-lg">
              <div className="rounded-lg bg-card aspect-[16/9] flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <FileSpreadsheet className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-muted-foreground text-sm">Platform Screenshot Placeholder</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition Section */}
      <section className="border-t border-border bg-background py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">
              Why finance teams rely on our infrastructure
            </h2>
          </div>
          <div className="max-w-3xl mx-auto">
            <div className="grid sm:grid-cols-2 gap-6">
              {valueProps.map((prop, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 p-5 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-foreground font-medium pt-2">{prop}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Product Visual Section */}
      <section id="platform" className="border-t border-border bg-card py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">
                A unified platform for digital asset operations
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Connect wallets, automate entries, and streamline digital asset workflows.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-gradient-to-b from-secondary/30 to-muted/20 p-1.5 shadow-md">
              <div className="rounded-lg bg-card aspect-[16/8] flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="flex items-center justify-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Wallet className="h-6 w-6 text-primary" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileSpreadsheet className="h-6 w-6 text-primary" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm">Large Platform Screenshot Placeholder</p>
                </div>
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
              Start with Early Access
            </h2>
            <p className="text-muted-foreground mb-8">
              Get started with complimentary evaluation access to explore the platform.
            </p>
            <Button asChild size="lg" className="min-w-[220px]">
              <Link to="/signup">
                Request Early Access
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              Complimentary evaluation access available now
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Digital Asset Finance Infrastructure
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
    </div>
  );
}
