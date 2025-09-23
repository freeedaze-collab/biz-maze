import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { WalletAddressInput } from "@/components/WalletAddressInput";

const WalletConnect = () => {

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
            <h1 className="text-3xl font-bold">Connect Existing Wallet</h1>
            <p className="text-muted-foreground mt-2">
              Enter your wallet address to connect your existing wallet
            </p>
          </div>

          <div className="max-w-2xl mx-auto mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">How to Connect Your Wallet</h3>
              <div className="text-sm text-blue-800 space-y-2">
                <p>To connect your existing wallet:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Copy your wallet's public address</li>
                  <li>Paste it in the field below</li>
                  <li>Click "Connect Wallet" to link it to your account</li>
                </ol>
                <p className="mt-3 font-medium">⚠️ Never share your private keys or seed phrases!</p>
              </div>
            </div>
          </div>

          <WalletAddressInput />

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Supported Wallets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>You can connect any wallet by entering its address:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>MetaMask, Coinbase Wallet, Exodus</li>
                  <li>Hardware wallets (Ledger, Trezor)</li>
                  <li>Any Ethereum or Bitcoin wallet</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WalletConnect;