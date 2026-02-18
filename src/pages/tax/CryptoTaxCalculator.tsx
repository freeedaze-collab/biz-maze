// src/pages/tax/CryptoTaxCalculator.tsx
// Main crypto tax calculator page with tabs for US/Germany/France

import { useState } from 'react';
import AppPageLayout from '@/components/layout/AppPageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import USTaxForm from '@/components/tax/USTaxForm';
import GermanyTaxForm from '@/components/tax/GermanyTaxForm';
import FranceTaxForm from '@/components/tax/FranceTaxForm';
import { Calculator, FileText } from 'lucide-react';

export default function CryptoTaxCalculator() {
    const { toast } = useToast();
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear() - 1);
    const [selectedMethod, setSelectedMethod] = useState('fifo');
    const [loading, setLoading] = useState(false);

    // Tax data state
    const [usTaxData, setUsTaxData] = useState<any>(null);
    const [germanyTaxData, setGermanyTaxData] = useState<any>(null);
    const [franceTaxData, setFranceTaxData] = useState<any>(null);

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 - i);

    const calculateUSTaxes = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('calculate-crypto-tax-us', {
                body: {
                    tax_year: selectedYear,
                    method: selectedMethod
                }
            });

            if (error) throw error;

            setUsTaxData(data);
            toast({
                title: 'US Tax Calculation Complete',
                description: `Processed ${data.summary?.total_transactions || 0} transactions`
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Calculation Failed',
                description: error.message || 'Failed to calculate US taxes'
            });
        } finally {
            setLoading(false);
        }
    };

    const calculateGermanyTaxes = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('calculate-crypto-tax-germany', {
                body: {
                    tax_year: selectedYear
                }
            });

            if (error) throw error;

            setGermanyTaxData(data);
            toast({
                title: 'Germany Tax Calculation Complete',
                description: `Processed ${data.summary?.total_transactions || 0} transactions`
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Calculation Failed',
                description: error.message || 'Failed to calculate Germany taxes'
            });
        } finally {
            setLoading(false);
        }
    };

    const calculateFranceTaxes = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('calculate-crypto-tax-france', {
                body: {
                    tax_year: selectedYear
                }
            });

            if (error) throw error;

            setFranceTaxData(data);
            toast({
                title: 'France Tax Calculation Complete',
                description: `Total gains: €${data.total_gains?.toFixed(2) || 0}`
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Calculation Failed',
                description: error.message || 'Failed to calculate France taxes'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppPageLayout>
            <div className="container mx-auto max-w-7xl p-6">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Calculator className="h-8 w-8 text-primary" />
                        <h1 className="text-3xl font-bold">Crypto Tax Calculator</h1>
                    </div>
                    <p className="text-muted-foreground">
                        Calculate your cryptocurrency tax obligations for US, Germany, and France
                    </p>
                </div>

                {/* Configuration Card */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Tax Calculation Settings
                        </CardTitle>
                        <CardDescription>
                            Select tax year and calculation method
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="tax-year">Tax Year</Label>
                                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                                    <SelectTrigger id="tax-year">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {years.map(year => (
                                            <SelectItem key={year} value={year.toString()}>
                                                {year}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="method">Cost Basis Method</Label>
                                <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                                    <SelectTrigger id="method">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fifo">FIFO (First In, First Out)</SelectItem>
                                        <SelectItem value="lifo" disabled>LIFO (Coming Soon)</SelectItem>
                                        <SelectItem value="hifo" disabled>HIFO (Coming Soon)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Country Tabs */}
                <Tabs defaultValue="us" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="us">🇺🇸 United States</TabsTrigger>
                        <TabsTrigger value="germany">🇩🇪 Germany</TabsTrigger>
                        <TabsTrigger value="france">🇫🇷 France</TabsTrigger>
                    </TabsList>

                    {/* US Tab */}
                    <TabsContent value="us" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>US Federal Tax (IRS)</CardTitle>
                                <CardDescription>
                                    Capital gains tax calculation using {selectedMethod.toUpperCase()} method for tax year {selectedYear}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    onClick={calculateUSTaxes}
                                    disabled={loading}
                                    size="lg"
                                    className="w-full md:w-auto"
                                >
                                    {loading ? 'Calculating...' : 'Calculate US Taxes'}
                                </Button>
                            </CardContent>
                        </Card>

                        <USTaxForm data={usTaxData} loading={loading} />
                    </TabsContent>

                    {/* Germany Tab */}
                    <TabsContent value="germany" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Germany Tax (Finanzamt)</CardTitle>
                                <CardDescription>
                                    Private disposal income calculation for tax year {selectedYear}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    onClick={calculateGermanyTaxes}
                                    disabled={loading}
                                    size="lg"
                                    className="w-full md:w-auto"
                                >
                                    Calculate Germany Taxes
                                </Button>
                                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                                    <h4 className="font-semibold mb-2">Germany Tax Rules</h4>
                                    <ul className="text-sm space-y-1 text-muted-foreground">
                                        <li>• Held {'>'} 1 year: Tax-free</li>
                                        <li>• Held ≤ 1 year: Taxed as private disposal income</li>
                                        <li>• Annual exemption: €600</li>
                                        <li>• Progressive tax rates: 14-45%</li>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>

                        <GermanyTaxForm data={germanyTaxData} loading={loading} />
                    </TabsContent>

                    {/* France Tab */}
                    <TabsContent value="france" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>France Tax (Impôts)</CardTitle>
                                <CardDescription>
                                    Digital asset gains calculation for tax year {selectedYear}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    onClick={calculateFranceTaxes}
                                    disabled={loading}
                                    size="lg"
                                    className="w-full md:w-auto"
                                >
                                    {loading ? 'Calculating...' : 'Calculate France Taxes'}
                                </Button>
                                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                                    <h4 className="font-semibold mb-2">France Tax Rules</h4>
                                    <ul className="text-sm space-y-1 text-muted-foreground">
                                        <li>• Flat Tax (PFU): 30% (12.8% income + 17.2% social)</li>
                                        <li>• Alternative: Progressive income tax + 17.2% social</li>
                                        <li>• Annual allowance may apply</li>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>

                        <FranceTaxForm data={franceTaxData} loading={loading} />
                    </TabsContent>
                </Tabs>

                {/* Disclaimer */}
                <Card className="mt-6 border-yellow-200 bg-yellow-50/50">
                    <CardContent className="pt-6">
                        <p className="text-sm text-yellow-800">
                            <strong>Disclaimer:</strong> This tool provides estimates for informational purposes only.
                            Tax laws are complex and subject to change. Please consult with a qualified tax professional
                            or certified public accountant (CPA) for accurate tax advice specific to your situation.
                            We are not responsible for any errors or omissions in the calculations.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </AppPageLayout>
    );
}
