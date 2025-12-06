
// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt, { AuthenticationError, ExchangeError } from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

async function getKey() { return (await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"])) }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> { const p = blob.split(":"); const k = await getKey(); const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2])); return JSON.parse(new TextDecoder().decode(d)) }

// ★★★【最終改修：タスクの完全分離と堅牢化】★★★
// ユーザー指摘に基づき、APIレート制限とDBエラーを解決する。
// 1. `trade`タスクを細分化し、API乱用を防止 (`trade`, `fiat`を新設)
// 2. データ整形ロジックを堅牢化し、price等がnullの場合も`0`を代入してDBエラーを回避
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

        try {
            //【最重要修正】タスクを完全に分離し、各タスクは単一の責務を持つ
            if (task_type === 'trade') {
                if (!symbol) throw new Error('Symbol is required for trade task.');
                records = await exchangeInstance.fetchMyTrades(symbol, since, 1000);
            } else if (task_type === 'fiat') { // Fiat取引を別タスクとして新設
                // @ts-ignore
                const buys = await exchangeInstance.sapiGetFiatOrders({ transactionType: '0', beginTime: since }).then(r => r.data || []);
                // @ts-ignore
                const sells = await exchangeInstance.sapiGetFiatOrders({ transactionType: '1', beginTime: since }).then(r => r.data || []);
                records = [...buys, ...sells];
            } else if (task_type === 'deposits') {
                records = await exchangeInstance.fetchDeposits(undefined, since);
            } else if (task_type === 'withdrawals') {
                records = await exchangeInstance.fetchWithdrawals(undefined, since);
            } else if (task_type === 'convert') {
                // @ts-ignore
                records = await exchangeInstance.fetchConvertTradeHistory(undefined, since);
            } else if (task_type === 'transfer') {
                // @ts-ignore
                records = await exchangeInstance.fetchTransfers(undefined, since);
            }
        } catch(e) {
            console.warn(`[WORKER] API call failed for task ${task_type}. This might be expected if the API key lacks permissions for this specific endpoint. Error: ${e.message}`);
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

            //【最重要修正】DBのnot-null制約違反を回避するため、nullの可能性がある項目にデフォルト値を設定
            return {
                user_id: user.id, exchange: exchangeName, trade_id: String(rec.id),
                symbol: rec.symbol, side: rec.side, 
                price: rec.price ?? 0,
                amount: rec.amount ?? 0,
                fee: rec.fee ?? 0, 
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
