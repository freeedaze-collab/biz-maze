
// src/pages/TransactionHistory.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "../integrations/supabase/client";
import { Button } from "@/components/ui/button";

// スキーマはこれで確定
interface Transaction {
    date: string;
    source: string;
    description: string | null;
    amount: number;
    asset: string | null;
}

// ★★★【最終FIX・テーブルレイアウト版】★★★
// divレイアウトを破棄し、堅牢な`<table>`要素で再構築
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

            {/* All Transactions Section: `<table>`でレイアウトを再構築 */}
            <section>
                <h2 className="text-2xl font-semibold mb-4">All Transactions</h2>
                
                {isLoading ? (
                    <p>Loading transactions...</p>
                ) : error ? (
                    <p className="text-red-500 font-mono">{error}</p>
                ) : (
                    <div className="w-full overflow-x-auto">
                        <table className="min-w-full text-sm text-left">
                            <thead className="font-mono text-gray-500">
                                <tr>
                                    <th className="p-2 font-semibold">Date</th>
                                    <th className="p-2 font-semibold">Source</th>
                                    <th className="p-2 font-semibold">Description</th>
                                    <th className="p-2 font-semibold text-right">Amount</th>
                                    <th className="p-2 font-semibold text-right">Asset</th>
                                </tr>
                            </thead>
                            <tbody className="font-mono">
                                {transactions.length > 0 ? transactions.map((tx, index) => (
                                    <tr key={`${tx.date}-${index}`} className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="p-2 whitespace-nowrap">{new Date(tx.date).toLocaleString()}</td>
                                        <td className="p-2 whitespace-nowrap">{tx.source}</td>
                                        <td className="p-2 text-gray-600 dark:text-gray-400">{tx.description || ''}</td>
                                        <td className="p-2 text-right">{tx.amount.toString()}</td>
                                        <td className="p-2 text-right text-gray-600 dark:text-gray-400">{tx.asset || ''}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="text-center text-gray-500 py-4">
                                            No transactions found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
