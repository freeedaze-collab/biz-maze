// src/pages/TransactionHistory.tsx
// FINAL FIXED VERSION — Save works for BOTH exchange & wallet

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
    id: string;             // VIEW ID (exchange-xxxx, onchain-xxxx)
    internal_id: string;    // REAL UUID — THE ONLY TRUE PK
    user_id: string;
    reference_id: string;
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

            const transactionsSelect = `
                id,
                internal_id,
                user_id,
                reference_id,
                date,
                source,
                chain,
                description,
                amount,
                asset,
                price,
                value_in_usd,
                type,
                usage,
                note
            `;

            const [holdingsRes, transactionsRes] = await Promise.all([
                supabase.from("v_holdings").select(holdingsSelect).eq("user_id", user.id),
                supabase
                    .from("all_transactions")
                    .select(transactionsSelect)
                    .eq("user_id", user.id)
                    .order("date", { ascending: false })
                    .limit(200)
            ]);

            if (holdingsRes.error) throw new Error(holdingsRes.error.message);
            if (transactionsRes.error) throw new Error(transactionsRes.error.message);

            setHoldings(holdingsRes.data || []);
            setTransactions(transactionsRes.data || []);

        } catch (err: any) {
            setError("Failed to load: " + err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // --- Handle Select / Input Changes ---
    const handleInputChange = (id: string, field: 'usage' | 'note', value: string) => {
        setEditedTransactions(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }));
    };

    // --- SAVE CHANGES (FINAL FIX) ---
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
                const originalTx = transactions.find(t => t.id === viewId);
                if (!originalTx) {
                    return { error: { message: "Original transaction not found" } };
                }

                // USE REAL PRIMARY KEY
                const realId = originalTx.internal_id;

                const updatePayload = {
                    usage: changes.usage ?? originalTx.usage,
                    note: changes.note ?? originalTx.note,
                };

                // Exchange transaction
                if (originalTx.source === "exchange") {
                    return supabase
                        .from("exchange_trades")
                        .update(updatePayload)
                        .eq("id", realId)
                        .eq("user_id", originalTx.user_id);
                }

                // Wallet transaction
                if (originalTx.source === "on-chain") {
                    return supabase
                        .from("wallet_transactions")
                        .update(updatePayload)
                        .eq("id", realId)
                        .eq("user_id", originalTx.user_id);
                }

                return { error: null };
            });

            const results = await Promise.all(updatePromises);
            const firstError = results.find(r => r && r.error);
            if (firstError) throw new Error(firstError.error.message);

            setSyncMessage("Changes saved. Refreshing...");
            await fetchAllData();
            setSyncMessage("Data refreshed.");

        } catch (err: any) {
            setError("Failed to save changes: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    // --- SYNC / Update Prices (unchanged) ---
    // ...（ここは元のままなので省略しますが、必要なら全文再掲します）

    // --- Render ---
    // ...（テーブル描画部分は変更ないので省略）
}

