import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, ArrowUpRight, ArrowDownLeft, Clock } from "lucide-react";

const TransactionList = () => {
  const transactions = [
    {
      id: "TXN-001",
      type: "outgoing",
      amount: "-$500.00",
      status: "pending",
      date: "2024-01-15",
      description: "Payment to Vendor ABC",
      recipient: "vendor-abc@company.com",
    },
    {
      id: "TXN-002", 
      type: "incoming",
      amount: "+$1,200.00",
      status: "completed",
      date: "2024-01-14",
      description: "Client Payment Received",
      recipient: "client@business.com",
    },
    {
      id: "TXN-003",
      type: "outgoing",
      amount: "-$250.75",
      status: "pending",
      date: "2024-01-13",
      description: "Subscription Renewal",
      recipient: "service@platform.com",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-card-foreground mb-2">
            Transactions
          </h1>
          <p className="text-muted-foreground text-lg">
            Manage and execute your transactions
          </p>
        </div>

        <Navigation />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Transaction List
            </CardTitle>
            <CardDescription>
              View and manage all your transactions
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
                    <div className={`p-2 rounded-full ${
                      transaction.type === 'incoming' 
                        ? 'bg-success/10 text-success' 
                        : 'bg-destructive/10 text-destructive'
                    }`}>
                      {transaction.type === 'incoming' ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold">{transaction.id}</h3>
                        <Badge
                          variant={transaction.status === 'completed' ? 'default' : 'destructive'}
                          className={transaction.status === 'completed' ? 'bg-success hover:bg-success/90' : 'bg-warning hover:bg-warning/90'}
                        >
                          {transaction.status}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mb-1">{transaction.description}</p>
                      <p className="text-sm text-muted-foreground">{transaction.recipient}</p>
                      <p className="text-xs text-muted-foreground">{transaction.date}</p>
                    </div>
                    
                    <div className="text-right">
                      <p className={`text-lg font-bold ${
                        transaction.type === 'incoming' ? 'text-success' : 'text-destructive'
                      }`}>
                        {transaction.amount}
                      </p>
                    </div>
                  </div>
                  
                  <Link to={`/transaction/${transaction.id}`}>
                    <Button variant="outline" size="sm" className="ml-4">
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
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

export default TransactionList;