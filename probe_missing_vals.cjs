const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://yelkjimxejmrkfzeumos.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbGtqaW14ZWptcmtmemV1bW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTgzNjQsImV4cCI6MjA4MTMzNDM2NH0.JO5ZsgYr2OH7sOTJ6cdjDIfLs2Fsi-rlD2atuLcatJs";
const supabase = createClient(supabaseUrl, supabaseKey);

async function probe() {
    console.log('--- Probing Missing Currency Values ---');

    // Fetch transactions where value_jpy is null/0 but amount is set
    const { data, error } = await supabase
        .from('all_transactions')
        .select('id, date, asset, amount, value_usd, value_jpy')
        .gt('amount', 0)
        .is('value_jpy', null)
        .limit(10);

    if (error) {
        console.error('Error fetching transactions:', error);
        return;
    }

    console.log(`Found ${data.length} rows with missing/null JPY values.`);

    if (data.length > 0) {
        console.table(data);

        // Pick one asset and date to debug deeper
        const sample = data[0];
        console.log(`\nDebugging Sample: Asset=${sample.asset}, Date=${sample.date}`);

        // Check Asset Price
        const { data: price } = await supabase
            .from('asset_prices')
            .select('*')
            .ilike('asset', sample.asset);
        console.log('Asset Price Entry:', price);

        // Check Exchange Rate for that date
        const dateOnly = sample.date.split('T')[0];
        const { data: rate } = await supabase
            .from('daily_exchange_rates')
            .select('*')
            .eq('target_currency', 'JPY')
            .eq('date', dateOnly);
        console.log(`Exchange Rate for ${dateOnly}:`, rate);

        // Check Latest Rate
        const { data: latest } = await supabase
            .from('daily_exchange_rates')
            .select('*')
            .eq('target_currency', 'JPY')
            .order('date', { ascending: false })
            .limit(1);
        console.log('Latest JPY Rate:', latest);
    }
}

probe();
