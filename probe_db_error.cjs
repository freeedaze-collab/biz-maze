
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://yelkjimxejmrkfzeumos.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbGtqaW14ZWptcmtmemV1bW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTgzNjQsImV4cCI6MjA4MTMzNDM2NH0.JO5ZsgYr2OH7sOTJ6cdjDIfLs2Fsi-rlD2atuLcatJs";

const supabase = createClient(supabaseUrl, supabaseKey);

async function probeDatabase() {
    console.log("--- Probing Database for Type Mismatch ---");

    // 1. Check if we can SELECT everything (already did, it passes for 1 row)
    // But maybe the error only happens when JOINING specific rows (where connection_id is populated)

    console.log("\n1. Fetching rows with non-null connection_id...");
    // We suspect the error is "invalid input syntax for type uuid"
    // This happens when 'wallet' source (text id 'w_123') tries to join 'connection_id' 
    // IF connection_id in the view is TEXT, it should work.
    // IF connection_id in the view is UUID, and we pass a non-uuid string, it crashes.

    // Let's try to filter by a known text-like condition to force evaluation
    const { data, error } = await supabase
        .from('all_transactions')
        .select('id, connection_id')
        .not('connection_id', 'is', null)
        .limit(5);

    if (error) {
        console.error("❌ Error querying connection_id:", error.message);
        if (error.message.includes('uuid')) {
            console.log("👉 DIAGNOSIS: The view still expects UUID for connection_id!");
        }
    } else {
        console.log("✅ Query successful (rows):", data.length);
        if (data.length > 0) {
            console.log("   Sample connection_id:", data[0].connection_id);
        }
    }
}

probeDatabase();
