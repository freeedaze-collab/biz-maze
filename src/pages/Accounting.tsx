// src/pages/Accounting.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type TxRow = {
  source: string;   // "ex:binance" / "wa:137" など
  ts: string;       // ISO
  asset?: string | null;
  amount?: number | null;
  side?: string | null; // buy/sell など（無ければ null）
  gross?: number | null; // 任意
};

export default function Accounting() {
  const { user } = useAuth();
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [rows, setRows] = useState<TxRow[]>([]);
  const [busy, setBusy] = useState(false);

  const parseDate = (s: string) => {
    if (!s.trim()) return null;
    const p = s.replaceAll("/", "-");
    const d = new Date(p);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const load = async () => {
    if (!user?.id) return;
    setBusy(true);
    const out: TxRow[] = [];
    try {
      // 既存の履歴テーブルから取得（名前は例。存在しない場合はスキップ）
      const ex = await supabase
        .from("exchange_trades")
        .select("exchange, ts, symbol, qty")
        .eq("user_id", user.id)
        .limit(5000);
      if (!ex.error && ex.data) {
        for (const r of ex.data as any[]) {
          out.push({ source: `ex:${r.exchange}`, ts: r.ts, asset: r.symbol, amount: Number(r.qty ?? 0), side: null });
        }
      }
    } catch {}
    try {
      const w = await supabase
        .from("wallet_transactions")
        .select("chain_id, timestamp, asset_symbol, amount")
        .eq("user_id", user.id)
        .limit(5000);
      if (!w.error && w.data) {
        for (const r of w.data as any[]) {
          out.push({ source: `wa:${r.chain_id}`, ts: r.timestamp, asset: r.asset_symbol, amount: Number(r.amount ?? 0), side: null });
        }
      }
    } catch {}
    setRows(out);
    setBusy(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const sinceIso = parseDate(since);
  const untilIso = parseDate(until);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const t = new Date(r.ts).getTime();
      if (sinceIso && t < new Date(sinceIso).getTime()) return false;
      if (untilIso && t > new Date(untilIso).getTime()) return false;
      return true;
    });
  }, [rows, sinceIso, untilIso]);

  // 超ざっくり合算（デモ集計）
  const totals = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) {
      const key = r.asset ?? "UNKNOWN";
      m.set(key, (m.get(key) ?? 0) + (r.amount ?? 0));
    }
    return Array.from(m.entries()).map(([asset, amount]) => ({ asset, amount }));
  }, [filtered]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-4xl font-bold">Accounting</h1>

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
        <button className="px-3 py-2 rounded border" onClick={load} disabled={busy}>
          {busy ? "Building..." : "Build statements"}
        </button>
      </div>

      <h2 className="text-2xl font-bold">Totals (demo)</h2>
      {totals.length === 0 ? (
        <p className="text-muted-foreground">No data in the selected period.</p>
      ) : (
        <div className="border rounded p-3">
          <ul className="space-y-1">
            {totals.map((t, i)=>(
              <li key={i} className="text-sm">{t.asset}: <b>{t.amount}</b></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
