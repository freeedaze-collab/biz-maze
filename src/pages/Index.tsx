import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Wallet, FileText, TrendingUp, Shield } from "lucide-react";

export default function Index() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Hero Section */}
      <div className="container mx-auto px-6 py-16">
        <div className="text-center space-y-6 mb-16">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Biz Maze
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
            暗号資産ウォレットを接続・検証し、取引履歴を自動同期。<br />
            仕訳と税務レポートまで一気通貫で。
          </p>
          <div className="flex flex-wrap gap-4 justify-center pt-4">
            <Link to="/auth/register">
              <Button size="lg" className="gap-2">
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth/login">
              <Button size="lg" variant="outline">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <div className="bg-card rounded-lg p-6 border shadow-sm hover:shadow-md transition-shadow">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Wallet Connect</h3>
            <p className="text-sm text-muted-foreground">
              Connect your crypto wallets securely and manage all assets in one place
            </p>
          </div>

          <div className="bg-card rounded-lg p-6 border shadow-sm hover:shadow-md transition-shadow">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Transaction Tracking</h3>
            <p className="text-sm text-muted-foreground">
              Auto-sync transaction history and monitor all your crypto activities
            </p>
          </div>

          <div className="bg-card rounded-lg p-6 border shadow-sm hover:shadow-md transition-shadow">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Accounting & Reports</h3>
            <p className="text-sm text-muted-foreground">
              Generate journal entries and comprehensive financial reports automatically
            </p>
          </div>

          <div className="bg-card rounded-lg p-6 border shadow-sm hover:shadow-md transition-shadow">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Tax Compliance</h3>
            <p className="text-sm text-muted-foreground">
              Stay compliant with automated tax calculations and reporting
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-16 space-y-4">
          <p className="text-muted-foreground">
            Ready to streamline your crypto business management?
          </p>
          <Link to="/pricing">
            <Button variant="outline" size="lg">
              View Pricing
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
