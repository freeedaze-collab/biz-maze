
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://yelkjimxejmrkfzeumos.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbGtqaW14ZWptcmtmemV1bW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTgzNjQsImV4cCI6MjA4MTMzNDM2NH0.JO5ZsgYr2OH7sOTJ6cdjDIfLs2Fsi-rlD2atuLcatJs";

console.log("Connecting to Supabase (Hardcoded)...");
const supabase = createClient(supabaseUrl, supabaseKey);

async function runDiagnostics() {
    console.log("--- Starting Database Diagnostics (v3) ---");

    try {
        // 1. Check 'entities' table
        console.log("\n1. Checking 'entities' table...");
        const { data: entities, error: entitiesError } = await supabase.from('entities').select('id').limit(1);
        if (entitiesError) {
            console.error("❌ FAILED 'entities':", entitiesError.message);
        } else {
            console.log("✅ 'entities' table exists.");
        }

        // 2. Check 'wallet_connections' column
        console.log("\n2. Checking 'wallet_connections.entity_id'...");
        const { data: wc, error: wcError } = await supabase.from('wallet_connections').select('entity_id').limit(1);
        if (wcError) {
            console.error("❌ FAILED 'wallet_connections.entity_id':", wcError.message);
        } else {
            console.log("✅ 'wallet_connections' has 'entity_id'.");
        }

        // 3. Check 'all_transactions' view (The critical one)
        console.log("\n3. Checking 'all_transactions' view...");
        const { data: at, error: atError } = await supabase.from('all_transactions').select('*').limit(1);
        if (atError) {
            console.error("❌ FAILED 'all_transactions':", atError.message);
            console.log("   (This confirms the view is broken)");
        } else {
            console.log("✅ 'all_transactions' seems workable (select success).");
        }

        // 4. Check 'v_holdings' view
        console.log("\n4. Checking 'v_holdings' view...");
        const { data: vh, error: vhError } = await supabase.from('v_holdings').select('*').limit(1);
        if (vhError) {
            console.error("❌ FAILED 'v_holdings':", vhError.message);
        } else {
            console.log("✅ 'v_holdings' seems workable.");
        }

    } catch (err) {
        console.error("Unexpected script error:", err);
    }
    console.log("\n--- Done ---");
}

runDiagnostics();
