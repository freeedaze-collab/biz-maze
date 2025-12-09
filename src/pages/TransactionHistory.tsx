// @ts-nocheck
// src/pages/TransactionHistory.tsx
import { useEffect, useState, useCallback } from "react";
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
  usage_pred?: string | null;
  usage_conf?: string | null;
};

export default function TransactionHistory() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [historySyncing, setHistorySyncing] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setMsg("");

    // 1) 取引本体のみ取得（素のテーブル）
    const { data: txs, error: txErr } = await supabase
      .from("wallet_transactions")
      .select(
        "id,wallet_address,chain_id,direction,tx_hash,block_number,occurred_at,asset_symbol,value_wei,fiat_value_usd"
      )
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: false })
      .limit(200);

    if (txErr) {
      console.error("load tx error:", txErr);
      setRows([]);
      setMsg(`Failed to load transactions: ${txErr.message}`);
      setLoading(false);
      return;
    }

    const ids = (txs ?? []).map((t) => t.id);
    let labelMap = new Map<number, { pred?: string | null; conf?: string | null }>();

    // 2) 用途ラベルを別クエリで取得（リレーション不要）
    if (ids.length) {
      const { data: labels, error: labErr } = await supabase
        .from("transaction_usage_labels")
        .select("tx_id,predicted_key,confirmed_key")
        .eq("user_id", user.id)
        .in("tx_id", ids);

      if (!labErr && labels) {
        for (const l of labels) {
          labelMap.set(l.tx_id, { pred: l.predicted_key, conf: l.confirmed_key });
        }
      }
    }

    const mapped = (txs ?? []).map((t) => {
      const lab = labelMap.get(t.id);
      return {
        ...t,
        usage_pred: lab?.pred ?? null,
        usage_conf: lab?.conf ?? null,
      } as Row;
    });

    setRows(mapped);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const classify = async () => {
    setClassifying(true);
    setMsg("");
    try {
      const { error } = await supabase.functions.invoke("classify-usage", { body: {} });
      if (error) setMsg(error.message ?? String(error));
    } catch (e: any) {
      console.warn("classify error:", e);
      setMsg(e?.message || String(e));
    } finally {
      await load();
      setClassifying(false);
    }
  };

  const sync = async () => {
    setSyncing(true);
    setMsg("");
    try {
      const { error } = await supabase.functions.invoke("sync-wallet-transactions", { body: {} });
      if (error) setMsg(error.message ?? String(error));
    } catch (e: any) {
      console.warn("sync error:", e);
      setMsg(e?.message || String(e));
    } finally {
      await load();
      setSyncing(false);
    }
  };

  const syncWalletHistory = async () => {
    setHistorySyncing(true);
    setMsg("");
    try {
      const { error } = await supabase.functions.invoke("sync_wallet_history", { body: {} });
      if (error) setMsg(error.message ?? String(error));
    } catch (e: any) {
      console.warn("sync wallet history error:", e);
      setMsg(e?.message || String(e));
    } finally {
      await load();
      setHistorySyncing(false);
    }
  };

  const onChangeUsage = async (txId: number, key: string) => {
    if (!user) return;
    setMsg("");
    const { error } = await supabase
      .from("transaction_usage_labels")
      .upsert({ tx_id: txId, user_id: user.id, confirmed_key: key }, { onConflict: "user_id,tx_id" });

    if (error) {
      console.warn("label save error:", error);
      setMsg(error.message ?? String(error));
      return;
    }

    try {
      const { error: genErr } = await supabase.functions.invoke("generate-journal-entries", {
        body: { tx_ids: [txId] }
      });
      if (genErr) setMsg(genErr.message ?? String(genErr));
    } catch (e: any) {
      console.warn("generate error:", e);
      setMsg(e?.message || String(e));
    }
    await load();
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
              <div className="flex gap-2">
                <Button onClick={classify} disabled={classifying} variant="secondary" size="lg"
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                  {classifying ? "Classifying..." : "Predict Usage"}
                </Button>
                <Button onClick={syncWalletHistory} disabled={historySyncing} variant="secondary" size="lg"
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                  {historySyncing ? "Syncing History..." : "Sync Wallet History"}
                </Button>
                <Button onClick={sync} disabled={syncing} variant="secondary" size="lg"
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                  {syncing ? "Syncing..." : "Sync Now"}
                </Button>
              </div>
          </div>
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-primary-foreground/10 rounded-full blur-2xl"></div>
        </div>

        {msg && <div className="text-sm text-red-600">{msg}</div>}

        <Card className="shadow-lg border-2">
          <CardHeader className="border-b bg-gradient-to-r from-card to-primary/5">
            <CardTitle className="text-2xl">Latest Transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-12">No transactions yet</div>
            ) : (
              <div className="space-y-3">
                {rows.map((r) => (
                  <div key={r.id}
                    className="group border-2 rounded-xl p-4 hover:border-primary/50 hover:shadow-md transition-all duration-300 bg-gradient-to-r from-card to-muted/20"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            r.direction === 'in' ? 'bg-success/10 text-success' :
                            r.direction === 'out' ? 'bg-destructive/10 text-destructive' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {r.direction === 'in' ? '↓ Incoming' : r.direction === 'out' ? '↑ Outgoing' : 'Unknown'}
                          </span>
                          <span className="text-xs text-muted-foreground">Chain {r.chain_id ?? "-"}</span>
                        </div>
                        <div className="font-mono text-sm font-medium mb-1 truncate group-hover:text-primary">
                          {r.tx_hash.slice(0, 12)}…{r.tx_hash.slice(-10)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{r.occurred_at ? new Date(r.occurred_at).toLocaleString() : "-"}</span>
                          <span>•</span>
                          <span className="truncate">Block {r.block_number ?? "-"}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-lg font-bold mb-1">
                          {r.fiat_value_usd != null ? (
                            <span className={r.direction === 'in' ? 'text-success' : 'text-foreground'}>${r.fiat_value_usd}</span>
                          ) : r.value_wei != null ? (
                            <span className="text-sm">{r.value_wei} wei</span>
                          ) : (<span className="text-muted-foreground">-</span>)}
                        </div>

                        {/* 用途ドロップダウン */}
                        <div className="mt-2">
                          <select
                            className="border rounded p-1 text-sm"
                            value={r.usage_conf ?? r.usage_pred ?? ""}
                            onChange={(e) => onChangeUsage(r.id, e.target.value)}
                          >
                            <option value="">用途を選択</option>
                            <option value="investment">投資（無形）</option>
                            <option value="impairment">減損</option>
                            <option value="inventory_trader">棚卸（LCNRV）</option>
                            <option value="inventory_broker">ブローカー特例（FVLCS）</option>
                            <option value="ifrs15_non_cash">非現金対価</option>
                            <option value="mining">マイニング報酬</option>
                            <option value="staking">ステーキング報酬</option>
                            <option value="disposal_sale">売却/除却</option>
                          </select>
                          {r.usage_pred && !r.usage_conf && (
                            <div className="text-xs text-muted-foreground mt-1">予測: {r.usage_pred}</div>
                          )}
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
