
// src/pages/TransactionHistory.tsx
import React, { useState, useEffect, useCallback } from \'react\';
import { Link } from \'react-router-dom\';
import { supabase } from \"../integrations/supabase/client\";
import { Button } from \"@/components/ui/button\";

// --- Data Structures Aligned with Database Views ---

// Based on v_holdings
interface Holding {
    asset: string;
    current_amount: number;
    current_price: number;
    current_value: number;
    average_buy_price: number;
    realized_capital_gain_loss: number;
}

// Based on v_all_transactions_classified
interface Transaction {
    ctx_id: string;
    ts: string;
    source: string;
    description: string;
    amount: number;
    asset: string;
    transaction_type: string;
}

// --- Main Component ---
export default function TransactionHistory() {
    // State Management
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [holdings, setHoldings] = useState<Holding[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isSyncing, setIsSyncing] = useState(false);
    const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);

    // --- Data Fetching Functions ---

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setSyncMessage(null);
        try {
            const [holdingsRes, transactionsRes] = await Promise.all([
                supabase.from(\'v_holdings\').select(\'*\'),
                supabase.from(\'v_all_transactions_classified\').select(\'*\').order(\'ts\', { ascending: false }).limit(100)
            ]);

            if (holdingsRes.error) throw new Error(`Holdings Error: ${holdingsRes.error.message}`);
            if (transactionsRes.error) throw new Error(`Transactions Error: ${transactionsRes.error.message}`);

            setHoldings(holdingsRes.data || []);
            setTransactions(transactionsRes.data || []);
        } catch (err: any) {
            console.error(\"Error fetching data:\", err);
            setError(`Failed to load data: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial data load
    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // --- Action Handlers ---

    const handleSync = async (syncFunction: \'sync-wallet-transactions\' | \'exchange-sync-all\', syncType: string) => {
        setIsSyncing(true);
        setSyncMessage(`Syncing ${syncType}...`);
        try {
            const { error } = await supabase.functions.invoke(syncFunction);
            if (error) throw error;
            setSyncMessage(`${syncType} sync complete. Refreshing all data...`);
            await fetchAllData(); // Refresh both holdings and transactions
            setSyncMessage(`${syncType} data refreshed successfully.`);
        } catch (err: any) {
            console.error(`${syncType} sync failed:\`, err);
            setError(`A critical error occurred during ${syncType} sync: ${err.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleUpdatePrices = async () => {
        setIsUpdatingPrices(true);
        setError(null);
        setSyncMessage(\'Updating asset prices...\');
        try {
            const { error } = await supabase.functions.invoke(\'update-prices\');
            if (error) throw error;
            setSyncMessage(\'Prices updated. Refreshing portfolio...\');
            
            // Only refetch holdings, as prices don\'t affect transaction history
            const { data, error: fetchError } = await supabase.from(\'v_holdings\').select(\'*\');
            if(fetchError) throw fetchError;
            setHoldings(data || []);

            setSyncMessage(\'Portfolio refreshed with latest prices.\');

        } catch (err: any) {
            console.error(\"Price update failed:\", err);
            setError(`Failed to update prices: ${err.message}`);
        } finally {
            setIsUpdatingPrices(false);
        }
    };

    // --- Formatting Helpers ---
    const formatCurrency = (value: number | null) => {
        if (value === null || typeof value === \'undefined\') return \'N/A\';
        return value.toLocaleString(\'en-US\', { style: \'currency\', currency: \'USD\' });
    };

    const formatNumber = (value: number | null) => {
        if (value === null || typeof value === \'undefined\') return \'-\';
        return value.toFixed(6);
    };

    const getPnlClass = (pnl: number | null) => {
        if (pnl === null || pnl === 0) return \'text-gray-500\';
        return pnl > 0 ? \'text-green-500\' : \'text-red-500\';
    };


    // --- Render Method ---
    return (
        <div className=\"p-4 md:p-6 lg:p-8\">
            <h1 className=\"text-3xl font-bold mb-6\">Transactions & Portfolio</h1>
            
            {/* --- Actions Section --- */}
            <section className=\"mb-8\">
                <h2 className=\"text-2xl font-semibold mb-2\">Actions</h2>
                <p className=\"text-gray-600 dark:text-gray-400 mb-4\">Update asset prices or manually sync transaction history.</p>
                <div className=\"flex items-center space-x-4\">
                    <Button variant=\"outline\" size=\"sm\" onClick={handleUpdatePrices} disabled={isUpdatingPrices || isSyncing}>
                        {isUpdatingPrices ? \'Updating Prices...\' : \'Update Asset Prices\'}
                    </Button>
                    <Button variant=\"outline\" size=\"sm\" onClick={() => handleSync(\'exchange-sync-all\', \'Exchanges\')} disabled={isSyncing || isUpdatingPrices}>
                        {isSyncing ? \'Syncing...\' : \'Sync Exchanges\'}
                    </Button>
                    <Button variant=\"outline\" size=\"sm\" onClick={() => handleSync(\'sync-wallet-transactions\', \'Wallet\')} disabled={isSyncing || isUpdatingPrices}>
                        {isSyncing ? \'Syncing...\' : \'Sync Wallet\'}
                    </Button>
                     <Link to=\"/management/exchange-services\" className=\"text-sm font-medium text-blue-600 hover:underline\">Manage API Keys</Link>
                </div>
                {(syncMessage || error) && (
                    <div className=\"mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono\">
                        {syncMessage && <p>{syncMessage}</p>}
                        {error && <p className=\"text-red-500\">Error: {error}</p>}
                    </div>
                )}
            </section>

            {/* --- Portfolio Summary Section (v_holdings) --- */}
            <section className=\"mb-8\">
                <h2 className=\"text-2xl font-semibold mb-4\">Portfolio Summary</h2>
                {isLoading ? <p>Loading portfolio...</p> : (
                    <div className=\"w-full overflow-x-auto\">
                         <table className=\"min-w-full text-sm text-left\">
                            <thead className=\"font-mono text-gray-500\">
                                <tr>
                                    <th className=\"p-2 font-semibold\">Asset</th>
                                    <th className=\"p-2 font-semibold text-right\">Amount</th>
                                    <th className=\"p-2 font-semibold text-right\">Avg. Buy Price</th>
                                    <th className=\"p-2 font-semibold text-right\">Current Price</th>
                                    <th className=\"p-2 font-semibold text-right\">Current Value</th>
                                    <th className=\"p-2 font-semibold text-right\">Realized P&L</th>
                                </tr>
                            </thead>
                            <tbody className=\"font-mono\">
                                {holdings.length > 0 ? holdings.map((h) => (
                                    <tr key={h.asset} className=\"border-b border-gray-200 dark:border-gray-700\">
                                        <td className=\"p-2 font-bold whitespace-nowrap\">{h.asset}</td>
                                        <td className=\"p-2 text-right whitespace-nowrap\">{formatNumber(h.current_amount)}</td>
                                        <td className=\"p-2 text-right whitespace-nowrap\">{formatCurrency(h.average_buy_price)}</td>
                                        <td className=\"p-2 text-right whitespace-nowrap\">{formatCurrency(h.current_price)}</td>
                                        <td className=\"p-2 text-right whitespace-nowrap font-semibold\">{formatCurrency(h.current_value)}</td>
                                        <td className={`p-2 text-right whitespace-nowrap ${getPnlClass(h.realized_capital_gain_loss)}`}>
                                            {formatCurrency(h.realized_capital_gain_loss)}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className=\"text-center text-gray-500 py-4\">No holdings found. Sync your transactions to build your portfolio.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* --- All Transactions Section (v_all_transactions_classified) --- */}
            <section>
                <h2 className=\"text-2xl font-semibold mb-4\">All Transactions</h2>
                {isLoading ? <p>Loading transactions...</p> : (
                    <div className=\"w-full overflow-x-auto\">
                         <table className=\"min-w-full text-sm text-left\">
                            <thead className=\"font-mono text-gray-500\">
                                <tr>
                                    <th className=\"p-2 font-semibold\">Date</th>
                                    <th className=\"p-2 font-semibold\">Source</th>
                                    <th className=\"p-2 font-semibold\">Description</th>
                                    <th className=\"p-2 font-semibold\">Asset</th>
                                    <th className=\"p-2 font-semibold text-right\">Amount</th>
                                    <th className=\"p-2 font-semibold\">Type</th>
                                </tr>
                            </thead>
                            <tbody className=\"font-mono\">
                                {transactions.length > 0 ? transactions.map((tx) => (
                                    <tr key={tx.ctx_id} className=\"border-b border-gray-200 dark:border-gray-700\">
                                        <td className=\"p-2 whitespace-nowrap\">{new Date(tx.ts).toLocaleString()}</td>
                                        <td className=\"p-2 whitespace-nowrap\">{tx.source}</td>
                                        <td className=\"p-2 text-gray-600 dark:text-gray-400\">{tx.description}</td>
                                        <td className=\"p-2 text-right text-gray-600 dark:text-gray-400\">{tx.asset}</td>
                                        <td className=\"p-2 text-right\">{formatNumber(tx.amount)}</td>
                                        <td className=\"p-2 font-semibold\">{tx.transaction_type}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className=\"text-center text-gray-500 py-4\">No transactions found.</td>
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
