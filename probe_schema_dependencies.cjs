const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://yelkjimxejmrkfzeumos.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbGtqaW14ZWptcmtmemV1bW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTgzNjQsImV4cCI6MjA4MTMzNDM2NH0.JO5ZsgYr2OH7sOTJ6cdjDIfLs2Fsi-rlD2atuLcatJs";
const supabase = createClient(supabaseUrl, supabaseKey);

async function probe() {
    console.log('--- Probing Schema Dependencies for Chain Data ---');

    // 1. Check wallet_connections 'chain' values
    const { data: wc, error: wcAcc } = await supabase
        .from('wallet_connections')
        .select('chain')
        .limit(10);

    if (wcAcc) console.error('Error fetching wallet_connections:', wcAcc);
    else {
        const distinctChains = [...new Set(wc.map(r => r.chain))];
        console.log('Existing chains in wallet_connections:', distinctChains);
    }

    // 2. Check wallet_transactions 'chain' and 'chain_id' values
    const { data: wt, error: wtAcc } = await supabase
        .from('wallet_transactions')
        .select('chain, chain_id')
        .limit(10);

    if (wtAcc) console.error('Error fetching wallet_transactions:', wtAcc);
    else {
        console.log('Sample wallet_transactions data:');
        console.table(wt);
    }
}

probe();
