// src/pages/TransactionHistory.tsx
// FINAL VERSION: Multi-currency support and VCE Sync.
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from "../integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AppPageLayout from "@/components/layout/AppPageLayout";

const accountingUsageOptions = [
    { value: 'cash_purchase', label: 'Cash Purchase' },
    { value: 'fair_value_gain', label: 'Fair Value Gain (Year-end)' },
    { value: 'fair_value_loss', label: 'Fair Value Loss (Year-end)' },
    { value: 'impairment_loss', label: 'Impairment Loss' },
    { value: 'sale_profit', label: 'Sale Profit (Realized Gain)' },
    { value: 'sale_loss', label: 'Sale Loss (Realized Loss)' },
    { value: 'staking_rewards', label: 'Staking Rewards (Crypto)' },
    { value: 'payment_in_crypto', label: 'Payment in Crypto' },
    { value: 'unspecified', label: 'Unspecified' }
];

interface Holding {
    asset: string;
    currentAmount: number;
    currentPrice: number;
    currentValueUsd: number;
    currentValueJpy: number;
    currentValueEur: number;
}

interface Transaction {
    id: string;
    user_id: string;
    reference_id: string;
    date: string;
    source: string;
    chain: string;
    description: string;
    amount: number;
    asset: string;
    price: number;
    value_usd: number;
    value_jpy: number;
    value_eur: number;
    type: string;
    usage: string | null;
    note: string | null;
    entity_id: string | null;
    entity_name: string | null;
    transaction_type: string;
}

type EditedTransaction = Partial<Pick<Transaction, 'usage' | 'note'>>;

