import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  CreditCard, 
  ArrowLeftRight, 
  Banknote, 
  Wallet,
  History,
  RefreshCw,
  FileCheck,
  DollarSign,
  TrendingUp,
  Clock
} from "lucide-react";

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-card-foreground mb-2">
            Financial Dashboard
          </h1>
          <p className="text-muted-foreground text-lg">
            Manage your transactions, invoices, and wallet connections
          </p>
        </div>

        {/* Navigation */}
        <Navigation />

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$12,234.56</div>
              <p className="text-xs text-muted-foreground">
                +2.5% from last month
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Transactions</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">7</div>
              <p className="text-xs text-muted-foreground">
                3 requiring attention
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Growth</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+12.3%</div>
              <p className="text-xs text-muted-foreground">
                Compared to last month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Access frequently used features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link to="/billing">
                <Button variant="outline" className="w-full h-24 flex-col gap-2">
                  <CreditCard className="h-6 w-6" />
                  <span>View Billing</span>
                </Button>
              </Link>
              
              <Link to="/transactions">
                <Button variant="outline" className="w-full h-24 flex-col gap-2">
                  <ArrowLeftRight className="h-6 w-6" />
                  <span>New Transaction</span>
                </Button>
              </Link>
              
              <Link to="/wallet">
                <Button variant="outline" className="w-full h-24 flex-col gap-2">
                  <Wallet className="h-6 w-6" />
                  <span>Connect Wallet</span>
                </Button>
              </Link>
              
              <Link to="/withdrawal">
                <Button variant="outline" className="w-full h-24 flex-col gap-2">
                  <Banknote className="h-6 w-6" />
                  <span>Request Withdrawal</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;