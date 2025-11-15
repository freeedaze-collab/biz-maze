// @ts-nocheck
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

const USAGE_OPTIONS = [
  { value: "", label: "用途を選択" },
  { value: "revenue", label: "収益（売上）" },
  { value: "expense", label: "費用" },
  { value: "transfer", label: "自分間の移転" },
  { value: "investment", label: "投資・購入" },
  { value: "payment", label: "支払" },
  { value: "fee", label: "手数料" },
  { value: "airdrop", label: "エアドロップ" },
  { value: "internal", label: "内部処理" },
  { value: "other", label: "その他" },
];

export default function TransactionHistory() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [labelMap, setLabelMap] = useState<Record<number, string>>({}); // tx_id -> label
  const [labelsReady, setLabelsReady] = useState<boolean>(false);
  const [labelTableMissing, setLabelTableMissing] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    // 取引の取得
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

    // 既存ラベルの取得（なければテーブル未作成を拾う）
    setLabelsReady(false);
    setLabelTableMissing(null);
    const { data: labels, error: lerr } = await supabase
      .from("transaction_usage_labels")
      .select("tx_id,label")
      .eq("user_id", user.id);

    if (lerr) {
      // PGRST205 → テーブル無し
      console.warn("labels load error:", lerr);
      if (lerr.code === "PGRST205") {
        setLabelTableMissing(
          "用途ラベル用テーブル（public.transaction_usage_labels）が見つかりません。SQLを適用してください。"
        );
      }
      setLabelMap({});
      setLabelsReady(true);
    } else {
      const map: Record<number, string> = {};
      (labels || []).forEach((r: any) => {
        if (r.tx_id != null) map[r.tx_id] = r.label;
      });
      setLabelMap(map);
      setLabelsReady(true);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const sync = async () => {
    setSyncing(true);
    try {
      // invoke に統一（相対 fetch は使わない）
      await supabase.functions.invoke("sync-wallet-transactions", { body: {} });
    } catch (e) {
      console.warn("sync error:", e);
    } finally {
      await load();
      setSyncing(false);
    }
  };

  // 用途ラベルの保存（user_id + tx_id で upsert）
  const saveLabel = async (txId: number, label: string) => {
    if (!user?.id) return;
    if (!label) return;

    const payload = {
      user_id: user.id,
      tx_id: txId,
      label,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("transaction_usage_labels")
      .upsert(payload, { onConflict: "user_id,tx_id" });

    if (error) {
      console.error("label save error:", error);
      // テーブル未作成時の文言は、上で setLabelTableMissing として出す
      return;
    }
    setLabelMap((m) => ({ ...m, [txId]: label }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="mx-auto max-w-6xl p-6 space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary to-accent p-8 text-primary-foreground shadow-elegant">
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">Transaction History</h1>
              <p className="text-primary-foreground/90">View all your blockchain transactions & assign usage</p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={async () => {
                  try {
                    await supabase.functions.invoke("classify-usage", { body: {} });
                    await load();
                  } catch (e) {
                    console.warn("predict error:", e);
                  }
                }}
                variant="secondary"
                size="lg"
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              >
                Predict Usage
              </Button>
              <Button
                onClick={sync}
                disabled={syncing}
                variant="secondary"
                size="lg"
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              >
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
            </div>
          </div>
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-primary-foreground/10 rounded-full blur-2xl"></div>
        </div>

        {labelTableMissing && (
          <div className="text-red-600 font-medium">
            {labelTableMissing}
          </div>
        )}

        <Card className="shadow-lg border-2">
          <CardHeader className="border-b bg-gradient-to-r from-card to-primary/5">
            <CardTitle className="text-2xl">Latest Transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
                  <p className="text-sm text-muted-foreground">Loading transactions...</p>
                </div>
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
                  <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-lg font-semibold mb-2">No transactions yet</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Link a wallet and press "Sync Now" to load your transaction history.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map((r) => (
                  <div
                    key={r.id}
                    className="group border-2 rounded-xl p-4 hover:border-primary/50 hover:shadow-md transition-all duration-300 bg-gradient-to-r from-card to-muted/20"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            r.direction === 'in'
                              ? 'bg-success/10 text-success'
                              : r.direction === 'out'
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {r.direction === 'in' ? '↓ Incoming' : r.direction === 'out' ? '↑ Outgoing' : 'Unknown'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Chain {r.chain_id ?? "-"}
                          </span>
                        </div>
                        <div className="font-mono text-sm font-medium mb-1 truncate group-hover:text-primary transition-colors">
                          {r.tx_hash.slice(0, 12)}…{r.tx_hash.slice(-10)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            {r.occurred_at ? new Date(r.occurred_at).toLocaleString() : "-"}
                          </span>
                          <span>•</span>
                          <span className="truncate">
                            Block {r.block_number ?? "-"}
                          </span>
                        </div>
                      </div>

                      {/* 金額 */}
                      <div className="text-right">
                        <div className="font-mono text-lg font-bold mb-1">
                          {r.fiat_value_usd != null ? (
                            <span className={r.direction === 'in' ? 'text-success' : 'text-foreground'}>
                              ${r.fiat_value_usd}
                            </span>
                          ) : r.value_wei != null ? (
                            <span className="text-sm">{r.value_wei} wei</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                        <div className="text-xs font-medium text-muted-foreground">
                          {r.asset_symbol ?? "-"}
                        </div>

                        {/* 用途セレクト */}
                        <div className="mt-3">
                          <select
                            className="border rounded px-2 py-1 text-sm"
                            value={labelMap[r.id] ?? ""}
                            onChange={(e) => saveLabel(r.id, e.target.value)}
                            disabled={!labelsReady || !!labelTableMissing}
                          >
                            {USAGE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
