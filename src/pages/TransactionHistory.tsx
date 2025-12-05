
// src/pages/TransactionHistory.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "../integrations/supabase/client";
import { Button } from "@/components/ui/button";

// The interface will be generic for now to accept any data from the DB
interface Transaction { [key: string]: any; }

// ★★★【最終手段：データベースの真実を問う】★★★
// 度重なるエラーのため、推測を完全に放棄します。
// データベースに「v_all_transactionsに、一体、何のカラムがあるのか」を直接尋ね、
// その「生の(RAW)」データを、そのまま画面に表示させます。
export default function TransactionHistory() {
    const [rawData, setRawData] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTheTruth = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // [最重要] "select('*')" を使い、存在する全てのカラムを取得します。
                const { data, error } = await supabase
                    .from('v_all_transactions')
                    .select('*') 
                    .limit(5); // 5件だけ取得して確認します

                if (error) throw error;
                setRawData(data || []);

            } catch (err: any) {
                console.error("CRITICAL: Failed to fetch schema with '*':", err);
                setError(`Failed to introspect the database. The view 'v_all_transactions' might not exist or there is a network issue. Error: ${err.message}`);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTheTruth();
    }, []);

    return (
        <div className="p-4 md:p-6 lg:p-8">
            <h1 className="text-3xl font-bold mb-6">Transactions</h1>

            {/* Data Sync Section: 変更なし */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-2">Data Sync</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Manually sync the latest transaction history from your connected sources.
                </p>
                <div className="space-y-3">
                    <div>
                        <p>Wallet (ethereum)</p>
                        <Button variant="outline" size="sm">Sync</Button>
                    </div>
                    <div>
                        <p>All Connected Exchanges</p>
                        <Button variant="outline" size="sm">Sync All</Button>
                    </div>
                    <div>
                        <Link to="/vce" className="text-sm font-medium text-blue-600 hover:underline">
                            Manage API Keys
                        </Link>
                    </div>
                </div>
            </section>

            {/* All Transactions Section: データベースからの生データを表示 */}
            <section>
                <h2 className="text-2xl font-semibold mb-4">Database Schema Truth (Raw Data)</h2>
                <p className="mb-4 text-gray-600">
                    Below is the raw data fetched from the 'v_all_transactions' view. Please copy this and provide it, so I can write the final, correct code.
                </p>
                
                {isLoading ? (
                    <p>Asking the database for the truth...</p>
                ) : error ? (
                    <p className="text-red-500 font-mono">{error}</p>
                ) : (
                    <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-sm font-mono overflow-x-auto">
                        <code>
                            {JSON.stringify(rawData, null, 2)}
                        </code>
                    </pre>
                )}
            </section>
        </div>
    );
}
