
// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const NINETY_DAYS_AGO = Date.now() - 90 * 24 * 60 * 60 * 1000;

async function getKey() { return (await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"])) }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> { const p = blob.split(":"); const k = await getKey(); const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2])); return JSON.parse(new TextDecoder().decode(d)) }

// ★★★【エリート工作員・最終決戦仕様】★★★
// upsertの返り値を信用せず、投入したレコード数を正としてカウントする
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
        if (userError || !user) throw new Error('User not found.');

        const bodyAsText = await req.text();
        console.log(`[WORKER-DEBUG] Received body: ${bodyAsText}`);
        let body;
        try { body = JSON.parse(bodyAsText); } catch (e) { throw new Error(`Invalid JSON: ${e.message}`); }
        
        let { exchange: exchangeName, task_type, symbol } = body;
        if (!task_type) {
            if (symbol) {
                task_type = 'trade';
                console.log("[WORKER-DEBUG] Inferred task_type as 'trade'.");
            }
        }

        if (!exchangeName || !task_type) throw new Error('exchange and task_type are required.');
        console.log(`[WORKER] Invoked for ${exchangeName}. Task: ${task_type}`)

        const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('user_id', user.id).eq('exchange', exchangeName).single();
        if (connError || !conn) throw new Error(`Connection not found for ${exchangeName}`);
        const credentials = await decryptBlob(conn.encrypted_blob!);
        // @ts-ignore
        const exchangeInstance = new ccxt[exchangeName]({ apiKey: credentials.apiKey, secret: credentials.apiSecret, password: credentials.apiPassphrase, options: { 'defaultType': 'spot' } });

        let recordsToSave: any[] = [];
        
        if (task_type === 'trade') {
            if (!symbol) throw new Error('symbol is required for trade sync.');
            console.log(`[WORKER] Fetching SPOT trades for ${symbol} since 90 days ago...`);
            const trades = await exchangeInstance.fetchMyTrades(symbol, NINETY_DAYS_AGO, 500);
            if (trades && trades.length > 0) {
                 console.log(`[WORKER] Found ${trades.length} spot trades for ${symbol}.`);
                 recordsToSave = trades.map(r => { const rid=r.id||r.txid,s=r.side||r.type,sy=r.symbol||r.currency; return {user_id:user.id,exchange:exchangeName,trade_id:String(rid),symbol:sy,side:s,price:r.price??0,amount:r.amount,fee:r.fee?.cost,fee_asset:r.fee?.currency,ts:new Date(r.timestamp).toISOString(),raw_data:r} });
            }
        } 
        else if (task_type === 'convert') {
            if (exchangeName !== 'binance' || !exchangeInstance.has['fetchConvertTradeHistory']) {
                return new Response(JSON.stringify({ message: 'Convert sync is not supported.', savedCount: 0 }), { headers: corsHeaders });
            }
            console.log("[WORKER] Fetching Binance Convert history...");
            const convertTrades = await exchangeInstance.fetchConvertTradeHistory(undefined, NINETY_DAYS_AGO);
            if (convertTrades && convertTrades.length > 0) {
                console.log(`[WORKER] Found ${convertTrades.length} Convert trades.`);
                recordsToSave = convertTrades.map(r => { const fromAsset=r.info.fromAsset,toAsset=r.info.toAsset,fromAmount=parseFloat(r.info.fromAmount),toAmount=parseFloat(r.info.toAmount); return { user_id:user.id,exchange:exchangeName,trade_id:String(r.info.orderId),symbol:`${fromAsset}/${toAsset}`,side:'convert',price:toAmount/fromAmount,amount:fromAmount,fee:0,fee_asset:fromAsset,ts:new Date(r.timestamp).toISOString(),raw_data:r }; });
            }
        }
         else if (task_type === 'deposits' || task_type === 'withdrawals') {
            const isDeposit = task_type === 'deposits';
            if (!(isDeposit ? exchangeInstance.has['fetchDeposits'] : exchangeInstance.has['fetchWithdrawals'])) {
                return new Response(JSON.stringify({ message: `${task_type} sync is not supported.`, savedCount: 0 }), { headers: corsHeaders });
            }
            console.log(`[WORKER] Fetching ${task_type}...`);
            const transactions = isDeposit ? await exchangeInstance.fetchDeposits(undefined, NINETY_DAYS_AGO) : await exchangeInstance.fetchWithdrawals(undefined, NINETY_DAYS_AGO);
            if(transactions && transactions.length > 0) {
                console.log(`[WORKER] Found ${transactions.length} ${task_type}.`);
                recordsToSave = transactions.map(r => { const rid=r.id||r.txid,s=r.side||r.type,sy=r.symbol||r.currency; return {user_id:user.id,exchange:exchangeName,trade_id:String(rid),symbol:sy,side:s,price:0,amount:r.amount,fee:r.fee?.cost,fee_asset:r.fee?.currency,ts:new Date(r.timestamp).toISOString(),raw_data:r} });
            }
        }

        if (recordsToSave.length === 0) {
            console.log(`[WORKER] No new records found for task ${task_type}.`);
            return new Response(JSON.stringify({ message: `Sync complete for ${task_type}. No new records.`, savedCount: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`[WORKER] Saving ${recordsToSave.length} records to the database...`);
        const { error } = await supabaseAdmin.from('exchange_trades').upsert(recordsToSave, { onConflict: 'user_id,exchange,trade_id' });

        if (error) throw error;

        //【最終修正】返り値のdataは信用せず、投入したrecordsToSaveのlengthを正とする
        const savedCount = recordsToSave.length;
        console.log(`[WORKER] Successfully saved ${savedCount} records for task ${task_type}.`);
        return new Response(JSON.stringify({ message: `Sync complete. Saved ${savedCount} records.`, savedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error(`[WORKER-CRASH] Task failed:`, err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
