// supabase/functions/exchange-sync-all/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

// This function triggers sync workers for all of a user's connected exchanges.
// IT MAINTAINS THE ORIGINAL LOGIC of invoking separate workers for 'trades' and 'transfers'.
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // --- User Authentication ---
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'User not found.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
        }

        // ★ MINIMAL CHANGE 1: Target 'exchange_connections' table.
        const { data: connections, error: connsError } = await supabaseAdmin
            .from('exchange_connections')
            .select('id, exchange') // 'id' is the connection ID.
            .eq('user_id', user.id);

        if (connsError) throw new Error(`Failed to fetch connections: ${connsError.message}`);

        if (!connections || connections.length === 0) {
            return new Response(JSON.stringify({ message: "No exchange connections found." }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ★ MINIMAL CHANGE 2: Loop through connections and invoke workers, PRESERVING ORIGINAL LOGIC.
        const tasks = [];
        for (const conn of connections) {
            console.log(`[ALL] -> Invoking sync for ${conn.exchange} (connection_id: ${conn.id})`);
            
            // Pass the new 'connection_id' alongside the existing parameters.
            const bodyPayload = { 
                connection_id: conn.id, // The only new piece of information.
                exchange: conn.exchange, 
            };

            // Invoke for 'trades' (maintaining original task-based design)
            tasks.push(supabaseAdmin.functions.invoke("exchange-sync-worker", { 
                body: { ...bodyPayload, task_type: 'trades' }
            }));

            // Invoke for 'transfers' (maintaining original task-based design)
            tasks.push(supabaseAdmin.functions.invoke("exchange-sync-worker", { 
                body: { ...bodyPayload, task_type: 'transfers' }
            }));
        }
        
        await Promise.all(tasks);

        const successMessage = `Successfully triggered sync for ${connections.length} exchange connection(s).`;
        return new Response(JSON.stringify({ message: successMessage }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 
        });
    }
});
