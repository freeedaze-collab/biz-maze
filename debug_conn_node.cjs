const { createClient } = require('@supabase/supabase-js');
async function debug() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.from('exchange_connections').select('*').eq('id', 3).single();
    if (error) {
        console.error('Error:', error.message);
        return;
    }
    console.log('--- Connection Debug ---');
    console.log('ID:', data.id);
    console.log('Exchange:', data.exchange);
    console.log('User ID:', data.user_id);
    console.log('API Key (raw, masked):', data.api_key ? data.api_key.substring(0, 4) + '...' + data.api_key.substring(data.api_key.length - 4) : 'null');
    console.log('Has Secret:', !!data.api_secret);
    console.log('Has Blob:', !!data.encrypted_blob);
    if (data.encrypted_blob) {
        console.log('Blob starts with:', data.encrypted_blob.substring(0, 10) + '...');
    }
}
debug();
