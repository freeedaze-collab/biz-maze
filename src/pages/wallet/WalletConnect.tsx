import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wallet, Shield, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WalletConnect = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);

  const walletInfo = {
    metamask: {
      name: "MetaMask",
      icon: "🦊",
      description: "Connect your MetaMask wallet to access DeFi features",
    },
    bitpay: {
      name: "BitPay",
      icon: "₿",
      description: "Connect your BitPay wallet for secure transactions",
    },
  };

  const currentWallet = walletInfo[id as keyof typeof walletInfo] || walletInfo.metamask;

  const handleConnect = async () => {
    setConnecting(true);
    
    // Simulate wallet connection process
    setTimeout(() => {
      setConnecting(false);
      toast({
        title: "Wallet Connected",
        description: `Successfully connected to ${currentWallet.name}`,
      });
      navigate(`/wallet/${id}/success`);
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/wallet">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Wallet Selection
              </Button>
            </Link>
          </div>
          <h1 className="text-4xl font-bold text-card-foreground mb-2">
            Connect {currentWallet.name}
          </h1>
          <p className="text-muted-foreground text-lg">
            {currentWallet.description}
          </p>
        </div>

        <Navigation />

        <div className="max-w-2xl mx-auto space-y-6">
          {/* Wallet Info */}
          <Card>
            <CardHeader className="text-center">
              <div className="text-6xl mb-4">{currentWallet.icon}</div>
              <CardTitle className="flex items-center justify-center gap-2">
                <Wallet className="h-5 w-5" />
                {currentWallet.name}
              </CardTitle>
              <CardDescription>
                Ready to connect your wallet
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Connection Steps */}
          <Card>
            <CardHeader>
              <CardTitle>Connection Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">1</div>
                  <div>
                    <p className="font-medium">Click Connect</p>
                    <p className="text-sm text-muted-foreground">
                      Click the button below to initiate connection
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">2</div>
                  <div>
                    <p className="font-medium">Approve in Wallet</p>
                    <p className="text-sm text-muted-foreground">
                      Approve the connection request in your {currentWallet.name} wallet
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-muted text-muted-foreground rounded-full flex items-center justify-center text-sm font-bold">3</div>
                  <div>
                    <p className="font-medium">Complete Setup</p>
                    <p className="text-sm text-muted-foreground">
                      Your wallet will be connected and ready to use
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Notice */}
          <Card className="border-success/20 bg-success/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-success mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-success mb-1">Security First</p>
                  <p className="text-muted-foreground">
                    We only request read permissions to display your wallet address. 
                    Your private keys and funds remain secure in your wallet.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Important Notice */}
          <Card className="border-warning/20 bg-warning/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-warning mb-1">Make sure you have {currentWallet.name} installed</p>
                  <p className="text-muted-foreground">
                    If you don't have {currentWallet.name} installed, please install it from their official website before connecting.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Connect Button */}
          <Card>
            <CardContent className="pt-6">
              <Button 
                onClick={handleConnect} 
                className="w-full" 
                size="lg"
                disabled={connecting}
              >
                {connecting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Connecting to {currentWallet.name}...
                  </>
                ) : (
                  <>
                    <Wallet className="h-4 w-4 mr-2" />
                    Connect {currentWallet.name}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WalletConnect;