// src/pages/Accounting.tsx
// 三表をEdge Functionから取得して表示（CSV/Excelは後続）
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Statement = {
  pl: { lines: { account_code: string; amount: number }[]; net_income: number };
  bs: { lines: { account_code: string; amount: number }[] };
  cf: { method: "indirect"; operating: number; adjustments: number };
};

export default function Accounting() {
  const [data, setData] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("/functions/v1/build-statements?period=this_month", {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const json = await res.json();
      setData(json);
      setLoading(false);
    };
    run();
  }, []);

  if (loading) return <div className="p-6">Loading statements...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Financial Statements</h1>

      <section>
        <h2 className="text-xl font-semibold mb-2">P/L</h2>
        <table className="w-full border">
          <thead><tr><th className="p-2 border">Account</th><th className="p-2 border text-right">Amount</th></tr></thead>
          <tbody>
            {data?.pl.lines.map((l, i) => (
              <tr key={i}><td className="p-2 border">{l.account_code}</td>
                <td className="p-2 border text-right">{l.amount.toFixed(2)}</td></tr>
            ))}
            <tr><td className="p-2 border font-bold">Net Income</td>
              <td className="p-2 border text-right font-bold">{data?.pl.net_income.toFixed(2)}</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">B/S</h2>
        <table className="w-full border">
          <thead><tr><th className="p-2 border">Account</th><th className="p-2 border text-right">Balance</th></tr></thead>
          <tbody>
            {data?.bs.lines.map((l, i) => (
              <tr key={i}><td className="p-2 border">{l.account_code}</td>
                <td className="p-2 border text-right">{l.amount.toFixed(2)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Cash Flow (Indirect)</h2>
        <table className="w-full border">
          <tbody>
            <tr><td className="p-2 border">Net Income</td><td className="p-2 border text-right">{data?.pl.net_income.toFixed(2)}</td></tr>
            <tr><td className="p-2 border">Non-cash Adjustments</td><td className="p-2 border text-right">{data?.cf.adjustments.toFixed(2)}</td></tr>
            <tr><td className="p-2 border font-bold">Operating Cash Flow</td><td className="p-2 border text-right font-bold">{data?.cf.operating.toFixed(2)}</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
