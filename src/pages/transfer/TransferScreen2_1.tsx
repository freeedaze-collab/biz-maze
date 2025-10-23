// @ts-nocheck
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CheckCircle } from "lucide-react";

interface TransferData {
  address: string;
  amount: string;
  gasFee: string;
}

const TransferScreen2_1 = () => {
  const navigate = useNavigate();
  const [transferData, setTransferData] = useState<TransferData | null>(null);

  useEffect(() => {
    const data = sessionStorage.getItem('transferData');
    if (data) {
      setTransferData(JSON.parse(data));
    } else {
      // Redirect back if no transfer data
      navigate('/transfer/manual');
    }
  }, [navigate]);

  const handleConfirmTransfer = () => {
    navigate('/transfer/complete');
  };

  const handleEdit = () => {
    navigate('/transfer/manual');
  };

  if (!transferData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Link to="/transfer/manual" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Transfer Details
          </Link>
        </div>

        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-card-foreground mb-8">Confirm Transfer</h1>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Is the following information correct?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Recipient Address</h3>
                  <p className="text-lg font-mono bg-muted p-3 rounded break-all">
                    {transferData.address}
                  </p>
                </div>

                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Amount</h3>
                  <p className="text-2xl font-bold text-primary">
                    ${transferData.amount}
                  </p>
                </div>

                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Gas Fee</h3>
                  <p className="text-lg">
                    {transferData.gasFee}
                  </p>
                </div>

                <Separator />

                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Total Amount</h3>
                  <p className="text-2xl font-bold">
                    ${transferData.amount} + Gas Fee
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Button onClick={handleEdit} variant="outline" className="flex-1">
                  Edit Details
                </Button>
                <Button onClick={handleConfirmTransfer} className="flex-1">
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

export default TransferScreen2_1;