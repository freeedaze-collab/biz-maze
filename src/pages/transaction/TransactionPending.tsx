import { Link, useParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, CheckCircle, Home } from "lucide-react";

const TransactionPending = () => {
  const { id } = useParams();

  const transaction = {
    id: id || "TXN-001",
    amount: "$500.00",
    description: "Payment to Vendor ABC",
    status: "processing",
    progress: 65,
    estimatedCompletion: "2 business days",
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-card-foreground mb-2">
            Transaction Processing
          </h1>
          <p className="text-muted-foreground text-lg">
            Your transaction is being processed
          </p>
        </div>

        <Navigation />

        <div className="max-w-2xl mx-auto space-y-6">
          {/* Processing Status */}
          <Card className="border-warning/20 bg-warning/5">
            <CardContent className="pt-6">
              <div className="text-center">
                <Clock className="h-16 w-16 text-warning mx-auto mb-4 animate-pulse" />
                <h2 className="text-2xl font-bold text-warning mb-2">
                  Transaction Processing
                </h2>
                <p className="text-muted-foreground mb-4">
                  Your transaction is currently being processed
                </p>
                <div className="space-y-2">
                  <Progress value={transaction.progress} className="w-full" />
                  <p className="text-sm text-muted-foreground">
                    {transaction.progress}% complete
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Transaction Details
              </CardTitle>
              <CardDescription>
                Keep this information for tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Transaction ID:</span>
                  <span className="font-medium">{transaction.id}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Description:</span>
                  <span className="font-medium">{transaction.description}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-bold text-lg">{transaction.amount}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium text-warning capitalize">{transaction.status}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Estimated Completion:</span>
                  <span className="font-medium">{transaction.estimatedCompletion}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card>
            <CardHeader>
              <CardTitle>What happens next?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-success rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium">Transaction initiated</p>
                    <p className="text-muted-foreground">Your transaction has been submitted</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-warning rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium">Processing payment</p>
                    <p className="text-muted-foreground">Currently verifying and processing</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-muted rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium">Completion</p>
                    <p className="text-muted-foreground">You'll receive confirmation when complete</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Link to="/" className="flex-1">
              <Button variant="outline" className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Return to Dashboard
              </Button>
            </Link>
            <Link to="/transaction-history" className="flex-1">
              <Button className="w-full">
                View Transaction History
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionPending;