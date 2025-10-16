// src/pages/transfer/TransferConfirm.tsx
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

export default function TransferConfirm() {
  const nav = useNavigate();
  const { state } = useLocation() as { state?: { to: string; amount: number } };
  const to = state?.to ?? "";
  const amount = state?.amount ?? 0;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  const send = async () => {
    setBusy(true); setErr("");
    try {
      // MVP: Edge Function があれば preflight -> send、無ければ成功画面へ
      const { data, error } = await supabase.functions.invoke("preflight_transfer", {
        method: "POST", body: { to, amount }
      });
      if (error) throw error;
      // 実送金（準備中ならスキップ）
      await supabase.functions.invoke("send-crypto-payment", {
        method: "POST", body: { to, amount }
      }).catch(()=>{ /* sandbox未接続でも先に進む */ });

      nav("/transfer/done", { state: { to, amount, tx: data?.tx_hash ?? null } });
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <Card>
        <CardHeader><CardTitle>Confirm</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>Recipient: <span className="font-mono">{to}</span></div>
          <div>Amount: <strong>${amount}</strong></div>
          {err && <div className="text-red-600 text-sm">{err}</div>}
          <div className="flex gap-2">
            <Button onClick={()=>nav(-1)} variant="outline">Back</Button>
            <Button onClick={send} disabled={busy || !to || !amount}>{busy ? "Sending..." : "Send"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
