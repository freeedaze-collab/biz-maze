// src/pages/transfer/PayFromInvoice.tsx
// 請求書から支払い：Invoice選択 → ETH送金（Demo）→ paid に更新
import Navigation from "@/components/Navigation";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccount, useSendTransaction } from "wagmi";
import { parseEther } from "viem";

type Invoice = { id: string; client_id: string; amount: number; currency: string; status: string; };
type Client = { id: string; name: string; wallet?: string | null };

export default function PayFromInvoice() {
  const { user } = useAuth();
  const { address: from } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clientsMap, setClientsMap] = useState<Record<string, Client>>({});
  const [invoiceId, setInvoiceId] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: inv } = await supabase.from("invoices").select("id, client_id, amount, currency, status").eq("user_id", user.id).order("created_at", { ascending: false });
      setInvoices(inv || []);
      const { data: clis } = await supabase.from("clients").select("id,name,wallet").eq("user_id", user.id);
      const map: Record<string, Client> = {};
      (clis || []).forEach(c => map[c.id] = c);
      setClientsMap(map);
    })();
  }, [user?.id]);

  const target = invoices.find(i => i.id === invoiceId);
  const client = target ? clientsMap[target.client_id] : undefined;

  const onSend = async () => {
    if (!user || !from || !target || !client?.wallet) return;
    if (target.currency !== "ETH") {
      alert("Demo: only ETH transfer is implemented for now.");
      return;
    }
    setSending(true);
    try {
      await sendTransactionAsync({ to: client.wallet as `0x${string}`, value: parseEther(String(target.amount)) });
      await supabase.from("transactions").insert({
        user_id: user.id, amount: Number(target.amount), status: "sent", meta: { from, to: client.wallet, invoiceId }
      } as any);
      await supabase.from("invoices").update({ status: "paid" }).eq("id", target.id);
      alert("Payment sent & invoice marked as paid");
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
              <CardTitle>Pay from invoice</CardTitle>
              <CardDescription>Pick an invoice and pay with your connected wallet (ETH demo).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Invoice ID</Label>
                <Input list="invoice-list" placeholder="Select or paste invoice id" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} />
                <datalist id="invoice-list">
                  {invoices.map(i => <option key={i.id} value={i.id}>{`${i.id} — ${i.amount} ${i.currency} (${i.status})`}</option>)}
                </datalist>
              </div>

              <div className="rounded-md border p-3 text-sm">
                <div>Client: <b>{client?.name ?? "-"}</b></div>
                <div>Wallet: <span className="font-mono">{client?.wallet ?? "-"}</span></div>
                <div>Amount: {target?.amount ?? "-" } {target?.currency ?? ""}</div>
                <div>Status: {target?.status ?? "-"}</div>
              </div>

              <Button onClick={onSend} disabled={!from || !target || !client?.wallet || sending}>
                {sending ? "Sending..." : "Confirm & Pay"}
              </Button>
              {!from && <p className="text-sm text-destructive">Please connect your wallet first on Wallet page.</p>}
              {target && !client?.wallet && <p className="text-sm text-muted-foreground">Client has no wallet address. Edit client and add wallet.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
