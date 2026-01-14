
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://yelkjimxejmrkfzeumos.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbGtqaW14ZWptcmtmemV1bW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTgzNjQsImV4cCI6MjA4MTMzNDM2NH0.JO5ZsgYr2OH7sOTJ6cdjDIfLs2Fsi-rlD2atuLcatJs";

const supabase = createClient(supabaseUrl, supabaseKey);

async function probe() {
    console.log('Probing information_schema.columns properly...');

    const targetView = 'v_all_transactions_classified';

    // Using .schema() to query system tables
    const { data, error } = await supabase
        .schema('information_schema')
        .from('columns')
        .select('column_name, data_type, udt_name, ordinal_position')
        .eq('table_name', targetView)
        .eq('table_schema', 'public')
        .order('ordinal_position');

    if (error) {
        console.error("Error querying schema:", error.message);
        // Fallback: try raw RPC if this fails (unlikely if schema is exposed)
    } else {
        if (data && data.length > 0) {
            console.log(`\nColumns for ${targetView}:`);
            data.forEach(col => {
                console.log(`${col.ordinal_position}. ${col.column_name} (${col.data_type} / ${col.udt_name})`);
            });
        } else {
            console.log(`No metadata found for ${targetView}. (Maybe permissions?)`);
        }
    }
}

probe();
