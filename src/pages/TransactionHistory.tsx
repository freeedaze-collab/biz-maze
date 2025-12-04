
// src/pages/TransactionHistory.tsx

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// NOTE: This interface is for the VIEW, not the raw table.
interface UnifiedTransaction {
  id: string; user_id: string; source: string; type: 'trade' | 'deposit' | 'withdrawal' | 'transfer';
  asset: string; side: 'buy' | 'sell' | 'in' | 'out' | null; amount: number; price: number | null;
  counter_asset: string | null; fee: number | null; fee_asset: string | null; ts: string;
}

// ★★★ お客様のご要望に基づき、UIを画像のデザインに復元し、バックエンドロジックを接続 ★★★
export default function TransactionHistory() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const toast = (msg: string) => alert(msg);

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    // v_all_transactions VIEWからデータを取得
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

  // Wallet Sync用のプレースホルダー関数
  const onSyncWallet = () => toast("Wallet sync feature is coming soon!");

  // ★★★ これが、最後の、そして、唯一、正しい、同期ロジック ★★★
  const onSyncAllExchanges = async () => {
    if (!user?.id) { toast("Please login again."); return; }
    setBusy(true);

    const { data: sess } = await supabase.auth.getSession();
    const headers = sess?.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {};

    try {
      // 1. ユーザーが連携している全ての取引所を取得
      setSyncMessage("Fetching your connected exchanges...");
      const { data: connections, error: connError } = await supabase.from('exchange_connections').select('exchange').eq('user_id', user.id);
      if (connError) throw new Error(`Failed to fetch connections: ${connError.message}`);
      if (!connections || connections.length === 0) {
        toast("No connected exchanges found. Please add API keys via 'Manage API Keys'.");
        return;
      }
      const exchangesToSync: string[] = connections.map(c => c.exchange);
      let totalRecordsSaved = 0;

      // 2. 各取引所をループして、新しい、単一の、正しい関数を呼び出す
      for (let i = 0; i < exchangesToSync.length; i++) {
        const currentExch = exchangesToSync[i] as string;
        const exchangeProgress = `(${i + 1}/${exchangesToSync.length})`;

        setSyncMessage(`[${currentExch} ${exchangeProgress}] Syncing all records...`);

        // 2a. 新しい `exchange-sync-all` を呼び出し、全てのレコードを一度に取得
        const { data: allRecords, error: syncError } = await supabase.functions.invoke("exchange-sync-all", {
            headers, body: { exchange: currentExch },
        });
        if (syncError) {
            console.warn(`[${currentExch} Sync All] Failed, continuing...`, syncError);
            continue; // エラーが発生しても、次の取引所の処理へ進む
        }

        // 2b. 取得したレコードを `exchange-sync-save` で保存
        if (allRecords && allRecords.length > 0) {
            setSyncMessage(`[${currentExch} ${exchangeProgress}] Saving ${allRecords.length} records...`);
            const { data: saveData, error: saveError } = await supabase.functions.invoke("exchange-sync-save", {
                headers, body: { exchange: currentExch, records: allRecords },
            });
            if (saveError) throw new Error(`[${currentExch} Save] ${saveError.message}`);
            totalRecordsSaved += saveData.totalSaved ?? 0;
        }
      }
      
      toast(`Sync complete! Saved ${totalRecordsSaved} new records across ${exchangesToSync.length} exchanges.`);
      loadData(); // 最後にデータをリロードして、画面を更新

    } catch (error: any) {
      console.error("[Sync All Flow Failed]", error);
      toast(`Sync failed: ${error.message}`);
    } finally {
      setBusy(false);
      setSyncMessage("");
    }
  };


  return (
    <div className="space-y-6">
        <h1 className="text-3xl font-bold">Transactions</h1>

        <div className="space-y-4 p-6 border rounded-lg">
            <h2 className="text-xl font-semibold">Data Sync</h2>
            <p className="text-gray-600">Manually sync the latest transaction history from your connected sources.</p>
            
            <div className="grid md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                    <div className="font-medium">Wallet (ethereum)</div>
                    <button className="px-4 py-2 rounded border disabled:opacity-50 flex items-center gap-2" onClick={onSyncWallet} disabled={busy}>Sync</button>
                </div>
                <div className="space-y-2">
                    <div className="font-medium">All Connected Exchanges</div>
                    <button className="px-4 py-2 rounded border bg-blue-600 text-white disabled:opacity-50 flex items-center gap-2" onClick={onSyncAllExchanges} disabled={busy}>Sync All</button>
                </div>
            </div>
            {syncMessage && <p className="text-sm text-blue-600 font-medium mt-4">{syncMessage}</p>}
            <div className="pt-2"><Link to="/exchange/VCE" className="text-sm underline">Manage API Keys</Link></div>
        </div>

        <div className="space-y-4">
            <h2 className="text-xl font-semibold">All Transactions</h2>
            <div className="border rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                    </tr></thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (<tr><td colSpan={5} className="text-center py-4">Loading...</td></tr>) : transactions.length === 0 ? (<tr><td colSpan={5} className="text-center py-4 text-gray-500">No transactions found.</td></tr>) : (
                            transactions.map((tx) => (
                                <tr key={tx.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(tx.ts).toLocaleString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">{tx.source}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{tx.type}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${tx.side === 'buy' || tx.side === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                                        {tx.side === 'buy' || tx.side === 'in' ? '+' : '-'}{tx.amount}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">{tx.asset}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
}

