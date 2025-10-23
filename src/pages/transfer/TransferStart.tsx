// @ts-nocheck
// src/pages/transfer/TransferStart.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAddress } from "viem";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function TransferStart() {
  const nav = useNavigate();
  const { user } = useAuth();

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState<number | "">("");

  const [formatOK, setFormatOK] = useState(false);
  const [exists, setExists] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  // 入力が変わるたびに形式チェック
  useEffect(() => {
    const ok = isAddress(to as `0x${string}`);
    setFormatOK(ok);
    setExists(null);
  }, [to]);

  // 実在性チェック（debounce 的に実装：形式OKかつ値があるときに呼ぶ）
  useEffect(() => {
    let canceled = false;
    (async () => {
      if (!formatOK || !to) return;
      setChecking(true);
      try {
        const { data, error } = await supabase.functions.invoke("preflight_transfer", {
          method: "POST",
          body: { to, checkOnly: true }
        });
        if (canceled) return;
        if (error) throw error;
        setExists(Boolean((data as any)?.exists));
      } catch {
        if (!canceled) setExists(false);
      } finally {
        if (!canceled) setChecking(false);
      }
    })();
    return () => { canceled = true; };
  }, [formatOK, to]);

  const canNext = formatOK && exists === true && Number(amount) > 0;

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Manual Transfer</h1>

      <Card>
        <CardHeader><CardTitle>Step 1 — Enter details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Recipient wallet address</Label>
            <Input
              value={to}
              onChange={(e)=>setTo(e.target.value.trim())}
              placeholder="0x..."
            />
            <div className="text-xs mt-1">
              <span className={formatOK ? "text-emerald-600" : "text-red-600"}>
                {formatOK ? "Valid EVM address format" : "Invalid address format"}
              </span>
              {" · "}
              {checking ? (
                <span className="text-muted-foreground">Checking existence...</span>
              ) : exists === true ? (
                <span className="text-emerald-600">Address exists on-chain</span>
              ) : exists === false ? (
                <span className="text-red-600">No on-chain activity/balance (blocked)</span>
              ) : (
                <span className="text-muted-foreground">Not checked</span>
              )}
            </div>
          </div>

          <div>
            <Label>Amount (USD)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e)=>setAmount(e.target.value === "" ? "" : Number(e.target.value))}
              min={0}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={()=>nav("/dashboard")} variant="outline">Back to dashboard</Button>
            <Button
              disabled={!canNext}
              onClick={()=>nav("/transfer/confirm", { state: { to, amount: Number(amount) } })}
              title={
                !formatOK ? "Invalid address" :
                exists === false ? "Address has no on-chain presence" :
                Number(amount) <= 0 ? "Enter amount" : undefined
              }
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
