const { createClient } = require('@supabase/supabase-js');
async function debug() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    // Check for any wallet addresses starting with bc1q or ending with nd44
    const { data, error } = await supabase.from('wallet_connections').select('address, name, chain_id');
    if (error) {
        console.error('Error:', error.message);
        return;
    }
    console.log('--- Wallet Address Debug ---');
    data.forEach(w => {
        console.log(`Address: ${w.address.substring(0, 4)}...${w.address.substring(w.address.length - 4)}, Name: ${w.name}`);
    });
}
debug();
