// src/pages/Accounting.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type UTx = {
  ts: string;
  source: "wallet" | "exchange";
  symbol?: string | null;
  side?: string | null;
  amount?: number | null;
};

export default function Accounting() {
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [rows, setRows] = useState<UTx[]>([]);
  const [building, setBuilding] = useState(false);

  const toast = (m: string) => alert(m);

  const load = async () => {
    // 同 TransactionHistory と同様の取得（必要あれば共通化可能）
    let unified: UTx[] = [];
    const { data: exTx } = await supabase
      .from("exchange_trades")
      .select("ts, symbol, side, raw")
      .order("ts", { ascending: false })
      .limit(200);
    if (exTx) {
      unified.push(
        ...exTx.map((t: any) => ({
          ts: t.ts,
          source: "exchange",
          symbol: t.symbol,
          side: t.side,
          amount: t.raw?.qty ?? null,
        }))
      );
    }
    const { data: wTx } = await supabase
      .from("wallet_transactions")
      .select("ts, symbol, direction, amount, raw")
      .order("ts", { ascending: false })
      .limit(200);
    if (wTx) {
      unified.push(
        ...wTx.map((t: any) => ({
          ts: t.ts ?? t.raw?.blockTime ?? new Date().toISOString(),
          source: "wallet",
          symbol: t.symbol ?? t.raw?.tokenSymbol ?? null,
          side: t.direction,
          amount: t.amount ?? t.raw?.value ?? null,
        }))
      );
    }

    // since/until フィルタ
    const from = since ? new Date(`${since}T00:00:00Z`).getTime() : null;
    const to = until ? new Date(`${until}T23:59:59Z`).getTime() : null;
    if (from || to) {
      unified = unified.filter((r) => {
        const t = new Date(r.ts).getTime();
        if (from && t < from) return false;
        if (to && t > to) return false;
        return true;
      });
    }
    setRows(unified);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    // 非厳密：デモ用の合算（実運用では通貨レート/評価額が必要）
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = r.symbol ?? "UNKNOWN";
      const cur = m.get(k) ?? 0;
      const amt = Number(r.amount ?? 0) * (r.side?.toLowerCase() === "sell" || r.side === "out" ? -1 : 1);
      m.set(k, cur + amt);
    }
    return Array.from(m.entries()).map(([symbol, amount]) => ({ symbol, amount }));
  }, [rows]);

  const onBuildStatements = async () => {
    setBuilding(true);
    try {
      // 今はクライアント集計のみ。将来はRPC/Edgeで確定版に置換。
      await load();
      toast("Statements built from the unified history (demo aggregation).");
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-extrabold">Accounting</h1>

      <div className="flex flex-wrap items-end gap-2 border rounded-xl p-4">
        <div className="flex flex-col">
          <label className="text-xs mb-1">Since</label>
          <input type="date" value={since} onChange={(e) => setSince(e.target.value)} className="border rounded px-2 py-1" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs mb-1">Until</label>
          <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="border rounded px-2 py-1" />
        </div>
        <button onClick={onBuildStatements} className="px-3 py-2 rounded bg-blue-600 text-white" disabled={building}>
          {building ? "Building..." : "Build statements"}
        </button>
      </div>

      <div className="border rounded-xl p-4">
        <h2 className="font-semibold mb-2">Totals (demo)</h2>
        {totals.length === 0 ? (
          <div className="text-sm text-muted-foreground">No data in the selected period.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-2 text-sm">
            {totals.map((t, i) => (
              <div key={i} className="flex justify-between border rounded p-2">
                <div>{t.symbol}</div>
                <div>{t.amount}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}