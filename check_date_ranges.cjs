
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://ymddtgbsybvxfitgupqy.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZGR0Z2JzeWJ2eGZpdGd1cHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwMjc0MjcsImV4cCI6MjA3MzYwMzQyN30.chcgcQ3Uwpow7PluU-5uvioe1IWIYjCC0QSzdF-T3_g";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDateRange() {
    console.log("--- Checking DB Date Ranges ---");

    // Check Rates
    const { data: rates, error: ratesError } = await supabase
        .from('daily_exchange_rates')
        .select('date')
        .order('date', { ascending: true })
        .limit(1);

    const { data: latestRates, error: latestError } = await supabase
        .from('daily_exchange_rates')
        .select('date')
        .order('date', { descending: true })
        .limit(1);

    if (ratesError) console.error("Rates Error:", ratesError.message);
    else console.log(`Rates Available From: ${rates?.[0]?.date} to ${latestRates?.[0]?.date}`);

    // Check Trades
    const { data: trades, error: tradesError } = await supabase
        .from('exchange_trades')
        .select('ts')
        .order('ts', { ascending: true })
        .limit(1);

    if (tradesError) console.warn("Trades Query (RLS might block):", tradesError.message);
    else console.log(`Earliest Trade in DB: ${trades?.[0]?.ts}`);
}

checkDateRange();
