
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
        // Create a Supabase client with the user's authorization to invoke other functions
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        // Get the user from the session.
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error("User not authenticated");
            throw new Error('User not authenticated');
        }
        
        console.log(`User ${user.id} authenticated.`);

        // Use the admin client to securely fetch credentials
        const adminSupabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        const { data: credentials, error: credsError } = await adminSupabase
            .from('exchange_api_credentials') // CORRECTED table name
            .select('id, exchange') // Select only what's needed to trigger the worker
            .eq('user_id', user.id);

        if (credsError) {
            console.error("Error fetching credentials:", credsError);
            throw credsError;
        }

        if (!credentials || credentials.length === 0) {
            console.log("No credentials found for user.");
            return new Response(JSON.stringify({ message: 'No exchange credentials found for this user.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }
        
        console.log(`Found ${credentials.length} credentials. Invoking worker for each.`);

        // Invoke the worker function for each credential.
        // This offloads the heavy work to background workers.
        const invocationPromises = credentials.map(cred => {
            console.log(`Invoking worker for exchange: ${cred.exchange} (credential ID: ${cred.id})`);
            return supabase.functions.invoke('exchange-sync-worker', {
                body: { credential_id: cred.id } // Pass the credential ID to the worker
            });
        });

        // Wait for all invocation requests to be sent.
        await Promise.all(invocationPromises);

        console.log("All worker invocations have been successfully triggered.");
        
        return new Response(JSON.stringify({ message: `Sync triggered for ${credentials.length} exchanges.` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 202, // 202 Accepted: The request has been accepted for processing.
        });

    } catch (err) {
        console.error('Critical error in exchange-sync-all function:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
