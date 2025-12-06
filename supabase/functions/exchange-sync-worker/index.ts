
// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

async function getKey() { return (await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"])) }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> { const p = blob.split(":"); const k = await getKey(); const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2])); return JSON.parse(new TextDecoder().decode(d)) }

// ★★★【最終・論理的修正：分割取得（Pagination）】★★★
// APIが大量データ要求に空データを返す事実に基づき、
// whileループで90日間を7日単位に分割し、繰り返し取得する。
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
            options: { 'defaultType': 'spot' }
        });

        let allRecords: any[] = [];
        const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

        //【最重要修正】90日分を一括取得するのではなく、7日間隔のループで分割取得する
        if (task_type === 'trade') {
            if (!symbol) throw new Error('Symbol is required for trade task.');
            
            console.log(`[WORKER] Starting paginated fetch for ${symbol} over 90 days.`);
            let startTime = ninetyDaysAgo;
            const endTime = Date.now();
            const BATCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7日間隔

            await exchangeInstance.loadMarkets();

            while (startTime < endTime) {
                const currentEndTime = Math.min(startTime + BATCH_WINDOW_MS, endTime);
                console.log(`[WORKER] Fetching chunk for ${symbol} from ${new Date(startTime).toISOString()} to ${new Date(currentEndTime).toISOString()}`);

                try {
                    // sinceではなく、startTimeとendTimeをparamsで明確に指定
                    const trades = await exchangeInstance.fetchMyTrades(symbol, undefined, 1000, {
                         'startTime': startTime, 
                         'endTime': currentEndTime 
                    });
                    if (trades && trades.length > 0) {
                        console.log(`[WORKER] Found ${trades.length} trades in this chunk.`);
                        allRecords.push(...trades);
                    }
                } catch (e) {
                    console.error(`[WORKER] Error fetching chunk for ${symbol}: ${e.message}`);
                }
                
                startTime = currentEndTime + 1;
                await new Promise(resolve => setTimeout(resolve, 500)); // API負荷を考慮した待機
            }
            console.log(`[WORKER] Total trades found for ${symbol} across all chunks: ${allRecords.length}`);

        } else {
            // Trade以外のタスクは従来のままで実行
            const since = ninetyDaysAgo;
            if (task_type === 'deposits') allRecords = await exchangeInstance.fetchDeposits(undefined, since);
            else if (task_type === 'withdrawals') allRecords = await exchangeInstance.fetchWithdrawals(undefined, since);
            // @ts-ignore
            else if (task_type === 'convert') allRecords = await exchangeInstance.fetchConvertTradeHistory(undefined, since);
        }

        if (!allRecords || allRecords.length === 0) {
            console.log(`[WORKER] No records found for task: ${task_type} ${symbol || ''}`);
            return new Response(JSON.stringify({ message: "No new records.", savedCount: 0 }), { headers: corsHeaders });
        }

        console.log(`[WORKER] Found total ${allRecords.length} records for task: ${task_type} ${symbol || ''}`);

        const recordsToSave = allRecords.map(r => {
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

        // 念の為、重複を排除
        const uniqueRecords = Array.from(new Map(recordsToSave.map(r => [`${r.exchange}-${r.trade_id}`, r])).values());

        const { error: dbError } = await supabaseAdmin.from('exchange_trades').upsert(uniqueRecords, { onConflict: 'user_id,exchange,trade_id' });
        if (dbError) throw dbError;

        console.log(`[WORKER] VICTORY! Successfully saved ${uniqueRecords.length} records.`);
        return new Response(JSON.stringify({ message: `Saved ${uniqueRecords.length} records.` }), { headers: corsHeaders });

    } catch (err) {
        console.error(`[WORKER-CRASH] Task failed for ${req.method} ${req.url}:`, err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
