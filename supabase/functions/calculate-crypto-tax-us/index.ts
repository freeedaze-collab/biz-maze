// supabase/functions/calculate-crypto-tax-us/index.ts
// US crypto tax calculation using FIFO method and IRS rules

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

type TransactionType = 'buy' | 'sell' | 'exchange' | 'transfer' | 'income';

type CryptoTransaction = {
    id: string;
    date: Date;
    type: TransactionType;
    currency: string;
    amount: number;
    price_usd: number;
    fee_usd: number;
    is_income: boolean;
};

type CostBasisLot = {
    date: Date;
    currency: string;
    amount: number;
    remaining: number;
    price_usd: number;
    fee_usd: number;
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

        const { tax_year, method = 'fifo' } = await req.json();

        if (!tax_year) {
            throw new Error('tax_year is required');
        }

        console.log(`Calculating US crypto taxes for user ${user.id}, year ${tax_year}, method ${method}`);

        // Fetch all wallet transactions for the tax year
        const startDate = new Date(tax_year, 0, 1);
        const endDate = new Date(tax_year, 11, 31, 23, 59, 59);

        const { data: walletTxs, error: walletError } = await supabase
            .from('wallet_transactions')
            .select('*')
            .eq('user_id', user.id)
            .gte('timestamp', startDate.toISOString())
            .lte('timestamp', endDate.toISOString())
            .order('timestamp', { ascending: true });

        if (walletError) throw walletError;

        // Fetch all exchange trades for the tax year
        const { data: exchangeTxs, error: exchangeError } = await supabase
            .from('exchange_trades')
            .select('*')
            .eq('user_id', user.id)
            .gte('timestamp', startDate.toISOString())
            .lte('timestamp', endDate.toISOString())
            .order('timestamp', { ascending: true });

        if (exchangeError) throw exchangeError;

        // Combine and normalize transactions
        const allTransactions: CryptoTransaction[] = [];

        // Process wallet transactions
        for (const tx of walletTxs || []) {
            const type: TransactionType =
                tx.transaction_type === 'receive' ? 'buy' :
                    tx.transaction_type === 'send' ? 'sell' :
                        'transfer';

            allTransactions.push({
                id: `wallet_${tx.id}`,
                date: new Date(tx.timestamp),
                type,
                currency: tx.chain?.toUpperCase() || 'ETH',
                amount: parseFloat(tx.amount || '0'),
                price_usd: parseFloat(tx.amount || '0') > 0 ? 0 : 0, // TODO: Get historical price
                fee_usd: parseFloat(tx.gas_used || '0'),
                is_income: false
            });
        }

        // Process exchange trades
        for (const trade of exchangeTxs || []) {
            const [baseCurrency, quoteCurrency] = (trade.symbol || '/').split('/');
            const amount = parseFloat(trade.amount || '0');
            const price = parseFloat(trade.price || '0');
            const fee = parseFloat(trade.fee || '0');

            // Buy transaction (receiving base currency)
            if (trade.side === 'buy') {
                allTransactions.push({
                    id: `exchange_${trade.id}_buy`,
                    date: new Date(trade.timestamp),
                    type: 'buy',
                    currency: baseCurrency,
                    amount: amount,
                    price_usd: price,
                    fee_usd: fee,
                    is_income: false
                });
            } else {
                // Sell transaction (disposing base currency)
                allTransactions.push({
                    id: `exchange_${trade.id}_sell`,
                    date: new Date(trade.timestamp),
                    type: 'sell',
                    currency: baseCurrency,
                    amount: amount,
                    price_usd: price,
                    fee_usd: fee,
                    is_income: false
                });
            }
        }

        // Calculate cost basis using FIFO
        const costBasisLots = new Map<string, CostBasisLot[]>();
        const capitalGainsTransactions: Array<{
            date: string;
            currency: string;
            amount: number;
            cost_basis: number;
            proceeds: number;
            gain_loss: number;
            holding_period_days: number;
            is_long_term: boolean;
        }> = [];

        let totalShortTermGains = 0;
        let totalLongTermGains = 0;
        let incomeTotal = 0;

        // Sort transactions by date
        allTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());

        for (const tx of allTransactions) {
            const currency = tx.currency;

            if (!costBasisLots.has(currency)) {
                costBasisLots.set(currency, []);
            }

            const lots = costBasisLots.get(currency)!;

            if (tx.type === 'buy' || tx.type === 'income') {
                // Add to cost basis lots
                lots.push({
                    date: tx.date,
                    currency: currency,
                    amount: tx.amount,
                    remaining: tx.amount,
                    price_usd: tx.price_usd,
                    fee_usd: tx.fee_usd
                });

                // Income is taxed as ordinary income
                if (tx.is_income) {
                    incomeTotal += tx.amount * tx.price_usd;
                }
            } else if (tx.type === 'sell') {
                // Match with FIFO lots
                let sellRemaining = tx.amount;
                let totalCostBasis = 0;
                let earliestPurchaseDate: Date | null = null;

                for (const lot of lots) {
                    if (sellRemaining <= 0) break;
                    if (lot.remaining <= 0) continue;

                    const amountToUse = Math.min(sellRemaining, lot.remaining);
                    const costBasis = (lot.price_usd * amountToUse) + (lot.fee_usd * (amountToUse / lot.amount));

                    totalCostBasis += costBasis;
                    lot.remaining -= amountToUse;
                    sellRemaining -= amountToUse;

                    if (!earliestPurchaseDate) {
                        earliestPurchaseDate = lot.date;
                    }
                }

                const proceeds = (tx.amount * tx.price_usd) - tx.fee_usd;
                const gainLoss = proceeds - totalCostBasis;
                const holdingPeriodDays = earliestPurchaseDate
                    ? Math.floor((tx.date.getTime() - earliestPurchaseDate.getTime()) / (1000 * 60 * 60 * 24))
                    : 0;
                const isLongTerm = holdingPeriodDays > 365;

                capitalGainsTransactions.push({
                    date: tx.date.toISOString().split('T')[0],
                    currency: currency,
                    amount: tx.amount,
                    cost_basis: totalCostBasis,
                    proceeds: proceeds,
                    gain_loss: gainLoss,
                    holding_period_days: holdingPeriodDays,
                    is_long_term: isLongTerm
                });

                if (isLongTerm) {
                    totalLongTermGains += gainLoss;
                } else {
                    totalShortTermGains += gainLoss;
                }
            }
        }

        const result = {
            ok: true,
            tax_year: tax_year,
            method: method,
            short_term_gains: totalShortTermGains,
            long_term_gains: totalLongTermGains,
            total_capital_gains: totalShortTermGains + totalLongTermGains,
            income_total: incomeTotal,
            transactions: capitalGainsTransactions,
            summary: {
                total_transactions: capitalGainsTransactions.length,
                short_term_count: capitalGainsTransactions.filter(t => !t.is_long_term).length,
                long_term_count: capitalGainsTransactions.filter(t => t.is_long_term).length
            }
        };

        console.log(`Calculated ${capitalGainsTransactions.length} transactions, Short-term: $${totalShortTermGains.toFixed(2)}, Long-term: $${totalLongTermGains.toFixed(2)}`);

        return new Response(
            JSON.stringify(result),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );

    } catch (error: any) {
        console.error('US tax calculation error:', error);
        return new Response(
            JSON.stringify({ ok: false, error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }
});
