// @ts-nocheck
// src/pages/Dashboard.tsx
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, FileText, Calculator, History, DollarSign, User, Wallet, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const quickActions = [
    {
      icon: ArrowLeftRight,
      title: "Send Money",
      description: "Start manual transfer flow and confirm the payment.",
      link: "/transfer/start",
      variant: "default" as const,
      color: "bg-primary/10 text-primary group-hover:bg-primary/20",
    },
    {
      icon: FileText,
      title: "Create Invoice",
      description: "Prepare an invoice (save company/client, add line items).",
      link: "/invoice/new",
      variant: "secondary" as const,
      color: "bg-success/10 text-success group-hover:bg-success/20",
    },
    {
      icon: Calculator,
      title: "Accounting / Tax",
      description: "Generate journal entries, P/L, trial balance and US tax estimate.",
      link: "/accounting",
      variant: "secondary" as const,
      color: "bg-accent/10 text-accent group-hover:bg-accent/20",
    },
    {
      icon: History,
      title: "Transactions",
      description: "View synchronized on-chain history.",
      link: "/transactions",
      variant: "secondary" as const,
      color: "bg-warning/10 text-warning group-hover:bg-warning/20",
    },
    {
      icon: DollarSign,
      title: "Pricing",
      description: "Check your plan and metered fees.",
      link: "/pricing",
      variant: "secondary" as const,
      color: "bg-secondary/10 text-secondary-foreground group-hover:bg-secondary/20",
    },
    {
      icon: User,
      title: "Profile",
      description: "Update country and entity type.",
      link: "/profile",
      variant: "secondary" as const,
      color: "bg-muted text-muted-foreground group-hover:bg-muted/80",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="mx-auto max-w-7xl p-6 space-y-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-accent p-6 md:p-8 text-primary-foreground shadow-glow">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="h-7 w-7" />
              <h1 className="text-3xl md:text-4xl font-bold">Dashboard</h1>
            </div>
            <p className="text-base md:text-lg text-primary-foreground/90 max-w-2xl">
              Welcome back! Manage your finances, track transactions, and access all your financial tools in one place.
            </p>
          </div>
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-primary-foreground/10 rounded-full blur-3xl"></div>
          <div className="absolute -left-10 -top-10 w-32 h-32 bg-accent/20 rounded-full blur-2xl"></div>
        </div>

        {/* Quick Actions Grid */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-foreground">Quick Actions</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Card key={action.title} className="group hover:shadow-lg transition-all duration-300 border hover:border-primary/30 hover:-translate-y-1">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg transition-colors ${action.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-lg">{action.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {action.description}
                    </p>
                    <Button asChild variant={action.variant} size="sm" className="w-full group-hover:shadow-md transition-shadow">
                      <Link to={action.link}>
                        {action.variant === "default" ? "Start Now" : "Open"}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20 hover:shadow-glow transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">$0.00</div>
              <p className="text-xs text-muted-foreground mt-1">Connect wallet to view</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-accent/5 border-accent/20 hover:shadow-glow transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Recent Transactions</CardTitle>
              <div className="p-2 rounded-lg bg-accent/10">
                <History className="h-4 w-4 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">0</div>
              <p className="text-xs text-muted-foreground mt-1">Sync to load history</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-success/5 border-success/20 hover:shadow-glow transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Invoices</CardTitle>
              <div className="p-2 rounded-lg bg-success/10">
                <FileText className="h-4 w-4 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">0</div>
              <p className="text-xs text-muted-foreground mt-1">No pending items</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
