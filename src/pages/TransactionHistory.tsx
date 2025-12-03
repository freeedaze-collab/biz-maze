
// src/pages/TransactionHistory.tsx

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// VCE.tsxから型定義を移植
type Exchange = "binance" | "bybit" | "okx";

interface SyncState {
  marketsToProcess: string[];
  processedRecords: any[];
  since: number;
}

interface ExchangeConn {
  id: number;
  exchange: Exchange;
}

// 取引履歴データの型定義（仮）
interface Transaction {
  id: string;
  ts: string;
  exchange: string;
  symbol: string;
  side: string;
  amount: number;
  price: number;
}

export default function TransactionHistory() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // ===== VCE.tsxから同期関連のStateを移植 =====
  const [connections, setConnections] = useState<ExchangeConn[]>([]);
  const [syncExch, setSyncExch] = useState<Exchange>("binance");
  const [busy, setBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const toast = (msg: string) => alert(msg);

  // 接続済みの取引所リストと取引履歴をロードする
  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);

    // 接続済み取引所リストを取得
    const { data: connData, error: connError } = await supabase
      .from("exchange_connections")
      .select("id, exchange")
      .eq("user_id", user.id);
    if (connError) console.error("[sync] Error loading connections:", connError);
    else setConnections(connData as ExchangeConn[] || []);

    // 取引履歴を取得
    const { data, error } = await supabase
      .from("exchange_trades") // `transactions`から`exchange_trades`に変更
      .select("id, ts, exchange, symbol, side, amount, price")
      .eq("user_id", user.id)
      .order("ts", { ascending: false })
      .limit(100); // パフォーマンスのため件数を制限

    if (error) {
      console.error("[history] load error:", error);
      setTransactions([]);
    } else {
      setTransactions(data as Transaction[] ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ===== VCE.tsxから同期ロジック(onSync)を完全に移植 =====
  const onSync = async () => {
    if (!user?.id) { toast("Please login again."); return; }

    setBusy(true);
    setSyncMessage(`Sync starting for ${syncExch}...`);

    const { data: sess } = await supabase.auth.getSession();
    const headers = sess?.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {};

    let currentState: SyncState | null = null;
    let keepGoing = true;
    let finalData = null;
    let totalMarketCount = 0;

    while (keepGoing) {
      try {
        const { error, data } = await supabase.functions.invoke("exchange-sync-all", {
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exchange: syncExch,
            state: currentState,
          }),
        });

        if (error) throw error;
        
        if (data.status === 'pending') {
          currentState = data.state;
          if (totalMarketCount === 0 && currentState?.marketsToProcess) {
            totalMarketCount = currentState.marketsToProcess.length + 1; // +1 for initial step
          }
          const processedCount = totalMarketCount - (currentState?.marketsToProcess.length ?? 0);
          setSyncMessage(`Syncing ${syncExch}... Processed ${processedCount} of ${totalMarketCount} steps.`);
        } else if (data.status === 'complete') {
          finalData = data;
          keepGoing = false;
        } else {
          throw new Error("Unexpected response from sync function.");
        }
      } catch (error: any) {
        console.error(error);
        toast(`Sync failed for ${syncExch}: ` + (error.message || "An unknown error occurred."));
        setSyncMessage("");
        setBusy(false);
        return; // Exit on error
      }
    }

    setBusy(false);
    setSyncMessage("");
    toast(`Sync complete for ${syncExch}! Saved ${finalData?.totalSaved ?? 0} new records.`);
    console.log("[sync] result:", finalData);
    loadData(); // 同期完了後、取引履歴を再読み込み
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transaction History</h1>
        <Link to="/dashboard" className="text-sm underline">Back to Dashboard</Link>
      </div>

      {/* ===== ここから同期UI ===== */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="font-semibold">Sync Exchange Transactions</div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={syncExch}
            onChange={(e) => setSyncExch(e.target.value as Exchange)}
            className="border rounded px-2 py-1"
            disabled={connections.length === 0 || busy}
          >
            {connections.length > 0 ? (
              connections.map(c => <option key={c.id} value={c.exchange}>{c.exchange}</option>)
            ) : (
              <option>No connections found</option>
            )}
          </select>
          
          <button
            className="px-3 py-1.5 rounded border bg-blue-600 text-white disabled:opacity-50"
            onClick={onSync}
            disabled={busy || connections.length === 0}
          >
            Sync now
          </button>
          <Link to="/exchange/VCE" className="text-sm underline ml-4">Manage Connections</Link>
        </div>
        
        {syncMessage && (
          <p className="text-sm text-blue-600 font-medium mt-2">
            {syncMessage}
          </p>
        )}

        <ul className="text-xs text-muted-foreground list-disc ml-5">
          <li>Sync fetches all trades, deposits, and withdrawals from the last 90 days.</li>
        </ul>
      </div>
      {/* ===== 同期UIここまで ===== */}

      {/* ===== 取引履歴テーブル ===== */}
      <div className="border rounded-xl">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exchange</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Side</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-4">Loading...</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-4 text-gray-500">No transactions found.</td></tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(tx.ts).toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">{tx.exchange}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tx.symbol}</td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${tx.side === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.side}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tx.amount}</td>
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
