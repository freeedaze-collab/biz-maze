
// src/pages/TransactionHistory.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "../integrations/supabase/client";
import { Button } from "@/components/ui/button";

// スキーマはこれで確定
interface Transaction {
    ts: string;
    tx_hash: string;
    source: string;
    amount: number;
    asset: string | null;
    exchange: string | null;
    symbol: string | null;
}

// ★★★【最終接続オペレーション版】★★★
// Sync Allボタンを有効化し、新しいバックエンドロジックに接続する
export default function TransactionHistory() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- Sync State ---
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState<string[]>([]);

    // --- Data Fetching (Table) ---
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

    // --- Sync Logic ---
    const handleSyncAll = async () => {
        setIsSyncing(true);
        setSyncProgress(['Starting sync...']);

        try {
            const { data: connections, error: connectionsError } = await supabase
                .from('exchange_connections')
                .select('exchange');

            if (connectionsError || !connections || connections.length === 0) {
                setSyncProgress(prev => [...prev, 'No exchange connections found. Please add API keys first.']);
                setIsSyncing(false);
                return;
            }

            const exchangesToSync = connections.map(c => c.exchange);
            setSyncProgress(prev => [...prev, `Found ${exchangesToSync.length} exchanges: ${exchangesToSync.join(', ')}`]);

            for (const exchange of exchangesToSync) {
                setSyncProgress(prev => [...prev, `---`, `Syncing ${exchange}...`]);
                
                const { data: trades, error: invokeError } = await supabase.functions.invoke('exchange-sync-all', {
                    body: { exchange: exchange },
                });

                if (invokeError) throw invokeError;
                if (trades.error) throw new Error(trades.error);

                setSyncProgress(prev => [...prev, `Fetched ${trades.length} trades from ${exchange}.`]);
                console.log(`[${exchange}] Fetched raw trades:`, trades);

                if (trades.length > 0) {
                    setSyncProgress(prev => [...prev, `Next step: Save these ${trades.length} trades to the database.`]);
                    // TODO: ここで、取得した`trades`をDBに保存する関数を呼び出す。
                    // 例: await saveTradesToDatabase(trades, exchange);
                } else {
                    setSyncProgress(prev => [...prev, `No new trades found.`]);
                }
            }

            setSyncProgress(prev => [...prev, '---', 'All syncs complete. Refreshing transaction list...']);
            await fetchTransactions(); // テーブルを再読み込み

        } catch (error: any) {
            console.error("Sync failed:", error);
            setSyncProgress(prev => [...prev, `An error occurred: ${error.message}`]);
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

            {/* Data Sync Section */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-2">Data Sync</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Manually sync the latest transaction history from your connected sources.
                </p>
                <div className="space-y-3">
                    <div>
                        <p>Wallet (ethereum)</p>
                        <Button variant="outline" size="sm">Sync</Button>
                    </div>
                    <div>
                        <p>All Connected Exchanges</p>
                        <Button variant="outline" size="sm" onClick={handleSyncAll} disabled={isSyncing}>
                            {isSyncing ? 'Syncing...' : 'Sync All'}
                        </Button>
                    </div>
                    <div>
                        <Link to="/vce" className="text-sm font-medium text-blue-600 hover:underline">
                            Manage API Keys
                        </Link>
                    </div>
                </div>
                {/* Sync Progress Display */}
                {syncProgress.length > 0 && (
                    <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono">
                        <h3 className="font-semibold mb-2">Sync Progress</h3>
                        <div className="whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {syncProgress.join('\n')}
                        </div>
                    </div>
                )}
            </section>

            {/* All Transactions Section */}
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
                                        <td className="p-2 text-right">{tx.amount.toString()}</td>
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
