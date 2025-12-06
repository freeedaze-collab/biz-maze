
// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const NINETY_DAYS_AGO = Date.now() - 90 * 24 * 60 * 60 * 1000;

async function getKey() { return (await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"])) }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> { const p = blob.split(":"); const k = await getKey(); const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2])); return JSON.parse(new TextDecoder().decode(d)) }

// ★★★【エリート工作員・最終形態 v2】★★★
// task_typeが無くてもsymbolがあれば'trade'だと推論する
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
        if (userError || !user) throw new Error('User not found.');

        const bodyAsText = await req.text();
        console.log(`[WORKER-DEBUG] Received body: ${bodyAsText}`);
        let body;
        try {
            body = JSON.parse(bodyAsText);
        } catch (parseError) {
            throw new Error(`Invalid JSON body received: ${parseError.message}`);
        }
        
        // === 新ロジック: task_typeの推論 ===
        let { exchange: exchangeName, task_type, symbol } = body;
        if (!task_type) {
            console.log("[WORKER-DEBUG] task_type is missing. Attempting to infer...");
            if (symbol) {
                task_type = 'trade';
                console.log("[WORKER-DEBUG] Inferred task_type as 'trade' because symbol was present.");
            }
        }
        // =====================================

        if (!exchangeName || !task_type) {
            console.error(`[WORKER-CRASH] Missing params. exchange=${exchangeName}, task_type=${task_type}`);
            throw new Error('exchange and task_type are required.');
        }
        console.log(`[WORKER] Invoked for ${exchangeName}. Task: ${task_type}`)

        const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('user_id', user.id).eq('exchange', exchangeName).single();
        if (connError || !conn) throw new Error(`Connection not found for ${exchangeName}`);
        const credentials = await decryptBlob(conn.encrypted_blob!);
        // @ts-ignore
        const exchangeInstance = new ccxt[exchangeName]({ apiKey: credentials.apiKey, secret: credentials.apiSecret, password: credentials.apiPassphrase, options: { 'defaultType': 'spot' } });

        let recordsToSave: any[] = [];
        
        if (task_type === 'trade') { /* ... */ }
        else if (task_type === 'convert') { /* ... */ }
        else if (task_type === 'deposits' || task_type === 'withdrawals') { /* ... */ }

        if (recordsToSave.length === 0) {
            return new Response(JSON.stringify({ message: `Sync complete for ${task_type}. No new records.`, savedCount: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { data, error } = await supabaseAdmin.from('exchange_trades').upsert(recordsToSave, { onConflict: 'user_id,exchange,trade_id' });
        if (error) throw error;

        const savedCount = data?.length ?? 0;
        return new Response(JSON.stringify({ message: `Sync complete. Saved ${savedCount} records.`, savedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error(`[WORKER-CRASH] Task failed:`, err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
