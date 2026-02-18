
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://ymddtgbsybvxfitgupqy.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZGR0Z2JzeWJ2eGZpdGd1cHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwMjc0MjcsImV4cCI6MjA3MzYwMzQyN30.chcgcQ3Uwpow7PluU-5uvioe1IWIYjCC0QSzdF-T3_g";

const supabase = createClient(supabaseUrl, supabaseKey);

async function getStats() {
    console.log("--- Production Stats ---");

    // Wallets (Head count if RLS permits)
    const { count: walletCount, error: walletError } = await supabase
        .from('wallet_connections')
        .select('*', { count: 'exact', head: true });

    // Exchanges
    const { count: exchangeCount, error: exchangeError } = await supabase
        .from('exchange_connections')
        .select('*', { count: 'exact', head: true });

    // Assets from v_holdings
    const { data: assets, error: assetError } = await supabase
        .from('v_holdings')
        .select('asset');

    const uniqueAssets = assets ? [...new Set(assets.map(a => a.asset))] : [];

    console.log(`Wallet Connections: ${walletCount ?? '0 (or RLS Restricted)'}`);
    console.log(`Exchange Connections: ${exchangeCount ?? '0 (or RLS Restricted)'}`);
    console.log(`Unique Active Assets: ${uniqueAssets ? uniqueAssets.length : 0}`);

    if (walletError) console.error("Wallet Error:", walletError.message);
    if (exchangeError) console.error("Exchange Error:", exchangeError.message);
    if (assetError) console.error("Asset Error:", assetError.message);

    // If everything is 0, we can mention that RLS might be active.
}

getStats();
