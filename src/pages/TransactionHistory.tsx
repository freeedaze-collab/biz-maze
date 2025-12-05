
// src/pages/TransactionHistory.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "../integrations/supabase/client";
import { Button } from "@/components/ui/button";

// スキーマは確定
interface Transaction {
    ts: string; 
    tx_hash: string; 
    source: string;
    amount: number;
    asset: string | null;
    exchange: string | null;
    symbol: string | null;
}

// ★★★【最終・完成版】★★★
// 自己完結型バックエンド(exchange-sync-all)と連携する最終形態
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

    // --- Sync Logic (最終版) ---
    const handleSyncAll = async () => {
        setIsSyncing(true);
        setSyncProgress(['Starting all exchange syncs...']);

        try {
            // バックエンドは引数不要で、内部で全コネクションを処理する自己完結型
            const { data: result, error: invokeError } = await supabase.functions.invoke('exchange-sync-all', {
                // bodyは空でOK
            });

            if (invokeError) throw invokeError;
            if (result.error) throw new Error(result.stack); // バックエンドからのスタックトレースをスローする

            // バックエンドからの完了報告を受け取る
            const { message, totalSaved } = result;
            setSyncProgress(prev => [...prev, `---`, `Backend process finished.`]);
            setSyncProgress(prev => [...prev, `Message: ${message}`]);
            setSyncProgress(prev => [...prev, `Total new records saved: ${totalSaved}`]);

            setSyncProgress(prev => [...prev, '---', 'Sync complete. Refreshing transaction list...']);
            await fetchTransactions(); // テーブルを再読み込みして最新データを表示

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

            {/* Data Sync Section (破損箇所を修復) */}
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
