// src/pages/transfer/NewRecipient.tsx
// ETH 送金：MetaMask接続済みアドレスから value 送金（demo）
import Navigation from "@/components/Navigation";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { useAccount, useSendTransaction } from "wagmi";
import { parseEther } from "viem";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function NewRecipient() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { address: from } = useAccount();
  const [to, setTo] = useState("");
  const [company, setCompany] = useState("");
  const [amountEth, setAmountEth] = useState("");
  const [confirming, setConfirming] = useState(false);
  const { sendTransactionAsync } = useSendTransaction();

  const onConfirm = async () => {
    if (!user || !from || !to || !amountEth) return;
    setConfirming(true);
    try {
      await sendTransactionAsync({ to: to as `0x${string}`, value: parseEther(amountEth) });
      await supabase.from("transactions").insert({
        user_id: user.id, amount: Number(amountEth), status: "sent", meta: { from, to, company }
      } as any);
      nav("/transfer?done=1");
    } catch (e) {
      console.error("send error", e);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <Navigation />
        <div className="max-w-3xl mx-auto mt-8">
          <Card>
            <CardHeader>
              <CardTitle>New recipient</CardTitle>
              <CardDescription>Enter destination and amount (ETH).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Company (optional)</Label>
                <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name for reuse" />
              </div>
              <div className="space-y-2">
                <Label>Wallet</Label>
                <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x..." />
              </div>
              <div className="space-y-2">
                <Label>Amount (ETH)</Label>
                <Input type="number" inputMode="decimal" value={amountEth} onChange={(e) => setAmountEth(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={onConfirm} disabled={!from || confirming || !to || !amountEth}>
                  {confirming ? "Sending..." : "Confirm & Send"}
                </Button>
                <Button variant="outline" onClick={() => nav("/dashboard")}>Back to dashboard</Button>
              </div>
              {!from && <p className="text-sm text-destructive">Please connect your wallet first on Wallet page.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
