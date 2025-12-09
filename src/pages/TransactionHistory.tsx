import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import AppLayout from '@/components/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Save, Settings } from 'lucide-react';

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

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setEditedTransactions({});
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const holdingsSelect = 'asset, current_amount, current_price, current_value_usd, average_buy_price, capital_gain';
      const transactionsSelect = 'id, user_id, reference_id, date, source, chain, description, amount, asset, price, value_in_usd, type, usage, note';

      const [holdingsRes, transactionsRes] = await Promise.all([
        supabase.from('v_holdings').select(holdingsSelect).eq('user_id', user.id),
        supabase.from('all_transactions').select(transactionsSelect).eq('user_id', user.id).order('date', { ascending: false }).limit(100)
      ]);

      if (holdingsRes.error) throw new Error(`Holdings Error: ${holdingsRes.error.message}`);
      if (transactionsRes.error) throw new Error(`Transactions Error: ${transactionsRes.error.message}`);

      const mappedHoldings = (holdingsRes.data || []).map(h => ({
        asset: h.asset,
        currentAmount: h.current_amount,
        currentPrice: h.current_price,
        currentValueUsd: h.current_value_usd,
        averageBuyPrice: h.average_buy_price,
        capitalGain: h.capital_gain,
      }));

      setHoldings(mappedHoldings);
      setTransactions(transactionsRes.data as Transaction[] || []);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleInputChange = (id: string, field: 'usage' | 'note', value: string) => {
    setEditedTransactions(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    setError(null);
    setSyncMessage('Saving changes...');

    const editedEntries = Object.entries(editedTransactions);
    if (editedEntries.length === 0) {
      setSyncMessage('No changes to save.');
      setIsSaving(false);
      return;
    }

    try {
      const updatePromises = editedEntries.map(([viewId, changes]) => {
        const originalTx = transactions.find(t => t.id === viewId);
        if (!originalTx) {
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
            .eq('id', viewId)
            .eq('user_id', originalTx.user_id);
        }
        return Promise.resolve({ error: null });
      });

      const results = await Promise.all(updatePromises);
      const firstError = results.find(res => res && res.error);
      if (firstError) {
        throw new Error(`An update failed: ${firstError.error.message}`);
      }

      setSyncMessage('Changes saved successfully. Refreshing data...');
      await fetchAllData();
      setSyncMessage('Data refreshed.');
    } catch (err: any) {
      console.error('Save failed:', err);
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
      console.error('Price update failed:', err);
      setError(`Failed to update prices: ${err.message}`);
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    const numericValue = value ?? 0;
    return numericValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  const formatNumber = (value: number | null | undefined) => (value ?? 0).toFixed(6);

  const getPnlClass = (pnl: number | null) => (pnl ?? 0) === 0 ? 'text-muted-foreground' : pnl > 0 ? 'text-success' : 'text-destructive';

  return (
    <AppLayout>
      <div className="content-container">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Portfolio Summary</h1>
            <p className="text-muted-foreground mt-1">Track your holdings and transactions</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUpdatePrices}
              disabled={isUpdatingPrices || isSyncing || isSaving}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isUpdatingPrices ? 'animate-spin' : ''}`} />
              {isUpdatingPrices ? 'Updating...' : 'Refresh Price'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSync('exchange-sync-all', 'Exchanges')}
              disabled={isSyncing || isUpdatingPrices || isSaving}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              Refresh Exchange
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSync('sync-wallet-transactions', 'Wallets')}
              disabled={isSyncing || isUpdatingPrices || isSaving}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              Refresh Wallet
            </Button>
          </div>
        </div>

        {/* Status Message */}
        {(syncMessage || error) && (
          <div className={`mb-6 p-4 rounded-lg text-sm ${error ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`}>
            {syncMessage && <p>{syncMessage}</p>}
            {error && <p>Error: {error}</p>}
          </div>
        )}

        {/* Portfolio Summary */}
        <section className="mb-8">
          <h2 className="section-title">Holdings</h2>
          <div className="card-elevated overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading portfolio...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th className="text-right">Amount</th>
                      <th className="text-right">Avg. Buy Price</th>
                      <th className="text-right">Current Price</th>
                      <th className="text-right">Current Value</th>
                      <th className="text-right">Unrealized P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.length > 0 ? holdings.map((h) => (
                      <tr key={h.asset}>
                        <td className="font-medium">{h.asset}</td>
                        <td className="text-right font-mono">{formatNumber(h.currentAmount)}</td>
                        <td className="text-right font-mono">{formatCurrency(h.averageBuyPrice)}</td>
                        <td className="text-right font-mono">{formatCurrency(h.currentPrice)}</td>
                        <td className="text-right font-mono font-medium">{formatCurrency(h.currentValueUsd)}</td>
                        <td className={`text-right font-mono ${getPnlClass(h.capitalGain)}`}>{formatCurrency(h.capitalGain)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6} className="text-center text-muted-foreground py-8">No holdings found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* All Transactions */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">All Transactions</h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveChanges}
                disabled={isSaving || isSyncing || Object.keys(editedTransactions).length === 0}
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Usage & Note'}
              </Button>
            </div>
          </div>

          <div className="card-elevated overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading transactions...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th className="text-right">Amount</th>
                      <th className="text-right">Value (USD)</th>
                      <th style={{ minWidth: '180px' }}>Usage</th>
                      <th style={{ minWidth: '160px' }}>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length > 0 ? transactions.map((tx) => {
                      const editedTx = editedTransactions[tx.id];
                      return (
                        <tr key={tx.id}>
                          <td className="whitespace-nowrap text-sm">{new Date(tx.date).toLocaleString()}</td>
                          <td className="text-sm text-muted-foreground">{tx.description}</td>
                          <td className="text-right font-mono text-sm">{formatNumber(tx.amount)} {tx.asset}</td>
                          <td className="text-right font-mono text-sm">{formatCurrency(tx.value_in_usd)}</td>
                          <td>
                            <Select
                              value={editedTx?.usage ?? tx.usage ?? 'unspecified'}
                              onValueChange={(value) => handleInputChange(tx.id, 'usage', value)}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {accountingUsageOptions.map(opt =>
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </td>
                          <td>
                            <Input
                              type="text"
                              placeholder="Add note..."
                              value={editedTx?.note ?? tx.note ?? ''}
                              onChange={(e) => handleInputChange(tx.id, 'note', e.target.value)}
                              className="h-8 text-sm"
                            />
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan={6} className="text-center text-muted-foreground py-8">No transactions found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
