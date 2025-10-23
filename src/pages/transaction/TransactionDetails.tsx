// @ts-nocheck
import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TransactionDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const transaction = {
    id: id || "TXN-001",
    type: "outgoing",
    amount: "-$500.00",
    status: "pending",
    date: "2024-01-15",
    description: "Payment to Vendor ABC",
    recipient: "vendor-abc@company.com",
    fee: "$2.50",
    estimatedTime: "2-5 business days",
    reference: "REF-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
  };

  const handleExecute = async () => {
    setLoading(true);
    
    setTimeout(() => {
      setLoading(false);
      toast({
        title: "Transaction Executed",
        description: "Your transaction is now being processed...",
      });
      navigate(`/transaction/${id}/pending`);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/transactions">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Transactions
              </Button>
            </Link>
          </div>
          <h1 className="text-4xl font-bold text-card-foreground mb-2">
            Transaction Details
          </h1>
          <p className="text-muted-foreground text-lg">
            Transaction {transaction.id}
          </p>
        </div>

        <Navigation />

        <div className="max-w-2xl mx-auto space-y-6">
          {/* Transaction Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${
                    transaction.type === 'incoming' 
                      ? 'bg-success/10 text-success' 
                      : 'bg-destructive/10 text-destructive'
                  }`}>
                    {transaction.type === 'incoming' ? (
                      <ArrowDownLeft className="h-6 w-6" />
                    ) : (
                      <ArrowUpRight className="h-6 w-6" />
                    )}
                  </div>
                  <div>
                    <CardTitle>{transaction.id}</CardTitle>
                    <CardDescription>{transaction.description}</CardDescription>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${
                    transaction.type === 'incoming' ? 'text-success' : 'text-destructive'
                  }`}>
                    {transaction.amount}
                  </p>
                  <Badge
                    variant={transaction.status === 'completed' ? 'default' : 'destructive'}
                    className={transaction.status === 'completed' ? 'bg-success hover:bg-success/90' : 'bg-warning hover:bg-warning/90'}
                  >
                    {transaction.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Transaction Details */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Recipient:</span>
                  <span className="font-medium">{transaction.recipient}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Transaction Fee:</span>
                  <span className="font-medium">{transaction.fee}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Estimated Time:</span>
                  <span className="font-medium">{transaction.estimatedTime}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Reference:</span>
                  <span className="font-medium">{transaction.reference}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Date Created:</span>
                  <span className="font-medium">{transaction.date}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Button */}
          {transaction.status === 'pending' && (
            <Card>
              <CardContent className="pt-6">
                <Button 
                  onClick={handleExecute} 
                  className="w-full" 
                  size="lg"
                  disabled={loading}
                >
                  {loading ? (
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {loading ? "Executing..." : "Execute Transaction"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionDetails;