// src/pages/transfer/TransferConfirm.tsx
import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type St = { to: string; amount: number };

export default function TransferConfirm() {
  const nav = useNavigate();
  const { state } = useLocation() as { state?: St };
  const to = state?.to ?? "";
  const amount = state?.amount ?? 0;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  if (!to || !amount) {
    // 直接アクセス時は開始画面へ
    nav("/transfer/start");
  }

  const send = async () => {
    setBusy(true); setErr("");
    try {
      // 先に preflight（無くてもOK）
      await supabase.functions.invoke("preflight_transfer", {
        method: "POST", body: { to, amount }
      }).catch(()=>{});
      // 実送金（MVP：失敗しても遷移は続ける）
      const { data } = await supabase.functions.invoke("send-crypto-payment", {
        method: "POST", body: { to, amount }
      }).catch(()=>({ data: { tx_hash: null }} as any));
      nav("/transfer/done", { state: { to, amount, tx: (data as any)?.tx_hash ?? null } });
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <Card>
        <CardHeader><CardTitle>Step 2 — Confirm</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>Recipient: <span className="font-mono">{to}</span></div>
          <div>Amount: <strong>${amount}</strong></div>
          {err && <div className="text-red-600 text-sm">{err}</div>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={()=>nav(-1)}>Back</Button>
            <Button onClick={send} disabled={busy}>{busy ? "Sending..." : "Send"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
