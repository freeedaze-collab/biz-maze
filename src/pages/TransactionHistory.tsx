
// src/pages/TransactionHistory.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "../integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface Transaction { /* ... */ ts: string; tx_hash: string; source: string; amount: number; asset: string | null; exchange: string | null; symbol: string | null; }

// ★★★【最終診断モード】★★★
// Ledger召喚用のデバッグボタンを追加
export default function TransactionHistory() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState<string[]>([]);
    const [isDebugging, setIsDebugging] = useState(false);

    const fetchTransactions = async () => { /* ... */ setIsLoading(true); try { const { data, error } = await supabase.from('v_all_transactions').select('ts, tx_hash, source, amount, asset, exchange, symbol').order('ts', { ascending: false }).limit(100); if (error) throw error; setTransactions(data || []); } catch (err: any) { console.error("Error fetching v_all_transactions:", err); setError(`Failed to load data: ${err.message}`); } finally { setIsLoading(false); } };
    useEffect(() => { fetchTransactions(); }, []);

    const handleSyncAll = async () => { /* ... */ setIsSyncing(true); setSyncProgress(['Starting sync...']); let totalSaved = 0; try { const { data: connections, error: connError } = await supabase.from('exchange_connections').select('exchange'); if (connError || !connections) throw new Error('Could not fetch exchange connections.'); const exchanges = connections.map(c => c.exchange); setSyncProgress(prev => [...prev, `Found exchanges: ${exchanges.join(', ')}`]); for (const exchange of exchanges) { setSyncProgress(prev => [...prev, `---`, `Processing ${exchange}...`]); const { data: plan, error: planError } = await supabase.functions.invoke('exchange-sync-all', { body: { exchange }, }); if (planError) throw planError; if (plan.error) throw new Error(`Plan error for ${exchange}: ${plan.error}`); const symbolsToSync = plan.symbols; if (!symbolsToSync || symbolsToSync.length === 0) { setSyncProgress(prev => [...prev, `[${exchange}] No symbols to sync.`]); continue; } setSyncProgress(prev => [...prev, `[${exchange}] Plan received. ${symbolsToSync.length} markets to sync.`]); for (const symbol of symbolsToSync) { setSyncProgress(prev => [...prev, `  -> Syncing ${symbol}...`]); const { data: workerResult, error: workerError } = await supabase.functions.invoke('exchange-sync-worker', { body: { exchange, symbol }, }); if (workerError) { setSyncProgress(prev => [...prev, `    ERROR for ${symbol}: ${workerError.message}`]); continue; } if(workerResult.error) { setSyncProgress(prev => [...prev, `    ERROR for ${symbol}: ${workerResult.error}`]); continue; } const saved = workerResult.savedCount || 0; totalSaved += saved; setSyncProgress(prev => [...prev, `    OK. Found and saved ${saved} trades.`]); } } setSyncProgress(prev => [...prev, '---', `All syncs complete. Total new records saved: ${totalSaved}. Refreshing list...`]); await fetchTransactions(); } catch (error: any) { console.error("Sync failed:", error); setSyncProgress(prev => [...prev, `A critical error occurred: ${error.message}`]); } finally { setIsSyncing(false); } };
    const generateDescription = (tx: Transaction): string => { /* ... */ if (tx.symbol) return tx.symbol; if (tx.source === 'exchange' && tx.exchange) return `Trade on ${tx.exchange}`; if (tx.source === 'wallet') return `On-chain transaction`; return '' }

    // ★★★ 最終診断ツールを起動する関数 ★★★
    const handleDebugLedger = async () => {
        setIsDebugging(true);
        try {
            alert('Invoking Ledger Debugger for Binance. This may take a moment. The result will be in the Supabase function logs, not here.');
            // 我々は "binance" が対象だと知っている
            const { data, error } = await supabase.functions.invoke('exchange-debug-ledger', {
                body: { exchange: 'binance' },
            });

            if (error) throw error;

            alert('SUCCESS: Ledger Debugger was invoked. Please go to the Supabase Dashboard > Edge Functions > exchange-debug-ledger > Logs and copy the entire log content.');
            console.log("Debug function returned:", data);

        } catch (err: any) {
            console.error("Ledger Debugger failed:", err);
            alert(`ERROR: Ledger Debugger failed: ${err.message}`);
        } finally {
            setIsDebugging(false);
        }
    };


    return (
        <div className="p-4 md:p-6 lg:p-8">
            <h1 className="text-3xl font-bold mb-6">Transactions</h1>

            {/* Data Sync Section */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-2">Data Sync</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Manually sync the latest transaction history from your connected sources.
                </p>
                <div className="flex items-center space-x-4">
                    <Button variant="outline" size="sm" onClick={handleSyncAll} disabled={isSyncing || isDebugging}>
                        {isSyncing ? 'Syncing...' : 'Sync All'}
                    </Button>
                     <Link to="/vce" className="text-sm font-medium text-blue-600 hover:underline">
                        Manage API Keys
                    </Link>
                </div>
                {syncProgress.length > 0 && ( /* ... */ <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono"><h3 className="font-semibold mb-2">Sync Progress</h3><div className="whitespace-pre-wrap max-h-60 overflow-y-auto">{syncProgress.join('\n')}</div></div>)}

                {/* ★★★ 最終診断セクション ★★★ */}
                <div className="mt-6 pt-6 border-t border-dashed border-red-500">
                    <h3 className="text-xl font-bold text-red-600">Final Diagnosis Tool</h3>
                    <p className="text-gray-600 dark:text-gray-400 my-2">
                        If normal sync does not find any trades, use this tool. This fetches the raw "Ledger" (the absolute source of truth for all transactions) from the exchange. This will reveal ALL account activity, including simple conversions, rewards, fees, and other non-trade events.
                    </p>
                    <Button variant="destructive" onClick={handleDebugLedger} disabled={isDebugging || isSyncing}>
                        {isDebugging ? 'Summoning Ledger...' : 'Invoke Ledger Debugger'}
                    </Button>
                </div>
            </section>

            {/* All Transactions Section */}
            <section>{ /* ... */ }</section>
        </div>
    );
}
