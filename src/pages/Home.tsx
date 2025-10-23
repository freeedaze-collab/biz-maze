// @ts-nocheck
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserProfile } from "@/components/UserProfile";
import { 
  ArrowLeftRight, 
  Download, 
  CreditCard, 
  TrendingUp,
  Calculator,
  Wallet,
  History
} from "lucide-react";

const Home = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 space-y-8">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-accent p-8 md:p-12 text-primary-foreground shadow-elegant">
          <div className="relative z-10">
            <div className="flex justify-between items-start flex-wrap gap-4">
              <div className="max-w-2xl">
                <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight">
                  Financial Hub
                </h1>
                <p className="text-lg md:text-xl text-primary-foreground/90 leading-relaxed">
                  Your complete financial management solution for crypto and traditional finance
                </p>
              </div>
              <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-xl p-4 border border-primary-foreground/20">
                <UserProfile showWalletInfo={true} />
              </div>
            </div>
          </div>
          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl"></div>
          <div className="absolute -left-10 -top-10 w-48 h-48 bg-accent/20 rounded-full blur-2xl"></div>
        </div>

        {/* Main Action Buttons */}
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-semibold mb-6 text-foreground">Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link to="/transfer" className="group">
              <Card className="h-full border-2 hover:border-primary/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 group-hover:from-primary/30 group-hover:to-accent/20 transition-all">
                    <ArrowLeftRight className="h-12 w-12 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Transfer</CardTitle>
                  <CardDescription>Send payments and transfer funds</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full group-hover:shadow-md transition-shadow">Transfer Funds</Button>
                </CardContent>
              </Card>
            </Link>

            <Link to="/request" className="group">
              <Card className="h-full border-2 hover:border-primary/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 group-hover:from-primary/30 group-hover:to-accent/20 transition-all">
                    <Download className="h-12 w-12 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Request</CardTitle>
                  <CardDescription>Request payments from others</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full group-hover:shadow-md transition-shadow">Request Payment</Button>
                </CardContent>
              </Card>
            </Link>

            <Link to="/payment-gateway" className="group">
              <Card className="h-full border-2 opacity-60 hover:opacity-70 transition-opacity cursor-not-allowed">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 p-4 rounded-2xl bg-muted/50">
                    <CreditCard className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-xl text-muted-foreground">Payment Gateway</CardTitle>
                  <CardDescription>Will be available soon</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" variant="outline" disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>
            </Link>

            <Link to="/management" className="group">
              <Card className="h-full border-2 hover:border-accent/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 p-4 rounded-2xl bg-gradient-to-br from-accent/20 to-primary/10 group-hover:from-accent/30 group-hover:to-primary/20 transition-all">
                    <TrendingUp className="h-12 w-12 text-accent" />
                  </div>
                  <CardTitle className="text-xl">Investment/Management</CardTitle>
                  <CardDescription>Manage your investments</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="secondary" className="w-full group-hover:shadow-md transition-shadow">Manage Portfolio</Button>
                </CardContent>
              </Card>
            </Link>

            <Link to="/accounting-tax" className="group">
              <Card className="h-full border-2 hover:border-primary/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 group-hover:from-primary/30 group-hover:to-accent/20 transition-all">
                    <Calculator className="h-12 w-12 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Accounting/Tax</CardTitle>
                  <CardDescription>Track expenses and taxes</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="secondary" className="w-full group-hover:shadow-md transition-shadow">View Reports</Button>
                </CardContent>
              </Card>
            </Link>

            <Link to="/wallet-creation" className="group">
              <Card className="h-full border-2 hover:border-accent/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 p-4 rounded-2xl bg-gradient-to-br from-accent/20 to-primary/10 group-hover:from-accent/30 group-hover:to-primary/20 transition-all">
                    <Wallet className="h-12 w-12 text-accent" />
                  </div>
                  <CardTitle className="text-xl">Wallet Creation/Linking</CardTitle>
                  <CardDescription>Connect or create wallets</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="secondary" className="w-full group-hover:shadow-md transition-shadow">Setup Wallet</Button>
                </CardContent>
              </Card>
            </Link>

            <Link to="/transaction-history" className="md:col-span-2 lg:col-span-1 group">
              <Card className="h-full border-2 hover:border-primary/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 group-hover:from-primary/30 group-hover:to-accent/20 transition-all">
                    <History className="h-12 w-12 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Transaction History</CardTitle>
                  <CardDescription>View all transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="secondary" className="w-full group-hover:shadow-md transition-shadow">View History</Button>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;