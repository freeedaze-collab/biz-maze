import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/useWallet";
import { useSIWE } from "@/hooks/useSIWE";
import { useNavigate } from "react-router-dom";

interface WalletAddressInputProps {
  title?: string;
  walletType?: string;
  walletName?: string;
}

export function WalletAddressInput({ 
  title = "Connect Existing Wallet", 
  walletType = "manual",
  walletName = "Wallet"
}: WalletAddressInputProps) {
  const [address, setAddress] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const { connectWallet } = useWallet();
  const { verifyWalletOwnership, isVerifying } = useSIWE();
  const { toast } = useToast();
  const navigate = useNavigate();

  const validateAddress = (addr: string) => {
    // Basic validation for common address formats
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    const btcAddressRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/;
    
    return ethAddressRegex.test(addr) || btcAddressRegex.test(addr);
  };

  const handleAddressChange = (value: string) => {
    setAddress(value);
    if (value.length > 10) {
      setIsValidating(true);
      setTimeout(() => {
        const valid = validateAddress(value);
        setIsValid(valid);
        setIsValidating(false);
      }, 500);
    } else {
      setIsValid(null);
      setIsValidating(false);
    }
  };

  const handleConnect = async () => {
    if (!isValid || !address) return;

    setIsConnecting(true);

    try {
      // Step 1: Verify wallet ownership with SIWE
      toast({
        title: "🔒 Verifying Wallet Ownership",
        description: "Please sign the message in your wallet to verify ownership",
      });

      const isVerified = await verifyWalletOwnership(address);
      if (!isVerified) {
        setIsConnecting(false);
        return;
      }

      // Step 2: Connect wallet to account
      await connectWallet();
      if (true) {
        toast({
          title: "✅ Wallet Connected Successfully!",
          description: `Your wallet (${address.substring(0, 6)}...${address.substring(address.length - 4)}) has been verified and linked to your account.`,
          duration: 5000,
        });
        navigate('/wallet/success');
      } else {
        toast({
          title: "❌ Connection Failed", 
          description: "Failed to connect wallet. Please try again or contact support.",
          variant: "destructive",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Wallet connection error:', error);
      toast({
        title: "❌ Connection Error",
        description: "An error occurred during wallet connection",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="wallet-address">Wallet Address</Label>
          <div className="relative">
            <Input
              id="wallet-address"
              placeholder="Enter your wallet address (0x... or bc1...)"
              value={address}
              onChange={(e) => handleAddressChange(e.target.value)}
              className="pr-10"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              {isValidating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {!isValidating && isValid === true && <CheckCircle className="h-4 w-4 text-green-500" />}
              {!isValidating && isValid === false && <AlertCircle className="h-4 w-4 text-red-500" />}
            </div>
          </div>
          {isValid === false && (
            <p className="text-sm text-red-500">
              Please enter a valid wallet address
            </p>
          )}
          {isValid === true && (
            <p className="text-sm text-green-600">
              Valid wallet address format
            </p>
          )}
        </div>

        <Button 
          onClick={handleConnect}
          disabled={!isValid || !address || isConnecting || isVerifying}
          className="w-full"
        >
          {isConnecting || isVerifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isVerifying ? 'Verifying Ownership...' : 'Connecting...'}
            </>
          ) : (
            'Connect & Verify Wallet'
          )}
        </Button>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>Supported address formats:</p>
          <p>• Ethereum: 0x1234...abcd (42 characters)</p>
          <p>• Bitcoin: 1A1z...Xyz or bc1...</p>
        </div>
      </CardContent>
    </Card>
  );
}