
// src/pages/TransactionHistory.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "../integrations/supabase/client";
import { Button } from "@/components/ui/button";

// インターフェース定義
interface ExchangeConnection {
    id: string;
    exchange: string;
}

interface Transaction {
    id: string;
    created_at: string;
    source: string;
    description: string | null;
    amount: number;
    asset: string;
}

// ★★★【UI復元版】★★★
// ご提示の、スクリーンショットに、基づいて、UIを、完全に、再構築
export default function TransactionHistory() {
    // --- STATE --- 
    const [connections, setConnections] = useState<ExchangeConnection[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<Record<string, string>>({});
    const isSyncing = Object.values(syncStatus).some(s => s.includes('...'));

    // --- DATA FETCHING --- 
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // 取引所接続と、取引履歴を、並行して、取得
                const [connectionsRes, transactionsRes] = await Promise.all([
                    supabase.from('exchange_connections').select('id, exchange'),
                    supabase.from('transactions').select('id, created_at, source, description, amount, asset').order('created_at', { ascending: false }).limit(100)
                ]);

                if (connectionsRes.error) throw connectionsRes.error;
                setConnections(connectionsRes.data || []);

                if (transactionsRes.error) throw transactionsRes.error;
                setTransactions(transactionsRes.data || []);

            } catch (err: any) {
                console.error("Error fetching page data:", err);
                setError(`Failed to load data: ${err.message}`);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // --- SYNC LOGIC --- 
    const updateStatus = (target: string, message: string) => {
        setSyncStatus(prev => ({ ...prev, [target]: message }));
    };

    const handleSyncWallet = () => {
        updateStatus('wallet', "Wallet sync is not yet implemented.");
    };
    
    const handleSyncExchange = async (exchange: string) => {
        updateStatus(exchange, `Syncing ${exchange}...`);
        try {
            const { error } = await supabase.functions.invoke('exchange-sync-all', { body: { exchange } });
            if (error) throw new Error(error.message);
            updateStatus(exchange, `${exchange} sync completed.`);
            // TODO: 同期後に、取引リストを、再読み込みする
        } catch (err: any) {
            console.error(`Error syncing ${exchange}:`, err);
            updateStatus(exchange, `Error syncing ${exchange}: ${err.message}`);
        }
    };

    const handleSyncAllExchanges = () => {
        if (connections.length === 0) {
            updateStatus('all_exchanges', 'No connected exchanges to sync.');
            return;
        }
        connections.forEach(conn => handleSyncExchange(conn.exchange));
    };

    // --- RENDER --- 
    return (
        <div className="p-4 md:p-6 lg:p-8">
            <h1 className="text-3xl font-bold mb-6">Transactions</h1>

            {/* Data Sync Section */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-2">Data Sync</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Manually sync the latest transaction history from your connected sources.
                </p>
                <div className="p-4 border dark:border-gray-700 rounded-lg space-y-4 bg-gray-50 dark:bg-gray-800/30">
                    <div className="flex items-center justify-between">
                        <span>Wallet (ethereum)</span>
                        <Button onClick={handleSyncWallet} variant="outline" disabled={isSyncing}>Sync</Button>
                    </div>
                    <div className="flex items-center justify-between">
                        <span>All Connected Exchanges</span>
                        <Button onClick={handleSyncAllExchanges} variant="outline" disabled={isSyncing}>Sync All</Button>
                    </div>
                    <div className="pt-2">
                         <Link to="/vce" className="text-sm font-medium text-blue-600 hover:underline">
                            Manage API Keys
                        </Link>
                    </div>
                </div>
            </section>

            {/* All Transactions Section */}
            <section>
                <h2 className="text-2xl font-semibold mb-4">All Transactions</h2>
                <div className="border rounded-lg overflow-x-auto">
                     {isLoading ? (
                        <p className="p-4 text-center">Loading transactions...</p>
                    ) : error ? (
                         <p className="p-4 text-center text-red-500">{error}</p>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Source</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Asset</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {transactions.length > 0 ? transactions.map(tx => (
                                    <tr key={tx.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{new Date(tx.created_at).toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{tx.source}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{tx.description || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{tx.amount}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{tx.asset}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                                            No transactions found. Try syncing your wallets or exchanges.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>
        </div>
    );
}
