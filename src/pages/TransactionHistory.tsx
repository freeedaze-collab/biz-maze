
// src/pages/TransactionHistory.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "../integrations/supabase/client";
import { Button } from "@/components/ui/button";

// --- Data Structures ---
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

interface Holding {
    asset: string;
    cost_currency: string;
    current_amount: number;
    total_cost: number;
    avg_buy_price: number;
    current_price: number | null;
    current_price_currency: string | null;
    current_value: number | null;
    unrealized_pnl: number | null;
    unrealized_pnl_percent: number | null;
}

// --- Main Component ---
export default function TransactionHistory() {
    // States for transactions
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // States for portfolio holdings
    const [holdings, setHoldings] = useState<Holding[]>([]);
    const [isPortfolioLoading, setIsPortfolioLoading] = useState(true);
    const [portfolioError, setPortfolioError] = useState<string | null>(null);

    // States for sync operations
    const [isSyncing, setIsSyncing] = useState(false);
    const [isWalletSyncing, setIsWalletSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState<string[]>([]);

    // --- Data Fetching Hooks ---
    useEffect(() => {
        // Reset states on initial load
        setIsLoading(true);
        setIsPortfolioLoading(true);
        setError(null);
        setPortfolioError(null);

        // Create independent promises for fetching data
        const fetchTransactionsPromise = fetchTransactions();
        const fetchPortfolioPromise = fetchPortfolio();

        // Wait for both to complete
        Promise.all([fetchTransactionsPromise, fetchPortfolioPromise]).finally(() => {
            // You might want to set a general loading state to false here if you had one
        });

    }, []); // Empty dependency array ensures this runs only once on mount


    // --- Async Functions ---
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

    const fetchPortfolio = async () => {
        setIsPortfolioLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('portfolio-summary');
            if (error) throw new Error(`Function invocation failed: ${error.message}`);
            // @ts-ignore
            if (data.error) throw new Error(`Function returned an error: ${data.error}`);
            setHoldings(data || []);
        } catch (err: any) {
            console.error("Error fetching portfolio:", err);
            setPortfolioError(`Failed to load portfolio: ${err.message}`);
        } finally {
            setIsPortfolioLoading(false);
        }
    };

    const handleSyncWallet = async () => {
        setIsWalletSyncing(true);
        setSyncProgress(['Starting wallet sync...']);
        try {
            const { data, error } = await supabase.functions.invoke('sync-wallet-transactions');
            if (error) throw error;
            // @ts-ignore
            setSyncProgress(prev => [...prev, data.message || 'Wallet sync complete.', 'Refreshing data...']);
            await Promise.all([fetchTransactions(), fetchPortfolio()]);
        } catch(err: any) {
            console.error("Wallet sync failed:", err);
            setSyncProgress(prev => [...prev, `A critical error occurred: ${err.message}`]);
        } finally {
            setIsWalletSyncing(false);
        }
    }

    const handleSyncAllExchanges = async () => {
        setIsSyncing(true);
        setSyncProgress(['Starting exchange sync...']);
        try {
            const { data, error } = await supabase.functions.invoke('exchange-sync-all');
             if (error) throw error;
            // @ts-ignore
            setSyncProgress(prev => [...prev, data.message || 'Exchange sync complete.', 'Refreshing data...']);
            await Promise.all([fetchTransactions(), fetchPortfolio()]);
        } catch (err: any) {
            console.error("Exchange sync failed:", err);
            setSyncProgress(prev => [...prev, `A critical error occurred: ${err.message}`]);
        } finally {
            setIsSyncing(false);
        }
    };

    // --- Formatting Helpers ---
    const generateDescription = (tx: Transaction): string => {
        if (tx.symbol) return tx.symbol;
        if (tx.source === 'exchange' && tx.exchange) return `Trade on ${tx.exchange}`;
        if (tx.source === 'wallet') return 'On-chain transaction';
        return ''
    }

    const formatCurrency = (value: number | null, currency: string | null = 'USD') => {
        if (value === null || typeof value === 'undefined') return 'N/A';
        return value.toLocaleString('en-US', { style: 'currency', currency: currency });
    }
    
    const formatNumber = (value: number | null) => {
        if (value === null || typeof value === 'undefined') return '-';
        return value.toFixed(8);
    }

    const formatPercentage = (value: number | null) => {
        if (value === null || typeof value === 'undefined') return '-';
        const sign = value > 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}%`;
    }

    const getPnlClass = (pnl: number | null) => {
        if (pnl === null || pnl === 0) return 'text-gray-500';
        return pnl > 0 ? 'text-green-500' : 'text-red-500';
    }

    // --- Render Method ---
    return (
        <div className="p-4 md:p-6 lg:p-8">
            <h1 className="text-3xl font-bold mb-6">Transactions & Portfolio</h1>
            
            {/* --- Sync Section --- */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-2">Data Sync</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Manually sync transaction history. Your portfolio summary will update automatically.</p>
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

            {/* --- Portfolio Summary Section --- */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Portfolio Summary</h2>
                {isPortfolioLoading ? <p>Loading portfolio...</p> : portfolioError ? <p className="text-red-500 font-mono">{portfolioError}</p> : (
                    <div className="w-full overflow-x-auto">
                         <table className="min-w-full text-sm text-left">
                            <thead className="font-mono text-gray-500">
                                <tr>
                                    <th className="p-2 font-semibold">Asset</th>
                                    <th className="p-2 font-semibold text-right">Amount</th>
                                    <th className="p-2 font-semibold text-right">Avg. Buy Price</th>
                                    <th className="p-2 font-semibold text-right">Current Price</th>
                                    <th className="p-2 font-semibold text-right">Total Cost</th>
                                    <th className="p-2 font-semibold text-right">Current Value</th>
                                    <th className="p-2 font-semibold text-right">Unrealized P&L</th>
                                </tr>
                            </thead>
                            <tbody className="font-mono">
                                {holdings.length > 0 ? holdings.map((h) => (
                                    <tr key={h.asset} className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="p-2 font-bold whitespace-nowrap">{h.asset}</td>
                                        <td className="p-2 text-right whitespace-nowrap">{formatNumber(h.current_amount)}</td>
                                        <td className="p-2 text-right whitespace-nowrap">{formatCurrency(h.avg_buy_price, h.cost_currency)}</td>
                                        <td className="p-2 text-right whitespace-nowrap">{formatCurrency(h.current_price, h.current_price_currency)}</td>
                                        <td className="p-2 text-right whitespace-nowrap">{formatCurrency(h.total_cost, h.cost_currency)}</td>
                                        <td className="p-2 text-right whitespace-nowrap">{formatCurrency(h.current_value, h.current_price_currency)}</td>
                                        <td className={`p-2 text-right font-semibold whitespace-nowrap ${getPnlClass(h.unrealized_pnl)}`}>
                                            <div>{formatCurrency(h.unrealized_pnl, h.current_price_currency)}</div>
                                            <div className="text-xs">({formatPercentage(h.unrealized_pnl_percent)})</div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={7} className="text-center text-gray-500 py-4">No holdings found. Sync your transactions to build your portfolio.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* --- All Transactions Section --- */}
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
