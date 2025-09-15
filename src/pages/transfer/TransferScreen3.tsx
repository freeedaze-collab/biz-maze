import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, FileText, CheckCircle } from "lucide-react";

const TransferScreen3 = () => {
  const navigate = useNavigate();
  const [invoiceData] = useState({
    invoiceNumber: "INV-2024-001",
    amount: "1,250.00",
    recipient: "ACME Corporation",
    dueDate: "2024-01-15",
    description: "Web Development Services"
  });

  const handleConfirmPayment = () => {
    navigate('/transfer/complete');
  };

  const handleEdit = () => {
    navigate('/transfer/manual');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Link to="/transfer" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Transfer
          </Link>
        </div>

        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-card-foreground mb-8">Invoice Payment Confirmation</h1>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Is the following information correct?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-medium">Invoice #{invoiceData.invoiceNumber}</h3>
                  <p className="text-sm text-muted-foreground">{invoiceData.description}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Recipient</h3>
                  <p className="text-lg font-medium">{invoiceData.recipient}</p>
                </div>

                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Amount Due</h3>
                  <p className="text-2xl font-bold text-primary">
                    ${invoiceData.amount}
                  </p>
                </div>

                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Due Date</h3>
                  <p className="text-lg">{invoiceData.dueDate}</p>
                </div>

                <Separator />

                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Gas Fee (estimated)</h3>
                  <p className="text-lg">0.0023 ETH (~$5.50)</p>
                </div>

                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Total Payment</h3>
                  <p className="text-2xl font-bold">
                    ${invoiceData.amount} + Gas Fee
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Button onClick={handleEdit} variant="outline" className="flex-1">
                  Edit Payment
                </Button>
                <Button onClick={handleConfirmPayment} className="flex-1">
                  Confirm Transfer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TransferScreen3;