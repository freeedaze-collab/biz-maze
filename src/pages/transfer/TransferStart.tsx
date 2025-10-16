// src/pages/transfer/TransferStart.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TransferStart() {
  const nav = useNavigate();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState<number | "">("");

  const canNext = !!to && Number(amount) > 0;

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Manual Transfer</h1>

      <Card>
        <CardHeader><CardTitle>Step 1 — Enter details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Recipient wallet address</Label>
            <Input value={to} onChange={(e)=>setTo(e.target.value)} placeholder="0x..." />
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
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
