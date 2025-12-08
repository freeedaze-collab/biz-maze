
// src/pages/TransactionHistory.tsx
// VERSION 10: Complete rewrite of save logic to use UPDATE instead of UPSERT for robustness.
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "../integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


// --- Constants ---
const accountingUsageOptions = [
    { value: 'investment_acquisition_ias38', label: 'Investment Acquisition (IAS 38)' },
    { value: 'trading_acquisition_ias2', label: 'Trading Acquisition (IAS 2)' },
    { value: 'mining_rewards', label: 'Mining Rewards' },
    { value: 'staking_rewards', label: 'Staking Rewards' },
    { value: 'revenue_ifrs15', label: 'Received as Consideration (IFRS 15)' },
    { value: 'impairment_ias38', label: 'Impairment (IAS 38)' },
    { value: 'revaluation_increase_ias38', label: 'Revaluation Increase (IAS 38)' },
    { value: 'revaluation_decrease_ias38', label: 'Revaluation Decrease (IAS 38)' },
    { value: 'lcnrv_ias2', label: 'LCNRV Adjustment (IAS 2)' },
    { value: 'fvlcs_ias2', label: 'FVLCS Adjustment (IAS 2)' },
    { value: 'sale_ias38', label: 'Sale of Intangible Asset (IAS 38)' },
    { value: 'sale_ias2', label: 'Sale of Inventory (IAS 2)' },
    { value: 'crypto_to_crypto_exchange', label: 'Crypto-to-Crypto Exchange' },
    { value: 'gas_fees', label: 'Gas / Network Fee' },
    { value: 'loss_unrecoverable', label: 'Loss of Crypto (Unrecoverable)' },
    { value: 'unspecified', label: 'Unspecified' },
];

// --- Data Structures ---
interface Holding {
    asset: string;
    currentAmount: number;
    currentPrice: number;
    currentValueUsd: number;
    averageBuyPrice: number;
    capitalGain: number;
}

interface Transaction {
    id: string; 
    user_id: string; 
    reference_id: string;
    date: string;
    source: string;
    chain: string; // Represents the exchange or blockchain name
    description: string;
    amount: number;
    asset: string;
    price: number;
    value_in_usd: number;
    type: string;
    usage: string | null;
    note: string | null;
}

type EditedTransaction = Partial<Pick<Transaction, 'usage' | 'note'>>;


