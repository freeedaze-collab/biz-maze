import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-card-foreground mb-2">
            Financial Hub
          </h1>
          <p className="text-muted-foreground text-lg">
            Your complete financial management solution
          </p>
          <div className="mt-4">
            <Link to="/auth/login">
              <Button>Login / Sign Up</Button>
            </Link>
          </div>
        </div>

        {/* Main Action Buttons */}
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link to="/transfer">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader className="text-center">
                  <ArrowLeftRight className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <CardTitle>Transfer</CardTitle>
                  <CardDescription>Send payments and transfer funds</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">Transfer Funds</Button>
                </CardContent>
              </Card>
            </Link>

            <Link to="/request">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader className="text-center">
                  <Download className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <CardTitle>Request</CardTitle>
                  <CardDescription>Request payments from others</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">Request Payment</Button>
                </CardContent>
              </Card>
            </Link>

            <Link to="/payment-gateway">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full opacity-50">
                <CardHeader className="text-center">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <CardTitle className="text-muted-foreground">Payment Gateway</CardTitle>
                  <CardDescription>Will be available soon</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" variant="outline" disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>
            </Link>

            <Link to="/management">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <CardTitle>Investment/Management</CardTitle>
                  <CardDescription>Manage your investments</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">Manage Portfolio</Button>
                </CardContent>
              </Card>
            </Link>

            <Link to="/accounting-tax">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader className="text-center">
                  <Calculator className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <CardTitle>Accounting/Tax</CardTitle>
                  <CardDescription>Track expenses and taxes</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">View Reports</Button>
                </CardContent>
              </Card>
            </Link>

            <Link to="/wallet-creation">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader className="text-center">
                  <Wallet className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <CardTitle>Wallet Creation/Linking</CardTitle>
                  <CardDescription>Connect or create wallets</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">Setup Wallet</Button>
                </CardContent>
              </Card>
            </Link>

            <Link to="/transaction-history" className="md:col-span-2 lg:col-span-1">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader className="text-center">
                  <History className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <CardTitle>Transaction History</CardTitle>
                  <CardDescription>View all transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">View History</Button>
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