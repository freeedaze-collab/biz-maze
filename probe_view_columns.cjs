
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://yelkjimxejmrkfzeumos.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbGtqaW14ZWptcmtmemV1bW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTgzNjQsImV4cCI6MjA4MTMzNDM2NH0.JO5ZsgYr2OH7sOTJ6cdjDIfLs2Fsi-rlD2atuLcatJs";

const supabase = createClient(supabaseUrl, supabaseKey);

async function probe() {
    console.log('Probing view columns...');
    const views = ['all_transactions', 'v_all_transactions_classified'];
    for (const view of views) {
        console.log(`\n--- ${view} ---`);
        const { data, error } = await supabase.from(view).select('*').limit(1);
        if (error) {
            console.error(`Error querying ${view}:`, error.message);
        } else {
            if (data && data.length > 0) {
                console.log('Columns found:', JSON.stringify(Object.keys(data[0])));
            } else {
                console.log('View empty.');
            }
        }
    }
}

probe();
