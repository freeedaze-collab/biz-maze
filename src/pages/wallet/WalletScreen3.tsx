// @ts-nocheck
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Home, Wallet } from "lucide-react";

const WalletScreen3 = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto mb-4">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <CardTitle className="text-3xl text-green-600 flex items-center justify-center gap-3">
                <Wallet className="h-8 w-8" />
                Wallet Connected Successfully
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-lg text-muted-foreground">
                Your wallet has been successfully connected and is ready to use.
              </p>

              <div className="bg-muted p-4 rounded-lg">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Connected Wallet</p>
                  <p className="font-mono text-sm">
                    0x1234...5678
                  </p>
                  <p className="text-xs text-muted-foreground">
                    MetaMask Wallet
                  </p>
                </div>
              </div>

              <div className="text-left bg-primary/5 p-4 rounded-lg">
                <h3 className="font-medium text-sm mb-2">What's Next?</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Start making transfers and payments</li>
                  <li>• View your transaction history</li>
                  <li>• Set up payment requests</li>
                  <li>• Access all financial features</li>
                </ul>
              </div>

              <Link to="/">
                <Button className="w-full">
                  <Home className="h-4 w-4 mr-2" />
                  Return to Home
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WalletScreen3;