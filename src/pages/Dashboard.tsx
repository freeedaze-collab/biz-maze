import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Clock,
  Users,
  FileText,
  Shield
} from "lucide-react";
import CustomerManager from "@/components/CustomerManager";
import { InvoiceGenerator } from "@/components/InvoiceGenerator";
import { InvoiceStatusTracker } from "@/components/InvoiceStatusTracker";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";

const Dashboard = () => {
  const { user } = useAuth();
  const { wallets } = useWallet();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-card-foreground mb-2">
            Financial Dashboard
          </h1>
          <p className="text-muted-foreground text-lg">
            Manage your transactions, invoices, and wallet connections with enhanced security
          </p>
        </div>

        {/* Navigation */}
        <Navigation />

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="invoices">Invoice Tracking</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="create-invoice">Create Invoice</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${wallets.reduce((sum, wallet) => sum + (wallet.balance_usd || 0), 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    From {wallets.length} connected wallet{wallets.length !== 1 ? 's' : ''}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Connected Wallets</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{wallets.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {wallets.filter(w => (w as any).verification_status === 'verified').length} verified
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Security Status</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">✓ Active</div>
                  <p className="text-xs text-muted-foreground">
                    SIWE verification enabled
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
                  Access frequently used features with enhanced security
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
          </TabsContent>

          <TabsContent value="invoices" className="space-y-6">
            <InvoiceStatusTracker />
          </TabsContent>

          <TabsContent value="customers" className="space-y-6">
            <CustomerManager />
          </TabsContent>

          <TabsContent value="create-invoice" className="space-y-6">
            <InvoiceGenerator />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;