
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://yelkjimxejmrkfzeumos.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbGtqaW14ZWptcmtmemV1bW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTgzNjQsImV4cCI6MjA4MTMzNDM2NH0.JO5ZsgYr2OH7sOTJ6cdjDIfLs2Fsi-rlD2atuLcatJs";

const supabase = createClient(supabaseUrl, supabaseKey);

async function getStats() {
    console.log("--- Current Stats ---");

    // Wallets
    const { count: walletCount, error: walletError } = await supabase
        .from('wallet_connections')
        .select('*', { count: 'exact', head: true });

    // Exchanges
    const { count: exchangeCount, error: exchangeError } = await supabase
        .from('exchange_connections')
        .select('*', { count: 'exact', head: true });

    // Unique Assets (Approximate from all_transactions or holdings)
    const { data: assets, error: assetError } = await supabase
        .from('v_holdings')
        .select('asset');

    const uniqueAssets = assets ? [...new Set(assets.map(a => a.asset))] : [];

    console.log(`Wallet Connections: ${walletCount ?? 'Error/RLS'}`);
    console.log(`Exchange Connections: ${exchangeCount ?? 'Error/RLS'}`);
    console.log(`Unique Active Assets: ${uniqueAssets.length}`);

    if (walletError) console.error("Wallet Error:", walletError.message);
    if (exchangeError) console.error("Exchange Error:", exchangeError.message);
    if (assetError) console.error("Asset Error:", assetError.message);
}

getStats();
