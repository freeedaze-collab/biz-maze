
// src/pages/TransactionHistory.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "../integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface Transaction {
    ts: string;
    tx_hash: string;
    source: string;
    amount: number | null;
    asset: string | null;
    exchange: string | null;
    symbol: string | null;
    value_usd: number | null;
}

export default function TransactionHistory() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isWalletSyncing, setIsWalletSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState<string[]>([]);

    const fetchTransactions = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('v_all_transactions').select('ts, tx_hash, source, amount, asset, exchange, symbol, value_usd').order('ts', { ascending: false }).limit(100);
            if (error) throw error;
            setTransactions(data || []);
        } catch (err: any) {
            console.error("Error fetching v_all_transactions:", err);
            setError(`Failed to load data: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchTransactions(); }, []);

    const handleSyncWallet = async () => {
        setIsWalletSyncing(true);
        setSyncProgress(['Starting wallet sync...']);
        try {
            const { data, error } = await supabase.functions.invoke('sync-wallet-transactions');
            if (error) throw error;
            // @ts-ignore
            setSyncProgress(prev => [...prev, data.message || 'Wallet sync complete.', 'Refreshing list...']);
            await fetchTransactions();
        } catch(err: any) {
            console.error("Wallet sync failed:", err);
            setSyncProgress(prev => [...prev, `A critical error occurred: ${err.message}`]);
        } finally {
            setIsWalletSyncing(false);
        }
    }

    // ★★★【診断用コード】★★★
    // 原因を特定するため、処理を極限まで単純化。
    // 'binance' という一つの取引所に対してだけ `exchange-sync-all` を呼び出し、結果を画面に表示する。
    const handleSyncAllExchanges = async () => {
        setIsSyncing(true);
        setSyncProgress(['[DIAGNOSTIC MODE] Starting sync...']);
        console.log('[DIAGNOSTIC] Attempting to invoke exchange-sync-all');
        
        try {
            const testExchange = 'binance';
            setSyncProgress(prev => [...prev, `[DIAGNOSTIC] Invoking function for a single exchange: ${testExchange}`]);

            const { data, error } = await supabase.functions.invoke('exchange-sync-all', {
                body: { exchange: testExchange },
            });

            if (error) {
                console.error('[DIAGNOSTIC] Invocation returned an error:', error);
                setSyncProgress(prev => [...prev, `[DIAGNOSTIC] FAILED. The function returned an error: ${error.message}`]);
            } else {
                console.log('[DIAGNOSTIC] Invocation returned data:', data);
                setSyncProgress(prev => [...prev, `[DIAGNOSTIC] SUCCESS! The function returned a response.`, `Response: ${JSON.stringify(data)}`]);
            }

        } catch (catchedError: any) {
            console.error("[DIAGNOSTIC] The entire operation failed in a catch block:", catchedError);
            setSyncProgress(prev => [...prev, `[DIAGNOSTIC] CRITICAL FAILURE. Could not execute the invoke command: ${catchedError.message}`]);
        } finally {
            setIsSyncing(false);
            setSyncProgress(prev => [...prev, "[DIAGNOSTIC MODE] Finished."]);
        }
    };
    
    const generateDescription = (tx: Transaction): string => {
        if (tx.symbol) return tx.symbol;
        if (tx.source === 'exchange' && tx.exchange) return `Trade on ${tx.exchange}`;
        if (tx.source === 'wallet') return 'On-chain transaction';
        return ''
    }

    const formatCurrency = (value: number | null) => {
        if (value === null || typeof value === 'undefined') return '-';
        return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    }

    return (
        <div className="p-4 md:p-6 lg:p-8">
            <h1 className="text-3xl font-bold mb-6">Transactions</h1>
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-2">Data Sync</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Manually sync the latest transaction history from your connected sources.</p>
                <div className="flex items-center space-x-4">
                    <Button variant="outline" size="sm" onClick={handleSyncAllExchanges} disabled={isSyncing || isWalletSyncing}>{isSyncing ? 'Syncing Exchanges...' : 'Sync Exchanges'}</Button>
                    <Button variant="outline" size="sm" onClick={handleSyncWallet} disabled={isWalletSyncing || isSyncing}>{isWalletSyncing ? 'Syncing Wallet...' : 'Sync Wallet'}</Button>
                     <Link to="/vce" className="text-sm font-medium text-blue-600 hover:underline">Manage API Keys</Link>
                </div>
                {syncProgress.length > 0 && (
                    <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono">
                        <h3 className="font-semibold mb-2">Sync Progress</h3>
                        <div className="whitespace-pre-wrap max-h-60 overflow-y-auto">{syncProgress.join('\n')}</div>
                    </div>
                )}
            </section>
            <section>
                <h2 className="text-2xl font-semibold mb-4">All Transactions</h2>
                {isLoading ? <p>Loading transactions...</p> : error ? <p className="text-red-500 font-mono">{error}</p> : (
                    <div className="w-full overflow-x-auto">
                         <table className="min-w-full text-sm text-left">
                            <thead className="font-mono text-gray-500">
                                <tr>
                                    <th className="p-2 font-semibold">Date</th>
                                    <th className="p-2 font-semibold">Source</th>
                                    <th className="p-2 font-semibold">Description</th>
                                    <th className="p-2 font-semibold text-right">Amount</th>
                                    <th className="p-2 font-semibold text-right">Value (USD)</th>
                                    <th className="p-2 font-semibold text-right">Asset</th>
                                </tr>
                            </thead>
                            <tbody className="font-mono">
                                {transactions.length > 0 ? transactions.map((tx) => (
                                    <tr key={tx.tx_hash} className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="p-2 whitespace-nowrap">{new Date(tx.ts).toLocaleString()}</td>
                                        <td className="p-2 whitespace-nowrap">{tx.source}</td>
                                        <td className="p-2 text-gray-600 dark:text-gray-400">{generateDescription(tx)}</td>
                                        <td className="p-2 text-right">{tx.amount?.toFixed(8) ?? ''}</td>
                                        <td className="p-2 text-right">{formatCurrency(tx.value_usd)}</td>
                                        <td className="p-2 text-right text-gray-600 dark:text-gray-400">{tx.asset || ''}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="text-center text-gray-500 py-4">No transactions found.</td>
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
