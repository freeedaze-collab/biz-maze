// supabase/functions/calculate-crypto-tax-france/index.ts
// France crypto tax calculation with flat tax and progressive options

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const EUR_USD_RATE = 1.08; // Mock rate

type CostBasisLot = {
    date: Date;
    currency: string;
    amount: number;
    remaining: number;
    price_eur: number;
    fee_eur: number;
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const authorization = req.headers.get('Authorization');
        if (!authorization) {
            throw new Error('Authorization header is missing');
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data: { user }, error: userError } = await supabase.auth.getUser(
            authorization.replace('Bearer ', '')
        );

        if (userError || !user) {
            throw new Error('User not found');
        }

        const { tax_year } = await req.json();

        if (!tax_year) {
            throw new Error('tax_year is required');
        }

        console.log(`Calculating France crypto taxes for user ${user.id}, year ${tax_year}`);

        const startDate = new Date(tax_year, 0, 1);
        const endDate = new Date(tax_year, 11, 31, 23, 59, 59);

        // Fetch transactions
        const { data: exchangeTxs, error: exchangeError } = await supabase
            .from('exchange_trades')
            .select('*')
            .eq('user_id', user.id)
            .lte('timestamp', endDate.toISOString())
            .order('timestamp', { ascending: true });

        if (exchangeError) throw exchangeError;

        // Process transactions
        const costBasisLots = new Map<string, CostBasisLot[]>();
        let totalGains = 0;

        for (const trade of exchangeTxs || []) {
            const [baseCurrency] = (trade.symbol || '/').split('/');
            const amount = parseFloat(trade.amount || '0');
            const priceUSD = parseFloat(trade.price || '0');
            const priceEUR = priceUSD / EUR_USD_RATE;
            const fee = parseFloat(trade.fee || '0') / EUR_USD_RATE;
            const txDate = new Date(trade.timestamp);

            if (!costBasisLots.has(baseCurrency)) {
                costBasisLots.set(baseCurrency, []);
            }
            const lots = costBasisLots.get(baseCurrency)!;

            if (trade.side === 'buy') {
                lots.push({
                    date: txDate,
                    currency: baseCurrency,
                    amount: amount,
                    remaining: amount,
                    price_eur: priceEUR,
                    fee_eur: fee
                });
            } else if (trade.side === 'sell' && txDate >= startDate && txDate <= endDate) {
                let sellRemaining = amount;
                let totalCostBasis = 0;

                for (const lot of lots) {
                    if (sellRemaining <= 0) break;
                    if (lot.remaining <= 0) continue;

                    const amountToUse = Math.min(sellRemaining, lot.remaining);
                    const costBasis = (lot.price_eur * amountToUse) + (lot.fee_eur * (amountToUse / lot.amount));

                    totalCostBasis += costBasis;
                    lot.remaining -= amountToUse;
                    sellRemaining -= amountToUse;
                }

                const proceeds = (amount * priceEUR) - fee;
                const gainLoss = proceeds - totalCostBasis;
                totalGains += gainLoss;
            }
        }

        // France tax calculation
        const FLAT_TAX_RATE = 0.30; // 30% (12.8% income + 17.2% social)
        const INCOME_TAX_RATE = 0.128; // Income portion only
        const SOCIAL_TAX_RATE = 0.172; // Social contributions (mandatory)

        // Flat tax option (PFU - Prélèvement Forfaitaire Unique)
        const flatTaxAmount = totalGains * FLAT_TAX_RATE;

        // Progressive tax option (simplified estimate - actual depends on income bracket)
        // Assuming 30% marginal rate for this estimate
        const progressiveTaxRate = 0.30;
        const progressiveIncomeTax = totalGains * progressiveTaxRate;
        const progressiveSocialTax = totalGains * SOCIAL_TAX_RATE;
        const progressiveTotalTax = progressiveIncomeTax + progressiveSocialTax;

        // Recommend the lower option
        const recommendedMethod = flatTaxAmount <= progressiveTotalTax ? 'flat' : 'progressive';

        const result = {
            ok: true,
            tax_year: tax_year,
            currency: 'EUR',
            total_gains: totalGains,
            flat_tax: {
                rate: FLAT_TAX_RATE,
                amount: flatTaxAmount,
                breakdown: {
                    income_tax: totalGains * INCOME_TAX_RATE,
                    social_tax: totalGains * SOCIAL_TAX_RATE
                }
            },
            progressive_tax: {
                estimated_rate: progressiveTaxRate,
                income_tax: progressiveIncomeTax,
                social_tax: progressiveSocialTax,
                total: progressiveTotalTax
            },
            recommended_method: recommendedMethod,
            savings_with_recommended: Math.abs(flatTaxAmount - progressiveTotalTax)
        };

        console.log(`France tax calculated: Total gains €${totalGains.toFixed(2)}, Flat tax €${flatTaxAmount.toFixed(2)}`);

        return new Response(
            JSON.stringify(result),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );

    } catch (error: any) {
        console.error('France tax calculation error:', error);
        return new Response(
            JSON.stringify({ ok: false, error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }
});
