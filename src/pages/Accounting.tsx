
// src/pages/Accounting.tsx
// FINAL VERSION: Includes Date Pickers for filtering, data transformation, and Excel/CSV export.
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from "../integrations/supabase/client";
import { useAuth } from '../hooks/useAuth';
import AppPageLayout from "@/components/layout/AppPageLayout";
import { Link } from 'react-router-dom';
import { format } from "date-fns";
import { Calendar as CalendarIcon, Download, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// --- Data Transformation Helper ---
const transformData = (data: any[], accountMapping: Record<string, string>) => {
    if (!data || data.length === 0) return null;
    const transformed = Object.values(accountMapping).reduce((acc, key) => {
        acc[key] = 0;
        return acc;
    }, {} as Record<string, number>);

    data.forEach(item => {
        const key = Object.keys(accountMapping).find(k => k === item.account || k === item.item);
        if (key) {
            transformed[accountMapping[key]] = item.balance ?? item.amount ?? 0;
        }
    });
    return transformed;
};

// --- Helper Functions & Components ---
const formatCurrency = (value: number | null | undefined, currency: string = 'USD') => {
    const numericValue = value ?? 0;
    const locale = currency === 'JPY' ? 'ja-JP' : currency === 'EUR' ? 'de-DE' : currency === 'GBP' ? 'en-GB' : currency === 'INR' ? 'en-IN' : currency === 'SGD' ? 'en-SG' : 'en-US';
    return numericValue.toLocaleString(locale, { style: 'currency', currency: currency });
};

interface FinancialCardProps {
    title: string;
    items: { label: string; value: number | null | undefined }[];
    totalLabel: string;
    totalValue: number;
    isLoading: boolean;
    currency: string;
}

const FinancialCard: React.FC<FinancialCardProps> = ({ title, items, totalLabel, totalValue, isLoading, currency }) => (
    <div className="surface-card p-6 w-full">
        <h3 className="text-xl font-bold mb-4 text-slate-900">{title}</h3>
        {isLoading ? <p className="text-muted-foreground">Loading...</p> : (
            <div className="font-mono">
                {items.map((item, index) => (
                    <div key={index} className="flex justify-between py-2 border-b border-border/60">
                        <span className="text-slate-600">{item.label}</span>
                        <span className="text-slate-800">{formatCurrency(item.value, currency)}</span>
                    </div>
                ))}
                <div className="flex justify-between py-3 mt-2 font-bold">
                    <span className="text-slate-800">{totalLabel}</span>
                    <span className="text-slate-900">{formatCurrency(totalValue, currency)}</span>
                </div>
            </div>
        )}
    </div>
);

const NoDataComponent = () => (
    <div className="surface-card p-6 w-full lg:col-span-3 text-center">
        <h3 className="text-xl font-bold mb-4 text-slate-900">No Accounting Data Found for the Selected Period</h3>
        <p className="text-muted-foreground mb-4">
            Financial statements are generated based on the 'usage' labels assigned to your transactions.
        </p>
        <p className="text-muted-foreground">
            Please go to the <Link to="/transactions" className="text-primary hover:underline">Transaction History</Link> page to classify your recent activity.
        </p>
    </div>
);


// --- Main Accounting Page Component ---
export default function Accounting() {
    const { user } = useAuth();
    const [entities, setEntities] = useState<{ id: string; name: string }[]>([]);
    const [selectedEntityId, setSelectedEntityId] = useState<string>('all');

    // Financial Data State
    const [plData, setPlData] = useState<any>(null);
    const [bsData, setBsData] = useState<any>(null);
    const [cfData, setCfData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    const [selectedCurrency, setSelectedCurrency] = useState('USD');

    useEffect(() => {
        const loadEntities = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from('entities').select('id, name').eq('user_id', user.id).order('is_head_office', { ascending: false });
            if (data) setEntities(data);
        };
        loadEntities();
    }, []);

    const fetchData = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        setError(null);

        try {
            const currencySuffix = selectedCurrency === 'USD' ? '' : `_${selectedCurrency.toLowerCase()}`;
            const balanceCol = `balance${currencySuffix}`;
            const amountCol = `amount${currencySuffix}`;

            let plQuery = supabase.from('v_profit_loss_statement').select(`account, balance: ${balanceCol}, entity_id`).eq('user_id', user.id);
            let bsQuery = supabase.from('v_balance_sheet').select(`account, balance: ${balanceCol}, entity_id`).eq('user_id', user.id);
            let cfQuery = supabase.from('v_cash_flow_statement').select(`item, amount: ${amountCol}, entity_id`).eq('user_id', user.id);

            // Apply Entity Filter
            if (selectedEntityId !== 'all') {
                plQuery = plQuery.eq('entity_id', selectedEntityId);
                bsQuery = bsQuery.eq('entity_id', selectedEntityId);
                cfQuery = cfQuery.eq('entity_id', selectedEntityId);
            }

            // Apply date filters if they exist
            if (startDate) {
                plQuery = plQuery.gte('date', startDate.toISOString());
                cfQuery = cfQuery.gte('date', startDate.toISOString());
            }
            if (endDate) {
                plQuery = plQuery.lte('date', endDate.toISOString());
                bsQuery = bsQuery.lte('date', endDate.toISOString());
                cfQuery = cfQuery.lte('date', endDate.toISOString());
            }

            const [plRes, bsRes, cfRes] = await Promise.all([plQuery, bsQuery, cfQuery]);

            if (plRes.error) throw new Error(`Profit & Loss Error: ${plRes.error.message}`);
            if (bsRes.error) throw new Error(`Balance Sheet Error: ${bsRes.error.message}`);
            if (cfRes.error) throw new Error(`Cash Flow Error: ${cfRes.error.message}`);

            // Mapping from DB account values to internal keys
            const plMapping = {
                'Other Revenue / Sales': 'staking_revenue',
                'Realized Gain (Non-operating)': 'realized_gain',
                'Realized Loss (Non-operating)': 'realized_loss',
                'Fair Value Gain (Non-operating)': 'fair_value_gain',
                'Fair Value Loss (Non-operating)': 'fair_value_loss',
                'Impairment Loss (Extraordinary)': 'impairment_loss',
                'Realized Gain (Deemed)': 'deemed_gain'
            };
            const bsMapping = {
                'Cryptocurrency Assets': 'crypto_assets'
            };
            const cfMapping = {
                'Adj: Fair Value Gain': 'adj_fv_gain',
                'Adj: Fair Value Loss': 'adj_fv_loss',
                'Adj: Impairment Loss': 'adj_impairment',
                'Adj: Sale Profit': 'adj_sale_profit',
                'Adj: Sale Loss': 'adj_sale_loss',
                'Adj: Non-cash Rewards': 'adj_rewards',
                'Adj: Deemed Sale Gain': 'adj_deemed_gain',
                'Acquisition of Crypto Assets': 'investing_acquisition',
                'Proceeds from Sale of Crypto Assets': 'investing_proceeds'
            };

            setPlData(transformData(plRes.data, plMapping));
            setBsData(transformData(bsRes.data, bsMapping));
            setCfData(transformData(cfRes.data, cfMapping));

        } catch (err: any) {
            console.error("Failed to fetch accounting data:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [user, startDate, endDate, selectedCurrency, selectedEntityId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const hasData = plData || bsData || cfData;

    const profitLossItems = [
        { label: "Other Revenue / Sales", value: plData?.staking_revenue },
        { label: "Realized Gain (Non-operating)", value: plData?.realized_gain },
        { label: "Realized Loss (Non-operating)", value: plData?.realized_loss },
        { label: "Fair Value Gain (Non-operating)", value: plData?.fair_value_gain },
        { label: "Fair Value Loss (Non-operating)", value: plData?.fair_value_loss },
        { label: "Impairment Loss (Extraordinary)", value: plData?.impairment_loss },
        { label: "Realized Gain (Deemed)", value: plData?.deemed_gain },
    ];
    const netIncome = profitLossItems.reduce((acc, item) => acc + (item.value ?? 0), 0);

    const assetItems = [
        { label: "Cryptocurrency Assets", value: bsData?.crypto_assets },
    ];
    const totalAssets = assetItems.reduce((acc, item) => acc + (item.value ?? 0), 0);

    const liabilityEquityItems = [
        { label: "Net Income (Retained Earnings)", value: netIncome },
    ];
    const totalLiabilitiesAndEquity = netIncome; // Simple BS for now

    const operatingCfItems = [
        { label: "Net Income (Reconciliation Start)", value: netIncome },
        { label: "Adj: Fair Value Gain", value: cfData?.adj_fv_gain },
        { label: "Adj: Fair Value Loss", value: cfData?.adj_fv_loss },
        { label: "Adj: Impairment Loss", value: cfData?.adj_impairment },
        { label: "Adj: Sale Profit", value: cfData?.adj_sale_profit },
        { label: "Adj: Sale Loss", value: cfData?.adj_sale_loss },
        { label: "Adj: Non-cash Rewards", value: cfData?.adj_rewards },
        { label: "Adj: Deemed Sale Gain", value: cfData?.adj_deemed_gain },
    ];
    const investingCfItems = [
        { label: "Acquisition of Crypto Assets", value: cfData?.investing_acquisition },
        { label: "Proceeds from Sale of Crypto Assets", value: cfData?.investing_proceeds },
    ];
    const financingCfItems: { label: string; value: number | null | undefined }[] = [];

    const totalOperatingCF = operatingCfItems.reduce((acc, item) => acc + (item.value ?? 0), 0);
    const totalInvestingCF = investingCfItems.reduce((acc, item) => acc + (item.value ?? 0), 0);
    const totalFinancingCF = 0;
    const netCashFlow = totalOperatingCF + totalInvestingCF + totalFinancingCF;

    // --- Export Functions ---
    const exportToCSV = () => {
        const rows: string[][] = [];

        // Profit & Loss Sheet
        rows.push(['=== Profit & Loss Statement ===', '', selectedCurrency]);
        rows.push(['Account', 'Amount']);
        profitLossItems.forEach(item => rows.push([item.label, String(item.value ?? 0)]));
        rows.push(['Net Income', String(netIncome)]);
        rows.push(['', '']);

        // Balance Sheet
        rows.push(['=== Balance Sheet ===', '', selectedCurrency]);
        rows.push(['Assets', '']);
        assetItems.forEach(item => rows.push([item.label, String(item.value ?? 0)]));
        rows.push(['Total Assets', String(totalAssets)]);
        rows.push(['', '']);
        rows.push(['Liabilities & Equity', '']);
        liabilityEquityItems.forEach(item => rows.push([item.label, String(item.value ?? 0)]));
        rows.push(['Total Liabilities & Equity', String(totalLiabilitiesAndEquity)]);
        rows.push(['', '']);

        // Cash Flow Statement
        rows.push(['=== Cash Flow Statement ===', '', selectedCurrency]);
        rows.push(['Operating Activities', '']);
        operatingCfItems.forEach(item => rows.push([item.label, String(item.value ?? 0)]));
        rows.push(['Net Operating CF', String(totalOperatingCF)]);
        rows.push(['', '']);
        rows.push(['Investing Activities', '']);
        investingCfItems.forEach(item => rows.push([item.label, String(item.value ?? 0)]));
        rows.push(['Net Investing CF', String(totalInvestingCF)]);
        rows.push(['Net Cash Flow', String(netCashFlow)]);

        const csvContent = rows.map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `financial_statements_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };


    return (
        <AppPageLayout
            title="Financial Statements"
            description="IFRS-aligned reporting for profit & loss, balance sheet, and cash flow—updated from your synced activity."
        >
            <div className="space-y-6">
                <div className="feature-banner">
                    <div className="flex flex-col gap-1">
                        <p className="section-title">Reporting Period & Currency</p>
                        <p className="text-sm text-slate-600">Select reporting currency and date range.</p>
                    </div>
                </div>

                {/* Dashboard Controls */}
                <div className="flex flex-wrap items-center gap-4 mb-8">
                    {/* Entity Selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-600">Entity:</span>
                        <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="All Companies" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All (Consolidated)</SelectItem>
                                {entities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Currency Selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-600">Reporting Currency:</span>
                        <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                            <SelectTrigger className="w-[100px]">
                                <SelectValue placeholder="USD" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="JPY">JPY</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                                <SelectItem value="GBP">GBP</SelectItem>
                                <SelectItem value="INR">INR</SelectItem>
                                <SelectItem value="SGD">SGD</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Date range pickers */}
                    <div className="flex items-center gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-[240px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {startDate ? format(startDate, "PPP") : <span>Pick a start date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-[240px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {endDate ? format(endDate, "PPP") : <span>Pick an end date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <Button onClick={fetchData} variant="secondary" className="px-4" disabled={isLoading}>
                            {isLoading ? 'Refreshing...' : 'Apply Filter'}
                        </Button>
                    </div>

                    {/* Export Button */}
                    <div className="flex items-center gap-2">
                        <Button onClick={exportToCSV} variant="outline" className="px-4" disabled={isLoading || !hasData}>
                            <Download className="mr-2 h-4 w-4" />
                            Export to CSV
                        </Button>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg" role="alert">
                        Error: {error}
                    </div>
                )}

                {!isLoading && !hasData ? (
                    <NoDataComponent />
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Column 1: P&L */}
                        <div className="space-y-8">
                            <FinancialCard
                                title="Profit & Loss Statement"
                                items={profitLossItems}
                                totalLabel="Net Income"
                                totalValue={netIncome}
                                isLoading={isLoading}
                                currency={selectedCurrency}
                            />
                        </div>

                        {/* Column 2: Balance Sheet */}
                        <div className="space-y-8">
                            <FinancialCard
                                title="Balance Sheet: Assets"
                                items={assetItems}
                                totalLabel="Total Assets"
                                totalValue={totalAssets}
                                isLoading={isLoading}
                                currency={selectedCurrency}
                            />
                            <FinancialCard
                                title="Balance Sheet: Liabilities & Equity"
                                items={liabilityEquityItems}
                                totalLabel="Total Liabilities & Equity"
                                totalValue={totalLiabilitiesAndEquity}
                                isLoading={isLoading}
                                currency={selectedCurrency}
                            />
                        </div>

                        {/* Column 3: Cash Flow */}
                        <div className="space-y-8">
                            <div className="surface-card p-6 w-full h-fit">
                                <h3 className="text-xl font-bold mb-4 text-slate-900">Cash Flow Statement</h3>
                                {isLoading ? (
                                    <p className="text-muted-foreground">Loading...</p>
                                ) : (
                                    <div className="font-mono space-y-4">
                                        <div>
                                            <h4 className="font-semibold text-slate-700 mb-2">Operating Activities</h4>
                                            {operatingCfItems.map((item, index) => (
                                                <div key={index} className="flex justify-between py-1 ml-4 border-b border-border/60">
                                                    <span className="text-slate-600 text-sm">{item.label}</span>
                                                    <span className="text-slate-800">{formatCurrency(item.value, selectedCurrency)}</span>
                                                </div>
                                            ))}
                                            <div className="flex justify-between py-2 ml-4 font-bold">
                                                <span>Net Operating CF</span>
                                                <span>{formatCurrency(totalOperatingCF, selectedCurrency)}</span>
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="font-semibold text-slate-700 mb-2">Investing Activities</h4>
                                            {investingCfItems.map((item, index) => (
                                                <div key={index} className="flex justify-between py-1 ml-4 border-b border-border/60">
                                                    <span className="text-slate-600 text-sm">{item.label}</span>
                                                    <span className="text-slate-800">{formatCurrency(item.value, selectedCurrency)}</span>
                                                </div>
                                            ))}
                                            <div className="flex justify-between py-2 ml-4 font-bold">
                                                <span>Net Investing CF</span>
                                                <span>{formatCurrency(totalInvestingCF, selectedCurrency)}</span>
                                            </div>
                                        </div>

                                        <div className="flex justify-between pt-4 border-t-2 border-slate-200 mt-4 font-bold text-lg text-slate-900">
                                            <span>Net Cash Flow</span>
                                            <span>{formatCurrency(netCashFlow, selectedCurrency)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {isLoading && !hasData && (
                    <div className="surface-card p-12 text-center">
                        <p className="text-muted-foreground">Loading financial data...</p>
                    </div>
                )}
            </div>
        </AppPageLayout>
    );
}
