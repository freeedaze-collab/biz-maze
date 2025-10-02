// src/pages/Billing.tsx
// 目的: cryptoinvoice.new のように「請求書を作成」できるフォーム画面
// - 顧客名 / 金額 / 通貨 / メモ を入力
// - Supabase の invoices に INSERT（RLS: user_id = auth.uid()）
// - 作成後、請求IDを表示 & ステータス確認ページへの導線
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Currency = "USD" | "BTC" | "ETH";

export default function Billing() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [memo, setMemo] = useState("");
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!user?.id && customer.trim() && amount.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setCreating(true);
    setError(null);
    try {
      // invoices テーブル想定カラム:
      // id (uuid/serial), user_id uuid, customer_name text, amount numeric, currency text,
      // memo text, status text default 'unpaid', created_at timestamp
      const payload = {
        user_id: user!.id,
        customer_name: customer,
        amount: Number(amount),
        currency,
        memo,
        status: "unpaid",
      } as const;

      const { data, error } = await supabase
        .from("invoices")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;
      setResult({ id: data!.id as string });

      // cryptoinvoice.new 風: そのまま完了表示 + ステータス確認へ誘導
      // 必要なら自動遷移: nav("/invoice-status") も可
    } catch (e: any) {
      setError(e?.message ?? "Failed to create invoice");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <CreditCard className="h-6 w-6" />
            <div>
              <h1 className="text-2xl font-bold">Create Invoice</h1>
              <p className="text-muted-foreground">Issue a crypto-friendly invoice</p>
            </div>
          </div>
          <Navigation />
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>New Invoice</CardTitle>
            <CardDescription>
              Enter recipient and amount. Status starts as <Badge>unpaid</Badge>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Invoice created</span>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-sm text-muted-foreground">Invoice ID</div>
                  <div className="font-mono">{result.id}</div>
                </div>
                <div className="flex gap-2">
                  <Button asChild>
                    <Link to="/invoice-status">Check Status</Link>
                  </Button>
                  <Button variant="outline" onClick={() => { setResult(null); setCustomer(""); setAmount(""); setMemo(""); }}>
                    Create Another
                  </Button>
                </div>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer</Label>
                  <Input
                    id="customer"
                    placeholder="ACME Inc."
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      inputMode="decimal"
                      placeholder="1000"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="BTC">BTC</SelectItem>
                        <SelectItem value="ETH">ETH</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="memo">Memo (optional)</Label>
                  <Textarea
                    id="memo"
                    placeholder="Service description, notes, etc."
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                  />
                </div>

                {error && <p className="text-destructive text-sm">{error}</p>}

                <Button type="submit" disabled={!canSubmit || creating}>
                  {creating ? "Creating..." : "Create Invoice"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
