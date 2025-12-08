
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
        let credentialIdsToSync: string[] | null = null;
        const bodyText = await req.text();
        if (bodyText) {
            try {
                const body = JSON.parse(bodyText);
                if (body && Array.isArray(body.credential_ids)) {
                    credentialIdsToSync = body.credential_ids;
                }
            } catch (e) {
                console.log("Malformed JSON body found, proceeding to sync all credentials for user.");
            }
        } else {
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

        let query = adminSupabase
            .from('exchange_api_credentials')
            .select('id, exchange')
            .eq('user_id', user.id);

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

        const invocationPromises = credentials.map(cred => {
            // Correctly pass the credential_id to the worker
            return supabase.functions.invoke('exchange-sync-worker', {
                body: { credential_id: cred.id } 
            });
        });

        await Promise.all(invocationPromises);

        console.log("All worker invocations have been successfully triggered.");
        
        return new Response(JSON.stringify({ message: `Sync triggered for ${credentials.length} exchanges.` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 202, 
        });

    } catch (err) {
        console.error(`[ALL-COMMANDER-CRASH] Plan building failed:`, err);
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
