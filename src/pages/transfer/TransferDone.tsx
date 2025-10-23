// @ts-nocheck
// src/pages/transfer/TransferDone.tsx
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TransferDone() {
  const nav = useNavigate();
  const { state } = useLocation() as { state?: { to: string; amount: number; tx?: string|null } };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <Card>
        <CardHeader><CardTitle>Step 3 — Completed</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>Payment finished.</div>
          <div>Recipient: <span className="font-mono">{state?.to}</span></div>
          <div>Amount: <strong>${state?.amount}</strong></div>
          {state?.tx && <div>TX: <span className="font-mono">{state.tx}</span></div>}

          <div className="flex gap-2">
            <Button variant="outline" onClick={()=>nav("/dashboard")}>Go dashboard</Button>
            <Button onClick={()=>nav("/transfer/start")}>Another transfer</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
