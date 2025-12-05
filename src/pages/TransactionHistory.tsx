
// src/pages/TransactionHistory.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "../integrations/supabase/client";
import { Button } from "@/components/ui/button";

// interfaceは、一旦、空っぽの、何でも受け取れる、状態に、しておきます
interface Transaction { [key: string]: any; }

// ★★★【データベース尋問モード】★★★
// データベースに、v_all_transactionsの、中身を、直接、吐き出させる
export default function TransactionHistory() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // [最重要] 'select('*')'で、存在する、全ての、カラムを、取得
                const { data, error } = await supabase
                    .from('v_all_transactions')
                    .select('*') 
                    .limit(5); // 負荷を、下げるため、5件だけ、取得

                if (error) throw error;
                setTransactions(data || []);

            } catch (err: any) {
                console.error("Error fetching v_all_transactions with *:", err);
                setError(`Failed to load raw data from v_all_transactions: ${err.message}`);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // --- RENDER --- 
    return (
        <div className="p-4 md:p-6 lg:p-8">
            <h1 className="text-3xl font-bold mb-6">Transactions</h1>

            {/* Data Sync Section:変更なし */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-2">Data Sync</h2>
                {/* ... UI部分は、デバッグ中は、変更しない ... */}
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

            {/* All Transactions Section: 生のJSONデータを、そのまま、表示 */}
            <section>
                <h2 className="text-2xl font-semibold mb-4">All Transactions (Raw Data)</h2>
                
                {isLoading ? (
                    <p>Fetching schema from database...</p>
                ) : error ? (
                    <p className="text-red-500 font-mono">{error}</p>
                ) : (
                    <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-sm font-mono overflow-x-auto">
                        <code>
                            {/* 取得した、生の、JSONデータを、整形して、表示 */}
                            {JSON.stringify(transactions, null, 2)}
                        </code>
                    </pre>
                )}
            </section>
        </div>
    );
}
