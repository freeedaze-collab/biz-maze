
// src/pages/Accounting.tsx
// FINAL VERSION: Dynamic financial statements based on entity company_type (IAS 2 vs IAS 38).
// Includes Date Pickers for filtering, data transformation, and Excel/CSV export.
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../hooks/useAuth";
import AppPageLayout from '@/components/layout/AppPageLayout';
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarIcon, Download, Shield, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// --- Helper Functions & Components ---
function formatCurrency(value: number | null | undefined, currency: string = 'USD') {
    if (value === null || value === undefined) return '-';
    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, minimumFractionDigits: 2 });
    return formatter.format(value);
}

interface FinancialCardProps {
    title: string;
    items: { label: string; value: number }[];
    totalLabel: string;
    totalValue: number;
    isLoading: boolean;
    currency: string;
}

function FinancialCard({ title, items, totalLabel, totalValue, isLoading, currency }: FinancialCardProps) {
    return (
        <div className="surface-card p-6 w-full h-fit">
            <h3 className="text-xl font-bold mb-4 text-slate-900">{title}</h3>
            {isLoading ? (
                <p className="text-muted-foreground">Loading...</p>
            ) : (
                <div className="font-mono">
                    {items.filter(i => i.value !== 0).map((item, index) => (
                        <div key={index} className="flex justify-between py-1 border-b border-border/60">
                            <span className="text-slate-600 text-sm">{item.label}</span>
                            <span className={cn("text-slate-800", item.value < 0 && "text-red-600")}>{formatCurrency(item.value, currency)}</span>
                        </div>
                    ))}
                    <div className="flex justify-between items-center py-3 mt-2 border-t-2 border-slate-200 font-bold text-lg text-slate-900">
                        <span>{totalLabel}</span>
                        <span className={cn(totalValue < 0 && "text-red-600")}>{formatCurrency(totalValue, currency)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

function NoDataComponent() {
    return (
        <div className="surface-card p-12 text-center space-y-3">
            <h3 className="text-lg font-medium text-slate-700">No Data Available</h3>
            <p className="text-sm text-muted-foreground">
                Sync your wallets and exchanges to generate financial statements.
            </p>
        </div>
    );
}

// --- Main Accounting Page Component ---
export default function Accounting() {
    const { user } = useAuth();
    const [entities, setEntities] = useState<{ id: string; name: string; company_type: string }[]>([]);
    const [selectedEntityId, setSelectedEntityId] = useState<string>('all');

    // Financial Data State
    const [plItems, setPlItems] = useState<{ label: string; value: number }[]>([]);
    const [bsItems, setBsItems] = useState<{ label: string; value: number }[]>([]);
    const [cfItems, setCfItems] = useState<{ label: string; value: number }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    const [selectedCurrency, setSelectedCurrency] = useState('USD');

    // Determine the company_type of the selected entity
    const selectedEntity = entities.find(e => e.id === selectedEntityId);
    const companyType = selectedEntityId === 'all' ? 'mixed' : (selectedEntity?.company_type || 'ordinary');

    useEffect(() => {
        const loadEntities = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from('entities').select('id, name, company_type').eq('user_id', user.id).order('is_head_office', { ascending: false });
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

            // Dynamically aggregate by account name — the view already returns
            // the correct labels based on company_type
            const aggregateByKey = (data: any[], keyField: string, valueField: string) => {
                const map = new Map<string, number>();
                for (const row of data || []) {
                    const key = row[keyField];
                    if (!key) continue;
                    map.set(key, (map.get(key) || 0) + (row[valueField] || 0));
                }
                return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
            };

            setPlItems(aggregateByKey(plRes.data, 'account', 'balance'));
            setBsItems(aggregateByKey(bsRes.data, 'account', 'balance'));
            setCfItems(aggregateByKey(cfRes.data, 'item', 'amount'));

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

    const hasData = plItems.length > 0 || bsItems.length > 0 || cfItems.length > 0;

    const netIncome = plItems.reduce((acc, item) => acc + item.value, 0);
    const totalAssets = bsItems.reduce((acc, item) => acc + item.value, 0);
    const liabilityEquityItems = [{ label: "Net Income (Retained Earnings)", value: netIncome }];
    const totalLiabilitiesAndEquity = netIncome;

    // Separate CF items into operating and investing
    const operatingCfItems = cfItems.filter(i => i.label.startsWith('Operating:'));
    const investingCfItems = cfItems.filter(i => i.label.startsWith('Investing:'));
    const otherCfItems = cfItems.filter(i => !i.label.startsWith('Operating:') && !i.label.startsWith('Investing:'));

    // Strip prefix for display
    const stripPrefix = (items: { label: string; value: number }[]) =>
        items.map(i => ({ ...i, label: i.label.replace(/^(Operating|Investing): /, '') }));

    const totalOperatingCF = operatingCfItems.reduce((acc, item) => acc + item.value, 0);
    const totalInvestingCF = investingCfItems.reduce((acc, item) => acc + item.value, 0);
    const totalOtherCF = otherCfItems.reduce((acc, item) => acc + item.value, 0);
    const netCashFlow = totalOperatingCF + totalInvestingCF + totalOtherCF;

    // --- Export Functions ---
    const exportToCSV = () => {
        const rows: string[][] = [];

        rows.push(['=== Profit & Loss Statement ===', '', selectedCurrency]);
        rows.push(['Account', 'Amount']);
        plItems.forEach(item => rows.push([item.label, String(item.value)]));
        rows.push(['Net Income', String(netIncome)]);
        rows.push(['', '']);

        rows.push(['=== Balance Sheet ===', '', selectedCurrency]);
        rows.push(['Assets', '']);
        bsItems.forEach(item => rows.push([item.label, String(item.value)]));
        rows.push(['Total Assets', String(totalAssets)]);
        rows.push(['', '']);
        rows.push(['Liabilities & Equity', '']);
        liabilityEquityItems.forEach(item => rows.push([item.label, String(item.value)]));
        rows.push(['Total Liabilities & Equity', String(totalLiabilitiesAndEquity)]);
        rows.push(['', '']);

        rows.push(['=== Cash Flow Statement ===', '', selectedCurrency]);
        rows.push(['Operating Activities', '']);
        stripPrefix(operatingCfItems).forEach(item => rows.push([item.label, String(item.value)]));
        rows.push(['Net Operating CF', String(totalOperatingCF)]);
        rows.push(['', '']);
        rows.push(['Investing Activities', '']);
        stripPrefix(investingCfItems).forEach(item => rows.push([item.label, String(item.value)]));
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
                            <SelectTrigger className="w-[220px]">
                                <SelectValue placeholder="All Companies" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All (Consolidated)</SelectItem>
                                {entities.map(e => (
                                    <SelectItem key={e.id} value={e.id}>
                                        <span className="flex items-center gap-2">
                                            {e.name}
                                            {e.company_type === 'crypto' && (
                                                <Badge variant="secondary" className="text-xs ml-1">IAS 2</Badge>
                                            )}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Company Type Badge */}
                    {selectedEntityId !== 'all' && (
                        <div className="flex items-center gap-1.5">
                            {companyType === 'crypto' ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                    Crypto Enterprise (IAS 2)
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    <Shield className="h-3 w-3 mr-1" />
                                    Ordinary Enterprise (IAS 38)
                                </Badge>
                            )}
                        </div>
                    )}

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
                                title={companyType === 'crypto' ? "Profit & Loss (IAS 2 — Trading)" : "Profit & Loss Statement"}
                                items={plItems}
                                totalLabel="Net Income"
                                totalValue={netIncome}
                                isLoading={isLoading}
                                currency={selectedCurrency}
                            />
                        </div>

                        {/* Column 2: Balance Sheet */}
                        <div className="space-y-8">
                            <FinancialCard
                                title={companyType === 'crypto' ? "Balance Sheet (Inventory Model)" : "Balance Sheet: Assets"}
                                items={bsItems}
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
                                <h3 className="text-xl font-bold mb-4 text-slate-900">
                                    {companyType === 'crypto' ? "Cash Flow (Operating — Trading)" : "Cash Flow Statement"}
                                </h3>
                                {isLoading ? (
                                    <p className="text-muted-foreground">Loading...</p>
                                ) : (
                                    <div className="font-mono space-y-4">
                                        {operatingCfItems.length > 0 && (
                                            <div>
                                                <h4 className="font-semibold text-slate-700 mb-2">Operating Activities</h4>
                                                {stripPrefix(operatingCfItems).map((item, index) => (
                                                    <div key={index} className="flex justify-between py-1 ml-4 border-b border-border/60">
                                                        <span className="text-slate-600 text-sm">{item.label}</span>
                                                        <span className={cn("text-slate-800", item.value < 0 && "text-red-600")}>{formatCurrency(item.value, selectedCurrency)}</span>
                                                    </div>
                                                ))}
                                                <div className="flex justify-between py-2 ml-4 font-bold">
                                                    <span>Net Operating CF</span>
                                                    <span>{formatCurrency(totalOperatingCF, selectedCurrency)}</span>
                                                </div>
                                            </div>
                                        )}

                                        {investingCfItems.length > 0 && (
                                            <div>
                                                <h4 className="font-semibold text-slate-700 mb-2">Investing Activities</h4>
                                                {stripPrefix(investingCfItems).map((item, index) => (
                                                    <div key={index} className="flex justify-between py-1 ml-4 border-b border-border/60">
                                                        <span className="text-slate-600 text-sm">{item.label}</span>
                                                        <span className={cn("text-slate-800", item.value < 0 && "text-red-600")}>{formatCurrency(item.value, selectedCurrency)}</span>
                                                    </div>
                                                ))}
                                                <div className="flex justify-between py-2 ml-4 font-bold">
                                                    <span>Net Investing CF</span>
                                                    <span>{formatCurrency(totalInvestingCF, selectedCurrency)}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Legacy/other items that don't have prefix */}
                                        {otherCfItems.length > 0 && (
                                            <div>
                                                <h4 className="font-semibold text-slate-700 mb-2">Other / Legacy</h4>
                                                {otherCfItems.map((item, index) => (
                                                    <div key={index} className="flex justify-between py-1 ml-4 border-b border-border/60">
                                                        <span className="text-slate-600 text-sm">{item.label}</span>
                                                        <span className={cn("text-slate-800", item.value < 0 && "text-red-600")}>{formatCurrency(item.value, selectedCurrency)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

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
