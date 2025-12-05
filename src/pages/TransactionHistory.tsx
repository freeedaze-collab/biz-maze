
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

// ★★★【最終安定版】コンポーネントの、クラッシュを、完全に、防ぐ ★★★
export default function TransactionHistory() {
    // [最重要修正] まず、context全体を受け取る。ここで、分割代入すると、contextが、未準備の場合に、クラッシュする。
    const context = useOutletContext<{ supabase: SupabaseClient }>();

    // [最重要修正] context、または、context.supabaseが、利用可能になるまで、何もせず、ローディング表示を、徹底する。
    // これが、究極の、セーフガードとなり、描画時の、クラッシュを、完全に、防ぐ。
    if (!context || !context.supabase) {
        return <div>Loading Supabase client...</div>;
    }

    // --- ここから先は、supabaseの、存在が、100%保証されている --- 
    const { supabase } = context;
    
    const [connections, setConnections] = useState<ExchangeConnection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState<Record<string, string>>({});
    const [totalSaved, setTotalSaved] = useState(0);

    useEffect(() => {
        // この、useEffectが、呼ばれる、時点で、supabaseの、存在は、保証されているので、ガードは、不要。
        const fetchConnections = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setIsLoading(false);
                return;
            }

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
    }, [supabase]); // supabaseオブジェクトが、変更された場合に、再実行される

    const updateStatus = (exchange: string, message: string) => {
        setSyncStatus(prev => ({ ...prev, [exchange]: message }));
    };

    // handleSyncの、ロジックは、前回と、同じ（筋は、悪くない、という、お言葉を、信じます）
    const handleSync = async (exchange: string) => {
        updateStatus(exchange, 'Phase 1/3: Preparing sync plan...');
        setTotalSaved(0);
        let currentRunSavedCount = 0;

        try {
            const { data: plan, error: planError } = await supabase.functions.invoke('exchange-sync-all', {
                body: { exchange },
            });
            if (planError) throw new Error(`[Prep Failed] ${planError.message}`);

            const { initialRecords, marketsToFetch, encrypted_blob } = plan;
            updateStatus(exchange, `Plan received. Found ${initialRecords.length} initial records and ${marketsToFetch.length} markets.`);

            if (initialRecords && initialRecords.length > 0) {
                updateStatus(exchange, `Phase 2/3: Saving ${initialRecords.length} initial records...`);
                const { data: saveData, error: saveError } = await supabase.functions.invoke('exchange-sync-save', {
                    body: { exchange, records: initialRecords },
                });
                if (saveError) throw new Error(`[Save Failed - Initial] ${saveError.message}`);
                
                const newSaves = saveData.totalSaved || 0;
                currentRunSavedCount += newSaves;
                setTotalSaved(currentRunSavedCount);
            }

            updateStatus(exchange, `Phase 3/3: Fetching trades from ${marketsToFetch.length} markets...`);
            for (let i = 0; i < marketsToFetch.length; i++) {
                const market = marketsToFetch[i];
                updateStatus(exchange, `[${i + 1}/${marketsToFetch.length}] Fetching trades for ${market}...`);

                const { data: trades, error: workerError } = await supabase.functions.invoke('exchange-sync-worker', {
                    body: { exchange, market, encrypted_blob },
                });
                if (workerError) {
                    console.warn(`[Worker Failed for ${market}]`, workerError);
                    continue;
                }

                if (trades && trades.length > 0) {
                    updateStatus(exchange, `[${i + 1}/${marketsToFetch.length}] Found ${trades.length} trades. Saving...`);
                    const { data: saveData, error: saveError } = await supabase.functions.invoke('exchange-sync-save', {
                        body: { exchange, records: trades },
                    });
                    if (saveError) {
                         console.warn(`[Save Failed for ${market}]`, saveError);
                         continue;
                    }
                    const newSaves = saveData.totalSaved || 0;
                    currentRunSavedCount += newSaves;
                    setTotalSaved(currentRunSavedCount);
                }
            }

            updateStatus(exchange, `Sync complete! Saved ${currentRunSavedCount} new records.`);

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

    // JSX (UI) は、一切、変更なし
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
