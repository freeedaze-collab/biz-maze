
// src/pages/TransactionHistory.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "../integrations/supabase/client";
import { Button } from "@/components/ui/button";

// 【最終FIX】真のビュー「all_transactions」のスキーマに、完全に、一致させたinterface
interface Transaction {
    id: string;
    date: string;       // 正: date
    source: string;     // 正: source
    description: string | null;
    amount: number;
    asset: string | null;
}

// ★★★【最終・完全修正版】★★★
// 真のビュー名と、真のカラム名に基づき、UIを、完全に、復元する
export default function TransactionHistory() {
    // --- STATE ---
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- DATA FETCHING ---
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // [最重要修正] 真のビュー名 'all_transactions' を使用する
                // [最重要修正] 真のカラム名のみを、selectで、指定する
                const { data, error } = await supabase
                    .from('all_transactions') // これが真の名前
                    .select('id, date, source, description, amount, asset')
                    .order('date', { ascending: false })
                    .limit(100);

                if (error) throw error;
                setTransactions(data || []);

            } catch (err: any) {
                console.error("Error fetching all_transactions:", err);
                setError(`Failed to load data: ${err.message}`);
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
                    <p className="text-red-500 font-mono">{error}</p>
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
                                <div className="w-48">{new Date(tx.date).toLocaleString()}</div>
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
