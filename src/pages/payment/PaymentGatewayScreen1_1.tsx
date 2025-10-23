// @ts-nocheck
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wallet, Shield, CheckCircle } from "lucide-react";

const PaymentGatewayScreen1_1 = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Link to="/payment-gateway/implement" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Wallet Selection
          </Link>
        </div>

        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-card-foreground mb-8">Connection Verification</h1>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Wallet className="h-6 w-6 text-primary" />
                Verify Wallet Connection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <Shield className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="font-medium">Secure Connection Established</p>
                    <p className="text-sm text-muted-foreground">
                      Your wallet is ready to connect
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Wallet compatibility verified</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Security protocols enabled</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Connection permissions granted</span>
                  </div>
                </div>
              </div>

              <div className="bg-primary/10 p-4 rounded-lg">
                <p className="text-sm">
                  <strong>Note:</strong> Your private keys and funds remain secure in your wallet. 
                  We only request permission to view your public address and approve transactions.
                </p>
              </div>

              <Link to="/wallet/success">
                <Button className="w-full">
                  Connect Wallet
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PaymentGatewayScreen1_1;