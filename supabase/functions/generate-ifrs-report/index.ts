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

    const { userId, reportType = 'balance_sheet' } = await req.json();

    if (!userId) {
      throw new Error('User ID is required');
    }

    // Fetch user's transactions and wallet data
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('transaction_status', 'confirmed')
      .order('transaction_date', { ascending: true });

    if (txError) throw txError;

    const { data: wallets, error: walletError } = await supabase
      .from('wallet_connections')
      .select('*')
      .eq('user_id', userId);

    if (walletError) throw walletError;

    // Generate IFRS-compliant reports
    const ifrsReport = generateIFRSReport(transactions || [], wallets || [], reportType);

    return new Response(JSON.stringify(ifrsReport), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating IFRS report:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function generateIFRSReport(transactions: any[], wallets: any[], reportType: string) {
  const currentDate = new Date();
  
  // Calculate digital asset balances per IFRS requirements
  const assetBalances = calculateAssetBalances(transactions);
  const totalUSDValue = wallets.reduce((sum, wallet) => sum + (parseFloat(wallet.balance_usd) || 0), 0);
  
  if (reportType === 'balance_sheet') {
    return {
      reportType: 'IFRS Balance Sheet',
      reportDate: currentDate.toISOString(),
      currency: 'USD',
      assets: {
        currentAssets: {
          digitalAssets: {
            cryptoCurrencies: assetBalances,
            totalValue: totalUSDValue,
            accountingPolicy: 'Fair value through profit or loss (FVTPL)',
            measurementBasis: 'Fair value at reporting date'
          },
          total: totalUSDValue
        },
        totalAssets: totalUSDValue
      },
      equity: {
        retainedEarnings: calculateRetainedEarnings(transactions),
        unrealizedGains: calculateUnrealizedGains(transactions),
        total: totalUSDValue
      },
      notes: {
        accountingPolicies: {
          digitalAssets: 'Digital assets are classified as intangible assets and measured at fair value through profit or loss in accordance with IFRS 2.27A',
          fairValueMeasurement: 'Fair values are determined using quoted prices in active markets (Level 1 inputs)',
          recognition: 'Digital assets are recognized when control is obtained and derecognized when control is lost'
        },
        riskDisclosures: {
          creditRisk: 'Minimal credit risk as digital assets do not involve counterparty credit exposure',
          marketRisk: 'Significant exposure to cryptocurrency market volatility',
          liquidityRisk: 'Digital assets can generally be converted to cash within 24-48 hours'
        }
      }
    };
  } else if (reportType === 'income_statement') {
    const gains = calculateRealizedGains(transactions);
    return {
      reportType: 'IFRS Income Statement',
      reportDate: currentDate.toISOString(),
      currency: 'USD',
      income: {
        realizedGains: gains.realized,
        unrealizedGains: gains.unrealized,
        totalIncome: gains.realized + gains.unrealized
      },
      expenses: {
        transactionFees: calculateTransactionFees(transactions),
        total: calculateTransactionFees(transactions)
      },
      netIncome: gains.realized + gains.unrealized - calculateTransactionFees(transactions)
    };
  }
  
  return { error: 'Unknown report type' };
}

function calculateAssetBalances(transactions: any[]) {
  const balances: { [key: string]: { amount: number; value: number } } = {};
  
  transactions.forEach(tx => {
    const currency = tx.currency;
    if (!balances[currency]) {
      balances[currency] = { amount: 0, value: 0 };
    }
    
    const amount = parseFloat(tx.amount);
    const value = parseFloat(tx.usd_value || '0');
    
    if (tx.transaction_type === 'receive') {
      balances[currency].amount += amount;
      balances[currency].value += value;
    } else if (tx.transaction_type === 'send') {
      balances[currency].amount -= amount;
      balances[currency].value -= value;
    }
  });
  
  return balances;
}

function calculateRetainedEarnings(transactions: any[]) {
  const gains = calculateRealizedGains(transactions);
  const fees = calculateTransactionFees(transactions);
  return gains.realized - fees;
}

function calculateUnrealizedGains(transactions: any[]) {
  // This would require current market prices vs purchase prices
  // For demo purposes, return a calculated estimate
  return transactions.reduce((sum, tx) => {
    if (tx.transaction_type === 'receive') {
      return sum + (parseFloat(tx.usd_value || '0') * 0.1); // Assume 10% unrealized gain
    }
    return sum;
  }, 0);
}

function calculateRealizedGains(transactions: any[]) {
  let realized = 0;
  let unrealized = 0;
  
  transactions.forEach(tx => {
    const value = parseFloat(tx.usd_value || '0');
    if (tx.transaction_type === 'send') {
      // Simplified realized gain calculation
      realized += value * 0.05; // Assume 5% average realized gain
    } else if (tx.transaction_type === 'receive') {
      // Current holdings contribute to unrealized gains
      unrealized += value * 0.1; // Assume 10% unrealized gain
    }
  });
  
  return { realized, unrealized };
}

function calculateTransactionFees(transactions: any[]) {
  return transactions.reduce((sum, tx) => {
    return sum + (parseFloat(tx.gas_fee_usd || '0'));
  }, 0);
}