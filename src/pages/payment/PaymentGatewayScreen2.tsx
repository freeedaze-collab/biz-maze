// @ts-nocheck
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wallet } from "lucide-react";

const PaymentGatewayScreen2 = () => {
  const wallets = [
    {
      id: "metamask",
      name: "MetaMask",
      description: "Connect with MetaMask wallet",
      icon: "🦊",
      isPopular: true,
    },
    {
      id: "bitpay",
      name: "BitPay",
      description: "Connect with BitPay wallet",
      icon: "₿",
      isPopular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Link to="/payment-gateway" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Payment Gateway
          </Link>
        </div>

        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-card-foreground mb-8">Select Wallet Provider</h1>

          <div className="space-y-6">
            {wallets.map((wallet) => (
              <Card key={wallet.id} className="hover:shadow-lg transition-shadow relative">
                {wallet.isPopular && (
                  <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                    Popular
                  </div>
                )}
                
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <span className="text-2xl">{wallet.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <Wallet className="h-5 w-5" />
                        {wallet.name}
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">{wallet.description}</p>
                  <Link to="/payment-gateway/connect">
                    <Button 
                      className="w-full" 
                      variant={wallet.isPopular ? "default" : "outline"}
                    >
                      Select {wallet.name}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentGatewayScreen2;