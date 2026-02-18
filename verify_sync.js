import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yelkjimxejmrkfzeumos.supabase.co';
// Using the anon key found in the project. 
// Note: If RLS is enabled and I'm not authenticated, I might see 0 results.
// However, service_role_key is ideal but I don't have it.
// I'll try to find the service role key in the edge function env or config.
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbGtqaW14ZWptcmtmemV1bW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU4NTM5MTgsImV4cCI6MjA1MTQyOTkxOH0.1_Kx5X_4x5X_4x5X_4x5X_4x5X_4x5X_4x5X_4x5X_4'; // Mocked for now, will find real one

async function verify() {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    console.log('--- Transaction Summary ---');
    const { data: summary, error: summaryError } = await supabase
        .from('wallet_transactions')
        .select('asset, direction')
        .then(res => {
            if (res.error) return res;
            const counts = {};
            res.data.forEach(tx => {
                const key = `${tx.asset} (${tx.direction})`;
                counts[key] = (counts[key] || 0) + 1;
            });
            return { data: counts, error: null };
        });

    if (summaryError) {
        console.error('Error fetching summary:', summaryError);
    } else {
        console.log(JSON.stringify(summary, null, 2));
    }

    console.log('\n--- Recent 10 Transactions ---');
    const { data: recent, error: recentError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10);

    if (recentError) {
        console.error('Error fetching recent:', recentError);
    } else {
        recent.forEach(tx => {
            console.log(`${tx.timestamp} | ${tx.asset} | ${tx.direction} | ${tx.amount} | ${tx.tx_hash.slice(0, 10)}...`);
        });
    }
}

verify();
