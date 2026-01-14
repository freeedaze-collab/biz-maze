const { createClient } = require('@supabase/supabase-js');

// Hardcoded credentials from .env
const supabaseUrl = "https://yelkjimxejmrkfzeumos.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbGtqaW14ZWptcmtmemV1bW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTgzNjQsImV4cCI6MjA4MTMzNDM2NH0.JO5ZsgYr2OH7sOTJ6cdjDIfLs2Fsi-rlD2atuLcatJs";

const supabase = createClient(supabaseUrl, supabaseKey);

async function probe() {
    console.log('--- Probing Exchange Trades ---');

    const { data, error } = await supabase
        .from('exchange_trades')
        .select('*')
        .limit(5);

    if (error) {
        console.error('Error querying exchange_trades:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No trades found.');
        return;
    }

    data.forEach((row, i) => {
        console.log(`\nRow ${i + 1}:`);
        console.log(`  ID: ${row.id}`);
        console.log(`  Symbol: ${row.symbol}`);
        console.log(`  Side: ${row.side}`);
        console.log(`  Amount: ${row.amount}`);
        console.log(`  Price: ${row.price}`);
        console.log(`  Fee: ${row.fee}`);
        console.log(`  Fee Asset: ${row.fee_asset}`);
        console.log(`  Raw: ${JSON.stringify(row.raw_data || {})}`);
    });
}

probe();
