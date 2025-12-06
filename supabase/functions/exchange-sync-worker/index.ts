
// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt, { AuthenticationError, ExchangeError } from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

async function getKey() { return (await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"])) }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> { const p = blob.split(":"); const k = await getKey(); const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2])); return JSON.parse(new TextDecoder().decode(d)) }

// ★★★【最終診断：認証エラーの可視化】★★★
// 全ての取得が失敗する事実から、原因を「認証情報」そのものと断定。
// ccxtの例外処理を強化し、`AuthenticationError`を捕捉して根本原因をユーザーに通知する。
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
        const since = exchangeInstance.parse8601(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

        //【最重要修正】API呼び出しをtry...catchで囲み、認証エラーを具体的に捕捉する
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
            }
        } catch (e) {
            if (e instanceof AuthenticationError) {
                // これこそが根本原因である可能性が極めて高い
                const errorMessage = `[WORKER] ROOT_CAUSE_ANALYSIS: AUTHENTICATION_ERROR. The API keys for ${exchangeName} are likely invalid or lack permissions. Please generate a new key on the exchange website and ensure 'Enable Reading' is checked.`;
                console.error(errorMessage);
                console.error(`Original Error: ${e.message}`);
                return new Response(JSON.stringify({ error: `Authentication Failed. Please check your API Keys for ${exchangeName}.` }), { status: 401, headers: corsHeaders });
            } else if (e instanceof ExchangeError) {
                // 取引所側のエラー（シンボル間違い、メンテナンスなど）
                const errorMessage = `[WORKER] EXCHANGE_ERROR: The exchange reported an issue, possibly an invalid symbol like BUSD or a temporary problem. Symbol: ${symbol}, Error: ${e.message}`;
                console.warn(errorMessage);
                // このタスクはスキップするが、処理は止めない
            } else {
                // その他の予期せぬエラー
                throw e;
            }
        }

        if (!records || records.length === 0) {
            console.log(`[WORKER] No records found for task: ${task_type} ${symbol || ''}`);
            return new Response(JSON.stringify({ message: "No new records.", savedCount: 0 }), { headers: corsHeaders });
        }

        console.log(`[WORKER] VICTORY! Found ${records.length} records for task: ${task_type} ${symbol || ''}`);

        const recordsToSave = records.map(r => {
            const recordId = r.id || r.txid; const side = r.side || r.type;
            let recordSymbol = r.symbol || r.currency;
            if (task_type === 'convert') recordSymbol = `${r.info.fromAsset}/${r.info.toAsset}`;
            return {
                user_id: user.id, exchange: exchangeName, trade_id: String(recordId), 
                symbol: recordSymbol, side: side,
                price: r.price ?? (task_type === 'convert' ? parseFloat(r.info.toAmount)/parseFloat(r.info.fromAmount) : 0),
                amount: r.amount, fee: r.fee?.cost, fee_asset: r.fee?.currency,
                ts: new Date(r.timestamp).toISOString(), raw_data: r,
            };
        }).filter(r => r.trade_id && r.symbol);

        if (recordsToSave.length === 0) {
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
