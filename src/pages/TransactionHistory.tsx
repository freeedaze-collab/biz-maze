
// src/pages/Accounting.tsx
// VERSION 2: Fetches data directly from the new database views instead of invoking a function.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// --- Type Definitions for Financial Statements from DB Views ---
type PLAccount = { account: string; balance: number; }
type BSAccount = { account: string; balance: number; }

interface FinancialStatements {
    profitAndLoss: PLAccount[];
    balanceSheet: BSAccount[];
}

// --- Helper Components ---
const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

const StatementCard: React.FC<{ title: string; data: { account: string; balance: number }[]; totalLabel?: string; totalValue?: number; }> = ({ title, data, totalLabel, totalValue }) => (
    <Card>
        <CardHeader>
            <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((item, index) => (
                        <TableRow key={index}>
                            <TableCell className="font-medium">{item.account}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.balance)}</TableCell>
                        </TableRow>
                    ))}
                    {totalLabel && totalValue !== undefined && (
                        <TableRow className="font-bold border-t-2">
                            <TableCell>{totalLabel}</TableCell>
                            <TableCell className="text-right">{formatCurrency(totalValue)}</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
);


// --- Main Accounting Component ---
export default function Accounting() {
    const [statements, setStatements] = useState<FinancialStatements | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStatements = async () => {
            setIsLoading(true);
            setError(null);

            try {
                // Fetch all statements from the new views in parallel
                const [plRes, bsRes] = await Promise.all([
                    supabase.from('v_profit_and_loss').select('account, balance'),
                    supabase.from('v_balance_sheet').select('account, balance')
                ]);

                if (plRes.error) throw new Error(`Profit & Loss Error: ${plRes.error.message}`);
                if (bsRes.error) throw new Error(`Balance Sheet Error: ${bsRes.error.message}`);

                setStatements({
                    profitAndLoss: plRes.data as PLAccount[],
                    balanceSheet: bsRes.data as BSAccount[],
                });

            } catch (err: any) {
                console.error("Error fetching financial statements:", err);
                setError(`Failed to load statements: ${err.message}. Ensure the database views (e.g., v_profit_and_loss) are created.`);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStatements();
    }, []);

    const netIncome = statements?.profitAndLoss.reduce((sum, item) => sum + item.balance, 0) ?? 0;

    return (
        <div className="p-4 md:p-6 lg:p-8">
            <h1 className="text-3xl font-bold mb-6">Financial Statements</h1>

            {isLoading && <p>Loading financial statements...</p>}
            {error && <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">{error}</div>}
            
            {statements && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* --- Profit & Loss --- */}
                    <StatementCard 
                        title="Profit & Loss Statement" 
                        data={statements.profitAndLoss} 
                        totalLabel="Net Income" 
                        totalValue={netIncome} 
                    />

                    {/* --- Balance Sheet --- */}
                    <StatementCard 
                        title="Balance Sheet" 
                        data={statements.balanceSheet} 
                    />
                    
                    {/* Cash Flow will be added in the next step */}
                </div>
            )}
        </div>
    );
}
