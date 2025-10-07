// src/pages/TransactionHistory.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Tx = {
  id: string;
  created_at?: string | null;
  from_address?: string | null;
  to_address?: string | null;
  amount_eth?: string | number | null;
  tx_hash?: string | null;
  status?: string | null;
};

export default function TransactionHistory() {
  const [rows, setRows] = useState<Tx[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg(null);
      try {
        const { data, error } = await supabase
          .from("transactions")
          .select("id, created_at, from_address, to_address, amount_eth, tx_hash, status")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        setRows(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setMsg(e?.message || String(e));
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Transaction History</h1>

      {msg && <div className="text-sm text-red-600">{msg}</div>}

      {rows.length === 0 ? (
        <div className="rounded-xl border p-6 text-sm text-muted-foreground">
          No transactions yet.
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">From</th>
                <th className="text-left p-2">To</th>
                <th className="text-left p-2">Amount (ETH)</th>
                <th className="text-left p-2">Hash</th>
                <th className="text-left p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</td>
                  <td className="p-2 font-mono">{r.from_address || "-"}</td>
                  <td className="p-2 font-mono">{r.to_address || "-"}</td>
                  <td className="p-2">{r.amount_eth ?? "-"}</td>
                  <td className="p-2">
                    {r.tx_hash ? (
                      <a className="text-blue-600 underline" href={`https://etherscan.io/tx/${r.tx_hash}`} target="_blank" rel="noreferrer">
                        {r.tx_hash.slice(0, 10)}...
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="p-2">{r.status || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
