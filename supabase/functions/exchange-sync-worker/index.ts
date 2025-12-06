
// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt, { AuthenticationError, ExchangeError } from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

async function getKey() { return (await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"])) }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> { const p = blob.split(":"); const k = await getKey(); const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2])); return JSON.parse(new TextDecoder().decode(d)) }

// ★★★【最終改修：全方位での履歴取得とデバッグ】★★★
// 盲点だった「振替」履歴を取得するため `fetchTransfers` を追加。
// さらに `verbose: true` でccxtの通信ログを全て出力し、根本原因を特定する。
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
            verbose: true, // 【最重要デバッグ】ccxtの全通信ログを有効化
        });

        let records: any[] = [];
        const since = exchangeInstance.parse8601(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

        try {
            if (task_type === 'trade') {
                if (!symbol) throw new Error('Symbol is required for trade task.');
                records = await exchangeInstance.fetchMyTrades(symbol, since, 1000); 
            } else if (task_type === 'deposits') {
                records = await exchangeInstance.fetchDeposits(undefined, since);
            } else if (task_type === 'withdrawals') {
                records = await exchangeInstance.fetchWithdrawals(undefined, since);
            } else if (task_type === 'convert') {
                // @ts-ignore
                records = await exchangeInstance.fetchConvertTradeHistory(undefined, since);
            } else if (task_type === 'transfer') { // 【新規追加】振替履歴の取得
                // @ts-ignore
                records = await exchangeInstance.fetchTransfers(undefined, since);
            }
        } catch (e) {
            if (e instanceof AuthenticationError) {
                const errorMessage = `[WORKER] ROOT_CAUSE_ANALYSIS: AUTHENTICATION_ERROR. The API keys for ${exchangeName} are likely invalid or lack permissions. Please generate a new key on the exchange website and ensure 'Enable Reading' is checked.`;
                console.error(errorMessage);
                console.error(`Original Error: ${e.message}`);
                return new Response(JSON.stringify({ error: `Authentication Failed. Please check your API Keys for ${exchangeName}.` }), { status: 401, headers: corsHeaders });
            } else if (e instanceof ExchangeError) {
                const errorMessage = `[WORKER] EXCHANGE_ERROR: The exchange reported an issue, possibly an invalid symbol or temporary problem. Task: ${task_type}, Symbol: ${symbol}, Error: ${e.message}`;
                console.warn(errorMessage);
            } else {
                throw e;
            }
        }

        if (!records || records.length === 0) {
            //【改修】API呼び出しが成功し、0件だった場合のログを明確化
            const successMessage = `[WORKER] API call for task '${task_type}' ${symbol ? `on symbol '${symbol}'` : ''} was successful but returned 0 records. This indicates no relevant history was found for this specific category within the last 90 days. Check other categories like 'transfer' or 'convert'.`;
            console.log(successMessage);
            return new Response(JSON.stringify({ message: "API call successful, but no new records found for this category.", savedCount: 0 }), { headers: corsHeaders });
        }

        console.log(`[WORKER] VICTORY! Found ${records.length} records for task: ${task_type} ${symbol || ''}`);

        const recordsToSave = records.map(r => {
            const recordId = r.id || r.txid; 
            //【改修】振替やコンバートのデータ構造に対応
            const side = r.side || r.type;
            let recordSymbol = r.symbol || r.currency;
            if (task_type === 'convert') recordSymbol = `${r.info.fromAsset}/${r.info.toAsset}`;

            return {
                user_id: user.id, 
                exchange: exchangeName, 
                trade_id: String(recordId), 
                symbol: recordSymbol, 
                side: side,
                price: r.price ?? (task_type === 'convert' ? parseFloat(r.info.toAmount)/parseFloat(r.info.fromAmount) : 0),
                amount: r.amount, 
                fee: r.fee?.cost, 
                fee_asset: r.fee?.currency,
                ts: new Date(r.timestamp).toISOString(), 
                raw_data: r,
            };
        }).filter(r => r.trade_id && r.symbol);

        if (recordsToSave.length === 0) {
            console.log(`[WORKER] Mapped records are 0. It means fetched data was not in a savable format.`);
            return new Response(JSON.stringify({ message: "No valid records to save.", savedCount: 0 }), { headers: corsHeaders });
        }

        const { error: dbError } = await supabaseAdmin.from('exchange_trades').upsert(recordsToSave, { onConflict: 'user_id,exchange,trade_id' });
        if (dbError) throw dbError;

        console.log(`[WORKER] Successfully saved ${recordsToSave.length} records.`);
        return new Response(JSON.stringify({ message: `Saved ${recordsToSave.length} records.` }), { headers: corsHeaders });

    } catch (err) {
        console.error(`[WORKER-CRASH] Task failed for ${req.method} ${req.url}:`, err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
