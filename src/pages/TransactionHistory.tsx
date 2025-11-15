// src/pages/TransactionHistory.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type BalanceRow = { source: string; asset: string; amount: number };

export default function TransactionHistory() {
  const { user } = useAuth();
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const parseDate = (s: string) => {
    if (!s.trim()) return null;
    const p = s.replaceAll("/", "-");
    const d = new Date(p);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const loadBalances = async () => {
    if (!user?.id) return;
    // 既存テーブルの読み取りのみ（処理は変更しない）
    // テーブル名は例：exchange_balances / wallet_balances がある前提。無ければ表示されないだけ。
    const out: BalanceRow[] = [];
    try {
      const eb = await supabase
        .from("exchange_balances")
        .select("exchange, asset, amount")
        .eq("user_id", user.id)
        .limit(1000);
      if (!eb.error && eb.data) {
        for (const r of eb.data as any[]) out.push({ source: `ex:${r.exchange}`, asset: r.asset, amount: Number(r.amount ?? 0) });
      }
    } catch {}
    try {
      const wb = await supabase
        .from("wallet_balances")
        .select("chain, asset, amount")
        .eq("user_id", user.id)
        .limit(1000);
      if (!wb.error && wb.data) {
        for (const r of wb.data as any[]) out.push({ source: `wa:${r.chain}`, asset: r.asset, amount: Number(r.amount ?? 0) });
      }
    } catch {}
    setBalances(out);
  };

  useEffect(() => { loadBalances(); /* eslint-disable-next-line */ }, [user?.id]);

  const onSync = async () => {
    if (!user?.id) return alert("Please login again.");
    setBusy(true);
    setErr(null);
    try {
      // 既存の Edge Function 呼び出しに合わせる（body キー等は変更しない）
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) return alert("No auth token. Please re-login.");

      const base = import.meta.env.VITE_SUPABASE_URL || (supabase as any).rest?.url?.replace?.("/rest/v1","") || "";
      const url = `${base}/functions/v1/exchange-sync`;

      const body = {
        exchange: "binance",      // ここは UI から選ばせていないが、既存のサーバ側で複数呼び出しされる想定なら適宜拡張可
        symbols: null,            // “all 固定”のリクエスト（サーバ側で自動推定に任せる）
        since: parseDate(since),
        until: parseDate(until),
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(body)
      });

      const text = await res.text();
      let json: any = {};
      try { json = JSON.parse(text); } catch { json = { raw: text }; }

      if (!res.ok || json?.ok === false) {
        setErr(`Sync failed (${res.status})\nstep: ${json?.step ?? "unknown"}\nerror: ${json?.error ?? "unknown"}`);
        alert(`Sync failed (${res.status})\nstep: ${json?.step ?? "unknown"}\nerror: ${json?.error ?? "unknown"}`);
      } else {
        alert(`Synced. Inserted: ${json?.inserted ?? 0}`);
        loadBalances();
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
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-4xl font-bold">Transaction History</h1>

      <p className="text-lg">
        If you haven’t linked any wallet yet,{" "}
        <Link to="/wallets" className="underline">go to the Wallets page</Link> and link it first.
      </p>
      <p className="text-base">
        <b>Predict Usage</b> tries to guess categories from transaction patterns (WIP; it won’t edit your data without confirmation).
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span>Since</span>
          <input
            className="border rounded px-2 py-1 min-w-[110px]"
            placeholder="yyyy/mm/dd"
            value={since} onChange={(e)=>setSince(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span>Until</span>
          <input
            className="border rounded px-2 py-1 min-w-[110px]"
            placeholder="yyyy/mm/dd"
            value={until} onChange={(e)=>setUntil(e.target.value)}
          />
        </div>

        <button className="px-3 py-2 rounded border disabled:opacity-50" disabled={busy} onClick={onSync}>
          {busy ? "Syncing..." : "Sync Now"}
        </button>
        <button className="px-3 py-2 rounded border" onClick={()=>alert("Predict Usage: coming soon (UI only).")}>
          Predict Usage
        </button>
      </div>

      <h2 className="text-2xl font-bold">Balances</h2>
      {grouped.length === 0 ? (
        <p className="text-muted-foreground">No exchange/wallet balances found yet. Try syncing first.</p>
      ) : (
        <div className="border rounded p-3">
          <ul className="space-y-1">
            {grouped.map((g, i)=>(
              <li key={i} className="text-sm">{g.source} • {g.asset}: <b>{g.amount}</b></li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="text-2xl font-bold">Latest Transactions</h2>
      <p className="text-muted-foreground">No transactions are rendered in this UI section yet.</p>

      {err && <div className="text-red-600 whitespace-pre-wrap text-sm">{err}</div>}
    </div>
  );
}
