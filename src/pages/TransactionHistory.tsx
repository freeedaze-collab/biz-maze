// src/pages/TransactionHistory.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type WalletTx = {
  id: number;
  user_id: string;
  wallet_address: string;
  chain_id: number;
  direction: "in" | "out" | "self";
  tx_hash: string;
  block_number: number | null;
  timestamp: string | null;
  from_address: string | null;
  to_address: string | null;
  value_wei: string | null;
  asset_symbol: string | null;
  created_at: string;
};

export default function TransactionHistory() {
  const { session, user } = useAuth();
  const [rows, setRows] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const FUNCTIONS_BASE = useMemo(() => {
    const url = (import.meta.env.VITE_SUPABASE_URL as string) || "";
    return url.replace(/\/+$/, "") + "/functions/v1";
  }, []);

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(200);
      if (error) throw error;
      setRows((data || []) as WalletTx[]);
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const syncNow = async () => {
    if (!session?.access_token) {
      setMsg("Not signed in.");
      return;
    }
    setSyncing(true);
    setMsg(null);
    try {
      const r = await fetch(`${FUNCTIONS_BASE}/sync_wallet_history`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || `Sync failed (${r.status})`);
      }
      await load();
      setMsg(`Synced ${j.synced ?? 0} items`);
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Transaction History</h1>
        <div className="flex gap-2">
          <button
            className="px-4 py-2 rounded border"
            onClick={load}
            disabled={loading || syncing}
          >
            {loading ? "Loading..." : "Reload"}
          </button>
          <button
            className="px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50"
            onClick={syncNow}
            disabled={loading || syncing}
          >
            {syncing ? "Syncing..." : "Sync now"}
          </button>
        </div>
      </div>

      {msg && <div className="mb-3 text-sm text-blue-600 whitespace-pre-wrap">{msg}</div>}

      {loading ? (
        <div>Loading...</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No transactions yet. Click “Sync now” to fetch from chain.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="border rounded p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <div className="font-mono break-all">
                    {r.tx_hash.slice(0, 10)}…{r.tx_hash.slice(-8)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.timestamp
                      ? new Date(r.timestamp).toLocaleString()
                      : "(no timestamp)"}{" "}
                    · Block {r.block_number ?? "-"} · Chain {r.chain_id}
                  </div>
                  <div className="text-xs">
                    {r.direction.toUpperCase()} — {r.from_address ?? "-"} → {r.to_address ?? "-"}
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
    </div>
  );
}
