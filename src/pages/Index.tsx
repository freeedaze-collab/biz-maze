// @ts-nocheck
// src/pages/Index.tsx
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

export default function Index() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 -z-10" />
      
      <div className="mx-auto max-w-6xl px-6 py-16 space-y-16">
        {/* Hero Section */}
        <section className="text-center space-y-6 py-12 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-scale-in">
            Biz Maze
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Connect your wallet, sync transactions, and automate accounting & taxes with powerful blockchain integration.
          </p>
        </section>

        {/* CTA Card */}
        <Card className="shadow-elegant border-border/50 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <CardContent className="py-10">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button asChild variant="premium" size="lg">
                <Link to="/auth/login">Get Started</Link>
              </Button>

              <Button asChild variant="outline" size="lg">
                <Link to="/auth/login">Sign In</Link>
              </Button>

              <Button asChild variant="secondary" size="lg">
                <Link to="/auth/register">Create Account</Link>
              </Button>

              <Button asChild variant="ghost" size="lg">
                <Link to="/pricing">View Pricing</Link>
              </Button>

              {user && (
                <Button asChild variant="default" size="lg">
                  <Link to="/dashboard">Go to Dashboard</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Feature Cards */}
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
          <Card className="group hover:shadow-glow transition-all duration-300 hover:-translate-y-1 border-border/50 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <CardContent className="pt-6 space-y-3">
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold">Wallet Linking</h3>
              <p className="text-muted-foreground">
                Securely connect MetaMask and verify your identity. RLS-protected data model powered by Supabase ensures your data stays private.
              </p>
            </CardContent>
          </Card>
          
          <Card className="group hover:shadow-glow transition-all duration-300 hover:-translate-y-1 border-border/50 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <CardContent className="pt-6 space-y-3">
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold">Accounting & Tax</h3>
              <p className="text-muted-foreground">
                Automatically generate journal entries, profit & loss statements, trial balances, and US tax estimates from your blockchain transactions.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
