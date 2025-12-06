
// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

async function getKey() { return (await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"])) }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> { const p = blob.split(":"); const k = await getKey(); const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2])); return JSON.parse(new TextDecoder().decode(d)) }

// ★★★【最終改修：対墜落・防御的プログラミング】★★★
// 不正な時刻値によるクラッシュを防ぐため、データ処理を多段化し、
// 保存前に必須データの検証とフィルタリングを行う堅牢なロジックに変更する。
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
        const limit = 500;

        try {
            if (task_type === 'trade') {
                if (!symbol) throw new Error('Symbol is required for trade task.');
                records = await exchangeInstance.fetchMyTrades(symbol, since, limit);
            } else if (task_type === 'fiat') {
                // @ts-ignore
                const buys = await exchangeInstance.sapiGetFiatPayments({ transactionType: '0', beginTime: since }).then(r => r.data || []);
                // @ts-ignore
                const sells = await exchangeInstance.sapiGetFiatPayments({ transactionType: '1', beginTime: since }).then(r => r.data || []);
                records = [
                    ...buys.map(b => ({...b, transactionType: '0'})),
                    ...sells.map(s => ({...s, transactionType: '1'}))
                ];
            } else if (task_type === 'simple-earn') {
                // @ts-ignore
                const subscriptions = await exchangeInstance.sapiGetSimpleEarnFlexibleHistorySubscriptionRecord({ beginTime: since }).then(r => r.rows || []);
                // @ts-ignore
                const redemptions = await exchangeInstance.sapiGetSimpleEarnFlexibleHistoryRedemptionRecord({ beginTime: since }).then(r => r.rows || []);
                records = [...subscriptions, ...redemptions];
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

        //【最重要修正】クラッシュを避けるため、検証・変換処理を多段化する
        // Step 1: まず、各レコードを共通の中間形式に変換する（この時点では ts は変換しない）
        const intermediateRecords = records.map(r => {
            const isFiatPayment = task_type === 'fiat'; // タスクタイプで直接判断
            const isSimpleEarn = task_type === 'simple-earn';

            let rec: any = {};
            if (isFiatPayment) {
                const isBuy = r.transactionType === '0';
                rec = {
                    id: r.orderNo,
                    symbol: `${r.cryptoCurrency}/${r.fiatCurrency}`,
                    side: isBuy ? 'buy' : 'sell',
                    price: parseFloat(r.price),
                    amount: parseFloat(isBuy ? r.obtainAmount : r.sourceAmount),
                    fee: parseFloat(r.totalFee),
                    fee_asset: r.fiatCurrency,
                    ts: r.createTime
                };
            } else if (isSimpleEarn) {
                const isSubscription = !!r.purchaseId;
                rec = {
                    id: r.purchaseId || r.redeemId,
                    symbol: r.asset,
                    side: isSubscription ? 'earn_subscribe' : 'earn_redeem',
                    price: 1, 
                    amount: parseFloat(r.amount),
                    fee: 0, 
                    fee_asset: '',
                    ts: r.time
                };
            } else { 
                rec = { id: r.id || r.txid, symbol: r.symbol || r.currency, side: r.side || r.type, price: r.price, amount: r.amount, fee: r.fee?.cost, fee_asset: r.fee?.currency, ts: r.timestamp };
            }
            return {
                user_id: user.id, exchange: exchangeName, trade_id: rec.id ? String(rec.id) : null,
                symbol: rec.symbol, side: rec.side, 
                price: rec.price ?? 0, amount: rec.amount ?? 0, fee: rec.fee ?? 0, 
                fee_asset: rec.fee_asset,
                ts: rec.ts, // 生のタイムスタンプを保持
                raw_data: r,
            };
        });

        // Step 2 & 3: 必須項目(id, symbol, ts)が有効なレコードのみをフィルタし、安全に最終形式へ変換する
        const recordsToSave = intermediateRecords.filter(r => {
            const isValid = r.trade_id && r.symbol && r.ts;
            if (!isValid) {
                console.warn(`[WORKER] Filtering out invalid record due to missing id, symbol, or timestamp. Data:`, r.raw_data);
            }
            return isValid;
        }).map(r => {
            return { ...r, ts: new Date(r.ts).toISOString() }; // 安全なデータのみをISO文字列に変換
        });

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
