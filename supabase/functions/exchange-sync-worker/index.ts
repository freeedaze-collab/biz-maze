
// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt, { AuthenticationError, ExchangeError } from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

async function getKey() { return (await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"])) }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> { const p = blob.split(":"); const k = await getKey(); const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2])); return JSON.parse(new TextDecoder().decode(d)) }

// ★★★【最終改修：全取引カテゴリの統合】★★★
// ユーザーの「取引」認識に合わせ、「現物取引」「フィアット購入」「コンバート」を全て取得し統合する。
// ccxtに無いFiat購入履歴は、BinanceのプライベートAPI `sapiGetFiatOrders` を直接呼び出して取得する。
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

        let allRecords: any[] = [];
        const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).getTime();

        //【最重要修正】「取引」タスク実行時に、考えられる全ての取引系APIを並列で叩く
        if (task_type === 'trade') {
            if (!symbol) throw new Error('Symbol is required for trade task.');

            const promises = [];
            // 1. 現物取引履歴 (Spot Trades)
            promises.push(exchangeInstance.fetchMyTrades(symbol, since, 1000).catch(e => { console.warn(`[WORKER] Could not fetch spot trades for ${symbol}:`, e.message); return []; }));
            
            // 2. フィアット購入履歴 (Fiat Buy/Sell) - ccxtに無いため直接呼び出し
            // @ts-ignore
            promises.push(exchangeInstance.sapiGetFiatOrders({ transactionType: '0', beginTime: since }).then(r => r.data).catch(e => { console.warn(`[WORKER] Could not fetch fiat buys:`, e.message); return []; }));
            // @ts-ignore
            promises.push(exchangeInstance.sapiGetFiatOrders({ transactionType: '1', beginTime: since }).then(r => r.data).catch(e => { console.warn(`[WORKER] Could not fetch fiat sells:`, e.message); return []; }));

            const results = await Promise.all(promises);
            allRecords = results.flat();

        } else if (task_type === 'deposits') {
            allRecords = await exchangeInstance.fetchDeposits(undefined, since);
        } else if (task_type === 'withdrawals') {
            allRecords = await exchangeInstance.fetchWithdrawals(undefined, since);
        } else if (task_type === 'convert') {
            // @ts-ignore
            allRecords = await exchangeInstance.fetchConvertTradeHistory(undefined, since);
        } else if (task_type === 'transfer') {
            // @ts-ignore
            allRecords = await exchangeInstance.fetchTransfers(undefined, since);
        }

        if (!allRecords || allRecords.length === 0) {
            const successMessage = `[WORKER] API call for task '${task_type}' was successful but returned 0 records. No relevant history found for this category.`;
            console.log(successMessage);
            return new Response(JSON.stringify({ message: "No new records for this category.", savedCount: 0 }), { headers: corsHeaders });
        }

        console.log(`[WORKER] VICTORY! Found a total of ${allRecords.length} records across all API calls for task: ${task_type}`);

        //【改修】各種APIの異なるレスポンス構造を統一フォーマットに整形
        const recordsToSave = allRecords.map(r => {
            const isFiat = r.orderId; // Fiat Order-specific field
            const isTrade = r.orderId && !r.fiatCurrency; // Spot Trade-specific field

            let record = {} as any;
            if (isFiat) {
                record = {
                    id: r.orderId, symbol: `${r.cryptoCurrency}/${r.fiatCurrency}`,
                    side: r.transactionType === '0' ? 'buy' : 'sell',
                    price: parseFloat(r.fiatAmount) / parseFloat(r.cryptoAmount),
                    amount: parseFloat(r.cryptoAmount),
                    ts: r.createTime
                };
            } else { // Assume Spot trade, withdrawal, deposit etc.
                record = {
                    id: r.id || r.txid, symbol: r.symbol || r.currency,
                    side: r.side || r.type,
                    price: r.price, amount: r.amount, 
                    fee: r.fee?.cost, fee_asset: r.fee?.currency,
                    ts: r.timestamp,
                };
            }

            return {
                user_id: user.id, exchange: exchangeName, trade_id: String(record.id),
                symbol: record.symbol, side: record.side, price: record.price, amount: record.amount,
                fee: record.fee, fee_asset: record.fee_asset,
                ts: new Date(record.ts).toISOString(), raw_data: r,
            };
        }).filter(r => r.trade_id && r.symbol);

        if (recordsToSave.length === 0) {
            return new Response(JSON.stringify({ message: "Fetched records were not in a savable format.", savedCount: 0 }), { headers: corsHeaders });
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
