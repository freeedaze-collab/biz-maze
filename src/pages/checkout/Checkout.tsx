// src/pages/checkout/Checkout.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Intent = {
  id: number;
  status: string;
  requested_amount: number;
  requested_currency: string;
  pay_asset: string;
  pay_network: string;
  pay_address: string;
  received_amount: number | null;
  tx_hash: string | null;
};

export default function Checkout() {
  const { id } = useParams();
  const intentId = Number(id);

  const [loading, setLoading] = useState(true);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const requiredLine = useMemo(() => {
    if (!intent) return "";
    return `${intent.requested_amount} ${intent.requested_currency} to be paid as ${intent.pay_asset} on ${intent.pay_network}`;
  }, [intent]);

  useEffect(() => {
    let timer: number | undefined;

    const fetchStatus = async () => {
      try {
        const url = `${
          import.meta.env.VITE_SUPABASE_URL
        }/functions/v1/payment-status?intent_id=${intentId}`;
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as Intent;
        setIntent(data);
        setErr(null);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    // poll
    timer = window.setInterval(fetchStatus, 5000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [intentId]);

  if (loading) return <div className="p-6">Loading checkout...</div>;
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;
  if (!intent) return <div className="p-6">Not found.</div>;

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Checkout</h1>
        <Link to="/" className="text-sm underline text-muted-foreground">
          Back to Home
        </Link>
      </div>

      <div className="border rounded-xl p-4 space-y-2">
        <div className="text-sm text-muted-foreground">Order amount</div>
        <div className="text-xl font-mono">
          {intent.requested_amount} {intent.requested_currency}
        </div>
        <div className="text-sm text-muted-foreground">Pay with</div>
        <div className="text-lg">
          {intent.pay_asset} on {intent.pay_network}
        </div>
      </div>

      <div className="border rounded-xl p-4 space-y-2">
        <div className="text-sm text-muted-foreground">Send to address</div>
        <div className="font-mono break-all">{intent.pay_address}</div>
        <button
          className="text-sm underline"
          onClick={() => navigator.clipboard.writeText(intent.pay_address)}
        >
          Copy address
        </button>
      </div>

      <div className="border rounded-xl p-4">
        <div className="text-sm text-muted-foreground mb-1">Status</div>
        <div className="text-lg font-semibold">{intent.status}</div>
        {intent.received_amount ? (
          <div className="mt-2 text-sm">
            Received: <span className="font-mono">{intent.received_amount}</span>
          </div>
        ) : null}
        {intent.tx_hash ? (
          <div className="mt-1 text-sm">
            Tx: <span className="font-mono break-all">{intent.tx_hash}</span>
          </div>
        ) : null}
      </div>

      <div className="text-xs text-muted-foreground">
        Required: {requiredLine}
      </div>
    </div>
  );
}
