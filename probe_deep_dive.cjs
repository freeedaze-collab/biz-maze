const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://yelkjimxejmrkfzeumos.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbGtqaW14ZWptcmtmemV1bW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTgzNjQsImV4cCI6MjA4MTMzNDM2NH0.JO5ZsgYr2OH7sOTJ6cdjDIfLs2Fsi-rlD2atuLcatJs";
const supabase = createClient(supabaseUrl, supabaseKey);

async function probe() {
    console.log('=== Deep Dive into View Data ===\n');

    // 1. Check all_transactions sample data
    console.log('--- all_transactions (sample) ---');
    const { data: allTx, error: allTxErr } = await supabase
        .from('all_transactions')
        .select('id, user_id, asset, type, amount, value_usd')
        .limit(10);

    if (allTxErr) console.log('Error:', allTxErr.message);
    else console.log(JSON.stringify(allTx, null, 2));

    // 2. Check v_all_transactions_classified sample
    console.log('\n--- v_all_transactions_classified (sample) ---');
    const { data: classifiedTx, error: classifiedErr } = await supabase
        .from('v_all_transactions_classified')
        .select('id, user_id, asset, type, transaction_type, amount, value_usd')
        .limit(10);

    if (classifiedErr) console.log('Error:', classifiedErr.message);
    else console.log(JSON.stringify(classifiedTx, null, 2));

    // 3. Check asset_prices
    console.log('\n--- asset_prices ---');
    const { data: prices, error: pricesErr } = await supabase
        .from('asset_prices')
        .select('asset, current_price')
        .limit(20);

    if (pricesErr) console.log('Error:', pricesErr.message);
    else console.log(JSON.stringify(prices, null, 2));

    // 4. Check v_holdings (should be 0 but why?)
    console.log('\n--- v_holdings (debug) ---');
    const { data: holdings, error: holdingsErr } = await supabase
        .from('v_holdings')
        .select('*')
        .limit(10);

    if (holdingsErr) console.log('Error:', holdingsErr.message);
    else if (holdings.length === 0) console.log('EMPTY - No holdings found!');
    else console.log(JSON.stringify(holdings, null, 2));

    // 5. Check exchange_trades for data
    console.log('\n--- exchange_trades (sample) ---');
    const { data: trades, error: tradesErr } = await supabase
        .from('exchange_trades')
        .select('id, user_id, symbol, side, amount, price, value_usd')
        .limit(10);

    if (tradesErr) console.log('Error:', tradesErr.message);
    else console.log(JSON.stringify(trades, null, 2));

    // 6. Check internal_transfer_pairs
    console.log('\n--- internal_transfer_pairs ---');
    const { data: pairs, error: pairsErr } = await supabase
        .from('internal_transfer_pairs')
        .select('*')
        .limit(10);

    if (pairsErr) console.log('Error:', pairsErr.message);
    else console.log(JSON.stringify(pairs, null, 2));
}

probe().catch(console.error);
