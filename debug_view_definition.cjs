
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://yelkjimxejmrkfzeumos.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbGtqaW14ZWptcmtmemV1bW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTgzNjQsImV4cCI6MjA4MTMzNDM2NH0.JO5ZsgYr2OH7sOTJ6cdjDIfLs2Fsi-rlD2atuLcatJs";

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAnalysis() {
    console.log("--- Forensic Analysis: Views & History ---");

    // 1. Get View Definition
    console.log("\n1. Fetching 'all_transactions' definition...");
    // Note: we can't easily get the full definition via PostgREST on information_schema unless permissions allow.
    // We'll try. If this fails, we infer from behavior.
    // Actually, 'rpc' to a system function would be best, but we can't create one easily.
    // Let's try querying information_schema.views.

    const { data: viewDef, error: viewError } = await supabase
        .from('information_schema.views') // This likely won't work with anon key, but trying.
        .select('view_definition')
        .eq('table_name', 'all_transactions')
        .eq('table_schema', 'public')
        .single();

    if (viewError) {
        console.error("❌ Cannot fetch DDL (Expected if restricted):", viewError.message);
        // Fallback: Check if we can deduce index/column types via RPC or just error details
    } else {
        console.log("✅ DDL Fetched Length:", viewDef.view_definition.length);
        console.log("Sample (Start):", viewDef.view_definition.substring(0, 200));
        console.log("Sample (Join Section):", viewDef.view_definition.match(/JOIN.*ON.*/gi));
    }

    // 2. Check Migrations Table
    console.log("\n2. Checking Applied Migrations...");
    const { data: migrations, error: migError } = await supabase
        .from('supabase_migrations.schema_migrations') // Usually hidden
        .select('*');

    if (migError) {
        console.error("❌ Cannot fetch migrations table (Expected):", migError.message);
    } else {
        console.log("Applied Versions:", migrations.map(m => m.version).sort());
    }

    console.log("\n--- Done ---");
}

runAnalysis();
