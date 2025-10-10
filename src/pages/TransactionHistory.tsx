// src/pages/TransactionHistory.tsx
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string;
  chain: string | null;
  tx_hash: string;
  direction: "in" | "out" | null;
  value_wei: string | null;
  asset_symbol: string | null;
  timestamp: string | null;
};

export default function TransactionHistory() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("wallet_transactions")
      .select("id,chain,tx_hash,direction,value_wei,asset_symbol,timestamp")
      .order("timestamp", { ascending: false })
      .limit(200);
    if (!error && data) setRows(data as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/functions/v1/sync-wallet-transactions", { method: "POST" });
      // レスポンス200でも件数0の場合があるため、UIは常に成功扱いにして最新を再読込
      if (!res.ok) {
        // Edge Function 側は 0 件時も 200 を返す想定、念のため
        console.warn("sync response status:", res.status);
      }
    } catch (e) {
      console.warn("sync error (UIは失敗扱いにしない):", e);
    } finally {
      await load();
      setSyncing(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transaction History</h1>
        <Button onClick={sync} disabled={syncing}>
          {syncing ? "Syncing..." : "Sync now"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Loading...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              取引履歴がまだありません。ウォレットを連携した上で「Sync now」を押してください。
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
                        {r.chain ?? "-"} ・ {r.direction ?? "-"} ・ {r.timestamp ? new Date(r.timestamp).toLocaleString() : "-"}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-mono">{r.value_wei ? `${r.value_wei} wei` : "-"}</div>
                      <div className="text-xs text-muted-foreground">{r.asset_symbol ?? "ETH/Native"}</div>
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
