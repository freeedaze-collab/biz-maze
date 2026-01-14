const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://yelkjimxejmrkfzeumos.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbGtqaW14ZWptcmtmemV1bW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTgzNjQsImV4cCI6MjA4MTMzNDM2NH0.JO5ZsgYr2OH7sOTJ6cdjDIfLs2Fsi-rlD2atuLcatJs";
const supabase = createClient(supabaseUrl, supabaseKey);

async function probe() {
    console.log('--- Probing Data for Calculation Debugging ---');

    // 1. Wallet Transactions
    const { data: wt, error: wtErr } = await supabase
        .from('wallet_transactions')
        .select('id, amount, asset, value_in_usd, timestamp')
        .limit(3);
    console.log('\nWallet Transactions:', wtErr ? wtErr.message : '');
    if (wt) console.table(wt);

    // 2. Exchange Trades
    const { data: et, error: etErr } = await supabase
        .from('exchange_trades')
        .select('id, amount, symbol, price, value_usd, fee, fee_currency, side')
        .limit(3);
    console.log('\nExchange Trades:', etErr ? etErr.message : '');
    if (et) console.table(et);

    // 3. Daily Exchange Rates
    const { data: rates, error: rateErr } = await supabase
        .from('daily_exchange_rates')
        .select('*')
        .eq('source_currency', 'USD')
        .order('date', { ascending: false })
        .limit(3);
    console.log('\nDaily Exchange Rates (Latest USD items):', rateErr ? rateErr.message : '');
    if (rates) console.table(rates);

    // 4. Asset Prices
    const { data: prices, error: priceErr } = await supabase
        .from('asset_prices')
        .select('*')
        .limit(3);
    console.log('\nAsset Prices:', priceErr ? priceErr.message : '');
    if (prices) console.table(prices);
}

probe();
