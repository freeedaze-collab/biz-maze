// src/pages/Accounting.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";

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

  useEffect(() => {
    run();
  }, []); // auto build stays

  return (
    <AppLayout
      title="Accounting"
      subtitle="Keep the data table layout intact while refreshing the visual shell."
    >
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span>Since</span>
            <input
              className="border rounded px-2 py-1 min-w-[120px]"
              placeholder="yyyy/mm/dd"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span>Until</span>
            <input
              className="border rounded px-2 py-1 min-w-[120px]"
              placeholder="yyyy/mm/dd"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          <button
            className="px-3 py-2 rounded border"
            onClick={run}
            disabled={loading}
            title="Rebuild statements"
          >
            {loading ? "Building..." : "Refresh"}
          </button>
        </div>

        {err && <div className="text-red-600 text-sm">{err}</div>}

        {!s && !loading && <div className="text-sm text-muted-foreground">No statements built yet.</div>}

        {loading && <div className="text-sm">Building statements...</div>}

        {s && (
          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-2">Profit &amp; Loss Statement (P&amp;L)</h2>
              <table className="w-full text-sm border rounded overflow-hidden">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left p-2">Account</th>
                    <th className="text-right p-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {s.pl.lines.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{l.account_code}</td>
                      <td className="p-2 text-right">{l.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td className="p-2">Net income</td>
                    <td className="p-2 text-right">{s.pl.net_income.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">Balance Sheet</h2>
              <table className="w-full text-sm border rounded overflow-hidden">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left p-2">Account</th>
                    <th className="text-right p-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {s.bs.lines.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{l.account_code}</td>
                      <td className="p-2 text-right">{l.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">Cash Flow Statement</h2>
              <p className="text-sm text-muted-foreground mb-2">Method: {s.cf.method}</p>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="border rounded p-3 bg-white">
                  <div className="font-semibold">Operating Activities</div>
                  <div className="text-2xl">{s.cf.operating.toLocaleString()}</div>
                </div>
                <div className="border rounded p-3 bg-white">
                  <div className="font-semibold">Adjustments</div>
                  <div className="text-2xl">{s.cf.adjustments.toLocaleString()}</div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
