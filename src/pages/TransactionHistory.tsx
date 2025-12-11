// src/pages/TransactionHistory.tsx
// FINAL STABLE VERSION — exchange_trades SAVE FIXED using origin_trade_id

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "../integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AppPageLayout from "@/components/layout/AppPageLayout";

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

// --- Data Types ---
interface Holding {
    asset: string;
    currentAmount: number;
    currentPrice: number;
    currentValueUsd: number;
    averageBuyPrice: number;
    capitalGain: number;
}

interface Transaction {
    id: string; // artificial id: "exchange-xxxx"
    user_id: string;
    reference_id: string; // trade_id or txid
    origin_trade_id?: string | null; // REAL exchange_trades.id
    date: string;
    source: string;
    chain: string;
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

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [holdings, setHoldings] = useState<Holding[]>([]);
    const [editedTransactions, setEditedTransactions] = useState<Record<string, EditedTransaction>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);

    // --- Fetch Data ---
    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setEditedTransactions({});

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            const holdingsSelect = `
                asset,
                currentAmount:current_amount,
                currentPrice:current_price,
                currentValueUsd:current_value_usd,
                averageBuyPrice:average_buy_price,
                capitalGain:capital_gain
            `;

            const transactionsSelect =
                "id, user_id, reference_id, origin_trade_id, date, source, chain, description, amount, asset, price, value_in_usd, type, usage, note";

            const [holdingsRes, transactionsRes] = await Promise.all([
                supabase.from("v_holdings").select(holdingsSelect).eq("user_id", user.id),
                supabase
                    .from("all_transactions")
                    .select(transactionsSelect)
                    .eq("user_id", user.id)
                    .order("date", { ascending: false })
                    .limit(300)
            ]);

            if (holdingsRes.error) throw new Error(holdingsRes.error.message);
            if (transactionsRes.error) throw new Error(transactionsRes.error.message);

            setHoldings(holdingsRes.data || []);
            setTransactions(transactionsRes.data || []);

        } catch (err: any) {
            console.error("Error fetching:", err);
            setError("Failed to load: " + err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);

    // --- Handle input changes ---
    const handleInputChange = (id: string, field: 'usage' | 'note', value: string) => {
        setEditedTransactions(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }));
    };

    // --- SAVE CHANGES ---
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
            const updatePromises = editedEntries.map(async ([viewId, changes]) => {
                const tx = transactions.find(t => t.id === viewId);
                if (!tx) return;

                const payload = {
                    usage: changes.usage ?? tx.usage,
                    note: changes.note ?? tx.note,
                };

                // ==========================================
                // 🔥 EXCHANGE — always use origin_trade_id
                // ==========================================
                if (tx.source === "exchange") {
                    const realId = tx.origin_trade_id; // MUST be UUID

                    if (!realId) {
                        console.error("Missing origin_trade_id for:", tx);
                        return { error: { message: "Missing origin_trade_id" } };
                    }

                    return supabase
                        .from("exchange_trades")
                        .update(payload)
                        .eq("id", realId)
                        .eq("user_id", tx.user_id);
                }

                // ==========================================
                // 🔥 WALLET — reference_id is already UUID
                // ==========================================
                if (tx.source === "on-chain") {
                    return supabase
                        .from("wallet_transactions")
                        .update(payload)
                        .eq("id", tx.reference_id)
                        .eq("user_id", tx.user_id);
                }

                return { error: null };
            });

            const results = await Promise.all(updatePromises);
            const firstError = results.find(r => r?.error);

            if (firstError) throw new Error(firstError.error.message);

            setSyncMessage("Changes saved. Refreshing...");
            await fetchAllData();
            setSyncMessage("Data refreshed.");

        } catch (err: any) {
            console.error("Save failed:", err);
            setError("Failed to save changes: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    // --- SYNC FUNCTIONS ---
    const handleSync = async (fn: 'sync-wallet-transactions' | 'exchange-sync-all' | 'sync-historical-exchange-rates', label: string) => {
        setIsSyncing(true);
        setSyncMessage(`Syncing ${label}...`);

        try {
            const { error } = await supabase.functions.invoke(fn, { body: {} });
            if (error) throw error;

            setSyncMessage(`${label} sync complete. Refreshing...`);
            await fetchAllData();
            setSyncMessage(`${label} refreshed.`);
        } catch (err: any) {
            console.error("Sync error:", err);
            setError(`Sync error: ${err.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    // --- Prices Update ---
    const handleUpdatePrices = async () => {
        setIsUpdatingPrices(true);
        setSyncMessage("Updating prices...");

        try {
            await supabase.functions.invoke("sync-historical-exchange-rates");
            const { error } = await supabase.functions.invoke("update-prices");
            if (error) throw error;

            await fetchAllData();
            setSyncMessage("Prices updated.");
        } catch (err: any) {
            console.error(err);
            setError("Price update failed: " + err.message);
        } finally {
            setIsUpdatingPrices(false);
        }
    };

    // --- Helpers ---
    const formatCurrency = (v: number | null | undefined) =>
        (v ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

    const formatNumber = (v: number | null | undefined) =>
        (v ?? 0).toFixed(6);

    const getPnlClass = (p: number | null) =>
        (p ?? 0) === 0 ? "text-gray-500" : p! > 0 ? "text-green-500" : "text-red-500";

    // --- Render ---
    return (
        <AppPageLayout
            title="Transactions & Portfolio"
            description="Keep your exchanges, wallets, and ledger notes perfectly aligned before exporting to accounting."
        >
            <div className="space-y-8">

                {/* Actions Section */}
                <section className="surface-card p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-xl font-semibold">Actions</h2>
                            <p className="text-sm text-muted-foreground">
                                Update rates, sync exchanges, and save your labeling.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" size="sm"
                                onClick={handleUpdatePrices}
                                disabled={isUpdatingPrices || isSyncing || isSaving}>
                                {isUpdatingPrices ? "Updating..." : "Update Prices & Rates"}
                            </Button>

                            <Button variant="outline" size="sm"
                                onClick={() => handleSync("exchange-sync-all", "Exchanges")}
                                disabled={isSyncing || isUpdatingPrices || isSaving}>
                                {isSyncing ? "Syncing..." : "Sync Exchanges"}
                            </Button>

                            <Button variant="outline" size="sm"
                                onClick={() => handleSync("sync-wallet-transactions", "Wallet Transactions")}
                                disabled={isSyncing || isUpdatingPrices || isSaving}>
                                {isSyncing ? "Syncing..." : "Sync Wallet Transactions"}
                            </Button>

                            <Button size="sm"
                                onClick={handleSaveChanges}
                                disabled={isSaving || isSyncing || Object.keys(editedTransactions).length === 0}>
                                {isSaving ? "Saving..." : "Save Changes"}
                            </Button>

                            <Link
                                to="/management/exchange-services"
                                className="text-sm font-semibold text-primary hover:underline"
                            >
                                Manage API Keys
                            </Link>
                        </div>
                    </div>

                    {(syncMessage || error) && (
                        <div className="mt-4 p-4 bg-slate-50 rounded-lg text-sm font-mono border border-border/70">
                            {syncMessage && <p>{syncMessage}</p>}
                            {error && <p className="text-red-500">Error: {error}</p>}
                        </div>
                    )}
                </section>

                {/* Portfolio Section */}
                <section className="surface-card p-5">
                    <h2 className="text-2xl font-semibold mb-4">Portfolio Summary</h2>

                    {isLoading ? (
                        <p>Loading portfolio...</p>
                    ) : (
                        <div className="table-shell">
                            <table className="min-w-full text-sm text-left">
                                <thead className="font-mono text-gray-500">
                                    <tr>
                                        <th className="p-2">Asset</th>
                                        <th className="p-2 text-right">Amount</th>
                                        <th className="p-2 text-right">Avg. Buy Price</th>
                                        <th className="p-2 text-right">Current Price</th>
                                        <th className="p-2 text-right">Current Value</th>
                                        <th className="p-2 text-right">Unrealized P&L</th>
                                    </tr>
                                </thead>
                                <tbody className="font-mono">
                                    {holdings.length > 0 ? holdings.map(h => (
                                        <tr key={h.asset} className="border-b">
                                            <td className="p-2">{h.asset}</td>
                                            <td className="p-2 text-right">{formatNumber(h.currentAmount)}</td>
                                            <td className="p-2 text-right">{formatCurrency(h.averageBuyPrice)}</td>
                                            <td className="p-2 text-right">{formatCurrency(h.currentPrice)}</td>
                                            <td className="p-2 text-right">{formatCurrency(h.currentValueUsd)}</td>
                                            <td className={`p-2 text-right ${getPnlClass(h.capitalGain)}`}>
                                                {formatCurrency(h.capitalGain)}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={6} className="text-center p-4">No holdings found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* Transactions Section */}
                <section className="surface-card p-5">
                    <h2 className="text-2xl font-semibold mb-4">All Transactions</h2>

                    {isLoading ? (
                        <p>Loading transactions...</p>
                    ) : (
                        <div className="table-shell">
                            <table className="min-w-full text-sm text-left">
                                <thead className="font-mono text-gray-500">
                                    <tr>
                                        <th className="p-2">Date</th>
                                        <th className="p-2">Description</th>
                                        <th className="p-2 text-right">Amount</th>
                                        <th className="p-2 text-right">Value (USD)</th>
                                        <th className="p-2">Usage</th>
                                        <th className="p-2">Note</th>
                                    </tr>
                                </thead>
                                <tbody className="font-mono">
                                    {transactions.length > 0 ? transactions.map(tx => {
                                        const editedTx = editedTransactions[tx.id];

                                        return (
                                            <tr key={tx.id} className="border-b">
                                                <td className="p-2">{new Date(tx.date).toLocaleString()}</td>
                                                <td className="p-2">{tx.description}</td>
                                                <td className="p-2 text-right">{formatNumber(tx.amount)} {tx.asset}</td>
                                                <td className="p-2 text-right">{formatCurrency(tx.value_in_usd)}</td>

                                                {/* Usage */}
                                                <td className="p-2" style={{ minWidth: "200px" }}>
                                                    <Select
                                                        value={editedTx?.usage ?? tx.usage ?? "unspecified"}
                                                        onValueChange={v => handleInputChange(tx.id, "usage", v)}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {accountingUsageOptions.map(opt => (
                                                                <SelectItem key={opt.value} value={opt.value}>
                                                                    {opt.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </td>

                                                {/* Note */}
                                                <td className="p-2" style={{ minWidth: "200px" }}>
                                                    <Input
                                                        type="text"
                                                        value={editedTx?.note ?? tx.note ?? ""}
                                                        placeholder="Add a note…"
                                                        onChange={e => handleInputChange(tx.id, "note", e.target.value)}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr><td colSpan={6} className="text-center p-4">No transactions found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

            </div>
        </AppPageLayout>
    );
}
