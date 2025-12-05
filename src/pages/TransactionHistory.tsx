
// app/routes/_protected.transaction-history/TransactionHistory.tsx
import React, { useState, useEffect } from 'react';
import { useOutletContext } from "@remix-run/react";
import { SupabaseClient } from "@supabase/supabase-js";
import SynthesisStatus from './SynthesisStatus'; // UIコンポーネントはそのまま利用

interface ExchangeConnection {
    id: string;
    exchange: string;
    created_at: string;
}

// ★★★ 「超」分散処理モデルの、最終形態 (UI変更なし) ★★★
export default function TransactionHistory() {
    const { supabase } = useOutletContext<{ supabase: SupabaseClient }>();
    const [connections, setConnections] = useState<ExchangeConnection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchConnections = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { setIsLoading(false); return; }

            const { data, error } = await supabase
                .from('exchange_connections')
                .select('id, exchange, created_at');

            if (error) {
                console.error("Error fetching connections:", error);
            } else {
                setConnections(data || []);
            }
            setIsLoading(false);
        };
        fetchConnections();
    }, [supabase]);

    const updateStatus = (exchange: string, message: string) => {
        setSyncStatus(prev => ({ ...prev, [exchange]: message }));
    };

    // ★★★ ここからが、新しい「現場監督」のロジック ★★★
    const handleSync = async (exchange: string) => {
        updateStatus(exchange, 'Phase 1/3: Preparing sync plan...');
        let totalSavedCount = 0; // 保存件数をローカルで追跡

        try {
            // STEP 1: `exchange-sync-all`を呼び出し、「計画書」を取得
            const { data: plan, error: planError } = await supabase.functions.invoke('exchange-sync-all', {
                body: { exchange },
            });
            if (planError) throw new Error(`[Prep Failed] ${planError.message}`);

            const { initialRecords, marketsToFetch, encrypted_blob } = plan;
            updateStatus(exchange, `Plan received. Found ${initialRecords.length} initial records and ${marketsToFetch.length} markets.`);

            // STEP 2: `all`が取得した入出金履歴(initialRecords)を、まず保存
            if (initialRecords && initialRecords.length > 0) {
                updateStatus(exchange, `Phase 2/3: Saving ${initialRecords.length} initial records...`);
                const { data: saveData, error: saveError } = await supabase.functions.invoke('exchange-sync-save', {
                    body: { exchange, records: initialRecords },
                });
                if (saveError) throw new Error(`[Save Failed - Initial] ${saveError.message}`);
                totalSavedCount += saveData.totalSaved || 0;
            }

            // STEP 3: `worker`と`save`を、ループで、小刻みに呼び出す
            updateStatus(exchange, `Phase 3/3: Fetching trades from ${marketsToFetch.length} markets...`);
            for (let i = 0; i < marketsToFetch.length; i++) {
                const market = marketsToFetch[i];
                updateStatus(exchange, `[${i + 1}/${marketsToFetch.length}] Fetching trades for ${market}...`);

                // 3a. `worker`を呼び出し、単一ペアの取引履歴を取得
                const { data: trades, error: workerError } = await supabase.functions.invoke('exchange-sync-worker', {
                    body: { exchange, market, encrypted_blob },
                });
                if (workerError) {
                    console.warn(`[Worker Failed for ${market}]`, workerError);
                    continue; // 一つのペアで失敗しても、全体は止めずに続行
                }

                // 3b. `worker`から受け取った履歴を、`save`で、即座に、保存
                if (trades && trades.length > 0) {
                    updateStatus(exchange, `[${i + 1}/${marketsToFetch.length}] Found ${trades.length} trades. Saving...`);
                    const { data: saveData, error: saveError } = await supabase.functions.invoke('exchange-sync-save', {
                        body: { exchange, records: trades },
                    });
                    if (saveError) {
                         console.warn(`[Save Failed for ${market}]`, saveError);
                         continue; // 保存で失敗しても続行
                    }
                    totalSavedCount += saveData.totalSaved || 0;
                }
            }

            updateStatus(exchange, `Sync complete! Saved ${totalSavedCount} new records.`);

        } catch (error: any) {
            console.error(`[Orchestration Failed for ${exchange}]`, error);
            updateStatus(exchange, `Error: ${error.message}`);
        }
    };

    const handleSyncAll = () => {
        connections.forEach(conn => handleSync(conn.exchange));
    };

    if (isLoading) {
        return <div>Loading connections...</div>;
    }

    // ★★★ JSX (UI) は、一切、変更していません ★★★
    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Transaction History</h1>
            
            <div className="mb-6">
                <button 
                    onClick={handleSyncAll}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
                    disabled={Object.values(syncStatus).some(s => s.includes('...'))}
                >
                    Sync All Exchanges
                </button>
            </div>

            <div className="space-y-4">
                {connections.map(conn => (
                    <div key={conn.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-semibold">{conn.exchange}</h2>
                            <button 
                                onClick={() => handleSync(conn.exchange)}
                                className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded disabled:bg-gray-400"
                                disabled={Object.values(syncStatus).some(s => s.includes('...'))}
                            >
                                Sync
                            </button>
                        </div>
                        {syncStatus[conn.exchange] && (
                            <SynthesisStatus status={syncStatus[conn.exchange]} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
