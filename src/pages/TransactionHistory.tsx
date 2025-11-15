// src/pages/TransactionHistory.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type XBalance = { exchange: string; asset: string; free?: number | null; locked?: number | null; updated_at?: string | null };
type UTx = {
  id?: number;
  source: "wallet" | "exchange";
  ts: string;
  symbol?: string | null;
  amount?: number | null;
  side?: string | null;
  raw?: any;
};

export default function TransactionHistory() {
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<XBalance[]>([]);
  const [rows, setRows] = useState<UTx[]>([]);

  // Sync controls
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");

  const toast = (m: string) => alert(m);

  const load = async () => {
    setLoading(true);

    // balances (exchanges)
    const { data: xb } = await supabase
      .from("exchange_balances")
      .select("exchange, asset, free, locked, updated_at")
      .order("exchange", { ascending: true })
      .limit(500);
    setBalances(xb ?? []);

    // unified tx（存在しない環境向けにフォールバック）
    let unified: UTx[] = [];
    const { data: exTx } = await supabase
      .from("exchange_trades")
      .select("id, ts, symbol, side, fee, raw")
      .order("ts", { ascending: false })
      .limit(300);
    if (exTx) {
      unified.push(
        ...exTx.map((t: any) => ({
          id: t.id,
          ts: t.ts,
          source: "exchange",
          symbol: t.symbol,
          side: t.side,
          amount: t.raw?.qty ?? null,
          raw: t,
        }))
      );
    }
    const { data: wTx } = await supabase
      .from("wallet_transactions")
      .select("id, ts, symbol, direction, amount, raw")
      .order("ts", { ascending: false })
      .limit(300);
    if (wTx) {
      unified.push(
        ...wTx.map((t: any) => ({
          id: t.id,
          ts: t.ts ?? t.raw?.blockTime ?? new Date().toISOString(),
          source: "wallet",
          symbol: t.symbol ?? t.raw?.tokenSymbol ?? null,
          side: t.direction,
          amount: t.amount ?? t.raw?.value ?? null,
          raw: t,
        }))
      );
    }

    // very-light de-dup (ts+symbol+amount)
    const seen = new Set<string>();
    unified = unified.filter((u) => {
      const k = `${u.ts}|${u.symbol}|${u.amount}|${u.source}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    unified.sort((a, b) => (a.ts > b.ts ? -1 : 1));
    setRows(unified);

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const onSyncNow = async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) return toast("Please sign in again.");

      const base =
        import.meta.env.VITE_SUPABASE_URL ||
        (supabase as any).rest?.url?.replace?.("/rest/v1", "") ||
        "";
      const url = `${base}/functions/v1/exchange-sync`;

      const body = {
        exchange: "binance", // 拡張時はユーザー毎の連携をループ
        since: since ? `${since}T00:00:00Z` : null,
        until: until ? `${until}T23:59:59Z` : null,
        symbols: "all", // サーバ側で自動推定
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

      if (!res.ok) {
        return toast(
          `Sync failed (${res.status})\nstep: ${json?.step ?? "unknown"}\nerror: ${
            json?.error ?? "unknown"
          }`
        );
      }

      toast(`Sync finished. Inserted: ${json?.inserted ?? 0}`);
      load();
    } catch (e: any) {
      toast("Sync failed: " + (e?.message ?? String(e)));
    }
  };

  const totalRows = rows.length;
  const topNotice = useMemo(
    () => (
      <div className="text-sm text-muted-foreground space-y-2">
        <div>
          If you haven’t linked any wallet yet,{" "}
          <Link to="/wallets" className="underline">
            go to the Wallets page
          </Link>{" "}
          and link it first.
        </div>
        <div>
          <b>Predict Usage</b> tries to guess categories from transaction patterns
          (WIP; it won’t edit your data without confirmation).
        </div>
      </div>
    ),
    []
  );

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-extrabold">Transaction History</h1>

      {/* Top notice moved here */}
      {topNotice}

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-2 border rounded-xl p-4">
        <div className="flex flex-col">
          <label className="text-xs mb-1">Since</label>
          <input
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs mb-1">Until</label>
          <input
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <button onClick={onSyncNow} className="px-3 py-2 rounded bg-blue-600 text-white">
          Sync Now
        </button>
        <button
          onClick={() => alert("Predict Usage will classify transactions (coming soon).")}
          className="px-3 py-2 rounded border"
        >
          Predict Usage
        </button>
      </div>

      {/* Balances */}
      <div className="border rounded-xl p-4">
        <h2 className="font-semibold mb-2">Balances</h2>
        {balances.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No exchange balances yet. Run <b>Sync Now</b> after linking an exchange.
            (Wallet balances will appear after wallet aggregation is enabled.)
          </div>
        ) : (
          <div className="text-sm grid md:grid-cols-2 gap-2">
            {balances.map((b, i) => (
              <div key={i} className="flex justify-between border rounded p-2">
                <div>{b.exchange.toUpperCase()} • {b.asset}</div>
                <div>
                  {b.free ?? 0}
                  {b.locked ? ` (locked: ${b.locked})` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-xl p-4">
        <h2 className="font-semibold mb-2">Latest Transactions ({totalRows})</h2>
        {loading ? (
          <div>Loading…</div>
        ) : totalRows === 0 ? (
          <div className="text-sm text-muted-foreground">No transactions yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-1 pr-2">Time</th>
                  <th className="py-1 pr-2">Source</th>
                  <th className="py-1 pr-2">Symbol</th>
                  <th className="py-1 pr-2">Side</th>
                  <th className="py-1 pr-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="py-1 pr-2">{new Date(r.ts).toLocaleString()}</td>
                    <td className="py-1 pr-2">{r.source}</td>
                    <td className="py-1 pr-2">{r.symbol ?? "—"}</td>
                    <td className="py-1 pr-2">{r.side ?? "—"}</td>
                    <td className="py-1 pr-2">{r.amount ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}