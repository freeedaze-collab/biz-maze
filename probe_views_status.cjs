const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://yelkjimxejmrkfzeumos.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbGtqaW14ZWptcmtmemV1bW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NTgzNjQsImV4cCI6MjA4MTMzNDM2NH0.JO5ZsgYr2OH7sOTJ6cdjDIfLs2Fsi-rlD2atuLcatJs";
const supabase = createClient(supabaseUrl, supabaseKey);

async function probe() {
    console.log('=== Probing View Status ===\n');
    
    // Check which views exist by querying information_schema
    const { data: views, error: viewsError } = await supabase.rpc('get_view_list', {});
    
    if (viewsError) {
        console.log('RPC not available, trying direct query to information_schema...');
        
        // Try to query each view directly to see if it exists
        const viewsToCheck = [
            'all_transactions',
            'all_transactions_v2',
            'internal_transfer_pairs',
            'internal_transfer_pairs_v2',
            'v_all_transactions_classified',
            'v_all_transactions_classified_v2',
            'v_holdings',
            'v_holdings_v2',
            'v_balance_sheet',
            'v_profit_loss_statement',
            'v_cash_flow_statement'
        ];
        
        for (const viewName of viewsToCheck) {
            const { data, error, count } = await supabase
                .from(viewName)
                .select('*', { count: 'exact', head: true });
            
            if (error) {
                console.log(`❌ ${viewName}: ERROR - ${error.message}`);
            } else {
                console.log(`✅ ${viewName}: EXISTS (count: ${count ?? 'unknown'})`);
            }
        }
    } else {
        console.log('Views found:', views);
    }
    
    console.log('\n=== Checking Base Tables ===\n');
    
    const tables = [
        'wallet_transactions',
        'wallet_connections',
        'exchange_trades',
        'exchange_connections',
        'daily_exchange_rates',
        'asset_prices',
        'entities',
        'transaction_usage_labels'
    ];
    
    for (const tableName of tables) {
        const { data, error, count } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });
        
        if (error) {
            console.log(`❌ ${tableName}: ERROR - ${error.message}`);
        } else {
            console.log(`✅ ${tableName}: EXISTS (count: ${count ?? 'unknown'})`);
        }
    }
}

probe().catch(console.error);
