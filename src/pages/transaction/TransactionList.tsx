
// src/pages/TransactionHistory.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "../integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface Transaction { ts: string; tx_hash: string; source: string; amount: number; asset: string | null; exchange: string | null; symbol: string | null; }

// ★★★【現場指揮官・最終形態】★★★
// 司令塔から受け取った作戦計画書に基づき、エリート工作員を順次派遣する
export default function TransactionHistory() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState<string[]>([]);

    const fetchTransactions = async () => { /* ... */ setIsLoading(true); try { const { data, error } = await supabase.from('v_all_transactions').select('ts, tx_hash, source, amount, asset, exchange, symbol').order('ts', { ascending: false }).limit(100); if (error) throw error; setTransactions(data || []); } catch (err: any) { console.error("Error fetching v_all_transactions:", err); setError(`Failed to load data: ${err.message}`); } finally { setIsLoading(false); } };
    useEffect(() => { fetchTransactions(); }, []);

    const handleSyncAll = async () => {
        setIsSyncing(true);
        setSyncProgress(['Starting sync...']);
        let totalSaved = 0;

        try {
            const { data: connections, error: connError } = await supabase.from('exchange_connections').select('exchange');
            if (connError || !connections) throw new Error('Could not fetch exchange connections.');
            const exchanges = connections.map(c => c.exchange);
            setSyncProgress(prev => [...prev, `Found exchanges: ${exchanges.join(', ')}`]);

            for (const exchange of exchanges) {
                setSyncProgress(prev => [...prev, `---`, `Processing ${exchange}...`]);
                
                // 1. 司令塔に作戦計画を要求
                setSyncProgress(prev => [...prev, `[${exchange}] Asking commander for a plan...`]);
                const { data: plan, error: planError } = await supabase.functions.invoke('exchange-sync-all', { body: { exchange } });
                if (planError) throw new Error(`Plan invocation failed: ${planError.message}`);
                if (plan.error) throw new Error(`Commander returned an error: ${plan.error}`);
                setSyncProgress(prev => [...prev, `[${exchange}] Plan received!`]);

                // 2. 計画書に基づき、特別任務（入出金・両替）を先に実行
                const specialTasks = plan.special_tasks || [];
                if (specialTasks.length > 0) {
                     setSyncProgress(prev => [...prev, `  -> Executing special tasks: [${specialTasks.join(', ')}]`]);
                    for (const task of specialTasks) {
                        setSyncProgress(prev => [...prev, `    -> Running ${task}...`]);
                        const { data: workerResult, error: workerError } = await supabase.functions.invoke('exchange-sync-worker', {
                            body: { exchange, task_type: task },
                        });
                        if (workerError || workerResult.error) {
                             const errMsg = workerError?.message || workerResult?.error;
                             setSyncProgress(prev => [...prev, `      ERROR for ${task}: ${errMsg}`]);
                        } else {
                             const saved = workerResult.savedCount || 0;
                             totalSaved += saved;
                             setSyncProgress(prev => [...prev, `      OK. Found and saved ${saved} records.`]);
                        }
                    }
                }

                // 3. 計画書に基づき、市場取引の同期を実行
                const symbolsToSync = plan.symbols || [];
                if (symbolsToSync.length > 0) {
                    setSyncProgress(prev => [...prev, `  -> Executing market trade sync for ${symbolsToSync.length} symbols...`]);
                    for (const symbol of symbolsToSync) {
                        setSyncProgress(prev => [...prev, `    -> Syncing ${symbol}...`]);
                        const { data: workerResult, error: workerError } = await supabase.functions.invoke('exchange-sync-worker', {
                            body: { exchange, task_type: 'trade', symbol },
                        });
                         if (workerError || workerResult.error) {
                             const errMsg = workerError?.message || workerResult?.error;
                             setSyncProgress(prev => [...prev, `      ERROR for ${symbol}: ${errMsg}`]);
                        } else {
                            const saved = workerResult.savedCount || 0;
                            totalSaved += saved;
                             if (saved > 0) {
                                setSyncProgress(prev => [...prev, `      OK. Found and saved ${saved} trades.`]);
                             }
                        }
                    }
                }
            }

            setSyncProgress(prev => [...prev, '---', `All syncs complete. Total new records saved: ${totalSaved}. Refreshing list...`]);
            await fetchTransactions();

        } catch (error: any) {
            console.error("Sync failed:", error);
            setSyncProgress(prev => [...prev, `A critical error occurred: ${error.message}`]);
        } finally {
            setIsSyncing(false);
        }
    };
    
    const generateDescription = (tx: Transaction): string => { if (tx.symbol) return tx.symbol; if (tx.source === 'exchange' && tx.exchange) return `Trade on ${tx.exchange}`; if (tx.source === 'wallet') return `On-chain transaction`; return '' }

    return (
        <div className="p-4 md:p-6 lg:p-8">
            <h1 className="text-3xl font-bold mb-6">Transactions</h1>
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-2">Data Sync</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Manually sync the latest transaction history from your connected sources.</p>
                <div className="flex items-center space-x-4">
                    <Button variant="outline" size="sm" onClick={handleSyncAll} disabled={isSyncing}>{isSyncing ? 'Syncing...' : 'Sync All'}</Button>
                     <Link to="/vce" className="text-sm font-medium text-blue-600 hover:underline">Manage API Keys</Link>
                </div>
                {syncProgress.length > 0 && (<div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono"><h3 className="font-semibold mb-2">Sync Progress</h3><div className="whitespace-pre-wrap max-h-60 overflow-y-auto">{syncProgress.join('\n')}</div></div>)}
            </section>
            <section>{/* ... */}</section>
        </div>
    );
}
