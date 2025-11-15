import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ymdToIso } from "@/lib/date";

type Row = { ts: string; symbol?: string; side?: string; qty?: number; price?: number; source?: string };

export default function Accounting() {
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const toast = (m: string) => alert(m);

  async function buildStatements() {
    setBusy(true);
    try {
      // 既存テーブル読み取りのみ（合算の土台：後で統合ビューに差し替え可能）
      const { data, error } = await supabase
        .from("exchange_trades")
        .select("ts, symbol, side, qty, price")
        .gte("ts", ymdToIso(since) ?? "1970-01-01")
        .lte("ts", ymdToIso(until) ?? "2100-01-01")
        .order("ts", { ascending: true });

      if (error) return toast("Failed: " + error.message);
      setRows((data as any[] ?? []).map(d => ({ ...d, source: "exchange" })));

      // ここで wallet 側を足す時も「読み取りのみ」で二重計上はフロントで除外（TxHash等で将来拡張）
      toast("Statements built from the unified history (demo).");
    } finally { setBusy(false); }
  }

  useEffect(()=>{},[]);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-4xl font-extrabold">Accounting</h1>

      <div className="flex flex-wrap items-center gap-2">
        <label>Since</label>
        <input className="border rounded px-2 py-1" placeholder="YYYY/MM/DD" value={since} onChange={(e)=>setSince(e.target.value)} />
        <label>Until</label>
        <input className="border rounded px-2 py-1" placeholder="YYYY/MM/DD" value={until} onChange={(e)=>setUntil(e.target.value)} />
        <button className="px-3 py-1.5 rounded border" disabled={busy} onClick={buildStatements}>
          {busy ? "Building..." : "Build statements"}
        </button>
      </div>

      <h2 className="text-2xl font-bold">Totals (demo)</h2>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">No data in the selected period.</p>
      ) : (
        <div className="border rounded-xl p-4">
          <ul className="text-sm">
            {rows.map((r,i)=>(
              <li key={i} className="border-b py-1 flex justify-between">
                <span>{new Date(r.ts).toLocaleString()}</span>
                <span>{r.symbol} {r.side} {r.qty}@{r.price}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
