
// src/pages/Accounting.tsx
// FINAL VERSION: Correctly transforms normalized data from views into the pivoted format expected by the UI.
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from "../integrations/supabase/client";
import { useAuth } from '../hooks/useAuth';
import AppPageLayout from "@/components/layout/AppPageLayout";

// --- Data Transformation Helper ---
// Transforms an array of { account, balance } rows into a single pivoted object.
const transformData = (data: any[], accountMapping: Record<string, string>) => {
    if (!data) return null;
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

const formatCurrency = (value: number | null | undefined) => {
    const numericValue = value ?? 0;
    return numericValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

interface FinancialCardProps {
    title: string;
    items: { label: string; value: number | null | undefined }[];
    totalLabel: string;
    totalValue: number;
    isLoading: boolean;
}

const FinancialCard: React.FC<FinancialCardProps> = ({ title, items, totalLabel, totalValue, isLoading }) => (
    <div className="surface-card p-6 w-full">
        <h3 className="text-xl font-bold mb-4 text-slate-900">{title}</h3>
        {isLoading ? <p className="text-muted-foreground">Loading...</p> : (
            <div className="font-mono">
                {items.map((item, index) => (
                    <div key={index} className="flex justify-between py-2 border-b border-border/60">
                        <span className="text-slate-600">{item.label}</span>
                        <span className="text-slate-800">{formatCurrency(item.value)}</span>
                    </div>
                ))}
                <div className="flex justify-between py-3 mt-2 font-bold">
                    <span className="text-slate-800">{totalLabel}</span>
                    <span className="text-slate-900">{formatCurrency(totalValue)}</span>
                </div>
            </div>
        )}
    </div>
);

// --- Main Accounting Page Component ---

export default function Accounting() {
    const { user } = useAuth();
    const [plData, setPlData] = useState<any>(null);
    const [bsData, setBsData] = useState<any>(null);
    const [cfData, setCfData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        setError(null);

        try {
            const [plRes, bsRes, cfRes] = await Promise.all([
                supabase.from('v_profit_loss_statement').select('account, balance').eq('user_id', user.id),
                supabase.from('v_balance_sheet').select('account, balance').eq('user_id', user.id),
                supabase.from('v_cash_flow_statement').select('item, amount').eq('user_id', user.id)
            ]);

            if (plRes.error) throw new Error(`Profit & Loss Error: ${plRes.error.message}`);
            if (bsRes.error) throw new Error(`Balance Sheet Error: ${bsRes.error.message}`);
            if (cfRes.error) throw new Error(`Cash Flow Error: ${cfRes.error.message}`);

            const plMapping = {
                'Sales Revenue (IAS 2)': 'sales_revenue',
                'Consideration Revenue (IFRS 15)': 'other_revenue',
                'Cost of Goods Sold (IAS 2)': 'cost_of_sales',
                'Staking & Mining Rewards': 'staking_and_mining_rewards',
                'Unrealized Gains on Intangibles (Revaluation)': 'revaluation_gains',
                'Unrealized Losses on Intangibles (Impairment)': 'impairment_losses',
                'Realized Gains on Intangibles (Sale)': 'realized_gains_on_sale',
                'Gas & Network Fees': 'gas_fees',
                'Loss of Crypto (Unrecoverable)': 'crypto_losses'
            };
            const bsMapping = {
                'Cash & Cash Equivalents': 'cash',
                'Inventory (Trading Crypto)': 'inventory',
                'Intangible Assets (Investing Crypto)': 'intangible_assets',
                'Retained Earnings': 'retained_earnings',
                'Revaluation Surplus': 'revaluation_surplus'
            };
            const cfMapping = {
                'Inflow from Sales (IAS 2 & IFRS 15)': 'cash_in_from_sales',
                'Outflow for Inventory (IAS 2)': 'cash_out_for_inventory',
                'Outflow for Gas Fees': 'cash_out_for_gas_fees',
                'Outflow for Intangible Assets': 'cash_out_for_intangibles',
                'Inflow from Sale of Intangibles': 'cash_in_from_intangibles'
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
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const profitLossItems = [
        { label: "Sales Revenue (IAS 2)", value: plData?.sales_revenue },
        { label: "Consideration Revenue (IFRS 15)", value: plData?.other_revenue },
        { label: "Cost of Goods Sold (IAS 2)", value: plData?.cost_of_sales },
        { label: "Staking & Mining Rewards", value: plData?.staking_and_mining_rewards },
        { label: "Unrealized Gains on Intangibles (Revaluation)", value: plData?.revaluation_gains },
        { label: "Unrealized Losses on Intangibles (Impairment)", value: plData?.impairment_losses },
        { label: "Realized Gains on Intangibles (Sale)", value: plData?.realized_gains_on_sale },
        { label: "Gas & Network Fees", value: plData?.gas_fees },
        { label: "Loss of Crypto (Unrecoverable)", value: plData?.crypto_losses },
    ];
    const netIncome = profitLossItems.reduce((acc, item) => acc + (item.value ?? 0), 0);

    const assetItems = [
        { label: "Cash & Cash Equivalents", value: bsData?.cash },
        { label: "Inventory (Trading Crypto)", value: bsData?.inventory },
        { label: "Intangible Assets (Investing Crypto)", value: bsData?.intangible_assets },
    ];
    const totalAssets = assetItems.reduce((acc, item) => acc + (item.value ?? 0), 0);

    const liabilityEquityItems = [
        { label: "Retained Earnings", value: bsData?.retained_earnings },
        { label: "Revaluation Surplus", value: bsData?.revaluation_surplus },
    ];
    const totalLiabilitiesAndEquity = liabilityEquityItems.reduce((acc, item) => acc + (item.value ?? 0), 0);

    const operatingCfItems = [
        { label: "Inflow from Sales (IAS 2 & IFRS 15)", value: cfData?.cash_in_from_sales },
        { label: "Outflow for Inventory (IAS 2)", value: cfData?.cash_out_for_inventory },
        { label: "Outflow for Gas Fees", value: cfData?.cash_out_for_gas_fees },
    ];
    const investingCfItems = [
        { label: "Outflow for Intangible Assets", value: cfData?.cash_out_for_intangibles },
        { label: "Inflow from Sale of Intangibles", value: cfData?.cash_in_from_intangibles },
    ];
    const financingCfItems: { label: string; value: number | null | undefined }[] = [];

    const totalOperatingCF = operatingCfItems.reduce((acc, item) => acc + (item.value ?? 0), 0);
    const totalInvestingCF = investingCfItems.reduce((acc, item) => acc + (item.value ?? 0), 0);
    const totalFinancingCF = 0;
    const netCashFlow = totalOperatingCF + totalInvestingCF + totalFinancingCF;

    return (
        <AppPageLayout
            title="Financial Statements"
            description="IFRS-aligned reporting for profit & loss, balance sheet, and cash flow—updated from your synced activity."
        >
            <div className="space-y-6">
                <div className="feature-banner">
                    <div className="flex flex-col gap-1">
                        <p className="section-title">Reporting</p>
                        <p className="text-sm text-slate-600">Refresh to capture the latest synced exchanges and wallets.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={fetchData} className="px-4 py-2 bg-primary text-primary-foreground rounded-md shadow-sm hover:shadow-md transition" disabled={isLoading}>
                            {isLoading ? 'Refreshing...' : 'Refresh Data'}
                        </button>
                    </div>
                </div>

                {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg" role="alert">Error: {error}</div>}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    <FinancialCard
                        title="Profit & Loss Statement (P&L)"
                        items={profitLossItems}
                        totalLabel="Net Income / (Loss)"
                        totalValue={netIncome}
                        isLoading={isLoading}
                    />
                    <div className="space-y-6">
                        <FinancialCard
                            title="Balance Sheet (Assets)"
                            items={assetItems}
                            totalLabel="Total Assets"
                            totalValue={totalAssets}
                            isLoading={isLoading}
                        />
                        <FinancialCard
                            title="Balance Sheet (Liabilities & Equity)"
                            items={liabilityEquityItems}
                            totalLabel="Total Liabilities & Equity"
                            totalValue={totalLiabilitiesAndEquity}
                            isLoading={isLoading}
                        />
                    </div>
                    <div className="surface-card p-6 w-full">
                        <h3 className="text-xl font-bold mb-4 text-slate-900">Cash Flow Statement</h3>
                        {isLoading ? <p className="text-muted-foreground">Loading...</p> : (
                             <div className="font-mono space-y-6">
                                <div>
                                    <h4 className="font-semibold text-lg text-slate-700">Operating Activities</h4>
                                    {operatingCfItems.map((item, index) => (
                                        <div key={index} className="flex justify-between py-1 ml-4 border-b border-border/60">
                                            <span className="text-slate-600">{item.label}</span>
                                            <span>{formatCurrency(item.value)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between py-2 ml-4 font-semibold">
                                        <span>Net Cash from Operating Activities</span>
                                        <span>{formatCurrency(totalOperatingCF)}</span>
                                    </div>
                                </div>
                                 <div>
                                    <h4 className="font-semibold text-lg text-slate-700">Investing Activities</h4>
                                    {investingCfItems.map((item, index) => (
                                        <div key={index} className="flex justify-between py-1 ml-4 border-b border-border/60">
                                            <span className="text-slate-600">{item.label}</span>
                                            <span>{formatCurrency(item.value)}</span>
                                        </div>
                                    ))}
                                     <div className="flex justify-between py-2 ml-4 font-semibold">
                                        <span>Net Cash from Investing Activities</span>
                                        <span>{formatCurrency(totalInvestingCF)}</span>
                                    </div>
                                </div>
                                {financingCfItems.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold text-lg text-slate-700">Financing Activities</h4>
                                        {financingCfItems.map((item, index) => (
                                            <div key={index} className="flex justify-between py-1 ml-4 border-b border-border/60">
                                                <span className="text-slate-600">{item.label}</span>
                                                <span>{formatCurrency(item.value)}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between py-2 ml-4 font-semibold">
                                            <span>Net Cash from Financing Activities</span>
                                            <span>{formatCurrency(totalFinancingCF)}</span>
                                        </div>
                                    </div>
                                )}
                                 <div className="flex justify-between pt-4 border-t-2 border-gray-300 dark:border-gray-600 font-bold text-lg">
                                    <span>Net Increase/(Decrease) in Cash</span>
                                    <span>{formatCurrency(netCashFlow)}</span>
                                </div>
                             </div>
                        )}
                    </div>
                </div>
            </div>
        </AppPageLayout>
    );
}
