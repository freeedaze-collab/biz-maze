
// src/pages/TransactionHistory.tsx

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Exchange = "binance" | "bybit" | "okx";

interface UnifiedTransaction {
  id: string; user_id: string; source: string; type: 'trade' | 'deposit' | 'withdrawal' | 'transfer';
  asset: string; side: 'buy' | 'sell' | 'in' | 'out' | null; amount: number; price: number | null;
  counter_asset: string | null; fee: number | null; fee_asset: string | null; ts: string;
}

// ★★★ 新アーキテクチャ対応 ★★★
export default function TransactionHistory() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncExch, setSyncExch] = useState<Exchange>("binance");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [symbols, setSymbols] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const toast = (msg: string) => alert(msg);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase.from("v_all_transactions").select("*").eq("user_id", user.id).order("ts", { ascending: false }).limit(200);
    if (error) {
      console.error("[history] load error:", error);
      setTransactions([]);
    } else {
      setTransactions((data as UnifiedTransaction[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user?.id]);

  // ★★★ onSyncを新アーキテクチャ（準備->実行->保存）に完全刷新 ★★★
  const onSync = async () => {
    if (!user?.id) { toast("Please login again."); return; }

    setBusy(true);
    const { data: sess } = await supabase.auth.getSession();
    const headers = sess?.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {};
    const allFetchedRecords: any[] = [];

    try {
      // 1. 準備 (Prep)
      setSyncMessage(`[1/3] Preparing sync for ${syncExch}...`);
      const { data: prepData, error: prepError } = await supabase.functions.invoke("exchange-sync-prep", {
        headers, body: { exchange: syncExch, symbols: symbols.trim() ? symbols : null },
      });
      if (prepError) throw new Error(`[Prep] ${prepError.message}`);
      const { marketsToFetch, deposits, withdrawals } = prepData;
      allFetchedRecords.push(...deposits, ...withdrawals);
      setSyncMessage(`[1/3] Found ${deposits.length} deposits, ${withdrawals.length} withdrawals, and ${marketsToFetch.length} markets to sync.`);

      // 2. 実行 (Worker)
      for (let i = 0; i < marketsToFetch.length; i++) {
        const market = marketsToFetch[i];
        setSyncMessage(`[2/3] Syncing market ${i + 1} of ${marketsToFetch.length}: ${market}...`);
        const { data: workerData, error: workerError } = await supabase.functions.invoke("exchange-sync-worker", {
          headers, body: { exchange: syncExch, symbol: market, since: since || null, until: until || null },
        });
        if (workerError) {
          console.warn(`[Worker] Failed to sync market ${market}. Continuing...`, workerError);
          continue; // 一つの市場の失敗で全体を止めない
        }
        allFetchedRecords.push(...workerData);
      }

      // 3. 保存 (Save)
      if (allFetchedRecords.length === 0) {
        toast("No new records found to save.");
        return;
      }
      setSyncMessage(`[3/3] Saving ${allFetchedRecords.length} records to the database...`);
      const { error: saveError } = await supabase.functions.invoke("exchange-sync-save", {
        headers, body: { exchange: syncExch, records: allFetchedRecords },
      });
      if (saveError) throw new Error(`[Save] ${saveError.message}`);

      toast(`Sync complete! Successfully processed ${allFetchedRecords.length} records.`);
      loadData();

    } catch (error: any) {
      console.error("[Sync Flow Failed]", error);
      toast(`Sync failed: ${error.message}`);
    } finally {
      setBusy(false);
      setSyncMessage("");
    }
  };

  const onSyncWallets = () => toast("Wallet sync feature is coming soon!");

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Transaction History</h1>
            <Link to="/dashboard" className="text-sm underline">Back to Dashboard</Link>
        </div>
        <div className="border rounded-xl p-4 space-y-3">
            <div className="font-semibold">Sync Data</div>
            <div className="flex flex-wrap items-center gap-2">
                <select value={syncExch} onChange={(e) => setSyncExch(e.target.value as Exchange)} className="border rounded px-2 py-1">
                    <option value="binance">Binance</option><option value="bybit">Bybit</option><option value="okx">OKX</option>
                </select>
                <input className="border rounded px-2 py-1 min-w-[210px]" placeholder="since (ISO or ms)" value={since} onChange={(e) => setSince(e.target.value)} />
                <input className="border rounded px-2 py-1 min-w-[210px]" placeholder="until (ISO or ms)" value={until} onChange={(e) => setUntil(e.target.value)} />
                <input className="border rounded px-2 py-1 min-w-[260px]" placeholder="Symbols (e.g., BTC/USDT,ETH/USDT)" value={symbols} onChange={(e) => setSymbols(e.target.value)} />
                <button className="px-3 py-1.5 rounded border bg-blue-600 text-white disabled:opacity-50" onClick={onSync} disabled={busy}>Sync Exchanges</button>
                <button className="px-3 py-1.5 rounded border disabled:opacity-50" onClick={onSyncWallets} disabled={busy}>Sync Wallets</button>
                <Link to="/exchange/VCE" className="text-sm underline ml-4">Manage API Keys</Link>
            </div>
            {syncMessage && <p className="text-sm text-blue-600 font-medium mt-2">{syncMessage}</p>}
        </div>
        <div className="border rounded-xl">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50"><tr>
                    <th className="px-6 py-3 tl text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 tl text-xs font-medium text-gray-500 uppercase">Source</th>
                    <th className="px-6 py-3 tl text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 tl text-xs font-medium text-gray-500 uppercase">Asset</th>
                    <th className="px-6 py-3 tl text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 tl text-xs font-medium text-gray-500 uppercase">Counter Asset</th>
                    <th className="px-6 py-3 tl text-xs font-medium text-gray-500 uppercase">Price</th>
                </tr></thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (<tr><td colSpan={7} className="tc py-4">Loading...</td></tr>) : transactions.length === 0 ? (<tr><td colSpan={7} className="tc py-4 text-gray-500">No transactions found.</td></tr>) : (
                        transactions.map((tx) => (
                            <tr key={tx.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(tx.ts).toLocaleString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">{tx.source}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{tx.type}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">{tx.asset}</td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm ${tx.side === 'buy' || tx.side === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                                    {tx.side === 'buy' || tx.side === 'in' ? '+' : '-'}{tx.amount}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tx.counter_asset}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tx.price}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );
}
