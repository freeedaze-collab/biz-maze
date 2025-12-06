
// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

async function getKey() { return (await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"])) }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> { const p = blob.split(":"); const k = await getKey(); const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2])); return JSON.parse(new TextDecoder().decode(d)) }

// ★★★【最終改修：`limit`の開放】★★★
// ユーザー指摘の「最新1件しか取れていない」問題を解決する。
// 全ての履歴取得API呼び出しに `limit: 1000` を明示的に設定し、過去90日間の全件取得を保証する。
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
        if (userError || !user) throw new Error('User not found.');

        const { exchange: exchangeName, task_type, symbol } = await req.json();
        if (!exchangeName || !task_type) throw new Error('exchange and task_type are required.');
        console.log(`[WORKER] Starting task: ${task_type} for ${exchangeName} ${symbol ? `on ${symbol}`: ''}`);

        const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('user_id', user.id).eq('exchange', exchangeName).single();
        if (connError || !conn) throw new Error(`Connection not found for ${exchangeName}`);
        
        const credentials = await decryptBlob(conn.encrypted_blob!);
        
        const exchangeInstance = new ccxt[exchangeName]({
            apiKey: credentials.apiKey, 
            secret: credentials.apiSecret, 
            password: credentials.apiPassphrase,
            options: { 'defaultType': 'spot' },
            adjustForTimeDifference: true,
        });

        let records: any[] = [];
        const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).getTime();
        const limit = 1000; //【最重要修正】取得件数の上限を明示的に指定

        try {
            if (task_type === 'trade') {
                if (!symbol) throw new Error('Symbol is required for trade task.');
                records = await exchangeInstance.fetchMyTrades(symbol, since, limit);
            } else if (task_type === 'fiat') {
                // @ts-ignore
                const buys = await exchangeInstance.sapiGetFiatOrders({ transactionType: '0', beginTime: since, rows: limit }).then(r => r.data || []);
                // @ts-ignore
                const sells = await exchangeInstance.sapiGetFiatOrders({ transactionType: '1', beginTime: since, rows: limit }).then(r => r.data || []);
                records = [...buys, ...sells];
            } else if (task_type === 'deposits') {
                records = await exchangeInstance.fetchDeposits(undefined, since, limit);
            } else if (task_type === 'withdrawals') {
                records = await exchangeInstance.fetchWithdrawals(undefined, since, limit);
            } else if (task_type === 'convert') {
                // @ts-ignore
                records = await exchangeInstance.fetchConvertTradeHistory(undefined, since, limit);
            } else if (task_type === 'transfer') {
                // @ts-ignore
                records = await exchangeInstance.fetchTransfers(undefined, since, limit);
            }
        } catch(e) {
            console.warn(`[WORKER] API call failed for task ${task_type}. Error: ${e.message}`);
        }

        if (!records || records.length === 0) {
            console.log(`[WORKER] API call for task '${task_type}' was successful but returned 0 records.`);
            return new Response(JSON.stringify({ message: "No new records for this category.", savedCount: 0 }), { headers: corsHeaders });
        }

        console.log(`[WORKER] Found ${records.length} records for task: ${task_type}`);

        const recordsToSave = records.map(r => {
            const isFiat = r.orderId && r.fiatCurrency;
            let rec = {} as any;
            if (isFiat) {
                rec = { id: r.orderId, symbol: `${r.cryptoCurrency}/${r.fiatCurrency}`, side: r.transactionType === '0' ? 'buy' : 'sell', price: parseFloat(r.fiatAmount) / parseFloat(r.cryptoAmount), amount: parseFloat(r.cryptoAmount), ts: r.createTime, fee: 0, fee_asset: '' };
            } else { 
                rec = { id: r.id || r.txid, symbol: r.symbol || r.currency, side: r.side || r.type, price: r.price, amount: r.amount, fee: r.fee?.cost, fee_asset: r.fee?.currency, ts: r.timestamp };
            }
            return {
                user_id: user.id, exchange: exchangeName, trade_id: String(rec.id),
                symbol: rec.symbol, side: rec.side, 
                price: rec.price ?? 0, amount: rec.amount ?? 0, fee: rec.fee ?? 0, 
                fee_asset: rec.fee_asset,
                ts: new Date(rec.ts).toISOString(), raw_data: r,
            };
        }).filter(r => r.trade_id && r.symbol);

        if (recordsToSave.length === 0) {
            return new Response(JSON.stringify({ message: "Fetched records were not in a savable format.", savedCount: 0 }), { headers: corsHeaders });
        }

        const { error: dbError, data: savedData } = await supabaseAdmin.from('exchange_trades').upsert(recordsToSave, { onConflict: 'user_id,exchange,trade_id' }).select();
        if (dbError) throw dbError;

        console.log(`[WORKER] VICTORY! Successfully saved ${savedData.length} records for task ${task_type}.`);
        return new Response(JSON.stringify({ message: `Saved ${savedData.length} records.` }), { headers: corsHeaders });

    } catch (err) {
        console.error(`[WORKER-CRASH] Unhandled exception for ${req.method} ${req.url}:`, err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
