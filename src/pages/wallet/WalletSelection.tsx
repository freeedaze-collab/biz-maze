import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Shield, Zap, Globe } from "lucide-react";

const WalletSelection = () => {
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
    {
      id: "coinbase",
      name: "Coinbase Wallet",
      description: "Self-custody wallet from Coinbase",
      icon: "🔵",
      features: ["DApp Browser", "NFT Support", "Cross-Chain"],
      isPopular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-card-foreground mb-2">
            Wallet Selection
          </h1>
          <p className="text-muted-foreground text-lg">
            Choose a wallet to connect to your account
          </p>
        </div>

        <Navigation />

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Security Notice */}
          <Card className="border-primary/20 bg-primary/5">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  <CardDescription>{wallet.description}</CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="space-y-4">
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

                    <Link to={`/wallet/${wallet.id}/connect`} className="block">
                      <Button className="w-full" variant={wallet.isPopular ? "default" : "outline"}>
                        Select {wallet.name}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Help Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Need Help?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">What is a wallet?</h4>
                  <p className="text-muted-foreground">
                    A cryptocurrency wallet is a digital tool that allows you to store, 
                    send, and receive cryptocurrencies securely.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Is it safe?</h4>
                  <p className="text-muted-foreground">
                    Yes! We only request connection permissions. Your private keys 
                    and funds remain secure in your chosen wallet.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WalletSelection;