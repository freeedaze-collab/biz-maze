// src/pages/Accounting.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client"; // ← 統一インポート

type Statement = {
  pl: { lines: { account_code: string; amount: number }[]; net_income: number };
  bs: { lines: { account_code: string; amount: number }[] };
  cf: { method: "indirect"; operating: number; adjustments: number };
};

export default function Accounting() {
  const [data, setData] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErrorMsg("");

      try {
        // ✅ Edge Function は invoke を使う（相対パス fetch をやめる）
        const { data, error } = await supabase.functions.invoke("build-statements", {
          // GET パラメータが必要なら body なしで query を実装側に寄せるか、
          // body に period 等を渡す（今回は body を使わず関数側で30日集計）
          // body: { period: "this_month" },
        });

        if (error) {
          setErrorMsg(`Edge Function error: ${error.message ?? error}`);
        } else if (!data) {
          setErrorMsg("No data returned from build-statements.");
        } else {
          setData(data as Statement);
        }
      } catch (e: any) {
        setErrorMsg(`Invoke failed: ${e?.message || String(e)}`);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  if (loading) return <div className="p-6">Loading statements...</div>;
  if (errorMsg) return <div className="p-6 text-red-600 whitespace-pre-wrap">{errorMsg}</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Financial Statements</h1>

      <section>
        <h2 className="text-xl font-semibold mb-2">P/L</h2>
        <table className="w-full border">
          <thead>
            <tr><th className="p-2 border">Account</th><th className="p-2 border text-right">Amount</th></tr>
          </thead>
          <tbody>
            {data?.pl.lines.map((l, i) => (
              <tr key={i}>
                <td className="p-2 border">{l.account_code}</td>
                <td className="p-2 border text-right">{l.amount.toFixed(2)}</td>
              </tr>
            ))}
            <tr>
              <td className="p-2 border font-bold">Net Income</td>
              <td className="p-2 border text-right font-bold">{data?.pl.net_income.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">B/S</h2>
        <table className="w-full border">
          <thead>
            <tr><th className="p-2 border">Account</th><th className="p-2 border text-right">Balance</th></tr>
          </thead>
          <tbody>
            {data?.bs.lines.map((l, i) => (
              <tr key={i}>
                <td className="p-2 border">{l.account_code}</td>
                <td className="p-2 border text-right">{l.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Cash Flow (Indirect)</h2>
        <table className="w-full border">
          <tbody>
            <tr>
              <td className="p-2 border">Net Income</td>
              <td className="p-2 border text-right">{data?.pl.net_income.toFixed(2)}</td>
            </tr>
            <tr>
              <td className="p-2 border">Non-cash Adjustments</td>
              <td className="p-2 border text-right">{data?.cf.adjustments.toFixed(2)}</td>
            </tr>
            <tr>
              <td className="p-2 border font-bold">Operating Cash Flow</td>
              <td className="p-2 border text-right font-bold">{data?.cf.operating.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
