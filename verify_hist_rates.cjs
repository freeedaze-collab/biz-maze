
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://ymddtgbsybvxfitgupqy.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZGR0Z2JzeWJ2eGZpdGd1cHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwMjc0MjcsImV4cCI6MjA3MzYwMzQyN30.chcgcQ3Uwpow7PluU-5uvioe1IWIYjCC0QSzdF-T3_g";

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyRates() {
    console.log("--- Verifying Historical Rates ---");

    // Fetch a few transactions with different dates
    const { data, error } = await supabase
        .from('all_transactions')
        .select('date, asset, amount, value_usd, value_jpy')
        .order('date', { ascending: true })
        .limit(10);

    if (error) {
        console.error("Error:", error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No transactions found.");
        return;
    }

    data.forEach(tx => {
        const rate = tx.value_usd ? (tx.value_jpy / tx.value_usd).toFixed(2) : 'N/A';
        console.log(`${tx.date} | ${tx.asset} | USD: ${tx.value_usd.toFixed(2)} | JPY: ${tx.value_jpy.toFixed(2)} | Implied Rate: ${rate}`);
    });
}

verifyRates();
