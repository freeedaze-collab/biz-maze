// src/pages/transfer/TransferStart.tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";

export default function TransferStart() {
  const nav = useNavigate();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState<number>(0);

  const proceed = () => {
    nav("/transfer/confirm", { state: { to, amount } });
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Send</h1>
      <Card>
        <CardHeader><CardTitle>New transfer</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Recipient address</Label>
            <Input value={to} onChange={e=>setTo(e.target.value)} placeholder="0x..." />
          </div>
          <div>
            <Label>Amount (USD equivalent)</Label>
            <Input type="number" value={amount} onChange={e=>setAmount(Number(e.target.value)||0)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={proceed} disabled={!to || !amount}>Next</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
