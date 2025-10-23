// @ts-nocheck
import { Link, useParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Copy, Home, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WalletSuccess = () => {
  const { id } = useParams();
  const { toast } = useToast();

  const walletInfo = {
    metamask: { name: "MetaMask", icon: "🦊" },
    bitpay: { name: "BitPay", icon: "₿" },
  };

  const currentWallet = walletInfo[id as keyof typeof walletInfo] || walletInfo.metamask;
  const walletAddress = "0x742d35Cc6565C42cC9C993B0BFe0F8E5e838e05C";

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    toast({
      title: "Address Copied",
      description: "Wallet address copied to clipboard",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-card-foreground mb-2">
            Wallet Connected
          </h1>
          <p className="text-muted-foreground text-lg">
            Your {currentWallet.name} wallet is now connected
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
                  Connection Successful!
                </h2>
                <p className="text-muted-foreground">
                  Your {currentWallet.name} wallet is now connected and ready to use
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Wallet Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">{currentWallet.icon}</span>
                <Wallet className="h-5 w-5" />
                Connected Wallet
              </CardTitle>
              <CardDescription>
                {currentWallet.name} wallet information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Wallet Type:</span>
                  <span className="font-medium">{currentWallet.name}</span>
                </div>
                <div className="py-2 border-b">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-muted-foreground">Wallet Address:</span>
                    <Button variant="ghost" size="sm" onClick={copyAddress}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <code className="text-xs bg-muted p-2 rounded block break-all">
                    {walletAddress}
                  </code>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium text-success">Connected</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Connection Time:</span>
                  <span className="font-medium">{new Date().toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card>
            <CardHeader>
              <CardTitle>What's Next?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium">Make Transactions</p>
                    <p className="text-muted-foreground">You can now send and receive payments using your connected wallet</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium">View Balance</p>
                    <p className="text-muted-foreground">Check your wallet balance and transaction history</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium">Access DeFi Features</p>
                    <p className="text-muted-foreground">Explore decentralized finance features with your connected wallet</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Link to="/" className="flex-1">
              <Button className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Return to Dashboard
              </Button>
            </Link>
            <Link to="/transactions" className="flex-1">
              <Button variant="outline" className="w-full">
                View Transactions
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletSuccess;