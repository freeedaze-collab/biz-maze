import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId, taxYear = new Date().getFullYear() } = await req.json();

    if (!userId) {
      throw new Error('User ID is required');
    }

    // Fetch user's transactions for the tax year
    const startDate = new Date(taxYear, 0, 1).toISOString();
    const endDate = new Date(taxYear, 11, 31).toISOString();

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('transaction_status', 'confirmed')
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .order('transaction_date', { ascending: true });

    if (txError) throw txError;

    // Calculate US tax obligations
    const taxCalculation = calculateUSTax(transactions || [], taxYear);

    return new Response(JSON.stringify(taxCalculation), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error calculating US tax:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function calculateUSTax(transactions: any[], taxYear: number) {
  const taxEvents = identifyTaxableEvents(transactions);
  const capitalGains = calculateCapitalGains(taxEvents);
  const ordinaryIncome = calculateOrdinaryIncome(taxEvents);
  
  return {
    taxYear,
    summary: {
      totalTransactions: transactions.length,
      taxableEvents: taxEvents.length,
      shortTermCapitalGains: capitalGains.shortTerm,
      longTermCapitalGains: capitalGains.longTerm,
      ordinaryIncome: ordinaryIncome.total,
      totalTaxableIncome: capitalGains.shortTerm + capitalGains.longTerm + ordinaryIncome.total
    },
    capitalGains: {
      shortTerm: {
        totalGain: capitalGains.shortTerm,
        taxRate: '22-37%', // Ordinary income rates
        events: capitalGains.shortTermEvents
      },
      longTerm: {
        totalGain: capitalGains.longTerm,
        taxRate: '0%, 15%, or 20%', // Based on income level
        events: capitalGains.longTermEvents
      }
    },
    ordinaryIncome: {
      mining: ordinaryIncome.mining,
      staking: ordinaryIncome.staking,
      airdrops: ordinaryIncome.airdrops,
      total: ordinaryIncome.total
    },
    deductions: {
      transactionFees: calculateDeductibleFees(transactions),
      total: calculateDeductibleFees(transactions)
    },
    forms: {
      form8949Required: capitalGains.shortTerm > 0 || capitalGains.longTerm > 0,
      scheduleD: capitalGains.shortTerm > 0 || capitalGains.longTerm > 0,
      schedule1: ordinaryIncome.total > 0
    },
    recommendations: generateTaxRecommendations(capitalGains, ordinaryIncome, transactions)
  };
}

function identifyTaxableEvents(transactions: any[]) {
  return transactions.filter(tx => {
    // Taxable events under US tax law
    return tx.transaction_type === 'send' || 
           tx.transaction_type === 'swap' || 
           tx.transaction_type === 'receive' && isOrdinaryIncomeEvent(tx);
  });
}

function isOrdinaryIncomeEvent(transaction: any) {
  // Mining, staking rewards, airdrops, etc. are ordinary income
  const ordinaryIncomeTypes = ['mining', 'staking', 'airdrop', 'fork'];
  return ordinaryIncomeTypes.some(type => 
    transaction.description?.toLowerCase().includes(type)
  );
}

function calculateCapitalGains(taxEvents: any[]) {
  let shortTerm = 0;
  let longTerm = 0;
  const shortTermEvents = [];
  const longTermEvents = [];
  
  const holdings = new Map(); // FIFO tracking for cost basis
  
  taxEvents.forEach(event => {
    if (event.transaction_type === 'receive' && !isOrdinaryIncomeEvent(event)) {
      // Add to holdings for cost basis tracking
      const key = event.currency;
      if (!holdings.has(key)) holdings.set(key, []);
      holdings.get(key).push({
        amount: parseFloat(event.amount),
        cost: parseFloat(event.usd_value || '0'),
        date: new Date(event.transaction_date)
      });
    } else if (event.transaction_type === 'send' || event.transaction_type === 'swap') {
      // Disposal event - calculate gain/loss
      const key = event.currency;
      if (holdings.has(key) && holdings.get(key).length > 0) {
        const holding = holdings.get(key).shift(); // FIFO
        const salePrice = parseFloat(event.usd_value || '0');
        const costBasis = holding.cost;
        const gain = salePrice - costBasis;
        
        const holdingPeriod = new Date(event.transaction_date).getTime() - holding.date.getTime();
        const isLongTerm = holdingPeriod > (365 * 24 * 60 * 60 * 1000); // > 1 year
        
        const taxEvent = {
          date: event.transaction_date,
          currency: event.currency,
          amount: event.amount,
          salePrice,
          costBasis,
          gain,
          holdingPeriod: Math.floor(holdingPeriod / (24 * 60 * 60 * 1000))
        };
        
        if (isLongTerm) {
          longTerm += gain;
          longTermEvents.push(taxEvent);
        } else {
          shortTerm += gain;
          shortTermEvents.push(taxEvent);
        }
      }
    }
  });
  
  return { shortTerm, longTerm, shortTermEvents, longTermEvents };
}

function calculateOrdinaryIncome(taxEvents: any[]) {
  let mining = 0;
  let staking = 0;
  let airdrops = 0;
  
  taxEvents.forEach(event => {
    if (event.transaction_type === 'receive' && isOrdinaryIncomeEvent(event)) {
      const value = parseFloat(event.usd_value || '0');
      const description = event.description?.toLowerCase() || '';
      
      if (description.includes('mining')) {
        mining += value;
      } else if (description.includes('staking')) {
        staking += value;
      } else if (description.includes('airdrop')) {
        airdrops += value;
      }
    }
  });
  
  return {
    mining,
    staking,
    airdrops,
    total: mining + staking + airdrops
  };
}

function calculateDeductibleFees(transactions: any[]) {
  return transactions.reduce((total, tx) => {
    return total + (parseFloat(tx.gas_fee_usd || '0'));
  }, 0);
}

function generateTaxRecommendations(capitalGains: any, ordinaryIncome: any, transactions: any[]) {
  const recommendations = [];
  
  if (capitalGains.shortTerm > capitalGains.longTerm * 2) {
    recommendations.push("Consider holding crypto assets for over one year to benefit from long-term capital gains rates.");
  }
  
  if (ordinaryIncome.total > 5000) {
    recommendations.push("Significant ordinary income from crypto activities. Consider quarterly estimated tax payments.");
  }
  
  const totalFees = calculateDeductibleFees(transactions);
  if (totalFees > 1000) {
    recommendations.push("Significant transaction fees are deductible. Ensure proper documentation for tax filing.");
  }
  
  if (transactions.length > 100) {
    recommendations.push("Consider using tax software or consulting a tax professional due to high transaction volume.");
  }
  
  recommendations.push("Keep detailed records of all transactions including dates, amounts, and fair market values.");
  recommendations.push("Consider tax-loss harvesting opportunities before year-end.");
  
  return recommendations;
}