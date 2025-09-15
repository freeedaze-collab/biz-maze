import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, History, Search, Filter, ArrowUpRight, ArrowDownLeft, Calendar, DollarSign } from "lucide-react";

const TransactionHistory = () => {
  const transactions = [
    {
      id: "TXN-001",
      type: "outgoing",
      amount: "-$500.00",
      status: "completed",
      date: "2024-01-15",
      time: "14:30",
      description: "Payment to Vendor ABC",
      recipient: "vendor-abc@company.com",
      fee: "$2.50",
    },
    {
      id: "TXN-002", 
      type: "incoming",
      amount: "+$1,200.00",
      status: "completed",
      date: "2024-01-14",
      time: "09:15",
      description: "Client Payment Received",
      recipient: "client@business.com",
      fee: "$0.00",
    },
    {
      id: "TXN-003",
      type: "outgoing",
      amount: "-$250.75",
      status: "pending",
      date: "2024-01-13",
      time: "16:45",
      description: "Subscription Renewal",
      recipient: "service@platform.com",
      fee: "$1.25",
    },
    {
      id: "WD-001",
      type: "withdrawal",
      amount: "-$1,500.00",
      status: "processing",
      date: "2024-01-12",
      time: "11:20",
      description: "Withdrawal to Bank Account",
      recipient: "Bank Transfer (**** 1234)",
      fee: "$5.00",
    },
    {
      id: "INV-001",
      type: "invoice",
      amount: "+$834.50",
      status: "completed",
      date: "2024-01-11",
      time: "13:10",
      description: "Invoice Payment Received",
      recipient: "Enterprise Client Inc.",
      fee: "$0.00",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success hover:bg-success/90';
      case 'pending': return 'bg-warning hover:bg-warning/90';
      case 'processing': return 'bg-primary hover:bg-primary/90';
      case 'failed': return 'bg-destructive hover:bg-destructive/90';
      default: return '';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'incoming':
      case 'invoice':
        return <ArrowDownLeft className="h-4 w-4" />;
      case 'outgoing':
      case 'withdrawal':
        return <ArrowUpRight className="h-4 w-4" />;
      default:
        return <ArrowUpRight className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'incoming':
      case 'invoice':
        return 'bg-success/10 text-success';
      case 'outgoing':
      case 'withdrawal':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-card-foreground mb-2">
            Transaction History
          </h1>
          <p className="text-muted-foreground text-lg">
            View and search through all your transactions
          </p>
        </div>

        <Navigation />

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search transactions..." className="pl-10" />
              </div>
              
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Transaction Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="incoming">Incoming</SelectItem>
                  <SelectItem value="outgoing">Outgoing</SelectItem>
                  <SelectItem value="withdrawal">Withdrawals</SelectItem>
                  <SelectItem value="invoice">Invoices</SelectItem>
                </SelectContent>
              </Select>

              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Transaction Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{transactions.length}</div>
              <p className="text-xs text-muted-foreground">
                In selected period
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Inflow</CardTitle>
              <ArrowDownLeft className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">+$2,034.50</div>
              <p className="text-xs text-muted-foreground">
                From incoming transactions
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Outflow</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">-$2,250.75</div>
              <p className="text-xs text-muted-foreground">
                From outgoing transactions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transaction List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              All Transactions
            </CardTitle>
            <CardDescription>
              Complete history of all your transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${getTypeColor(transaction.type)}`}>
                      {getTypeIcon(transaction.type)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold">{transaction.id}</h3>
                        <Badge
                          variant="secondary"
                          className={getStatusColor(transaction.status)}
                        >
                          {transaction.status}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mb-1">{transaction.description}</p>
                      <p className="text-sm text-muted-foreground">{transaction.recipient}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {transaction.date} at {transaction.time}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Fee: {transaction.fee}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className={`text-lg font-bold ${
                        transaction.type === 'incoming' || transaction.type === 'invoice'
                          ? 'text-success' 
                          : 'text-destructive'
                      }`}>
                        {transaction.amount}
                      </p>
                    </div>
                  </div>
                  
                  <Link to={`/transaction/${transaction.id}`}>
                    <Button variant="outline" size="sm" className="ml-4">
                      <Eye className="h-4 w-4 mr-2" />
                      Details
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TransactionHistory;