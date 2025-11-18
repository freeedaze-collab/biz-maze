// src/pages/TransactionHistory.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type BalanceRow = { source: string; asset: string; amount: number };
type TxRow = {
  user_id: string;
  source: "wallet" | "exchange";
  source_id: string | null;
  ts: string;           // timestamptz
  chain: string | null;
  tx_hash: string | null;
  asset: string | null;
  amount: number | null;
  exchange: string | null;
  symbol: string | null;
  fee: number | null;
  fee_asset: string | null;
};

export default function TransactionHistory() {
  const { user } = useAuth();
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);

  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const parseDate = (s: string) => {
    if (!s.trim()) return null;
    const p = s.replaceAll("/", "-");
    const d = new Date(p);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  // ===== Balances 読み込み（既存のまま・壊さない） =====
  const loadBalances = async () => {
    if (!user?.id) return;
    const out: BalanceRow[] = [];
    try {
      const eb = await supabase
        .from("exchange_balances")
        .select("exchange, asset, amount")
        .eq("user_id", user.id)
        .limit(1000);
      if (!eb.error && eb.data) {
        for (const r of eb.data as any[])
          out.push({ source: `ex:${r.exchange}`, asset: r.asset, amount: Number(r.amount ?? 0) });
      }
    } catch {}

    try {
      const wb = await supabase
        .from("wallet_balances")
        .select("chain, asset, amount")
        .eq("user_id", user.id)
        .limit(1000);
      if (!wb.error && wb.data) {
        for (const r of wb.data as any[])
          out.push({ source: `wa:${r.chain}`, asset: r.asset, amount: Number(r.amount ?? 0) });
      }
    } catch {}

    setBalances(out);
  };

  // ===== Transactions 読み込み（v_all_transactions） =====
  const loadTxs = async () => {
    if (!user?.id) return;
    setErr(null);
    try {
      let q = supabase
        .from("v_all_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("ts", { ascending: false })
        .limit(1000);

      const s = parseDate(since);
      const u = parseDate(until);

      if (s) q = q.gte("ts", s);
      if (u) q = q.lte("ts", u);

      const { data, error } = await q;
      if (error) throw error;
      setTxs((data as TxRow[]) ?? []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  };

  useEffect(() => {
    loadBalances();
    loadTxs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ===== 既存 Sync（Edge Function 呼び出しは現状維持） =====
  const onSync = async () => {
    if (!user?.id) return alert("Please login again.");
    setBusy(true);
    setErr(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) return alert("No auth token. Please re-login.");

      const base =
        import.meta.env.VITE_SUPABASE_URL ||
        (supabase as any).rest?.url?.replace?.("/rest/v1", "") ||
        "";
      const url = `${base}/functions/v1/exchange-sync`;

      const body = {
        exchange: "binance", // 既存維持（UIで複数化するなら後日拡張）
        symbols: null,       // “all 固定”＝サーバ自動推定
        since: parseDate(since),
        until: parseDate(until),
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }

      if (!res.ok || json?.ok === false) {
        const msg = `Sync failed (${res.status})
step: ${json?.step ?? "unknown"}
error: ${json?.error ?? "unknown"}`;
        setErr(msg);
        alert(msg);
      } else {
        alert(`Synced. Inserted: ${json?.inserted ?? 0}`);
        await loadBalances();
        await loadTxs();
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      alert("Sync failed: " + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  };

  const grouped = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of balances) {
      const k = `${b.source}:${b.asset}`;
      m.set(k, (m.get(k) ?? 0) + b.amount);
    }
    return Array.from(m.entries()).map(([k, v]) => {
      const [source, asset] = k.split(":");
      return { source, asset, amount: v };
    });
  }, [balances]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-4xl font-bold">Transaction History</h1>

      <p className="text-lg">
        If you haven’t linked any wallet yet,{" "}
        <Link to="/wallets" className="underline">
          go to the Wallets page
        </Link>{" "}
        and link it first.
      </p>
      <p className="text-base">
        <b>Predict Usage</b> tries to infer categories from patterns (it never edits data automatically).
      </p>

      {/* Filters & Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span>Since</span>
          <input
            className="border rounded px-2 py-1 min-w-[120px]"
            placeholder="yyyy/mm/dd"
            value={since}
            onChange={(e) => setSince(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span>Until</span>
          <input
            className="border rounded px-2 py-1 min-w-[120px]"
            placeholder="yyyy/mm/dd"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </div>

        <button
          className="px-3 py-2 rounded border disabled:opacity-50"
          disabled={busy}
          onClick={onSync}
          title="Fetch from exchanges; server merges to your tables"
        >
          {busy ? "Syncing..." : "Sync Now"}
        </button>
        <button
          className="px-3 py-2 rounded border"
          onClick={() => alert("Predict Usage: coming soon (Edge Function not found).")}
          title="Analyze patterns and suggest categories; non-destructive"
        >
          Predict Usage
        </button>
        <button
          className="px-3 py-2 rounded border"
          onClick={loadTxs}
          title="Reload from view"
        >
          Refresh List
        </button>
      </div>

      {/* Balances (existing section) */}
      <h2 className="text-2xl font-bold">Balances</h2>
      {grouped.length === 0 ? (
        <p className="text-muted-foreground">No exchange/wallet balances found yet. Try syncing first.</p>
      ) : (
        <div className="border rounded p-3">
          <ul className="space-y-1">
            {grouped.map((g, i) => (
              <li key={i} className="text-sm">
                {g.source} • {g.asset}: <b>{g.amount}</b>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Transactions table (from v_all_transactions) */}
      <h2 className="text-2xl font-bold">All Transactions</h2>
      {txs.length === 0 ? (
        <p className="text-muted-foreground">No transactions found for the current filters.</p>
      ) : (
        <div className="overflow-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Source</th>
                <th className="text-left p-2">Chain/Exch</th>
                <th className="text-left p-2">Asset</th>
                <th className="text-right p-2">Amount</th>
                <th className="text-right p-2">Fee</th>
                <th className="text-left p-2">Tx/Trade ID</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t, i) => (
                <tr key={`${t.source}-${t.source_id}-${i}`} className="border-t">
                  <td className="p-2">{new Date(t.ts).toLocaleString()}</td>
                  <td className="p-2 capitalize">{t.source}</td>
                  <td className="p-2">
                    {t.source === "wallet" ? (t.chain ?? "-") : (t.exchange ?? "-")}
                  </td>
                  <td className="p-2">{t.asset ?? t.symbol ?? "-"}</td>
                  <td className="p-2 text-right">
                    {typeof t.amount === "number" ? t.amount.toLocaleString() : "-"}
                  </td>
                  <td className="p-2 text-right">
                    {typeof t.fee === "number"
                      ? `${t.fee.toLocaleString()} ${t.fee_asset ?? ""}`.trim()
                      : "-"}
                  </td>
                  <td className="p-2 font-mono">
                    {t.source === "wallet" ? (t.tx_hash ?? t.source_id ?? "-") : (t.source_id ?? "-")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {err && <div className="text-red-600 whitespace-pre-wrap text-sm">{err}</div>}
    </div>
  );
}
