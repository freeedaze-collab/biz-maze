// src/components/tax/USTaxForm.tsx
// US Crypto Tax Form (IRS Form 8949 style)

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatTaxDate } from '@/lib/taxCalculation';
import { FileText, Download } from 'lucide-react';

type USTaxData = {
    tax_year: number;
    short_term_gains: number;
    long_term_gains: number;
    total_capital_gains: number;
    income_total?: number;
    transactions: Array<{
        date: string;
        currency: string;
        amount: number;
        cost_basis: number;
        proceeds: number;
        gain_loss: number;
        holding_period_days: number;
        is_long_term: boolean;
    }>;
    summary: {
        total_transactions: number;
        short_term_count: number;
        long_term_count: number;
    };
};

type USTaxFormProps = {
    data: USTaxData | null;
    loading: boolean;
};

export default function USTaxForm({ data, loading }: USTaxFormProps) {
    if (loading) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                    Calculating...
                </CardContent>
            </Card>
        );
    }

    if (!data) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                    No tax data available. Click "Calculate Taxes" to begin.
                </CardContent>
            </Card>
        );
    }

    const shortTermTransactions = data.transactions.filter(t => !t.is_long_term);
    const longTermTransactions = data.transactions.filter(t => t.is_long_term);

    const exportPDF = () => {
        // TODO: Implement PDF export
        alert('PDF export coming soon!');
    };

    const exportCSV = () => {
        const headers = ['Date Acquired', 'Date Sold', 'Description', 'Proceeds', 'Cost Basis', 'Gain/Loss', 'Term'];
        const rows = data.transactions.map(t => [
            'Various', // Simplified for FIFO
            t.date,
            `${t.amount.toFixed(8)} ${t.currency}`,
            t.proceeds.toFixed(2),
            t.cost_basis.toFixed(2),
            t.gain_loss.toFixed(2),
            t.is_long_term ? 'Long' : 'Short'
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `crypto_tax_${data.tax_year}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <Card className="border-2">
                <CardHeader className="bg-muted/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-2xl font-bold">
                                Form 8949 - Sales and Other Dispositions of Capital Assets
                            </CardTitle>
                            <CardDescription className="mt-2 text-base">
                                Tax Year {data.tax_year} | Internal Revenue Service
                            </CardDescription>
                        </div>
                        <FileText className="h-12 w-12 text-muted-foreground" />
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">Taxpayer Name:</span>
                            <div className="font-mono mt-1 border-b border-dotted pb-1">___________________________</div>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Social Security Number:</span>
                            <div className="font-mono mt-1 border-b border-dotted pb-1">XXX-XX-____</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Summary Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                            <div className="text-2xl font-bold">{data.summary.total_transactions}</div>
                            <div className="text-sm text-muted-foreground">Total Transactions</div>
                        </div>
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">{data.summary.short_term_count}</div>
                            <div className="text-sm text-muted-foreground">Short-Term</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">{data.summary.long_term_count}</div>
                            <div className="text-sm text-muted-foreground">Long-Term</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Part I - Short-Term Transactions */}
            <Card className="border-2 border-blue-200">
                <CardHeader className="bg-blue-50/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Part I - Short-Term Capital Gains and Losses</CardTitle>
                            <CardDescription className="mt-1">
                                Assets held one year or less
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                            {data.summary.short_term_count} transactions
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b-2 border-blue-200">
                                    <th className="text-left py-3 px-2">(a) Description</th>
                                    <th className="text-left py-3 px-2">(b) Date Acquired</th>
                                    <th className="text-left py-3 px-2">(c) Date Sold</th>
                                    <th className="text-right py-3 px-2">(d) Proceeds</th>
                                    <th className="text-right py-3 px-2">(e) Cost Basis</th>
                                    <th className="text-right py-3 px-2">(h) Gain/(Loss)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shortTermTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No short-term transactions
                                        </td>
                                    </tr>
                                ) : (
                                    shortTermTransactions.map((tx, idx) => (
                                        <tr key={idx} className="border-b hover:bg-muted/30">
                                            <td className="py-3 px-2 font-mono text-xs">
                                                {tx.amount.toFixed(8)} {tx.currency}
                                            </td>
                                            <td className="py-3 px-2">Various (FIFO)</td>
                                            <td className="py-3 px-2">{tx.date}</td>
                                            <td className="py-3 px-2 text-right font-mono">
                                                ${tx.proceeds.toFixed(2)}
                                            </td>
                                            <td className="py-3 px-2 text-right font-mono">
                                                ${tx.cost_basis.toFixed(2)}
                                            </td>
                                            <td className={`py-3 px-2 text-right font-mono font-semibold ${tx.gain_loss >= 0 ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                ${tx.gain_loss >= 0 ? '' : '-'}${Math.abs(tx.gain_loss).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                                <tr className="border-t-2 border-blue-300 bg-blue-50 font-semibold">
                                    <td colSpan={5} className="py-3 px-2 text-right">
                                        Total Short-Term Capital Gain/(Loss):
                                    </td>
                                    <td className={`py-3 px-2 text-right font-mono text-lg ${data.short_term_gains >= 0 ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                        ${data.short_term_gains >= 0 ? '' : '-'}${Math.abs(data.short_term_gains).toFixed(2)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Part II - Long-Term Transactions */}
            <Card className="border-2 border-green-200">
                <CardHeader className="bg-green-50/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Part II - Long-Term Capital Gains and Losses</CardTitle>
                            <CardDescription className="mt-1">
                                Assets held more than one year
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                            {data.summary.long_term_count} transactions
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b-2 border-green-200">
                                    <th className="text-left py-3 px-2">(a) Description</th>
                                    <th className="text-left py-3 px-2">(b) Date Acquired</th>
                                    <th className="text-left py-3 px-2">(c) Date Sold</th>
                                    <th className="text-right py-3 px-2">(d) Proceeds</th>
                                    <th className="text-right py-3 px-2">(e) Cost Basis</th>
                                    <th className="text-right py-3 px-2">(h) Gain/(Loss)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {longTermTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No long-term transactions
                                        </td>
                                    </tr>
                                ) : (
                                    longTermTransactions.map((tx, idx) => (
                                        <tr key={idx} className="border-b hover:bg-muted/30">
                                            <td className="py-3 px-2 font-mono text-xs">
                                                {tx.amount.toFixed(8)} {tx.currency}
                                            </td>
                                            <td className="py-3 px-2">Various (FIFO)</td>
                                            <td className="py-3 px-2">{tx.date}</td>
                                            <td className="py-3 px-2 text-right font-mono">
                                                ${tx.proceeds.toFixed(2)}
                                            </td>
                                            <td className="py-3 px-2 text-right font-mono">
                                                ${tx.cost_basis.toFixed(2)}
                                            </td>
                                            <td className={`py-3 px-2 text-right font-mono font-semibold ${tx.gain_loss >= 0 ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                ${tx.gain_loss >= 0 ? '' : '-'}${Math.abs(tx.gain_loss).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                                <tr className="border-t-2 border-green-300 bg-green-50 font-semibold">
                                    <td colSpan={5} className="py-3 px-2 text-right">
                                        Total Long-Term Capital Gain/(Loss):
                                    </td>
                                    <td className={`py-3 px-2 text-right font-mono text-lg ${data.long_term_gains >= 0 ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                        ${data.long_term_gains >= 0 ? '' : '-'}${Math.abs(data.long_term_gains).toFixed(2)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Total Summary */}
            <Card className="border-2 border-primary">
                <CardHeader className="bg-primary/5">
                    <CardTitle>Net Capital Gain/(Loss)</CardTitle>
                    <CardDescription>Combine short-term and long-term totals</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b">
                            <span>Short-Term Capital Gain/(Loss):</span>
                            <span className={`font-mono font-semibold ${data.short_term_gains >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                ${data.short_term_gains >= 0 ? '' : '-'}${Math.abs(data.short_term_gains).toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b">
                            <span>Long-Term Capital Gain/(Loss):</span>
                            <span className={`font-mono font-semibold ${data.long_term_gains >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                ${data.long_term_gains >= 0 ? '' : '-'}${Math.abs(data.long_term_gains).toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-3 bg-muted/50 px-4 rounded-lg">
                            <span className="font-bold text-lg">Net Capital Gain/(Loss):</span>
                            <span className={`font-mono font-bold text-2xl ${data.total_capital_gains >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                ${data.total_capital_gains >= 0 ? '' : '-'}${Math.abs(data.total_capital_gains).toFixed(2)}
                            </span>
                        </div>
                    </div>

                    <div className="mt-6 flex gap-3">
                        <Button onClick={exportPDF} variant="default" className="flex-1">
                            <Download className="mr-2 h-4 w-4" />
                            Export PDF
                        </Button>
                        <Button onClick={exportCSV} variant="outline" className="flex-1">
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>
                    </div>

                    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                        <p className="font-semibold text-yellow-800 mb-2">⚠️ Important Tax Notice</p>
                        <p className="text-yellow-700">
                            This is a simplified calculation for informational purposes only. Please consult with a qualified tax professional
                            or CPA for accurate tax filing. Individual circumstances may affect your tax liability.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
