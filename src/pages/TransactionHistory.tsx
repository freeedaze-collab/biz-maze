
// src/pages/TransactionHistory.tsx
import React, { useState, useEffect } from 'react';
// [重要修正] supabaseクライアントは、useOutletContextではなく、直接、インポートするのが、この、プロジェクトの、正しい、方法
import { supabase } from "../integrations/supabase/client";
import { SupabaseClient } from "@supabase/supabase-js";

// [重要修正] 仮の、コンポーネント定義を、削除し、実際の、ファイルから、インポートする
import SynthesisStatus from './SynthesisStatus';

interface ExchangeConnection {
    id: string;
    exchange: string;
    created_at: string;
}

// ★★★【最終確定版】★★★
export default function TransactionHistory() {
    // --- STEP 1: Hooks (Reactの、ルールを、遵守) ---
    const [connections, setConnections] = useState<ExchangeConnection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState<Record<string, string>>({});
    const [totalSaved, setTotalSaved] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // --- STEP 2: 副作用 (データ取得) ---
    useEffect(() => {
        // supabaseクライアントは、直接、インポートされているため、常に、利用可能。
        // そのため、「準備ができるまで待つ」ロジックは、不要。

        const fetchConnections = async () => {
            setIsLoading(true);
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                setError("Authentication session not found.");
                setIsLoading(false);
                return;
            }

            const { data, error: dbError } = await supabase
                .from('exchange_connections')
                .select('id, exchange, created_at');

            if (dbError) {
                console.error("Error fetching connections:", dbError);
                setError(`Failed to fetch connections: ${dbError.message}`);
            } else {
                setConnections(data || []);
            }
            setIsLoading(false);
        };

        fetchConnections();
    }, []); // 依存配列は、空にする。マウント時に、一度だけ、実行されれば、良い。

    // --- STEP 3: イベントハンドラ (同期ロジック) --- 
    // この、部分の、ロジックは、以前の、ままで、問題ないと、判断
    const updateStatus = (exchange: string, message: string) => {
        setSyncStatus(prev => ({ ...prev, [exchange]: message }));
    };

    const handleSync = async (exchange: string) => {
        updateStatus(exchange, 'Phase 1/3: Preparing sync plan...');
        // 同期開始時に、合計保存件数を、リセット
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
                    setTotalSaved(prev => prev + newSaves);
                }
            }

            updateStatus(exchange, `Sync complete! Saved ${currentRunSavedCount} new records in total.`);

        } catch (error: any) {
            console.error(`[Orchestration Failed for ${exchange}]`, error);
            updateStatus(exchange, `Error: ${error.message}`);
        }
    };

    const handleSyncAll = () => {
        connections.forEach(conn => handleSync(conn.exchange));
    };

    // --- STEP 4: 描画 ---
    if (isLoading) {
        return <div className="p-4">Loading connections...</div>;
    }

    if (error) {
        return <div className="p-4 text-red-500"><b>Error:</b> {error}</div>;
    }

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Transaction History</h1>
            <div className="mb-6">
                <button 
                    onClick={handleSyncAll}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
                    disabled={isLoading || Object.values(syncStatus).some(s => s.includes('...'))}
                >
                    Sync All Exchanges
                </button>
            </div>
            <div className="space-y-4">
                {connections.length > 0 ? (
                    connections.map(conn => (
                        <div key={conn.id} className="p-4 border rounded-lg">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-semibold">{conn.exchange}</h2>
                                <button 
                                    onClick={() => handleSync(conn.exchange)}
                                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded disabled:bg-gray-400"
                                    disabled={isLoading || Object.values(syncStatus).some(s => s.includes('...'))}
                                >
                                    Sync
                                </button>
                            </div>
                            {syncStatus[conn.exchange] && (
                                <SynthesisStatus status={syncStatus[conn.exchange]} />
                            )}
                        </div>
                    ))
                ) : (
                    <p>No exchange connections found. Please add a connection first.</p>
                )}
            </div>
        </div>
    );
}
