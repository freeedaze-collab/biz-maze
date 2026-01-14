const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://yelkjimxejmrkfzeumos.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbGtqaW14ZWptcmtmemV1bW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTgzNjQsImV4cCI6MjA4MTMzNDM2NH0.JO5ZsgYr2OH7sOTJ6cdjDIfLs2Fsi-rlD2atuLcatJs";
const supabase = createClient(supabaseUrl, supabaseKey);

async function probe() {
    console.log('=== Checking Exchange Rates & Asset Prices ===\n');

    // 1. Check daily_exchange_rates structure
    console.log('--- daily_exchange_rates (sample) ---');
    const { data: rates, error: ratesErr } = await supabase
        .from('daily_exchange_rates')
        .select('*')
        .limit(20);

    if (ratesErr) console.log('Error:', ratesErr.message);
    else console.log(JSON.stringify(rates, null, 2));

    // 2. Check current all_transactions value columns
    console.log('\n--- all_transactions value columns ---');
    const { data: tx, error: txErr } = await supabase
        .from('all_transactions')
        .select('id, asset, value_usd, value_jpy, value_eur')
        .limit(10);

    if (txErr) console.log('Error:', txErr.message);
    else console.log(JSON.stringify(tx, null, 2));

    // 3. Check v_profit_loss_statement
    console.log('\n--- v_profit_loss_statement ---');
    const { data: pnl, error: pnlErr } = await supabase
        .from('v_profit_loss_statement')
        .select('*')
        .limit(5);

    if (pnlErr) console.log('Error:', pnlErr.message);
    else console.log(JSON.stringify(pnl, null, 2));

    // 4. Check v_cash_flow_statement
    console.log('\n--- v_cash_flow_statement ---');
    const { data: cf, error: cfErr } = await supabase
        .from('v_cash_flow_statement')
        .select('*')
        .limit(5);

    if (cfErr) console.log('Error:', cfErr.message);
    else console.log(JSON.stringify(cf, null, 2));
}

probe().catch(console.error);
