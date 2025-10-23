// @ts-nocheck
import { Link, useParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Download, Home, Receipt } from "lucide-react";

const InvoiceCompletion = () => {
  const { id } = useParams();

  const invoice = {
    id: id || "INV-001",
    amount: "$1,234.56",
    description: "Web Development Services",
    paymentDate: new Date().toLocaleDateString(),
    transactionId: "TXN-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-card-foreground mb-2">
            Payment Completed
          </h1>
          <p className="text-muted-foreground text-lg">
            Your payment has been processed successfully
          </p>
        </div>

        <Navigation />

        <div className="max-w-2xl mx-auto space-y-6">
          {/* Success Message */}
          <Card className="border-success/20 bg-success/5">
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-success mb-2">
                  Payment Successful!
                </h2>
                <p className="text-muted-foreground">
                  Your payment of {invoice.amount} has been processed
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Payment Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Payment Receipt
              </CardTitle>
              <CardDescription>
                Keep this information for your records
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Invoice ID:</span>
                  <span className="font-medium">{invoice.id}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Description:</span>
                  <span className="font-medium">{invoice.description}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Amount Paid:</span>
                  <span className="font-bold text-lg">{invoice.amount}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Payment Date:</span>
                  <span className="font-medium">{invoice.paymentDate}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Transaction ID:</span>
                  <span className="font-medium">{invoice.transactionId}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium text-success">Paid</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download Receipt
            </Button>
            <Link to="/" className="flex-1">
              <Button className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Return to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceCompletion;