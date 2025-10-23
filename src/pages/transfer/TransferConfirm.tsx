// @ts-nocheck
// src/pages/transfer/TransferConfirm.tsx
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  const [fee, setFee] = useState<number>(0);

  // 直接アクセス防止
  useEffect(() => {
    if (!to || !amount) nav("/transfer/start");
  }, [to, amount, nav]);

  // ✅ 送金手数料の概算を自動取得
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("preflight_transfer", {
          method: "POST", body: { to, amount }
        });
        const f = Number((data as any)?.fee_usd ?? 0);
        setFee(Number.isFinite(f) ? f : 0);
      } catch {
        setFee(0);
      }
    })();
  }, [to, amount]);

  const total = amount + (fee || 0);

  const send = async () => {
    setBusy(true); setErr("");
    try {
      // 実送金（MVP：失敗しても遷移は続ける）
      const { data } = await supabase.functions.invoke("send-crypto-payment", {
        method: "POST", body: { to, amount }
      }).catch(()=>({ data: { tx_hash: null }} as any));
      nav("/transfer/done", { state: { to, amount: total, tx: (data as any)?.tx_hash ?? null } });
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
          <div className="flex justify-between text-sm">
            <span>Amount</span>
            <span>${amount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Network fee (est.)</span>
            <span>{fee ? `$${fee.toFixed(2)}` : "-"}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>${total.toLocaleString()}</span>
          </div>

          {err && <div className="text-red-600 text-sm">{err}</div>}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={()=>nav(-1)}>Back</Button>
            <Button onClick={send} disabled={busy}>{busy ? "Sending..." : "Send"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
