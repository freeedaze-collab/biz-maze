
// src/pages/TransactionHistory.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "../integrations/supabase/client";
import { Button } from "@/components/ui/button";

// スキーマは、これで、確定
interface Transaction {
    date: string;
    source: string;
    description: string | null;
    amount: number;
    asset: string | null;
}

// ★★★【UI最終調整版】★★★
// CSS Gridを、用いて、テーブルの、表示崩れを、完全に、防ぐ
export default function TransactionHistory() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const { data, error } = await supabase
                    .from('v_all_transactions')
                    .select('date, source, description, amount, asset')
                    .order('date', { ascending: false })
                    .limit(100);

                if (error) throw error;
                setTransactions(data || []);
            } catch (err: any) {
                console.error("Error fetching v_all_transactions:", err);
                setError(`Failed to load data: ${err.message}`);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
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

            {/* All Transactions Section: CSS Gridで、堅牢な、レイアウトに */}
            <section>
                <h2 className="text-2xl font-semibold mb-4">All Transactions</h2>
                
                {isLoading ? (
                    <p>Loading transactions...</p>
                ) : error ? (
                    <p className="text-red-500 font-mono">{error}</p>
                ) : (
                    <div className="text-sm">
                        {/* Grid Layout Container */}
                        <div className="grid grid-cols-[1fr_1fr_2fr_1fr_1fr] gap-x-4 gap-y-2 font-mono">
                            {/* Header */}
                            <div className="font-bold text-gray-500">Date</div>
                            <div className="font-bold text-gray-500">Source</div>
                            <div className="font-bold text-gray-500">Description</div>
                            <div className="font-bold text-gray-500 text-right">Amount</div>
                            <div className="font-bold text-gray-500 text-right">Asset</div>

                            {/* Separator */}
                            <div className="col-span-5 border-b my-1"></div>

                            {/* Data Rows */}
                            {transactions.length > 0 ? transactions.map((tx, index) => (
                                <React.Fragment key={`${tx.date}-${index}`}>
                                    <div className="py-1">{new Date(tx.date).toLocaleString()}</div>
                                    <div className="py-1">{tx.source}</div>
                                    <div className="py-1 text-gray-600">{tx.description || ''}</div>
                                    <div className="py-1 text-right">{tx.amount.toString()}</div>
                                    <div className="py-1 text-right text-gray-600">{tx.asset || ''}</div>
                                </React.Fragment>
                            )) : (
                                <div className="col-span-5 text-center text-gray-500 py-4">
                                    No transactions found.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
