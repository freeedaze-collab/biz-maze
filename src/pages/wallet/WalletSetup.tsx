import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WalletSetup = () => {
  const { walletId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletData, setWalletData] = useState<any>(null);

  const wallets = {
    metamask: {
      name: "MetaMask",
      icon: "🦊",
      iframeUrl: "https://metamask.io/download/",
      instructions: [
        "Click 'Download MetaMask' below",
        "Install the browser extension",
        "Create a new wallet or import existing",
        "Secure your seed phrase",
        "Return here to connect"
      ]
    },
    coinbase: {
      name: "Coinbase Wallet",
      icon: "🔵",
      iframeUrl: "https://www.coinbase.com/wallet",
      instructions: [
        "Download Coinbase Wallet app",
        "Create your account",
        "Set up your wallet",
        "Enable browser connection",
        "Return here to connect"
      ]
    },
    exodus: {
      name: "Exodus",
      icon: "💎",
      iframeUrl: "https://www.exodus.com/download/",
      instructions: [
        "Download Exodus wallet",
        "Install and launch the application",
        "Create a new wallet",
        "Backup your seed phrase",
        "Enable wallet connect feature"
      ]
    }
  };

  const currentWallet = wallets[walletId as keyof typeof wallets];

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      // Simulate wallet connection and data retrieval
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock wallet data - replace with actual wallet integration
      const mockAddress = '0x' + Math.random().toString(16).substring(2, 42);
      const mockWalletData = {
        address: mockAddress,
        balance: "2.45 ETH",
        network: "Ethereum Mainnet",
        tokens: [
          { symbol: "ETH", balance: "2.45", value: "$3,920.50" },
          { symbol: "USDC", balance: "1,250.00", value: "$1,250.00" },
          { symbol: "BTC", balance: "0.05", value: "$2,150.00" }
        ]
      };
      
      setWalletData(mockWalletData);
      
      // Store wallet data for accounting and connect to database
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Store wallet connection in database
          await supabase.from('wallet_connections').insert({
            user_id: user.id,
            wallet_address: mockAddress,
            wallet_type: walletId || 'unknown',
            wallet_name: currentWallet?.name,
            is_primary: true,
            balance_usd: parseFloat(mockWalletData.balance.replace(/[^0-9.]/g, '')) * 1600 // Mock ETH price
          });
          
          console.log('Wallet connected to database successfully');
        } else {
          console.log('User not authenticated, storing locally only');
        }
      } catch (dbError) {
        console.error('Error saving wallet to database:', dbError);
      }
      
      // Also store locally for immediate access
      localStorage.setItem('connectedWallet', JSON.stringify({
        ...mockWalletData,
        walletType: currentWallet?.name,
        connectedAt: new Date().toISOString()
      }));
      
      toast({
        title: "Wallet Connected Successfully!",
        description: `${currentWallet?.name} is now connected and ready to use.`,
      });
      
      // Navigate to wallet success page after 2 seconds
      setTimeout(() => {
        navigate('/wallet/success');
      }, 2000);
      
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Please try again or check your wallet setup.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  if (!currentWallet) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center">
            <p>Wallet not found</p>
            <Link to="/wallet-creation">
              <Button className="mt-4">Back to Wallet Selection</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (walletData) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader className="text-center">
                <div className="text-4xl mb-2">{currentWallet.icon}</div>
                <CardTitle className="text-2xl text-success">Wallet Connected!</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Wallet Information:</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Address:</strong> {walletData.address}</p>
                    <p><strong>Network:</strong> {walletData.network}</p>
                    <p><strong>Primary Balance:</strong> {walletData.balance}</p>
                  </div>
                </div>
                
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Token Holdings:</h3>
                  <div className="space-y-2">
                    {walletData.tokens.map((token: any, index: number) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{token.balance} {token.symbol}</span>
                        <span className="text-muted-foreground">{token.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-success">
                  <CheckCircle className="h-5 w-5" />
                  <span>Data successfully stored for accounting</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Link to="/wallet-creation" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Wallet Selection
          </Link>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="text-4xl mb-2">{currentWallet.icon}</div>
            <h1 className="text-3xl font-bold">Set up {currentWallet.name}</h1>
            <p className="text-muted-foreground mt-2">
              Follow the steps below to create and connect your wallet
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Instructions */}
            <Card>
              <CardHeader>
                <CardTitle>Setup Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {currentWallet.instructions.map((instruction, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <span className="text-sm">{instruction}</span>
                    </li>
                  ))}
                </ol>

                <div className="mt-6 space-y-3">
                  <Button
                    onClick={connectWallet}
                    disabled={isConnecting}
                    className="w-full"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting Wallet...
                      </>
                    ) : (
                      `Connect ${currentWallet.name}`
                    )}
                  </Button>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    Make sure you have completed the setup steps above before connecting
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Wallet Setup iframe */}
            <Card>
              <CardHeader>
                <CardTitle>Wallet Setup</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full h-96 border rounded-lg overflow-hidden">
                  <iframe
                    src={currentWallet.iframeUrl}
                    className="w-full h-full"
                    title={`${currentWallet.name} Setup`}
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Use this window to download and set up your {currentWallet.name} wallet
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletSetup;