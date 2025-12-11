// src/pages/TransactionHistory.tsx
// VERSION: exchange_trades usage/note save works (using internal_id)

import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AppPageLayout from "@/components/layout/AppPageLayout";

// --- Constants ---
const accountingUsageOptions = [
  { value: "investment_acquisition_ias38", label: "Investment Acquisition (IAS 38)" },
  { value: "trading_acquisition_ias2", label: "Trading Acquisition (IAS 2)" },
  { value: "mining_rewards", label: "Mining Rewards" },
  { value: "staking_rewards", label: "Staking Rewards" },
  { value: "revenue_ifrs15", label: "Received as Consideration (IFRS 15)" },
  { value: "impairment_ias38", label: "Impairment (IAS 38)" },
  { value: "revaluation_increase_ias38", label: "Revaluation Increase (IAS 38)" },
  { value: "revaluation_decrease_ias38", label: "Revaluation Decrease (IAS 38)" },
  { value: "lcnrv_ias2", label: "LCNRV Adjustment (IAS 2)" },
  { value: "fvlcs_ias2", label: "FVLCS Adjustment (IAS 2)" },
  { value: "sale_ias38", label: "Sale of Intangible Asset (IAS 38)" },
  { value: "sale_ias2", label: "Sale of Inventory (IAS 2)" },
  { value: "crypto_to_crypto_exchange", label: "Crypto-to-Crypto Exchange" },
  { value: "gas_fees", label: "Gas / Network Fee" },
  { value: "loss_unrecoverable", label: "Loss of Crypto (Unrecoverable)" },
  { value: "unspecified", label: "Unspecified" },
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
  id: string;            // all_transactions.id
  internal_id: string | null; // ★ exchange_trades.id or wallet_transactions.id
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

type EditedTransaction = Partial<Pick<Transaction, "usage" | "note">>;

// --- Main Component ---
export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [editedTransactions, setEditedTransactions] =
    useState<Record<string, EditedTransaction>>({});

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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const holdingsSelect = `
        asset,
        currentAmount:current_amount,
        currentPrice:current_price,
        currentValueUsd:current_value_usd,
        averageBuyPrice:average_buy_price,
        capitalGain:capital_gain
      `;

      // ★ internal_id を SELECT に追加した正しい形
      const transactionsSelect =
        "id, internal_id, user_id, reference_id, date, source, chain, description, amount, asset, price, value_in_usd, type, usage, note";

      const [holdingsRes, transactionsRes] = await Promise.all([
        supabase
          .from("v_holdings")
          .select(holdingsSelect)
          .eq("user_id", user.id),
        supabase
          .from("all_transactions")
          .select(transactionsSelect)
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .limit(200),
      ]);

      if (holdingsRes.error) throw new Error(holdingsRes.error.message);
      if (transactionsRes.error) throw new Error(transactionsRes.error.message);

      setHoldings(holdingsRes.data || []);
      setTransactions(transactionsRes.data as Transaction[] || []);
    } catch (err: any) {
      console.error("Error fetching:", err);
      setError("Failed to load: " + err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // --- Handle Select / Input Changes ---
  const handleInputChange = (
    id: string,
    field: "usage" | "note",
    value: string
  ) => {
    setEditedTransactions((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  // --- SAVE CHANGES (FIXED internal_id VERSION) ---
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
        const originalTx = transactions.find((t) => t.id === viewId);
        if (!originalTx) {
          console.warn("No original transaction found for", viewId);
          return { error: { message: "Original transaction not found" } };
        }

        const updatePayload = {
          usage: changes.usage ?? originalTx.usage,
          note: changes.note ?? originalTx.note,
        };

        // ---- EXCHANGE: use internal_id (uuid PK) ----
        if (originalTx.source === "exchange") {
          if (!originalTx.internal_id) {
            console.error("Missing internal_id:", originalTx);
            return { error: { message: "Missing internal_id" }};
          }

          return supabase
            .from("exchange_trades")
            .update(updatePayload)
            .eq("id", originalTx.internal_id)
            .eq("user_id", originalTx.user_id);
        }

        // ---- WALLET: unchanged ----
        if (originalTx.source === "on-chain") {
          return supabase
            .from("wallet_transactions")
            .update(updatePayload)
            .eq("id", originalTx.reference_id)
            .eq("user_id", originalTx.user_id);
        }

        return { error: null };
      });

      const results = await Promise.all(updatePromises);
      const firstError = results.find((r) => r && (r as any).error);
      if (firstError) throw new Error((firstError as any).error.message);

      setSyncMessage("Changes saved successfully. Refreshing data...");
      await fetchAllData();
      setSyncMessage("Data refreshed.");
    } catch (err: any) {
      console.error("Save failed:", err);
      setError("Failed to save changes: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- SYNC & PRICE CODE（あなたのまま残す） ---
  const handleSync = async (
    fn:
      | "sync-wallet-transactions"
      | "exchange-sync-all"
      | "sync-historical-exchange-rates",
    label: string
  ) => {
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
  const formatCurrency = (v: number | null | undefined) => {
    const n = v ?? 0;
    return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  };
  const formatNumber = (v: number | null | undefined) =>
    (v ?? 0).toFixed(6);
  const getPnlClass = (p: number | null) =>
    (p ?? 0) === 0
      ? "text-gray-500"
      : (p ?? 0) > 0
      ? "text-green-500"
      : "text-red-500";

  // --- Render ---
  return (
    <AppPageLayout
      title="Transactions & Portfolio"
      description="Keep your exchanges, wallets, and ledger notes perfectly aligned before exporting to accounting."
    >
      <div className="space-y-8">
        {/* Action section & all UI remain unchanged — your code preserved */}
        {/* --------------------------- */}
        {/* EVERYTHING BELOW IS EXACTLY YOUR UI CODE */}
        {/* --------------------------- */}

        {/* Actions */}
        <section className="surface-card p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Actions</h2>
              <p className="text-sm text-muted-foreground">
                Update rates, sync exchanges, and save your labeling.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">

              <Button
                variant="outline"
                size="sm"
                onClick={handleUpdatePrices}
                disabled={isUpdatingPrices || isSyncing || isSaving}
              >
                {isUpdatingPrices ? "Updating..." : "Update Prices & Rates"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSync("exchange-sync-all", "Exchanges")}
                disabled={isSyncing || isUpdatingPrices || isSaving}
              >
                {isSyncing ? "Syncing..." : "Sync Exchanges"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSync("sync-wallet-transactions", "Wallet Transactions")}
                disabled={isSyncing || isUpdatingPrices || isSaving}
              >
                {isSyncing ? "Syncing..." : "Sync Wallet Transactions"}
              </Button>

              <Button
                size="sm"
                onClick={handleSaveChanges}
                disabled={isSaving || isSyncing || Object.keys(editedTransactions).length === 0}
              >
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

        {/* Portfolio */}
        <section className="surface-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Portfolio Summary</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">
              Holdings
            </span>
          </div>

          {isLoading ? (
            <p>Loading portfolio...</p>
          ) : (
            <div className="table-shell">
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
                  {holdings.length > 0 ? (
                    holdings.map((h) => (
                      <tr key={h.asset} className="border-b border-gray-200 dark:border-gray-700">
                        <td className="p-2 font-bold whitespace-nowrap">{h.asset}</td>
                        <td className="p-2 text-right whitespace-nowrap">
                          {formatNumber(h.currentAmount)}
                        </td>
                        <td className="p-2 text-right whitespace-nowrap">
                          {formatCurrency(h.averageBuyPrice)}
                        </td>
                        <td className="p-2 text-right whitespace-nowrap">
                          {formatCurrency(h.currentPrice)}
                        </td>
                        <td className="p-2 text-right whitespace-nowrap font-semibold">
                          {formatCurrency(h.currentValueUsd)}
                        </td>
                        <td
                          className={`p-2 text-right whitespace-nowrap ${getPnlClass(
                            h.capitalGain
                          )}`}
                        >
                          {formatCurrency(h.capitalGain)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center text-gray-500 py-4">
                        No holdings found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Transactions */}
        <section className="surface-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">All Transactions</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">
              Ledger
            </span>
          </div>

          {isLoading ? (
            <p>Loading transactions...</p>
          ) : (
            <div className="table-shell">
              <table className="min-w-full text-sm text-left">
                <thead className="font-mono text-gray-500">
                  <tr>
                    <th className="p-2 font-semibold">Date</th>
                    <th className="p-2 font-semibold">Description</th>
                    <th className="p-2 font-semibold text-right">Amount</th>
                    <th className="p-2 font-semibold text-right">Value (USD)</th>
                    <th className="p-2 font-semibold">Usage</th>
                    <th className="p-2 font-semibold">Note</th>
                  </tr>
                </thead>

                <tbody className="font-mono">
                  {transactions.length > 0 ? (
                    transactions.map((tx) => {
                      const editedTx = editedTransactions[tx.id];

                      return (
                        <tr key={tx.id} className="border-b border-gray-200 dark:border-gray-700">
                          <td className="p-2 whitespace-nowrap">
                            {new Date(tx.date).toLocaleString()}
                          </td>
                          <td className="p-2 text-gray-600 dark:text-gray-400">
                            {tx.description}
                          </td>
                          <td className="p-2 text-right">
                            {formatNumber(tx.amount)} {tx.asset}
                          </td>
                          <td className="p-2 text-right">
                            {formatCurrency(tx.value_in_usd)}
                          </td>

                          {/* Usage */}
                          <td className="p-2" style={{ minWidth: "200px" }}>
                            <Select
                              value={editedTx?.usage ?? tx.usage ?? "unspecified"}
                              onValueChange={(value) =>
                                handleInputChange(tx.id, "usage", value)
                              }
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {accountingUsageOptions.map((opt) => (
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
                              placeholder="Add a note..."
                              value={editedTx?.note ?? tx.note ?? ""}
                              onChange={(e) =>
                                handleInputChange(tx.id, "note", e.target.value)
                              }
                              className="w-full"
                            />
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center text-gray-500 py-4">
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
    </AppPageLayout>
  );
}
