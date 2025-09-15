import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wallet, Shield } from "lucide-react";

const WalletCreationScreen1 = () => {
  const wallets = [
    {
      id: "metamask",
      name: "MetaMask",
      description: "The most popular Ethereum wallet for DeFi",
      icon: "🦊",
      features: ["Browser Extension", "Mobile App", "Hardware Wallet Support"],
      isPopular: true,
    },
    {
      id: "bitpay",
      name: "BitPay",
      description: "Secure wallet for Bitcoin and other cryptocurrencies",
      icon: "₿",
      features: ["Multi-Currency", "Prepaid Cards", "Business Solutions"],
      isPopular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-card-foreground mb-8">Wallet Creation & Linking</h1>

          {/* Security Notice */}
          <Card className="border-primary/20 bg-primary/5 mb-8">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-primary mb-1">Secure Connection</p>
                  <p className="text-muted-foreground">
                    We use industry-standard encryption to protect your wallet connection. 
                    Your private keys remain secure in your wallet.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Wallet Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {wallets.map((wallet) => (
              <Card key={wallet.id} className="relative hover:shadow-lg transition-shadow">
                {wallet.isPopular && (
                  <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                    Popular
                  </div>
                )}
                
                <CardHeader className="text-center">
                  <div className="text-4xl mb-2">{wallet.icon}</div>
                  <CardTitle className="flex items-center justify-center gap-2">
                    <Wallet className="h-5 w-5" />
                    {wallet.name}
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <div className="space-y-4">
                    <p className="text-muted-foreground text-center">
                      {wallet.description}
                    </p>
                    
                    <div>
                      <h4 className="font-medium mb-2 text-sm">Features:</h4>
                      <ul className="text-xs space-y-1">
                        {wallet.features.map((feature, index) => (
                          <li key={index} className="flex items-center gap-2 text-muted-foreground">
                            <div className="w-1 h-1 bg-primary rounded-full"></div>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Link to="/wallet/connect" className="block">
                      <Button className="w-full" variant={wallet.isPopular ? "default" : "outline"}>
                        Select {wallet.name}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletCreationScreen1;