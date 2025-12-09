
// src/pages/TransactionHistory.tsx
// VERSION 14: Correctly aliases v_holdings columns to match the frontend interface based on user feedback.
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
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [historySyncing, setHistorySyncing] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setMsg("");

    // 1) 取引本体のみ取得（素のテーブル）
    const { data: txs, error: txErr } = await supabase
      .from("wallet_transactions")
      .select(
        "id,wallet_address,chain_id,direction,tx_hash,block_number,occurred_at,asset_symbol,value_wei,fiat_value_usd"
      )
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: false })
      .limit(200);

    if (txErr) {
      console.error("load tx error:", txErr);
      setRows([]);
      setMsg(`Failed to load transactions: ${txErr.message}`);
      setLoading(false);
      return;
    }

    const ids = (txs ?? []).map((t) => t.id);
    let labelMap = new Map<number, { pred?: string | null; conf?: string | null }>();

    // 2) 用途ラベルを別クエリで取得（リレーション不要）
    if (ids.length) {
      const { data: labels, error: labErr } = await supabase
        .from("transaction_usage_labels")
        .select("tx_id,predicted_key,confirmed_key")
        .eq("user_id", user.id)
        .in("tx_id", ids);

      if (!labErr && labels) {
        for (const l of labels) {
          labelMap.set(l.tx_id, { pred: l.predicted_key, conf: l.confirmed_key });
        }
      }
    }

    const mapped = (txs ?? []).map((t) => {
      const lab = labelMap.get(t.id);
      return {
        ...t,
        usage_pred: lab?.pred ?? null,
        usage_conf: lab?.conf ?? null,
      } as Row;
    });

    setRows(mapped);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const classify = async () => {
    setClassifying(true);
    setMsg("");
    try {
      const { error } = await supabase.functions.invoke("classify-usage", { body: {} });
      if (error) setMsg(error.message ?? String(error));
    } catch (e: any) {
      console.warn("classify error:", e);
      setMsg(e?.message || String(e));
    } finally {
      await load();
      setClassifying(false);
    }
  };

  const sync = async () => {
    setSyncing(true);
    setMsg("");
    try {
      const { error } = await supabase.functions.invoke("sync-wallet-transactions", { body: {} });
      if (error) setMsg(error.message ?? String(error));
    } catch (e: any) {
      console.warn("sync error:", e);
      setMsg(e?.message || String(e));
    } finally {
      await load();
      setSyncing(false);
    }
  };

  const syncWalletHistory = async () => {
    setHistorySyncing(true);
    setMsg("");
    try {
      const { error } = await supabase.functions.invoke("sync_wallet_history", { body: {} });
      if (error) setMsg(error.message ?? String(error));
    } catch (e: any) {
      console.warn("sync wallet history error:", e);
      setMsg(e?.message || String(e));
    } finally {
      await load();
      setHistorySyncing(false);
    }
  };

  const onChangeUsage = async (txId: number, key: string) => {
    if (!user) return;
    setMsg("");
    const { error } = await supabase
      .from("transaction_usage_labels")
      .upsert({ tx_id: txId, user_id: user.id, confirmed_key: key }, { onConflict: "user_id,tx_id" });

    if (error) {
      console.warn("label save error:", error);
      setMsg(error.message ?? String(error));
      return;
    }

    try {
      const { error: genErr } = await supabase.functions.invoke("generate-journal-entries", {
        body: { tx_ids: [txId] }
      });
      if (genErr) setMsg(genErr.message ?? String(genErr));
    } catch (e: any) {
      console.warn("generate error:", e);
      setMsg(e?.message || String(e));
    }
    await load();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="mx-auto max-w-6xl p-6 space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary to-accent p-8 text-primary-foreground shadow-elegant">
            <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-4xl font-bold mb-2">Transaction History</h1>
                <p className="text-primary-foreground/90">View all your blockchain transactions & assign usage</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={classify} disabled={classifying} variant="secondary" size="lg"
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                  {classifying ? "Classifying..." : "Predict Usage"}
                </Button>
                <Button onClick={syncWalletHistory} disabled={historySyncing} variant="secondary" size="lg"
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                  {historySyncing ? "Syncing History..." : "Sync Wallet History"}
                </Button>
                <Button onClick={sync} disabled={syncing} variant="secondary" size="lg"
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                  {syncing ? "Syncing..." : "Sync Now"}
                </Button>
              </div>
          </div>
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-primary-foreground/10 rounded-full blur-2xl"></div>
        </div>

        {msg && <div className="text-sm text-red-600">{msg}</div>}

        <Card className="shadow-lg border-2">
          <CardHeader className="border-b bg-gradient-to-r from-card to-primary/5">
            <CardTitle className="text-2xl">Latest Transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-12">No transactions yet</div>
            ) : (
              <div className="space-y-3">
                {rows.map((r) => (
                  <div key={r.id}
                    className="group border-2 rounded-xl p-4 hover:border-primary/50 hover:shadow-md transition-all duration-300 bg-gradient-to-r from-card to-muted/20"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            r.direction === 'in' ? 'bg-success/10 text-success' :
                            r.direction === 'out' ? 'bg-destructive/10 text-destructive' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {r.direction === 'in' ? '↓ Incoming' : r.direction === 'out' ? '↑ Outgoing' : 'Unknown'}
                          </span>
                          <span className="text-xs text-muted-foreground">Chain {r.chain_id ?? "-"}</span>
                        </div>
                        <div className="font-mono text-sm font-medium mb-1 truncate group-hover:text-primary">
                          {r.tx_hash.slice(0, 12)}…{r.tx_hash.slice(-10)}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" size="sm" onClick={handleUpdatePrices} disabled={isUpdatingPrices || isSyncing ||isSaving}>
                                {isUpdatingPrices ? 'Updating...' : 'Update Prices & Rates'}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleSync('exchange-sync-all', 'Exchanges')} disabled={isSyncing || isUpdatingPrices || isSaving}>
                                {isSyncing ? 'Syncing...' : 'Sync Exchanges'}
                            </Button>
                            <Button size="sm" onClick={handleSaveChanges} disabled={isSaving || isSyncing || Object.keys(editedTransactions).length === 0}>
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </Button>
                            <Link to="/management/exchange-services" className="text-sm font-semibold text-primary hover:underline">
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

                <section className="surface-card p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-semibold">Portfolio Summary</h2>
                        <span className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">Holdings</span>
                    </div>
                    {isLoading ? <p>Loading portfolio...</p> : (
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

                <section className="surface-card p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-semibold">All Transactions</h2>
                        <span className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">Ledger</span>
                    </div>
                    {isLoading ? <p>Loading transactions...</p> : (
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
                                    {transactions.length > 0 ? transactions.map((tx) => {
                                        const editedTx = editedTransactions[tx.id];
                                        return (
                                        <tr key={tx.id} className="border-b border-gray-200 dark:border-gray-700">
                                            <td className="p-2 whitespace-nowrap">{new Date(tx.date).toLocaleString()}</td>
                                            <td className="p-2 text-gray-600 dark:text-gray-400">{tx.description}</td>
                                            <td className="p-2 text-right">{formatNumber(tx.amount)} {tx.asset}</td>
                                            <td className="p-2 text-right">{formatCurrency(tx.value_in_usd)}</td>
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
                                        <tr><td colSpan={6} className="text-center text-gray-500 py-4">No transactions found.</td></tr>
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
