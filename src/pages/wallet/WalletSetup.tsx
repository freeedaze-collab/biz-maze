import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, ExternalLink } from "lucide-react";
import { WalletAddressInput } from "@/components/WalletAddressInput";

const WalletSetup = () => {
  const { walletId } = useParams();
  const [showAddressInput, setShowAddressInput] = useState(false);

  const wallets = {
    metamask: {
      name: "MetaMask",
      icon: "🦊",
      url: "https://metamask.io/",
      instructions: [
        "Click 'Click & Connect MetaMask' below",
        "Install the browser extension if needed",
        "Create a new wallet or import existing",
        "Secure your seed phrase",
        "Return here to input your wallet address"
      ]
    },
    coinbase: {
      name: "Coinbase Wallet",
      icon: "🔵",
      url: "https://www.coinbase.com/",
      instructions: [
        "Click 'Click & Connect Coinbase' below",
        "Download Coinbase Wallet app if needed",
        "Create your account",
        "Set up your wallet",
        "Return here to input your wallet address"
      ]
    },
    exodus: {
      name: "Exodus",
      icon: "💎",
      url: "https://www.exodus.com/",
      instructions: [
        "Click 'Click & Connect Exodus' below",
        "Download Exodus wallet if needed",
        "Install and launch the application",
        "Create a new wallet",
        "Return here to input your wallet address"
      ]
    }
  };

  const currentWallet = wallets[walletId as keyof typeof wallets];

  const handleWalletOpen = () => {
    if (currentWallet?.url) {
      window.open(currentWallet.url, '_blank');
      setShowAddressInput(true);
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

  if (showAddressInput) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6">
          <div className="mb-6">
            <Link to="/wallet-creation" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to Wallet Selection
            </Link>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="text-4xl mb-2">{currentWallet.icon}</div>
              <h1 className="text-3xl font-bold">Connect {currentWallet.name}</h1>
              <p className="text-muted-foreground mt-2">
                Enter your wallet address to complete the connection
              </p>
            </div>

            <WalletAddressInput 
              title={`Connect ${currentWallet.name}`}
              walletType={walletId || 'unknown'}
              walletName={currentWallet?.name}
            />

            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-success mb-2">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Wallet setup completed</span>
              </div>
              <p className="text-sm text-muted-foreground">
                You should now have {currentWallet.name} installed and ready. 
                Copy your wallet address from the wallet app and paste it above.
              </p>
            </div>
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
                    onClick={handleWalletOpen}
                    className="w-full"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Click & Connect {currentWallet.name}
                  </Button>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    This will open {currentWallet.name} website in a new tab for wallet setup
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Wallet Setup Info */}
            <Card>
              <CardHeader>
                <CardTitle>Next Steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm space-y-2">
                  <p className="font-medium">After clicking the button above:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Complete the wallet setup on {currentWallet.name} website</li>
                    <li>Copy your wallet address from the wallet</li>
                    <li>Return here to input your address</li>
                    <li>Your wallet will be connected to your account</li>
                  </ol>
                </div>
                
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <strong>Security Note:</strong> We only store your wallet address, never your private keys. 
                    Your funds remain secure in your wallet.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletSetup;