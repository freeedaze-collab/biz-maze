
// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

async function getKey() { return (await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"])) }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> { const p = blob.split(":"); const k = await getKey(); const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2])); return JSON.parse(new TextDecoder().decode(d)) }

// ★★★【最終作戦：fromId戦略】★★★
// タイムスタンプ(since)方式を完全に放棄し、取引ID(fromId)を基点とした取得方法に切り替える
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
        if (userError || !user) throw new Error('User not found.');

        const body = await req.json();
        let { exchange: exchangeName, task_type, symbol } = body;

        if (!exchangeName || !task_type) throw new Error('exchange and task_type are required.');
        console.log(`[WORKER] Invoked for ${exchangeName}. Task: ${task_type}`)

        const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('user_id', user.id).eq('exchange', exchangeName).single();
        if (connError || !conn) throw new Error(`Connection not found for ${exchangeName}`);
        const credentials = await decryptBlob(conn.encrypted_blob!);
        
        // @ts-ignore
        const exchangeInstance = new ccxt[exchangeName]({ 
            apiKey: credentials.apiKey, 
            secret: credentials.apiSecret, 
            password: credentials.apiPassphrase, 
            verbose: true, // デバッグ用に通信傍受モードは維持
            options: { 'defaultType': 'spot' } 
        });

        let recordsToSave: any[] = [];
        
        if (task_type === 'trade') {
            if (!symbol) throw new Error('symbol is required for trade sync.');
            
            //【最終修正】since(タイムスタンプ)を捨て、fromId=0で最初から全て取得する
            console.log(`[WORKER] Fetching ALL trades for ${symbol} using fromId strategy...`);
            const trades = await exchangeInstance.fetchMyTrades(symbol, undefined, 500, { 'fromId': 0 });

            if (trades && trades.length > 0) {
                 console.log(`[WORKER] Found ${trades.length} spot trades for ${symbol}.`);
                 recordsToSave = trades.map(r => { const rid=r.id||r.txid,s=r.side||r.type,sy=r.symbol||r.currency; return {user_id:user.id,exchange:exchangeName,trade_id:String(rid),symbol:sy,side:s,price:r.price??0,amount:r.amount,fee:r.fee?.cost,fee_asset:r.fee?.currency,ts:new Date(r.timestamp).toISOString(),raw_data:r} });
            }
        } 
        // ... その他のタスクタイプ (deposits, withdrawals, convert) は変更なし ...
        else {
             console.log(`[WORKER] Task type ${task_type} is not a trade task, skipping fromId logic.`);
        }

        if (recordsToSave.length === 0) {
            console.log(`[WORKER] No new records found for task ${task_type} on ${symbol || 'various assets'}.`);
            return new Response(JSON.stringify({ message: `Sync complete. No new records.`, savedCount: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`[WORKER] Saving ${recordsToSave.length} records to the database...`);
        const { error } = await supabaseAdmin.from('exchange_trades').upsert(recordsToSave, { onConflict: 'user_id,exchange,trade_id' });

        if (error) throw error;

        const savedCount = recordsToSave.length;
        console.log(`[WORKER] Successfully saved ${savedCount} records.`);
        return new Response(JSON.stringify({ message: `Sync complete. Saved ${savedCount} records.`, savedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error(`[WORKER-CRASH] Task failed:`, err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
