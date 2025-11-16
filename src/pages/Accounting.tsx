// src/pages/Accounting.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Statements = {
  pl: { lines: { account_code: string; amount: number }[]; net_income: number };
  bs: { lines: { account_code: string; amount: number }[] };
  cf: { method: "indirect"; operating: number; adjustments: number };
};

export default function Accounting() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [s, setS] = useState<Statements | null>(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const toISO = (v: string) => {
    if (!v.trim()) return undefined;
    const d = new Date(v.replaceAll("/", "-"));
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  };

  const run = async () => {
    setLoading(true);
    setErr(null);
    setS(null);
    const body: any = {};
    // 期間指定は「付けるだけ」。サーバ未対応でも影響なし（既存仕様はそのまま）
    const f = toISO(dateFrom);
    const t = toISO(dateTo);
    if (f) body.dateFrom = f;
    if (t) body.dateTo = t;

    const { data, error } = await supabase.functions.invoke("build-statements", {
      body,
    });
    if (error) {
      setErr(error.message ?? String(error));
      setLoading(false);
      return;
    }
    setS(data as Statements);
    setLoading(false);
  };

  useEffect(() => { run(); }, []); // 既存の自動ビルド挙動は維持

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Accounting / Tax</h1>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span>Since</span>
          <input
            className="border rounded px-2 py-1 min-w-[120px]"
            placeholder="yyyy/mm/dd"
            value={dateFrom}
            onChange={(e)=>setDateFrom(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span>Until</span>
          <input
            className="border rounded px-2 py-1 min-w-[120px]"
            placeholder="yyyy/mm/dd"
            value={dateTo}
            onChange={(e)=>setDateTo(e.target.value)}
          />
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={run}
          disabled={loading}
        >
          {loading ? "Building..." : "Build Statements"}
        </button>
      </div>

      {err && <div className="text-red-600">{err}</div>}

      {s && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profit & Loss */}
          <div className="border rounded p-4">
            <h2 className="font-semibold mb-3">Profit & Loss</h2>
            <table className="w-full text-sm">
              <tbody>
                {s.pl.lines.map((l) => (
                  <tr key={l.account_code}>
                    <td className="py-1">{l.account_code}</td>
                    <td className="py-1 text-right">${l.amount.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="border-t">
                  <td className="py-1 font-semibold">Net Income</td>
                  <td className="py-1 text-right font-semibold">
                    ${s.pl.net_income.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Balance Sheet */}
          <div className="border rounded p-4">
            <h2 className="font-semibold mb-3">Balance Sheet</h2>
            <table className="w-full text-sm">
              <tbody>
                {s.bs.lines.map((l, i) => (
                  <tr key={`${l.account_code}-${i}`}>
                    <td className="py-1">{l.account_code}</td>
                    <td className="py-1 text-right">${l.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cash Flow */}
          <div className="border rounded p-4">
            <h2 className="font-semibold mb-3">Cash Flow (Indirect)</h2>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-1">Operating Cash Flow</td>
                  <td className="py-1 text-right">${s.cf.operating.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="py-1">Adjustments</td>
                  <td className="py-1 text-right">${s.cf.adjustments.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