// --- Main Component ---
export default function TransactionHistory() {
    // Component State
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [holdings, setHoldings] = useState<Holding[]>([]);
    const [editedTransactions, setEditedTransactions] = useState<Record<string, EditedTransaction>>({});
    
    // UI/Loading State
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);

    // --- Data Fetching ---
    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setEditedTransactions({});
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            const selectColumns = 'id, user_id, reference_id, date, source, chain, description, amount, asset, price, value_in_usd, type, usage, note';

            const [holdingsRes, transactionsRes] = await Promise.all([
                supabase.from('v_holdings').select('*').eq('user_id', user.id),
                supabase.from('all_transactions').select(selectColumns).eq('user_id', user.id).order('date', { ascending: false }).limit(100)
            ]);

            if (holdingsRes.error) throw new Error(`Holdings Error: ${holdingsRes.error.message}`);
            if (transactionsRes.error) throw new Error(`Transactions Error: ${transactionsRes.error.message}`);
            
            setHoldings(holdingsRes.data || []);
            setTransactions(transactionsRes.data as Transaction[] || []);
        } catch (err: any) {
            console.error("Error fetching data:", err);
            setError(`Failed to load data: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // --- Event Handlers ---
    const handleInputChange = (id: string, field: 'usage' | 'note', value: string) => {
        setEditedTransactions(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        setError(null);
        setSyncMessage("Saving changes...");

        const editedEntries = Object.entries(editedTransactions);
        if (editedEntries.length === 0) {
            setSyncMessage("No changes to save.");
            setIsSaving(false);
            return;
        }

        try {
            const updatePromises = editedEntries.map(([viewId, changes]) => {
                const originalTx = transactions.find(t => t.id === viewId);
                if (!originalTx) {
                    console.warn(`Original transaction not found for view ID: ${viewId}`);
                    return Promise.resolve({ error: { message: `Original transaction for ${viewId} not found.` } });
                }

                const updatePayload = {
                    usage: changes.usage !== undefined ? changes.usage : originalTx.usage,
                    note: changes.note !== undefined ? changes.note : originalTx.note,
                };

                if (originalTx.source === 'exchange') {
                    return supabase
                        .from('exchange_trades')
                        .update(updatePayload)
                        .eq('trade_id', originalTx.reference_id)
                        .eq('user_id', originalTx.user_id); 
                } else if (originalTx.source === 'on-chain') {
                    return supabase
                        .from('wallet_transactions')
                        .update(updatePayload)
                        .eq('id', originalTx.reference_id)
                        .eq('user_id', originalTx.user_id);
                }
                return Promise.resolve({ error: null });
            });

            const results = await Promise.all(updatePromises);

            const firstError = results.find(res => res && res.error);
            if (firstError) {
                throw new Error(`An update failed: ${firstError.error.message}`);
            }

            setSyncMessage("Changes saved successfully. Refreshing data...");
            await fetchAllData();
            setSyncMessage("Data refreshed.");

        } catch (err: any) {
            console.error("Save failed:", err);
            setError(`Failed to save changes: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSync = async (syncFunction: 'sync-wallet-transactions' | 'exchange-sync-all' | 'sync-historical-exchange-rates', syncType: string) => {
        setIsSyncing(true);
        setSyncMessage(`Syncing ${syncType}...`);
        try {
            const { error } = await supabase.functions.invoke(syncFunction);
            if (error) throw error;
            setSyncMessage(`${syncType} sync complete. Refreshing all data...`);
            await fetchAllData();
            setSyncMessage(`${syncType} data refreshed successfully.`);
        } catch (err: any) {
            console.error(`${syncType} sync failed:`, err);
            setError(`A critical error occurred during ${syncType} sync: ${err.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleUpdatePrices = async () => {
        setIsUpdatingPrices(true);
        setError(null);
        setSyncMessage('Updating asset prices (USD)...');
        try {
            await supabase.functions.invoke('sync-historical-exchange-rates');
            setSyncMessage('Exchange rates synced. Updating asset prices...');

            const { error } = await supabase.functions.invoke('update-prices');
            if (error) throw error;
            setSyncMessage('Prices updated. Refreshing all data...');

            await fetchAllData();
            setSyncMessage('Portfolio and transactions refreshed with latest prices.');

        } catch (err: any) {
            console.error("Price update failed:", err);
            setError(`Failed to update prices: ${err.message}`);
        } finally {
            setIsUpdatingPrices(false);
        }
    };

    // --- Formatting & Style Helpers ---
    const formatCurrency = (value: number | null) => value?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) ?? 'N/A';
    const formatNumber = (value: number | null) => value?.toFixed(6) ?? '-';
    const getPnlClass = (pnl: number | null) => (pnl ?? 0) === 0 ? 'text-gray-500' : pnl > 0 ? 'text-green-500' : 'text-red-500';

    // --- Render Method ---
    return (
        <div className="p-4 md:p-6 lg:p-8">
            <h1 className="text-3xl font-bold mb-6">Transactions & Portfolio</h1>
            
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-2">Actions</h2>
                <div className="flex items-center space-x-4">
                    <Button variant="outline" size="sm" onClick={handleUpdatePrices} disabled={isUpdatingPrices || isSyncing || isSaving}>
                        {isUpdatingPrices ? 'Updating...' : 'Update Prices & Rates'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleSync('exchange-sync-all', 'Exchanges')} disabled={isSyncing || isUpdatingPrices || isSaving}>
                        {isSyncing ? 'Syncing...' : 'Sync Exchanges'}
                    </Button>
                     <Button size="sm" onClick={handleSaveChanges} disabled={isSaving || isSyncing || Object.keys(editedTransactions).length === 0}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                     <Link to="/management/exchange-services" className="text-sm font-medium text-blue-600 hover:underline">Manage API Keys</Link>
                </div>
                {(syncMessage || error) && (
                    <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono">
                        {syncMessage && <p>{syncMessage}</p>}
                        {error && <p className="text-red-500">Error: {error}</p>}
                    </div>
                )}
            </section>

            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Portfolio Summary</h2>
                {isLoading ? <p>Loading portfolio...</p> : (
                    <div className="w-full overflow-x-auto">
                         <table className="min-w-full text-sm text-left">
                            <thead className="font-mono text-gray-500">
                                <tr>
                                    <th className="p-2 font-semibold">Asset</th>
                                    <th className="p-2 font-semibold text-right">Amount</th>
                                    <th className="p-2 font-semibold text-right">Avg. Buy Price</th>
                                    <th className="p-2 font-semibold text-right">Current Price</th>
                                    <th className="p-2 font-semibold text-right">Current Value</th>
                                    <th className="p-2 font-semibold text-right">Unrealized P&L</th>
                                </tr>
                            </thead>
                            <tbody className="font-mono">
                                {holdings.length > 0 ? holdings.map((h) => (
                                    <tr key={h.asset} className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="p-2 font-bold whitespace-nowrap">{h.asset}</td>
                                        <td className="p-2 text-right whitespace-nowrap">{formatNumber(h.currentAmount)}</td>
                                        <td className="p-2 text-right whitespace-nowrap">{formatCurrency(h.averageBuyPrice)}</td>
                                        <td className="p-2 text-right whitespace-nowrap">{formatCurrency(h.currentPrice)}</td>
                                        <td className="p-2 text-right whitespace-nowrap font-semibold">{formatCurrency(h.currentValueUsd)}</td> 
                                        <td className={`p-2 text-right whitespace-nowrap ${getPnlClass(h.capitalGain)}`}>{formatCurrency(h.capitalGain)}</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={6} className="text-center text-gray-500 py-4">No holdings found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section>
                <h2 className="text-2xl font-semibold mb-4">All Transactions</h2>
                {isLoading ? <p>Loading transactions...</p> : (
                    <div className="w-full overflow-x-auto">
                         <table className="min-w-full text-sm text-left">
                            <thead className="font-mono text-gray-500">
                                <tr>
                                    <th className="p-2 font-semibold">Date</th>
                                    <th className="p-2 font-semibold">Description</th>
                                    <th className="p-2 font-semibold text-right">Amount</th>
                                    <th className="p-2 font-semibold">Usage</th>
                                    <th className="p-2 font-semibold">Note</th>
                                </tr>
                            </thead>
                            <tbody className="font-mono">
                                {transactions.length > 0 ? transactions.map((tx) => {
                                    const editedTx = editedTransactions[tx.id];
                                    return (
                                    <tr key={tx.id} className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="p-2 whitespace-nowrap">{new Date(tx.date).toLocaleString()}</td>
                                        <td className="p-2 text-gray-600 dark:text-gray-400">{tx.description}</td>
                                        <td className="p-2 text-right">{formatNumber(tx.amount)} {tx.asset}</td>
                                        <td className="p-2" style={{minWidth: '200px'}}>
                                            <Select 
                                                value={editedTx?.usage ?? tx.usage ?? 'unspecified'}
                                                onValueChange={(value) => handleInputChange(tx.id, 'usage', value)}
                                            >
                                                <SelectTrigger><SelectValue/></SelectTrigger>
                                                <SelectContent>
                                                    {accountingUsageOptions.map(opt => 
                                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        <td className="p-2" style={{minWidth: '200px'}}>
                                            <Input
                                                type="text"
                                                placeholder="Add a note..."
                                                value={editedTx?.note ?? tx.note ?? ''}
                                                onChange={(e) => handleInputChange(tx.id, 'note', e.target.value)}
                                                className="w-full"
                                            />
                                        </td>
                                    </tr>
                                )}) : (
                                    <tr><td colSpan={5} className="text-center text-gray-500 py-4">No transactions found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
