
// supabase/functions/exchange-sync-all/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

console.log("Starting exchange-sync-all function (Orchestrator Role)");

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // This function no longer requires a request body.

        // Get the Supabase client with the user's access token.
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        // Get the user from the access token.
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');
        
        console.log(`User ${user.id} authenticated. Preparing to sync all credentials.`);

        // Use the admin client to fetch all credentials for the user.
        const adminSupabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        const { data: credentials, error: credsError } = await adminSupabase
            .from('exchange_api_credentials')
            .select('id, exchange')
            .eq('user_id', user.id);

        if (credsError) throw credsError;

        if (!credentials || credentials.length === 0) {
            return new Response(JSON.stringify({ message: 'No exchange credentials found to sync.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }
        
        console.log(`Found ${credentials.length} credentials. Invoking workers for trades and transfers for each.`);

        // For each credential, invoke a worker for 'trades' and another for 'transfers'.
        const invocationPromises = credentials.flatMap(cred => {
            const tasks = ['trades', 'transfers'];
            return tasks.map(task_type => 
                supabase.functions.invoke('exchange-sync-worker', {
                    body: { 
                        credential_id: cred.id,
                        exchange: cred.exchange,
                        task_type: task_type
                    }
                })
            );
        });

        // Wait for all invocations to be triggered (don't wait for them to complete).
        await Promise.all(invocationPromises);

        console.log("All worker invocations have been successfully triggered.");
        
        const totalInvocations = credentials.length * 2;
        return new Response(JSON.stringify({ message: `Sync triggered for ${totalInvocations} tasks across ${credentials.length} exchanges.` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 202, // 202 Accepted: The request has been accepted for processing, but the processing has not been completed.
        });

    } catch (err) {
        console.error(`[ORCHESTRATOR-CRASH] Failed to trigger sync tasks:`, err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
