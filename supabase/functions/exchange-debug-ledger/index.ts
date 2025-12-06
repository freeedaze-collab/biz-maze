
// supabase/functions/exchange-debug-ledger/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

// 暗号化されたAPIキーを復号するためのヘルパー関数
async function getKey() { return (await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"])) }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> { const p = blob.split(":"); const k = await getKey(); const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2])); return JSON.parse(new TextDecoder().decode(d)) }

// ★★★【最終診断ツール：Ledger召喚】★★★
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log("[DEBUG-LEDGER] Invoked.");
        const { exchange: exchangeName } = await req.json();
        if (!exchangeName) throw new Error('exchange is required.');

        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
        if (userError || !user) throw new Error('User not found.');

        const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('user_id', user.id).eq('exchange', exchangeName).single();
        if (connError || !conn) throw new Error(`Connection not found for ${exchangeName}`);

        const credentials = await decryptBlob(conn.encrypted_blob!);

        // @ts-ignore
        const exchangeInstance = new ccxt[exchangeName]({
            apiKey: credentials.apiKey,
            secret: credentials.apiSecret,
            password: credentials.apiPassphrase,
        });

        if (!exchangeInstance.has['fetchLedger']) {
            throw new Error(`The exchange ${exchangeName} does not support fetchLedger.`);
        }

        console.log(`[DEBUG-LEDGER] Fetching ALL ledger entries for ${exchangeName}...`);

        // ★★★ 会計台帳（Ledger）を取得 ★★★
        const ledger = await exchangeInstance.fetchLedger();

        console.log(`[DEBUG-LEDGER] <<< RAW LEDGER DATA for ${exchangeName} >>>`, JSON.stringify(ledger, null, 2));

        if (!ledger || ledger.length === 0) {
            console.log(`[DEBUG-LEDGER] Ledger is empty for ${exchangeName}.`);
        } else {
            console.log(`[DEBUG-LEDGER] ★★★ SUCCESS! ★★★ Found ${ledger.length} ledger entries.`);
        }

        return new Response(JSON.stringify({
            message: `Ledger fetch complete. Found ${ledger?.length ?? 0} entries. Check the function logs for the raw data.`,
            ledger,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err) {
        console.error(`[DEBUG-LEDGER-CRASH]`, err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});
