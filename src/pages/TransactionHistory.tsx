
// src/pages/TransactionHistory.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "../integrations/supabase/client";
import { Button } from "@/components/ui/button";

// ★★★【最終修正】★★★
// amount が null になる可能性を受け入れ、フロントエンドのクラッシュを完全に防ぐ
interface Transaction {
    ts: string;
    tx_hash: string;
    source: string;
    amount: number | null; // null許容に変更
    asset: string | null;
    exchange: string | null;
    symbol: string | null;
}

export default function TransactionHistory() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState<string[]>([]);

    // --- データ取得関数 ---
    const fetchTransactions = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('v_all_transactions')
                .select('ts, tx_hash, source, amount, asset, exchange, symbol')
                .order('ts', { ascending: false })
                .limit(100);
            if (error) throw error;
            setTransactions(data || []);
        } catch (err: any) {
            console.error("Error fetching v_all_transactions:", err);
            setError(`Failed to load data: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, []);

    // --- 同期ロジック ---
    const handleSyncAll = async () => {
        setIsSyncing(true);
        setSyncProgress(['Starting sync...']);
        let totalSaved = 0;

        try {
            const { data: connections, error: connError } = await supabase.from('exchange_connections').select('exchange');
            if (connError || !connections) throw new Error('Could not fetch exchange connections.');
            const exchanges = connections.map(c => c.exchange);
            setSyncProgress(prev => [...prev, `Found exchanges: ${exchanges.join(', ')}`]);

            for (const exchange of exchanges) {
                setSyncProgress(prev => [...prev, `---`, `Processing ${exchange}...`]);
                
                setSyncProgress(prev => [...prev, `[${exchange}] Asking commander for a plan...`]);
                const { data: plan, error: planError } = await supabase.functions.invoke('exchange-sync-all', {
                    body: { exchange },
                });
                if (planError) throw planError;
                if (plan.error) throw new Error(`Plan error for ${exchange}: ${plan.error}`);
                
                const nonTradeSaved = plan.nonTradeCount || 0;
                if (nonTradeSaved > 0) {
                    totalSaved += nonTradeSaved;
                    setSyncProgress(prev => [...prev, `[${exchange}] Commander found and saved ${nonTradeSaved} non-trade records (deposits, withdrawals, converts).`]);
                }

                const symbolsToSync = plan.symbols;
                if (!symbolsToSync || symbolsToSync.length === 0) {
                    setSyncProgress(prev => [...prev, `[${exchange}] No market trades to sync.`]);
                    continue;
                }
                setSyncProgress(prev => [...prev, `[${exchange}] Plan received. ${symbolsToSync.length} markets to sync for trades.`]);

                for (const symbol of symbolsToSync) {
                    setSyncProgress(prev => [...prev, `  -> Syncing ${symbol}...`]);
                    const { data: workerResult, error: workerError } = await supabase.functions.invoke('exchange-sync-worker', {
                        body: { exchange, symbol },
                    });

                    if (workerError) {
                        setSyncProgress(prev => [...prev, `    ERROR for ${symbol}: ${workerError.message}`]);
                        continue; 
                    }
                    if(workerResult.error) {
                        setSyncProgress(prev => [...prev, `    ERROR for ${symbol}: ${workerResult.error}`]);
                        continue;
                    }

                    const saved = workerResult.savedCount || 0;
                    totalSaved += saved;
                    if (saved > 0) {
                        setSyncProgress(prev => [...prev, `    OK. Found and saved ${saved} trades.`]);
                    }
                }
            }

            setSyncProgress(prev => [...prev, '---', `All syncs complete. Total new records saved: ${totalSaved}. Refreshing list...`]);
            await fetchTransactions();

        } catch (error: any) {
            console.error("Sync failed:", error);
            setSyncProgress(prev => [...prev, `A critical error occurred: ${error.message}`]);
        } finally {
            setIsSyncing(false);
        }
    };
    
    const generateDescription = (tx: Transaction): string => {
        if (tx.symbol) return tx.symbol;
        if (tx.source === 'exchange' && tx.exchange) return `Trade on ${tx.exchange}`;
        if (tx.source === 'wallet') return `On-chain transaction`;
        return ''
    }

    return (
        <div className="p-4 md:p-6 lg:p-8">
            <h1 className="text-3xl font-bold mb-6">Transactions</h1>

            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-2">Data Sync</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Manually sync the latest transaction history from your connected sources.
                </p>
                <div className="flex items-center space-x-4">
                    <Button variant="outline" size="sm" onClick={handleSyncAll} disabled={isSyncing}>
                        {isSyncing ? 'Syncing...' : 'Sync All'}
                    </Button>
                     <Link to="/vce" className="text-sm font-medium text-blue-600 hover:underline">
                        Manage API Keys
                    </Link>
                </div>
                {syncProgress.length > 0 && (
                    <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono">
                        <h3 className="font-semibold mb-2">Sync Progress</h3>
                        <div className="whitespace-pre-wrap max-h-60 overflow-y-auto">
                            {syncProgress.join('\n')}
                        </div>
                    </div>
                )}
            </section>

            <section>
                <h2 className="text-2xl font-semibold mb-4">All Transactions</h2>
                {isLoading ? (
                    <p>Loading transactions...</p>
                ) : error ? (
                    <p className="text-red-500 font-mono">{error}</p>
                ) : (
                    <div className="w-full overflow-x-auto">
                         <table className="min-w-full text-sm text-left">
                            <thead className="font-mono text-gray-500">
                                <tr>
                                    <th className="p-2 font-semibold">Date</th>
                                    <th className="p-2 font-semibold">Source</th>
                                    <th className="p-2 font-semibold">Description</th>
                                    <th className="p-2 font-semibold text-right">Amount</th>
                                    <th className="p-2 font-semibold text-right">Asset</th>
                                </tr>
                            </thead>
                            <tbody className="font-mono">
                                {transactions.length > 0 ? transactions.map((tx) => (
                                    <tr key={tx.tx_hash} className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="p-2 whitespace-nowrap">{new Date(tx.ts).toLocaleString()}</td>
                                        <td className="p-2 whitespace-nowrap">{tx.source}</td>
                                        <td className="p-2 text-gray-600 dark:text-gray-400">{generateDescription(tx)}</td>
                                        {/* ★★★【最終修正】★★★ amountがnullの場合でもtoString()でクラッシュしないよう修正 */}
                                        <td className="p-2 text-right">{tx.amount?.toString() ?? ''}</td>
                                        <td className="p-2 text-right text-gray-600 dark:text-gray-400">{tx.asset || ''}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="text-center text-gray-500 py-4">
                                            No transactions found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
