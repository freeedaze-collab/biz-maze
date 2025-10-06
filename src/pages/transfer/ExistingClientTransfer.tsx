// src/pages/transfer/ExistingClientTransfer.tsx
// 既存クライアントの wallet を自動投入 → ETH 送金
import Navigation from "@/components/Navigation";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccount, useSendTransaction } from "wagmi";
import { parseEther } from "viem";
import { useNavigate } from "react-router-dom";

type Client = { id: string; name: string; wallet?: string | null };

export default function ExistingClientTransfer() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { address: from } = useAccount();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [amountEth, setAmountEth] = useState("");
  const { sendTransactionAsync } = useSendTransaction();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase.from("clients").select("id,name,wallet").eq("user_id", user.id).order("created_at", { ascending: false });
      setClients(data || []);
    })();
  }, [user?.id]);

  const target = clients.find(c => c.id === clientId);

  const onSend = async () => {
    if (!user || !from || !target?.wallet || !amountEth) return;
    setSending(true);
    try {
      await sendTransactionAsync({ to: target.wallet as `0x${string}`, value: parseEther(amountEth) });
      await supabase.from("transactions").insert({
        user_id: user.id, amount: Number(amountEth), status: "sent", meta: { from, to: target.wallet, clientId }
      } as any);
      nav("/transfer?done=1");
    } catch (e) {
      console.error("send error", e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <Navigation />
        <div className="max-w-3xl mx-auto mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Existing client</CardTitle>
              <CardDescription>Select a saved client and enter the amount (ETH).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger><SelectValue placeholder="Choose client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount (ETH)</Label>
                  <Input type="number" inputMode="decimal" value={amountEth} onChange={(e) => setAmountEth(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={onSend} disabled={!from || !clientId || !amountEth || sending}>{sending ? "Sending..." : "Confirm & Send"}</Button>
                <Button variant="outline" onClick={() => nav("/dashboard")}>Back to dashboard</Button>
              </div>
              {!from && <p className="text-sm text-destructive">Please connect your wallet first on Wallet page.</p>}
              {target && !target.wallet && <p className="text-sm text-muted-foreground">This client has no wallet address. Edit in Billing → Clients.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
