
// src/pages/TransactionHistory.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "../integrations/supabase/client";
import { Button } from "@/components/ui/button";

// 【最終FIX】データベースのスキーマ（真実）に合わせてinterfaceを修正
interface Transaction {
    id: string;
    date: string; // created_at ではなく date
    source: string;
    description: string | null;
    amount: number;
    asset: string | null;
}

export default function TransactionHistory() {
    // --- STATE ---
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- DATA FETCHING ---
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // 【最終FIX】SELECT文をDBスキーマ（真実）に完全に一致させる
                const { data, error } = await supabase
                    .from('v_all_transactions')
                    .select('id, date, source, description, amount, asset')
                    .order('date', { ascending: false })
                    .limit(100);

                if (error) throw error;
                setTransactions(data || []);

            } catch (err: any) {
                console.error("Error fetching v_all_transactions:", err);
                setError(`Failed to load data from v_all_transactions: ${err.message}`);
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

            {/* All Transactions Section */}
            <section>
                <h2 className="text-2xl font-semibold mb-4">All Transactions</h2>
                
                {isLoading ? (
                    <p>Loading transactions...</p>
                ) : error ? (
                    <p className="text-red-500">{error}</p>
                ) : (
                    <div className="font-mono text-sm space-y-2">
                        {/* Header Row */}
                        <div className="flex space-x-4 text-gray-500">
                            <div className="w-48">Date</div>
                            <div className="w-24">Source</div>
                            <div className="flex-1">Description</div>
                            <div className="w-40 text-right">Amount</div>
                            <div className="w-20 text-right">Asset</div>
                        </div>
                        {/* Data Rows */}
                        {transactions.length > 0 ? transactions.map(tx => (
                            <div key={tx.id} className="flex space-x-4 items-baseline">
                                {/* 【最終FIX】created_at を date に修正 */}
                                <div className="w-48">{new Date(tx.date).toLocaleString()}</div>
                                {/* 【最終FIX】source を表示するように戻す */}
                                <div className="w-24">{tx.source}</div>
                                <div className="flex-1 text-gray-600">{tx.description || ''}</div>
                                <div className="w-40 text-right">{tx.amount.toString()}</div>
                                <div className="w-20 text-right text-gray-600">{tx.asset || ''}</div>
                            </div>
                        )) : (
                            <p className="text-gray-500">No transactions found.</p>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}
