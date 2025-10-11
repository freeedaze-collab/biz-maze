// src/pages/TransactionHistory.tsx
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Row = {
  id: number;
  wallet_address: string | null;
  chain_id: number | null;
  direction: "in" | "out" | null;
  tx_hash: string;
  block_number: number | null;
  occurred_at: string | null;
  asset_symbol: string | null;
  value_wei: string | number | null;
  fiat_value_usd: string | number | null;
};

export default function TransactionHistory() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("wallet_transactions")
      .select(
        "id,wallet_address,chain_id,direction,tx_hash,block_number,occurred_at,asset_symbol,value_wei,fiat_value_usd"
      )
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("load tx error:", error);
      setRows([]);
    } else {
      setRows((data as any) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const sync = async () => {
    setSyncing(true);
    try {
      await fetch("/functions/v1/sync-wallet-transactions", { method: "POST" });
    } catch (e) {
      console.warn("sync error:", e);
    } finally {
      await load();
      setSyncing(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transaction History</h1>
        <Button onClick={sync} disabled={syncing}>{syncing ? "Syncing..." : "Sync now"}</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Latest Transactions</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div>Loading...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No transactions yet. Link a wallet and press “Sync now” or import CSV into Supabase.
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.id} className="border rounded p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm">
                      <div className="font-mono break-all">
                        {r.tx_hash.slice(0, 10)}…{r.tx_hash.slice(-8)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        chain: {r.chain_id ?? "-"} · {r.direction ?? "-"} ·{" "}
                        {r.occurred_at ? new Date(r.occurred_at).toLocaleString() : "-"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        wallet: {r.wallet_address ?? "-"} · block: {r.block_number ?? "-"}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-mono">
                        {r.fiat_value_usd != null ? `$${r.fiat_value_usd}` :
                         r.value_wei != null ? `${r.value_wei} wei` : "-"}
                      </div>
                      <div className="text-xs text-muted-foreground">{r.asset_symbol ?? "-"}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
