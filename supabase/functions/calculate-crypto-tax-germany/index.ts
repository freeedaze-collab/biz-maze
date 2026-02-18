// supabase/functions/calculate-crypto-tax-germany/index.ts
// Germany crypto tax calculation with 1-year holding exemption

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const EUR_USD_RATE = 1.08; // Mock rate - should fetch from historical_exchange_rates

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

        console.log(`Calculating Germany crypto taxes for user ${user.id}, year ${tax_year}`);

        const startDate = new Date(tax_year, 0, 1);
        const endDate = new Date(tax_year, 11, 31, 23, 59, 59);

        // Fetch transactions
        const { data: walletTxs, error: walletError } = await supabase
            .from('wallet_transactions')
            .select('*')
            .eq('user_id', user.id)
            .lte('timestamp', endDate.toISOString())
            .order('timestamp', { ascending: true });

        if (walletError) throw walletError;

        const { data: exchangeTxs, error: exchangeError } = await supabase
            .from('exchange_trades')
            .select('*')
            .eq('user_id', user.id)
            .lte('timestamp', endDate.toISOString())
            .order('timestamp', { ascending: true });

        if (exchangeError) throw exchangeError;

        // Process transactions
        const costBasisLots = new Map<string, CostBasisLot[]>();
        const transactions: Array<{
            date: string;
            currency: string;
            amount: number;
            cost_basis: number;
            proceeds: number;
            gain_loss: number;
            holding_period_days: number;
            is_tax_free: boolean;
        }> = [];

        let totalTaxableGains = 0;
        let totalTaxFreeGains = 0;

        // Process exchange trades
        for (const trade of exchangeTxs || []) {
            const [baseCurrency, quoteCurrency] = (trade.symbol || '/').split('/');
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
                // Add to cost basis
                lots.push({
                    date: txDate,
                    currency: baseCurrency,
                    amount: amount,
                    remaining: amount,
                    price_eur: priceEUR,
                    fee_eur: fee
                });
            } else if (trade.side === 'sell') {
                // Only process sales in the tax year
                if (txDate >= startDate && txDate <= endDate) {
                    let sellRemaining = amount;
                    let totalCostBasis = 0;
                    let earliestPurchaseDate: Date | null = null;

                    for (const lot of lots) {
                        if (sellRemaining <= 0) break;
                        if (lot.remaining <= 0) continue;

                        const amountToUse = Math.min(sellRemaining, lot.remaining);
                        const costBasis = (lot.price_eur * amountToUse) + (lot.fee_eur * (amountToUse / lot.amount));

                        totalCostBasis += costBasis;
                        lot.remaining -= amountToUse;
                        sellRemaining -= amountToUse;

                        if (!earliestPurchaseDate) {
                            earliestPurchaseDate = lot.date;
                        }
                    }

                    const proceeds = (amount * priceEUR) - fee;
                    const gainLoss = proceeds - totalCostBasis;
                    const holdingPeriodDays = earliestPurchaseDate
                        ? Math.floor((txDate.getTime() - earliestPurchaseDate.getTime()) / (1000 * 60 * 60 * 24))
                        : 0;

                    // Germany: Tax-free if held > 1 year (365 days)
                    const isTaxFree = holdingPeriodDays > 365;

                    transactions.push({
                        date: txDate.toISOString().split('T')[0],
                        currency: baseCurrency,
                        amount: amount,
                        cost_basis: totalCostBasis,
                        proceeds: proceeds,
                        gain_loss: gainLoss,
                        holding_period_days: holdingPeriodDays,
                        is_tax_free: isTaxFree
                    });

                    if (isTaxFree) {
                        totalTaxFreeGains += gainLoss;
                    } else {
                        totalTaxableGains += gainLoss;
                    }
                }
            }
        }

        // Apply €600 exemption (Freigrenze)
        const EXEMPTION_LIMIT = 600;
        let exemptionUsed = 0;
        let finalTaxableIncome = 0;

        if (totalTaxableGains > 0 && totalTaxableGains <= EXEMPTION_LIMIT) {
            // Fully exempt
            exemptionUsed = totalTaxableGains;
            finalTaxableIncome = 0;
        } else if (totalTaxableGains > EXEMPTION_LIMIT) {
            // No exemption (all or nothing rule)
            exemptionUsed = 0;
            finalTaxableIncome = totalTaxableGains;
        } else {
            // Negative gains - no exemption needed
            finalTaxableIncome = totalTaxableGains;
        }

        const result = {
            ok: true,
            tax_year: tax_year,
            currency: 'EUR',
            taxable_gains: totalTaxableGains,
            tax_free_gains: totalTaxFreeGains,
            exemption_limit: EXEMPTION_LIMIT,
            exemption_used: exemptionUsed,
            final_taxable_income: finalTaxableIncome,
            transactions: transactions,
            summary: {
                total_transactions: transactions.length,
                taxable_count: transactions.filter(t => !t.is_tax_free).length,
                tax_free_count: transactions.filter(t => t.is_tax_free).length
            }
        };

        console.log(`Germany tax calculated: Taxable €${totalTaxableGains.toFixed(2)}, Tax-free €${totalTaxFreeGains.toFixed(2)}`);

        return new Response(
            JSON.stringify(result),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );

    } catch (error: any) {
        console.error('Germany tax calculation error:', error);
        return new Response(
            JSON.stringify({ ok: false, error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }
});