export default function TransactionHistory() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [holdings, setHoldings] = useState<Holding[]>([]);
    const [entities, setEntities] = useState<{ id: string; name: string }[]>([]);
    const [selectedEntityId, setSelectedEntityId] = useState<string>('all');
    const [editedTransactions, setEditedTransactions] = useState<Record<string, EditedTransaction>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const [selectedCurrency, setSelectedCurrency] = useState('USD');

    useEffect(() => {
        const loadEntities = async () => {
            const { data } = await supabase.from('entities').select('id, name').order('name');
            if (data) setEntities(data);
        };
        loadEntities();
    }, []);

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            // Select multi-currency and entity columns
            const holdingsSelect = 'asset, current_amount, current_price, current_value_usd, current_value_jpy, current_value_eur, entity_id';
            const transactionsSelect = 'id, user_id, reference_id, date, source, chain, description, amount, asset, price, value_usd, value_jpy, value_eur, type, usage, note, entity_id, entity_name, transaction_type';

            let holdingsQuery = supabase.from('v_holdings').select(holdingsSelect).eq('user_id', user.id);
            let transactionsQuery = supabase.from('v_all_transactions_classified').select(transactionsSelect).eq('user_id', user.id).order('date', { ascending: false }).limit(100);

            if (selectedEntityId !== 'all') {
                holdingsQuery = holdingsQuery.eq('entity_id', selectedEntityId);
                transactionsQuery = transactionsQuery.eq('entity_id', selectedEntityId);
            }

            const [holdingsRes, transactionsRes] = await Promise.all([
                holdingsQuery,
                transactionsQuery
            ]);

            if (holdingsRes.error) throw new Error(`Holdings Error: ${holdingsRes.error.message}`);
            if (transactionsRes.error) throw new Error(`Transactions Error: ${transactionsRes.error.message}`);

            const mappedHoldings = (holdingsRes.data || []).map(h => ({
                asset: h.asset,
                currentAmount: h.current_amount,
                currentPrice: h.current_price,
                currentValueUsd: h.current_value_usd,
                currentValueJpy: h.current_value_jpy,
                currentValueEur: h.current_value_eur,
            }));

            setHoldings(mappedHoldings as Holding[]);
            setTransactions(transactionsRes.data as Transaction[] || []);
        } catch (err: any) {
            console.error("Error fetching data:", err);
            setError(`Failed to load data: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [selectedEntityId]);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);

    const handleInputChange = (id: string, field: 'usage' | 'note', value: string) => {
        setEditedTransactions(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        setError(null);
        setSyncMessage("Saving changes...");
        try {
            const editedEntries = Object.entries(editedTransactions);
            if (editedEntries.length === 0) { setSyncMessage("No changes to save."); return; }

            const updatePromises = editedEntries.map(([viewId, changes]) => {
                const originalTx = transactions.find(t => t.id === viewId);
                if (!originalTx) return Promise.resolve({ error: { message: `Original tx not found.` } });
                const updatePayload = { usage: changes.usage, note: changes.note };
                const fromTable = originalTx.source === 'exchange' ? 'exchange_trades' : 'wallet_transactions';
                const refIdCol = originalTx.source === 'exchange' ? 'trade_id' : 'id';
                return supabase.from(fromTable).update(updatePayload).eq(refIdCol, originalTx.reference_id).eq('user_id', originalTx.user_id);
            });

            const results = await Promise.all(updatePromises);
            const firstError = results.find(res => res && res.error);
            if (firstError) throw new Error(`An update failed: ${firstError.error.message}`);

            setSyncMessage("Changes saved. Refreshing data...");
            await fetchAllData();
        } catch (err: any) {
            setError(`Failed to save: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSync = async (syncFunction: 'sync-wallet-transactions' | 'exchange-sync-all' | 'sync-historical-exchange-rates', syncType: string) => {
        setIsSyncing(true);
        setSyncMessage(`Initiating ${syncType} sync...`);
        setError(null);
        try {
            if (syncFunction === 'sync-wallet-transactions') {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("User not authenticated");

                const { data: wallets, error: walletsError } = await supabase.from('wallet_connections').select('wallet_address').eq('user_id', user.id).not('verified_at', 'is', null);
                if (walletsError) throw walletsError;
                if (!wallets || wallets.length === 0) { setSyncMessage("No verified wallets found to sync."); return; }

                setSyncMessage(`Syncing all chains for ${wallets.length} wallet(s)...`);
                let syncErrors: string[] = [];

                for (const wallet of wallets) {
                    try {
                        const trimmedAddress = (wallet.wallet_address || '').trim();
                        const { error: invokeError } = await supabase.functions.invoke('sync-wallet-transactions', { body: { walletAddress: trimmedAddress } });
                        if (invokeError) syncErrors.push(invokeError.message);
                    } catch (e: any) { syncErrors.push(e.message); }
                }
                if (syncErrors.length > 0) setError(`Sync completed with issues: ${syncErrors.join("; ")}`);

            } else {
                const { error } = await supabase.functions.invoke(syncFunction, { body: {} });
                if (error) throw error;
            }

            setSyncMessage("Sync tasks complete. Refreshing all data...");
            await fetchAllData();
            setSyncMessage("Data refreshed.");
        } catch (err: any) {
            setError(`Sync failed: ${err.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleUpdatePrices = async () => {
        setIsUpdatingPrices(true);
        setError(null);
        setSyncMessage('Updating asset prices...');
        try {
            await supabase.functions.invoke('sync-historical-exchange-rates');
            await supabase.functions.invoke('update-prices');
            setSyncMessage('Prices updated. Refreshing data...');
            await fetchAllData();
        } catch (err: any) {
            setError(`Failed to update prices: ${err.message}`);
        } finally {
            setIsUpdatingPrices(false);
        }
    };

    const formatCurrency = (val: number | null | undefined, currency: string) => {
        const locale = currency === 'JPY' ? 'ja-JP' : currency === 'EUR' ? 'de-DE' : 'en-US';
        return (val ?? 0).toLocaleString(locale, { style: 'currency', currency });
    };

    const formatNumber = (val: number | null | undefined) => (val ?? 0).toFixed(6);

    return (
        <AppPageLayout title="Transactions & Portfolio" description="Keep your exchanges, wallets, and ledger notes perfectly aligned.">
            <div className="space-y-8">
                <section className="surface-card p-5"> {/* Actions Section */}
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                            <div><h2 className="text-xl font-semibold">Filters & Actions</h2><p className="text-sm text-muted-foreground">Update rates, sync, and filter by wallet/exchange.</p></div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-600">Currency:</span>
                                <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                                    <SelectTrigger className="w-[100px] h-9">
                                        <SelectValue placeholder="USD" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="USD">USD</SelectItem>
                                        <SelectItem value="JPY">JPY</SelectItem>
                                        <SelectItem value="EUR">EUR</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-600">Entity:</span>
                                <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                                    <SelectTrigger className="w-[180px] h-9">
                                        <SelectValue placeholder="All Entities" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Entities</SelectItem>
                                        {entities.map(entity => (
                                            <SelectItem key={entity.id} value={entity.id}>{entity.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-2 border-l pl-4">
                                <Button variant="outline" size="sm" onClick={handleUpdatePrices} disabled={isUpdatingPrices || isSyncing || isSaving}>{isUpdatingPrices ? 'Updating...' : 'Update Prices'}</Button>
                                <Button variant="outline" size="sm" onClick={() => handleSync('exchange-sync-all', 'Exchanges')} disabled={isSyncing || isUpdatingPrices || isSaving}>{isSyncing ? 'Syncing...' : 'Sync VCE'}</Button>
                                <Button variant="outline" size="sm" onClick={() => handleSync('sync-wallet-transactions', 'Wallets')} disabled={isSyncing || isUpdatingPrices || isSaving}>{isSyncing ? 'Syncing...' : 'Sync Wallets'}</Button>
                                <Button size="sm" onClick={handleSaveChanges} disabled={isSaving || isSyncing || Object.keys(editedTransactions).length === 0}>{isSaving ? 'Saving...' : 'Save Changes'}</Button>
                            </div>
                        </div>
                    </div>
                    {(syncMessage || error) && <div className="mt-4 p-4 bg-slate-50 rounded-lg text-sm font-mono"><p>{syncMessage}</p>{error && <p className="text-red-500">Error: {error}</p>}</div>}
                </section>

                <section className="surface-card p-5"> {/* Portfolio Summary Section */}
                    <div className="flex items-center justify-between mb-4"><h2 className="text-2xl font-semibold">Portfolio Summary ({selectedCurrency})</h2></div>
                    {isLoading ? <p>Loading...</p> : (
                        <div className="table-shell">
                            <table className="min-w-full text-sm text-left">
                                <thead className="font-mono text-gray-500">
                                    <tr>
                                        <th className="p-2 font-semibold">Asset</th>
                                        <th className="p-2 font-semibold text-right">Amount</th>
                                        <th className="p-2 font-semibold text-right">Current Price</th>
                                        <th className="p-2 font-semibold text-right">Current Value</th>
                                    </tr>
                                </thead>
                                <tbody className="font-mono">
                                    {holdings.length > 0 ? holdings.map((h) => (
                                        <tr key={h.asset} className="border-b border-gray-200 dark:border-gray-700">
                                            <td className="p-2 font-bold whitespace-nowrap">{h.asset}</td>
                                            <td className="p-2 text-right whitespace-nowrap">{formatNumber(h.currentAmount)}</td>
                                            <td className="p-2 text-right whitespace-nowrap">{formatCurrency(h.currentPrice, 'USD')}</td>
                                            <td className="p-2 text-right whitespace-nowrap font-semibold">
                                                {formatCurrency(selectedCurrency === 'JPY' ? h.currentValueJpy : selectedCurrency === 'EUR' ? h.currentValueEur : h.currentValueUsd, selectedCurrency)}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={4} className="text-center text-gray-500 py-4">No holdings found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <section className="surface-card p-5"> {/* All Transactions Section */}
                    <div className="flex items-center justify-between mb-4"><h2 className="text-2xl font-semibold">All Transactions</h2></div>
                    {isLoading ? <p>Loading...</p> : (
                        <div className="table-shell">
                            <table className="min-w-full text-sm text-left"><thead className="font-mono text-gray-500"><tr>
                                <th className="p-2 font-semibold">Date</th><th className="p-2 font-semibold">Type</th><th className="p-2 font-semibold text-right">Amount</th><th className="p-2 font-semibold text-right">Value ({selectedCurrency})</th><th className="p-2 font-semibold">Usage</th><th className="p-2 font-semibold">Note</th>
                            </tr></thead>
                                <tbody className="font-mono">{transactions.length > 0 ? transactions.map((tx) => (
                                    <tr key={tx.id}><td className="p-2">{new Date(tx.date).toLocaleString()}</td><td className="p-2">{tx.type}</td><td className="p-2 text-right">{formatNumber(tx.amount)} {tx.asset}</td>
                                        <td className="p-2 text-right">
                                            {formatCurrency(selectedCurrency === 'JPY' ? tx.value_jpy : selectedCurrency === 'EUR' ? tx.value_eur : tx.value_usd, selectedCurrency)}
                                        </td>
                                        <td className="p-2" style={{ minWidth: '200px' }}><Select value={editedTransactions[tx.id]?.usage ?? tx.usage ?? 'unspecified'} onValueChange={(v) => handleInputChange(tx.id, 'usage', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{accountingUsageOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></td>
                                        <td className="p-2" style={{ minWidth: '200px' }}><Input type="text" placeholder="Add a note..." value={editedTransactions[tx.id]?.note ?? tx.note ?? ''} onChange={(e) => handleInputChange(tx.id, 'note', e.target.value)} /></td></tr>
                                )) : <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">No transactions found.</td></tr>}</tbody></table>
                        </div>
                    )}
                </section>
            </div>
        </AppPageLayout>
    );
}
