
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
        // --- [START] ROBUST BODY HANDLING ---
        // This function is designed to be called in two ways:
        // 1. With an empty body, signaling a full sync of all user credentials.
        // 2. With a JSON body like `{"credential_ids": ["id1", "id2"]}` for a partial sync.
        let credentialIdsToSync: string[] | null = null;
        const bodyText = await req.text();
        if (bodyText) {
            try {
                const body = JSON.parse(bodyText);
                if (body && Array.isArray(body.credential_ids)) {
                    credentialIdsToSync = body.credential_ids;
                }
            } catch (e) {
                // This error is expected for malformed JSON.
                // We robustly interpret this as a signal to sync ALL credentials.
                console.log("Malformed JSON body found, proceeding to sync all credentials for user.");
            }
        } else {
            // This is expected for empty body requests.
            // We robustly interpret this as a signal to sync ALL credentials.
            console.log("No body found, proceeding to sync all credentials for user.");
        }
        // --- [END] ROBUST BODY HANDLING ---

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');
        
        console.log(`User ${user.id} authenticated. Plan: ${credentialIdsToSync ? `Sync specific IDs` : 'Sync all'}`);

        const adminSupabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        // Build the query to fetch the credentials that need to be synced.
        let query = adminSupabase
            .from('exchange_api_credentials')
            .select('id, exchange')
            .eq('user_id', user.id);

        // If specific IDs were provided in the request, filter the query.
        if (credentialIdsToSync && credentialIdsToSync.length > 0) {
            query = query.in('id', credentialIdsToSync);
        }

        const { data: credentials, error: credsError } = await query;

        if (credsError) throw credsError;

        if (!credentials || credentials.length === 0) {
            return new Response(JSON.stringify({ message: 'No matching exchange credentials found to sync.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }
        
        console.log(`Found ${credentials.length} credentials. Invoking worker for each.`);

        // Asynchronously invoke the worker function for each credential.
        const invocationPromises = credentials.map(cred => {
            return supabase.functions.invoke('exchange-sync-worker', {
                body: { credential_id: cred.id }
            });
        });

        await Promise.all(invocationPromises);

        console.log("All worker invocations have been successfully triggered.");
        
        return new Response(JSON.stringify({ message: `Sync triggered for ${credentials.length} exchanges.` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 202, // 202 Accepted: The request has been accepted for processing.
        });

    } catch (err) {
        console.error(`[ALL-COMMANDER-CRASH] Critical error in exchange-sync-all:`, err);
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
