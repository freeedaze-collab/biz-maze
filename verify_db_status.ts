
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

// Load env explicitly
const envFile = fs.readFileSync('.env', 'utf8');
const envConfig = dotenv.parse(envFile);

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;
// Start using service role key if available for checking schema, but anon often sufficient for public views
// Actually for checking schema meta info, better to try simple queries first.

console.log("Connecting to:", supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

async function runDiagnostics() {
    console.log("--- Starting Database Diagnostics ---");

    // 1. Check if 'entities' table exists
    console.log("\n1. Checking 'entities' table access...");
    const { data: entitiesData, error: entitiesError } = await supabase.from('entities').select('count', { count: 'exact', head: true });
    if (entitiesError) {
        console.error("❌ FAILED to access entities table:", entitiesError.message, entitiesError.details);
    } else {
        console.log("✅ 'entities' table accessible. Count:", entitiesData);
    }

    // 2. Check column 'entity_id' in 'wallet_connections'
    console.log("\n2. Checking 'entity_id' in 'wallet_connections'...");
    const { data: wcData, error: wcError } = await supabase.from('wallet_connections').select('entity_id').limit(1);
    if (wcError) {
        console.error("❌ FAILED to access wallet_connections.entity_id:", wcError.message);
    } else {
        console.log("✅ 'wallet_connections' has 'entity_id' column.");
    }

    // 3. Check 'all_transactions' view functionality
    console.log("\n3. Checking 'all_transactions' view (Looking for casting errors)...");
    const { data: atData, error: atError } = await supabase.from('all_transactions').select('*').limit(5);
    if (atError) {
        console.error("❌ FAILED to query 'all_transactions':", atError.message);
        if (atError.message.includes('invalid input syntax')) {
            console.error("   -> THIS IS THE KNOWN BUG: UUID casting issue.");
        }
    } else {
        console.log("✅ 'all_transactions' query successful. Rows:", atData.length);
    }

    // 4. Check 'v_holdings' view
    console.log("\n4. Checking 'v_holdings' view...");
    const { data: vhData, error: vhError } = await supabase.from('v_holdings').select('*').limit(5);
    if (vhError) {
        console.error("❌ FAILED to query 'v_holdings':", vhError.message);
    } else {
        console.log("✅ 'v_holdings' query successful. Rows:", vhData.length);
    }

    console.log("\n--- Diagnostics Complete ---");
}

runDiagnostics();
