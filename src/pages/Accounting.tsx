import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../hooks/useAuth';
import AppLayout from '@/components/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

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
  <div className="card-elevated p-6">
    <h3 className="text-lg font-semibold text-foreground mb-4">{title}</h3>
    {isLoading ? (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 bg-muted rounded" />
        ))}
      </div>
    ) : (
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex justify-between py-2 border-b border-border">
            <span className="text-sm text-muted-foreground">{item.label}</span>
            <span className="text-sm font-mono text-foreground">{formatCurrency(item.value)}</span>
          </div>
        ))}
        <div className="flex justify-between py-3 mt-2 font-semibold">
          <span className="text-foreground">{totalLabel}</span>
          <span className="font-mono text-foreground">{formatCurrency(totalValue)}</span>
        </div>
      </div>
    )}
  </div>
);

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
        supabase.from('v_profit_loss_statement').select('*').eq('user_id', user.id).single(),
        supabase.from('v_balance_sheet').select('*').eq('user_id', user.id).single(),
        supabase.from('v_cash_flow_statement').select('*').eq('user_id', user.id).single()
      ]);

      if (plRes.error && plRes.error.code !== 'PGRST116') throw new Error(`Profit & Loss Error: ${plRes.error.message}`);
      if (bsRes.error && bsRes.error.code !== 'PGRST116') throw new Error(`Balance Sheet Error: ${bsRes.error.message}`);
      if (cfRes.error && cfRes.error.code !== 'PGRST116') throw new Error(`Cash Flow Error: ${cfRes.error.message}`);

      setPlData(plRes.data);
      setBsData(bsRes.data);
      setCfData(cfRes.data);
    } catch (err: any) {
      console.error('Failed to fetch accounting data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const profitLossItems = [
    { label: 'Sales Revenue (IAS 2)', value: plData?.sales_revenue },
    { label: 'Consideration Revenue (IFRS 15)', value: plData?.other_revenue },
    { label: 'Cost of Goods Sold (IAS 2)', value: plData?.cost_of_sales },
    { label: 'Staking & Mining Rewards', value: plData?.staking_and_mining_rewards },
    { label: 'Unrealized Gains on Intangibles', value: plData?.revaluation_gains },
    { label: 'Unrealized Losses on Intangibles', value: plData?.impairment_losses },
    { label: 'Realized Gains on Intangibles', value: plData?.realized_gains_on_sale },
    { label: 'Gas & Network Fees', value: plData?.gas_fees },
    { label: 'Loss of Crypto (Unrecoverable)', value: plData?.crypto_losses },
  ];
  const netIncome = plData?.net_income ?? 0;

  const assetItems = [
    { label: 'Cash & Cash Equivalents', value: bsData?.cash },
    { label: 'Inventory (Trading Crypto)', value: bsData?.inventory },
    { label: 'Intangible Assets (Investing Crypto)', value: bsData?.intangible_assets },
  ];
  const totalAssets = bsData?.total_assets ?? 0;

  const liabilityEquityItems = [
    { label: 'Retained Earnings', value: bsData?.retained_earnings },
  ];
  const totalLiabilitiesAndEquity = bsData?.total_liabilities_and_equity ?? 0;

  const operatingCfItems = [
    { label: 'Inflow from Sales (IAS 2 & IFRS 15)', value: (cfData?.cash_in_from_inventory_sales ?? 0) + (cfData?.cash_in_from_revenue ?? 0) },
    { label: 'Outflow for Inventory (IAS 2)', value: cfData?.cash_out_for_inventory },
    { label: 'Outflow for Gas Fees', value: cfData?.cash_out_for_gas_fees },
  ];
  const investingCfItems = [
    { label: 'Outflow for Intangible Assets', value: cfData?.cash_out_for_intangibles },
    { label: 'Inflow from Sale of Intangibles', value: cfData?.cash_in_from_intangibles },
  ];

  const totalOperatingCF = (cfData?.cash_in_from_inventory_sales ?? 0) + (cfData?.cash_in_from_revenue ?? 0) + (cfData?.cash_out_for_inventory ?? 0) + (cfData?.cash_out_for_gas_fees ?? 0);
  const totalInvestingCF = (cfData?.cash_out_for_intangibles ?? 0) + (cfData?.cash_in_from_intangibles ?? 0);
  const netCashFlow = totalOperatingCF + totalInvestingCF;

  return (
    <AppLayout>
      <div className="content-container">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Financial Statements</h1>
            <p className="text-muted-foreground mt-1">Overview of your financial performance based on IFRS standards.</p>
          </div>
          <Button onClick={fetchData} disabled={isLoading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Refreshing...' : 'Refresh Data'}
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            Error: {error}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* P&L Card */}
          <FinancialCard
            title="Profit & Loss Statement (P&L)"
            items={profitLossItems}
            totalLabel="Net Income / (Loss)"
            totalValue={netIncome}
            isLoading={isLoading}
          />

          {/* Balance Sheet */}
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

          {/* Cash Flow */}
          <div className="card-elevated p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Cash Flow Statement</h3>
            {isLoading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-8 bg-muted rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Operating */}
                <div>
                  <h4 className="font-medium text-foreground mb-2">Operating Activities</h4>
                  {operatingCfItems.map((item, index) => (
                    <div key={index} className="flex justify-between py-1.5 text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-mono text-foreground">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 font-medium border-t border-border mt-2">
                    <span className="text-foreground text-sm">Net Cash from Operating</span>
                    <span className="font-mono text-foreground text-sm">{formatCurrency(totalOperatingCF)}</span>
                  </div>
                </div>

                {/* Investing */}
                <div>
                  <h4 className="font-medium text-foreground mb-2">Investing Activities</h4>
                  {investingCfItems.map((item, index) => (
                    <div key={index} className="flex justify-between py-1.5 text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-mono text-foreground">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 font-medium border-t border-border mt-2">
                    <span className="text-foreground text-sm">Net Cash from Investing</span>
                    <span className="font-mono text-foreground text-sm">{formatCurrency(totalInvestingCF)}</span>
                  </div>
                </div>

                {/* Net Change */}
                <div className="flex justify-between pt-4 border-t-2 border-border font-semibold">
                  <span className="text-foreground">Net Increase/(Decrease)</span>
                  <span className="font-mono text-foreground">{formatCurrency(netCashFlow)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
