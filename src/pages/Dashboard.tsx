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
    },
    {
      icon: FileText,
      title: "Create Invoice",
      description: "Prepare an invoice (save company/client, add line items).",
      link: "/invoice/new",
      variant: "secondary" as const,
    },
    {
      icon: Calculator,
      title: "Accounting / Tax",
      description: "Generate journal entries, P/L, trial balance and US tax estimate.",
      link: "/accounting",
      variant: "secondary" as const,
    },
    {
      icon: History,
      title: "Transactions",
      description: "View synchronized on-chain history.",
      link: "/transactions",
      variant: "secondary" as const,
    },
    {
      icon: DollarSign,
      title: "Pricing",
      description: "Check your plan and metered fees.",
      link: "/pricing",
      variant: "secondary" as const,
    },
    {
      icon: User,
      title: "Profile",
      description: "Update country and entity type.",
      link: "/profile",
      variant: "secondary" as const,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="mx-auto max-w-7xl p-6 space-y-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-accent p-8 md:p-12 text-primary-foreground shadow-elegant">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <Wallet className="h-10 w-10" />
              <h1 className="text-4xl md:text-5xl font-bold">Dashboard</h1>
            </div>
            <p className="text-lg md:text-xl text-primary-foreground/90 max-w-2xl">
              Welcome back! Manage your finances, track transactions, and access all your financial tools in one place.
            </p>
          </div>
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl"></div>
          <div className="absolute -left-10 -top-10 w-48 h-48 bg-accent/20 rounded-full blur-2xl"></div>
        </div>

        {/* Quick Actions Grid */}
        <div>
          <h2 className="text-2xl font-semibold mb-6 text-foreground">Quick Actions</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Card key={action.title} className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50 hover:-translate-y-1">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <CardTitle className="text-xl">{action.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {action.description}
                    </p>
                    <Button asChild variant={action.variant} className="w-full group-hover:shadow-md transition-shadow">
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
          <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">$0.00</div>
              <p className="text-xs text-muted-foreground mt-1">Connect wallet to view</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-accent/5 border-accent/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Recent Transactions</CardTitle>
              <History className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">0</div>
              <p className="text-xs text-muted-foreground mt-1">Sync to load history</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-success/5 border-success/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Invoices</CardTitle>
              <FileText className="h-4 w-4 text-success" />
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
