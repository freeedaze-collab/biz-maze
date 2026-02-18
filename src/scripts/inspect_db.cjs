
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://yelkjimxejmrkfzeumos.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbGtqaW14ZWptcmtmemV1bW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTgzNjQsImV4cCI6MjA4MTMzNDM2NH0.JO5ZsgYr2OH7sOTJ6cdjDIfLs2Fsi-rlD2atuLcatJs";

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function run() {
    // We don't have the user's login, but we can try to query if RLS permits or just check columns via a dummy query
    console.log("Checking exchange_connections schema and sample data...");
    const { data, error } = await supabase
        .from('exchange_connections')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching sample:", error);
    } else if (data && data.length > 0) {
        console.log("Sample connection columns:", Object.keys(data[0]));
    } else {
        console.log("No connections found to inspect.");
    }
}

run();
