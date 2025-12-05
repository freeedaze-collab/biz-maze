
// app/routes/_protected.transaction-history/TransactionHistory.tsx
import React, { useState, useEffect } from 'react';
import { useOutletContext } from "@remix-run/react";
import { SupabaseClient } from "@supabase/supabase-js";

// SynthesisStatusは、この、安全版では、不要なため、コメントアウト
// import SynthesisStatus from './SynthesisStatus'; 

interface ExchangeConnection {
    id: string;
    exchange: string;
    created_at: string;
}

// ★★★【デバッグ用・安全第一版】★★★
// まずは、このコンポーネントが、クラッシュせずに、正しく、表示されることを、最優先します。
// 同期ロジックは、この、バージョンでは、意図的に、全て、削除しています。
export default function TransactionHistory() {
    // --- STEP 1: Hooks (Reactの、ルールに従い、全て、トップレベルで、呼び出す) ---
    const context = useOutletContext<{ supabase: SupabaseClient }>();
    const supabase = context?.supabase;
    
    const [connections, setConnections] = useState<ExchangeConnection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null); // エラー表示専用の、状態

    // --- STEP 2: データ取得の、副作用 (useEffect) ---
    useEffect(() => {
        // supabaseクライアントの、準備が、できるまで、何もしない。
        // 準備が、できたら、依存配列の、おかげで、この、Effectが、再実行される。
        if (!supabase) {
            setIsLoading(false);
            // supabaseがない場合、エラーメッセージを設定して、ユーザーに、状況を、知らせる
            setError("Supabase client is not available. Please try refreshing the page.");
            return; 
        }

        const fetchConnections = async () => {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                setIsLoading(false);
                setError("Authentication session not found. Please log in again.");
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
    }, [supabase]); // supabaseクライアントが、準備でき次第、この、Effectが、実行される

    // --- STEP 3: UIの、描画 ---
    
    // ローディング状態を、最優先で、チェック
    if (isLoading) {
        return <div className="p-4">Loading connections...</div>;
    }

    // エラーが、発生した場合、ユーザーに、エラーメッセージを、明確に、表示
    if (error) {
        return <div className="p-4 text-red-500"><b>Error:</b> {error}</div>;
    }
    
    // 正常な、UIを、描画
    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Transaction History</h1>
            <div className="mb-6">
                {/* 同期ボタンは、デバッグ中は、無効化し、見た目だけ、表示する */}
                <button 
                    className="bg-gray-400 text-white font-bold py-2 px-4 rounded cursor-not-allowed"
                    disabled={true}
                    title="Temporarily disabled for debugging"
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
                                {/* 同期ボタンは、デバッグ中は、無効化し、見た目だけ、表示する */}
                                <button 
                                    className="bg-gray-400 text-white font-bold py-1 px-3 rounded cursor-not-allowed"
                                    disabled={true}
                                    title="Temporarily disabled for debugging"
                                >
                                    Sync
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p>No exchange connections found.</p>
                )}
            </div>
        </div>
    );
}
