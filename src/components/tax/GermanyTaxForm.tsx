// src/components/tax/GermanyTaxForm.tsx
// Germany Crypto Tax Form (Anlage SO style)

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, FileText } from 'lucide-react';

type GermanyTaxData = {
    tax_year: number;
    currency: string;
    taxable_gains: number;
    tax_free_gains: number;
    exemption_limit: number;
    exemption_used: number;
    final_taxable_income: number;
    transactions: Array<{
        date: string;
        currency: string;
        amount: number;
        cost_basis: number;
        proceeds: number;
        gain_loss: number;
        holding_period_days: number;
        is_tax_free: boolean;
    }>;
    summary: {
        total_transactions: number;
        taxable_count: number;
        tax_free_count: number;
    };
};

type GermanyTaxFormProps = {
    data: GermanyTaxData | null;
    loading: boolean;
};

export default function GermanyTaxForm({ data, loading }: GermanyTaxFormProps) {
    if (loading) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                    Berechnung läuft...
                </CardContent>
            </Card>
        );
    }

    if (!data) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                    Keine Daten verfügbar. Klicken Sie auf "Berechnen".
                </CardContent>
            </Card>
        );
    }

    const taxableTransactions = data.transactions.filter(t => !t.is_tax_free);
    const taxFreeTransactions = data.transactions.filter(t => t.is_tax_free);

    const exportCSV = () => {
        const headers = ['Datum', 'Währung', 'Menge', 'Anschaffungskosten', 'Verkaufserlös', 'Gewinn/Verlust', 'Haltefrist (Tage)', 'Steuerfrei'];
        const rows = data.transactions.map(t => [
            t.date,
            t.currency,
            t.amount.toFixed(8),
            t.cost_basis.toFixed(2),
            t.proceeds.toFixed(2),
            t.gain_loss.toFixed(2),
            t.holding_period_days,
            t.is_tax_free ? 'Ja' : 'Nein'
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `krypto_steuer_${data.tax_year}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card className="border-2">
                <CardHeader className="bg-muted/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-2xl font-bold">
                                Anlage SO - Sonstige Einkünfte
                            </CardTitle>
                            <CardDescription className="mt-2 text-base">
                                Steuerjahr {data.tax_year} | Private Veräußerungsgeschäfte
                            </CardDescription>
                        </div>
                        <FileText className="h-12 w-12 text-muted-foreground" />
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">Steuerpflichtiger:</span>
                            <div className="font-mono mt-1 border-b border-dotted pb-1">___________________________</div>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Steuernummer:</span>
                            <div className="font-mono mt-1 border-b border-dotted pb-1">___/___/_____</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Summary */}
            <Card>
                <CardHeader>
                    <CardTitle>Zusammenfassung</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                            <div className="text-2xl font-bold">{data.summary.total_transactions}</div>
                            <div className="text-sm text-muted-foreground">Transaktionen gesamt</div>
                        </div>
                        <div className="text-center p-4 bg-red-50 rounded-lg">
                            <div className="text-2xl font-bold text-red-600">{data.summary.taxable_count}</div>
                            <div className="text-sm text-muted-foreground">Steuerpflichtig (≤1 Jahr)</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">{data.summary.tax_free_count}</div>
                            <div className="text-sm text-muted-foreground">Steuerfrei (&gt;1 Jahr)</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Taxable Transactions (≤1 year) */}
            <Card className="border-2 border-red-200">
                <CardHeader className="bg-red-50/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Steuerpflichtige Geschäfte (Haltefrist ≤ 1 Jahr)</CardTitle>
                            <CardDescription className="mt-1">
                                Veräußerungen innerhalb der Spekulationsfrist
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                            {data.summary.taxable_count} Geschäfte
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b-2 border-red-200">
                                    <th className="text-left py-3 px-2">Währung</th>
                                    <th className="text-left py-3 px-2">Datum</th>
                                    <th className="text-right py-3 px-2">Anschaffung</th>
                                    <th className="text-right py-3 px-2">Veräußerung</th>
                                    <th className="text-right py-3 px-2">Gewinn/Verlust</th>
                                    <th className="text-right py-3 px-2">Haltefrist</th>
                                </tr>
                            </thead>
                            <tbody>
                                {taxableTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-muted-foreground">
                                            Keine steuerpflichtigen Transaktionen
                                        </td>
                                    </tr>
                                ) : (
                                    taxableTransactions.map((tx, idx) => (
                                        <tr key={idx} className="border-b hover:bg-muted/30">
                                            <td className="py-3 px-2 font-mono text-xs">{tx.amount.toFixed(8)} {tx.currency}</td>
                                            <td className="py-3 px-2">{tx.date}</td>
                                            <td className="py-3 px-2 text-right font-mono">€{tx.cost_basis.toFixed(2)}</td>
                                            <td className="py-3 px-2 text-right font-mono">€{tx.proceeds.toFixed(2)}</td>
                                            <td className={`py-3 px-2 text-right font-mono font-semibold ${tx.gain_loss >= 0 ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                €{tx.gain_loss.toFixed(2)}
                                            </td>
                                            <td className="py-3 px-2 text-right text-xs">{tx.holding_period_days} Tage</td>
                                        </tr>
                                    ))
                                )}
                                <tr className="border-t-2 border-red-300 bg-red-50 font-semibold">
                                    <td colSpan={4} className="py-3 px-2 text-right">
                                        Summe steuerpflichtige Gewinne:
                                    </td>
                                    <td className={`py-3 px-2 text-right font-mono text-lg ${data.taxable_gains >= 0 ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                        €{data.taxable_gains.toFixed(2)}
                                    </td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Tax-Free Transactions (>1 year) */}
            <Card className="border-2 border-green-200">
                <CardHeader className="bg-green-50/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Steuerfreie Geschäfte (Haltefrist &gt; 1 Jahr)</CardTitle>
                            <CardDescription className="mt-1">
                                Veräußerungen außerhalb der Spekulationsfrist
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                            {data.summary.tax_free_count} Geschäfte
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b-2 border-green-200">
                                    <th className="text-left py-3 px-2">Währung</th>
                                    <th className="text-left py-3 px-2">Datum</th>
                                    <th className="text-right py-3 px-2">Gewinn/Verlust</th>
                                    <th className="text-right py-3 px-2">Haltefrist</th>
                                    <th className="text-center py-3 px-2">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {taxFreeTransactions.map((tx, idx) => (
                                    <tr key={idx} className="border-b hover:bg-muted/30">
                                        <td className="py-3 px-2 font-mono text-xs">{tx.amount.toFixed(8)} {tx.currency}</td>
                                        <td className="py-3 px-2">{tx.date}</td>
                                        <td className="py-3 px-2 text-right font-mono text-muted-foreground">€{tx.gain_loss.toFixed(2)}</td>
                                        <td className="py-3 px-2 text-right text-xs">{tx.holding_period_days} Tage</td>
                                        <td className="py-3 px-2 text-center">
                                            <Badge variant="outline" className="bg-green-100 text-green-700">Steuerfrei</Badge>
                                        </td>
                                    </tr>
                                ))}
                                <tr className="border-t-2 border-green-300 bg-green-50 font-semibold">
                                    <td colSpan={2} className="py-3 px-2 text-right">
                                        Summe steuerfreie Gewinne:
                                    </td>
                                    <td className="py-3 px-2 text-right font-mono text-lg text-green-600">
                                        €{data.tax_free_gains.toFixed(2)}
                                    </td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Final Calculation */}
            <Card className="border-2 border-primary">
                <CardHeader className="bg-primary/5">
                    <CardTitle>Steuerpflichtiges Einkommen (Anlage SO)</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b">
                            <span>Steuerpflichtige Gewinne (≤1 Jahr):</span>
                            <span className="font-mono font-semibold">€{data.taxable_gains.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b">
                            <span>Freigrenze (§ 23 EStG):</span>
                            <span className="font-mono">€{data.exemption_limit.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b">
                            <span>Genutzte Freigrenze:</span>
                            <span className="font-mono text-green-600">-€{data.exemption_used.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 bg-muted/50 px-4 rounded-lg">
                            <span className="font-bold text-lg">Steuerpflichtiges Einkommen:</span>
                            <span className="font-mono font-bold text-2xl text-primary">
                                €{data.final_taxable_income.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    <div className="mt-6 flex gap-3">
                        <Button onClick={exportCSV} variant="outline" className="flex-1">
                            <Download className="mr-2 h-4 w-4" />
                            CSV exportieren
                        </Button>
                    </div>

                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                        <p className="font-semibold text-blue-800 mb-2">ℹ️ Hinweis zur Freigrenze</p>
                        <p className="text-blue-700">
                            Die Freigrenze von €600 ist eine "Alles-oder-Nichts"-Regel. Wenn die steuerpflichtigen Gewinne
                            €600 übersteigen, ist der gesamte Betrag steuerpflichtig. Diese Berechnung ist vereinfacht.
                            Bitte konsultieren Sie einen Steuerberater.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
