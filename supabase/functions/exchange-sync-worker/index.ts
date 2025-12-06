
// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
// const NINETY_DAYS_AGO = Date.now() - 90 * 24 * 60 * 60 * 1000; // 一時的に無効化

async function getKey() { /* ... */ return (await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"])) }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> { /* ... */ const p = blob.split(":"); const k = await getKey(); const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2])); return JSON.parse(new TextDecoder().decode(d)) }
function transformRecord(r: any, uid: string, ex: string) { /* ... */ const rid=r.id||r.txid; if(!rid)return null; const s=r.side||r.type; const sy=r.symbol||r.currency; if(!sy||!s||!r.amount||!r.timestamp)return null; return {user_id:uid,exchange:ex,trade_id:String(rid),symbol:sy,side:s,price:r.price??0,amount:r.amount,fee:r.fee?.cost,fee_asset:r.fee?.currency,ts:new Date(r.timestamp).toISOString(),raw_data:r} }

// ★★★【最終実験：時間制限解除】★★★
// `since`パラメータを外し、全期間の履歴を要求する
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        console.log("[WORKER] Invoked.");
        const { exchange: exchangeName, symbol } = await req.json();
        if (!exchangeName || !symbol) throw new Error('exchange and symbol are required.');
        console.log(`[WORKER] Mission: Sync ALL SPOT trades for ${exchangeName} - ${symbol}`);

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
            options: { 'defaultType': 'spot' }, 
            // verbose: true, // 諜報モードは一旦OFFに。必要なら再度ONにできます。
        });

        console.log(`[WORKER] Fetching ALL spot trades for ${symbol}...`);
        // ★★★【最重要修正】第2引数のsinceを削除！★★★
        const trades = await exchangeInstance.fetchMyTrades(symbol, undefined /* since */, 500 /* limit */);

        if (!trades || trades.length === 0) {
            console.log(`[WORKER] No spot trades found for ${symbol} in the entire history.`);
            return new Response(JSON.stringify({ message: `Sync complete for ${symbol}.`, savedCount: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`[WORKER] ★★★ SUCCESS!! ★★★ Found ${trades.length} trades for ${symbol} in the entire history!`);
        
        const transformed = trades.map(r => transformRecord(r, user.id, exchangeName)).filter(r => r !== null);
        if (transformed.length === 0) {
             return new Response(JSON.stringify({ message: `Sync complete for ${symbol}.`, savedCount: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { data, error } = await supabaseAdmin.from('exchange_trades').upsert(transformed, { onConflict: 'user_id,exchange,trade_id' }).select();
        if (error) throw error;

        const savedCount = data?.length ?? 0;
        console.log(`[WORKER] Successfully saved ${savedCount} records for ${symbol}.`);
        return new Response(JSON.stringify({ message: `Sync complete for ${symbol}.`, savedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error(`[WORKER-CRASH]`, err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
