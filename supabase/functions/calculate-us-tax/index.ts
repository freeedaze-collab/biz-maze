import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TaxCalculationInput {
  userId: string;
  method: 'FIFO' | 'AVERAGE';
  period: {
    start: string;
    end: string;
  };
}

interface TaxCalculationOutput {
  totalIncome: number;
  totalCapitalGains: number;
  totalCapitalLosses: number;
  netCapitalGains: number;
  estimatedTaxOwed: number;
  effectiveTaxRate: number;
  taxBracket: string;
  calculations: Array<{
    asset: string;
    transactions: number;
    totalGains: number;
    totalLosses: number;
    netGainLoss: number;
    costBasis: number;
    proceeds: number;
  }>;
  transactions: Array<{
    date: string;
    type: string;
    asset: string;
    amount: number;
    usd_value: number;
    gain_loss?: number;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const input: TaxCalculationInput = await req.json();
    const { userId, method = 'FIFO', period } = input;
    
    console.log('Calculating US tax for user:', userId, 'method:', method, 'period:', period);

    // Fetch transactions for the period
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .gte('transaction_date', period.start)
      .lte('transaction_date', period.end)
      .order('transaction_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

    if (!transactions || transactions.length === 0) {
      return new Response(
        JSON.stringify({
          totalIncome: 0,
          totalCapitalGains: 0,
          totalCapitalLosses: 0,
          netCapitalGains: 0,
          estimatedTaxOwed: 0,
          effectiveTaxRate: 0,
          taxBracket: "0%",
          calculations: [],
          transactions: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate tax using specified method
    const taxData = method === 'FIFO' 
      ? calculateTaxFIFO(transactions)
      : calculateTaxAverage(transactions);

    return new Response(
      JSON.stringify(taxData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error calculating US tax:', error);
    
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function calculateTaxFIFO(transactions: any[]): TaxCalculationOutput {
  const assetInventory: { [asset: string]: Array<{ amount: number; costBasis: number; date: string }> } = {};
  const calculations: { [asset: string]: { gains: number; losses: number; transactions: number; costBasis: number; proceeds: number } } = {};
  const processedTransactions: any[] = [];

  let totalGains = 0;
  let totalLosses = 0;

  for (const tx of transactions) {
    const asset = tx.asset_symbol || tx.currency;
    const amount = parseFloat(tx.amount || '0');
    const usdValue = parseFloat(tx.usd_value_at_tx || tx.usd_value || '0');

    if (!calculations[asset]) {
      calculations[asset] = { gains: 0, losses: 0, transactions: 0, costBasis: 0, proceeds: 0 };
      assetInventory[asset] = [];
    }

    calculations[asset].transactions++;

    if (tx.direction === 'in' || tx.transaction_type === 'receive') {
      // Acquisition - add to inventory
      assetInventory[asset].push({
        amount,
        costBasis: usdValue / amount,
        date: tx.transaction_date
      });
      calculations[asset].costBasis += usdValue;

    } else if (tx.direction === 'out' || tx.transaction_type === 'send') {
      // Disposition - calculate gain/loss using FIFO
      let remainingAmount = amount;
      let totalCostBasis = 0;
      
      while (remainingAmount > 0 && assetInventory[asset].length > 0) {
        const oldest = assetInventory[asset][0];
        const usedAmount = Math.min(remainingAmount, oldest.amount);
        
        totalCostBasis += usedAmount * oldest.costBasis;
        
        oldest.amount -= usedAmount;
        remainingAmount -= usedAmount;
        
        if (oldest.amount <= 0) {
          assetInventory[asset].shift();
        }
      }

      const gainLoss = usdValue - totalCostBasis;
      
      if (gainLoss > 0) {
        calculations[asset].gains += gainLoss;
        totalGains += gainLoss;
      } else {
        calculations[asset].losses += Math.abs(gainLoss);
        totalLosses += Math.abs(gainLoss);
      }

      calculations[asset].proceeds += usdValue;

      processedTransactions.push({
        ...tx,
        gain_loss: gainLoss
      });
    }
  }

  const netCapitalGains = totalGains - totalLosses;
  const estimatedTaxOwed = Math.max(0, netCapitalGains * 0.15); // Simplified 15% capital gains rate
  const effectiveTaxRate = netCapitalGains > 0 ? (estimatedTaxOwed / netCapitalGains) * 100 : 0;

  return {
    totalIncome: 0, // Not calculated from crypto transactions
    totalCapitalGains: totalGains,
    totalCapitalLosses: totalLosses,
    netCapitalGains,
    estimatedTaxOwed,
    effectiveTaxRate,
    taxBracket: netCapitalGains > 40000 ? "20%" : "15%",
    calculations: Object.entries(calculations).map(([asset, calc]) => ({
      asset,
      transactions: calc.transactions,
      totalGains: calc.gains,
      totalLosses: calc.losses,
      netGainLoss: calc.gains - calc.losses,
      costBasis: calc.costBasis,
      proceeds: calc.proceeds
    })),
    transactions: processedTransactions.map(tx => ({
      date: tx.transaction_date,
      type: tx.transaction_type || tx.direction,
      asset: tx.asset_symbol || tx.currency,
      amount: parseFloat(tx.amount || '0'),
      usd_value: parseFloat(tx.usd_value_at_tx || tx.usd_value || '0'),
      gain_loss: tx.gain_loss
    }))
  };
}

function calculateTaxAverage(transactions: any[]): TaxCalculationOutput {
  // Simplified average cost method - in production would need more sophisticated calculation
  return calculateTaxFIFO(transactions); // For now, use FIFO as fallback
}