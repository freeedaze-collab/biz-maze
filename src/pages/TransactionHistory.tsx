import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ymdToIso } from "@/lib/date";

type Bal = { asset: string; free: number; locked?: number };

export default function TransactionHistory() {
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [balances, setBalances] = useState<Bal[]>([]);
  const [busy, setBusy] = useState(false);
  const toast = (m: string) => alert(m);

  useEffect(() => { void loadBalances(); }, []);

  async function loadBalances() {
    // 表示専用（読み取りのみ）
    const { data } = await supabase
      .from("exchange_balances")
      .select("asset, free, locked")
      .order("asset");
    setBalances((data as any) ?? []);
  }

  async function onSync() {
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) return toast("No auth token. Please re-login.");

      const base =
        import.meta.env.VITE_SUPABASE_URL ||
        (supabase as any).rest?.url?.replace?.("/rest/v1", "");
      const url = `${base}/functions/v1/exchange-sync`;

      // 既存の関数をそのまま使用（symbols は null = all 相当）
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          exchange: "binance",
          symbols: null,
          since: ymdToIso(since),
          until: ymdToIso(until),
        }),
      });

      const text = await res.text();
      let json: any = {};
      try { json = JSON.parse(text); } catch { json = { raw: text }; }
      if (!res.ok) return toast(`Sync failed (${res.status})\nstep: ${json.step}\nerror: ${json.error}`);
      toast(`Synced: ${json.inserted ?? 0} items`);
      await loadBalances();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-4xl font-extrabold">Transaction History</h1>

      <p className="text-muted-foreground">
        If you haven’t linked any wallet yet, <Link to="/wallets" className="underline">go to the Wallets page</Link> and link it first.
      </p>
      <p className="text-muted-foreground">
        <strong>Predict Usage</strong> tries to guess categories from transaction patterns (WIP; it won’t edit your data without confirmation).
      </p>

      <div className="flex flex-wrap gap-2 items-center">
        <label>Since</label>
        <input
          className="border rounded px-2 py-1"
          placeholder="YYYY/MM/DD"
          value={since}
          onChange={(e) => setSince(e.target.value)}
        />
        <label>Until</label>
        <input
          className="border rounded px-2 py-1"
          placeholder="YYYY/MM/DD"
          value={until}
          onChange={(e) => setUntil(e.target.value)}
        />
        <button className="px-3 py-1.5 rounded border" disabled={busy} onClick={onSync}>
          Sync Now
        </button>
        <button className="px-3 py-1.5 rounded border" disabled title="Coming soon">
          Predict Usage
        </button>
      </div>

      <section className="border rounded-xl p-4">
        <h2 className="text-xl font-semibold mb-2">Balances</h2>
        {balances.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No exchange balance found yet. Try syncing first.
          </p>
        ) : (
          <ul className="text-sm">
            {balances.map((b) => (
              <li key={b.asset} className="flex justify-between border-b py-1">
                <span>{b.asset}</span>
                <span>{b.free}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-bold">Latest Transactions</h2>
        <p className="text-sm text-muted-foreground">No transactions yet</p>
      </section>
    </div>
  );
}
