import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TransferScreen2 = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [gasFee, setGasFee] = useState("0.0023 ETH");
  const [addressError, setAddressError] = useState("");

  const validateWalletAddress = (addr: string) => {
    // Basic Ethereum address validation (0x followed by 40 hex characters)
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    return ethAddressRegex.test(addr);
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAddress = e.target.value;
    setAddress(newAddress);
    
    if (newAddress && !validateWalletAddress(newAddress)) {
      setAddressError("Please enter a valid crypto wallet address (0x...)");
    } else {
      setAddressError("");
    }
  };

  const handleTransfer = () => {
    if (!validateWalletAddress(address)) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid crypto wallet address",
        variant: "destructive",
      });
      return;
    }

    // Store transfer data in sessionStorage for confirmation screen
    sessionStorage.setItem('transferData', JSON.stringify({
      address,
      amount,
      gasFee
    }));
    navigate('/transfer/confirm');
  };

  const isFormValid = address.trim() !== '' && amount.trim() !== '' && !addressError;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Link to="/transfer" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Transfer
          </Link>
        </div>

        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-card-foreground mb-8">Transfer Details</h1>

          <Card>
            <CardHeader>
              <CardTitle>Enter Transfer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="address">Recipient Address</Label>
                <Input
                  id="address"
                  type="text"
                  placeholder="0x... (Enter crypto wallet address)"
                  value={address}
                  onChange={handleAddressChange}
                  className={`mt-2 ${addressError ? "border-destructive" : ""}`}
                />
                {addressError && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {addressError}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="text"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="gas-fee">Gas Fee (estimated)</Label>
                <Input
                  id="gas-fee"
                  type="text"
                  value={gasFee}
                  readOnly
                  className="mt-2 bg-muted"
                />
              </div>

              <Button 
                onClick={handleTransfer}
                className="w-full"
                disabled={!isFormValid}
              >
                Continue to Confirmation
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TransferScreen2;