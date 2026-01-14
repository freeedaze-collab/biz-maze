// supabase/functions/exchange-sync-worker/index.ts
// // import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

async function getKey() { return (await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"])) }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> { const p = blob.split(":"); const k = await getKey(); const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2])); return JSON.parse(new TextDecoder().decode(d)) }

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
        if (userError || !user) throw new Error('User not found.');

        // ★ MODIFICATION 1: Expect 'connection_id' from the commander
        const { connection_id, task_type, symbol } = await req.json();
        if (!connection_id || !task_type) throw new Error('connection_id and task_type are required.');

        // ★ MODIFICATION 2: Fetch connection details using the provided connection_id
        const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('exchange, encrypted_blob').eq('id', connection_id).eq('user_id', user.id).single();
        if (connError || !conn) throw new Error(`Connection not found for id: ${connection_id}`);
        const exchangeName = conn.exchange;

        console.log(`[WORKER] Starting task: ${task_type} for ${exchangeName} (Conn: ${connection_id}) ${symbol ? `on ${symbol}` : ''}`);

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
                const buys = await exchangeInstance.sapiGetFiatPayments({ transactionType: '0', beginTime: since }).then(r => r.data || []);
                const sells = await exchangeInstance.sapiGetFiatPayments({ transactionType: '1', beginTime: since }).then(r => r.data || []);
                records = [
                    ...buys.map(b => ({ ...b, transactionType: '0' })),
                    ...sells.map(s => ({ ...s, transactionType: '1' }))
                ];
            } else if (task_type === 'simple-earn') {
                const subscriptions = await exchangeInstance.sapiGetSimpleEarnFlexibleHistorySubscriptionRecord({ beginTime: since }).then(r => r.rows || []);
                const redemptions = await exchangeInstance.sapiGetSimpleEarnFlexibleHistoryRedemptionRecord({ beginTime: since }).then(r => r.rows || []);
                records = [...subscriptions, ...redemptions];
            } else if (task_type === 'deposits') {
                records = await exchangeInstance.fetchDeposits(undefined, since, limit);
            } else if (task_type === 'withdrawals') {
                records = await exchangeInstance.fetchWithdrawals(undefined, since, limit);
            } else if (task_type === 'convert') {
                records = await exchangeInstance.fetchConvertTradeHistory(undefined, since, limit);
            } else if (task_type === 'transfer') {
                records = await exchangeInstance.fetchTransfers(undefined, since, limit);
            }
        } catch (e) {
            console.warn(`[WORKER] API call failed for task ${task_type}. Error: ${e.message}`);
        }

        if (!records || records.length === 0) {
            return new Response(JSON.stringify({ message: "No new records for this category.", savedCount: 0 }), { headers: corsHeaders });
        }

        console.log(`[WORKER] Found ${records.length} records for task: ${task_type}`);

        const intermediateRecords = records.map(r => {
            let payment_amount: number | string | null = null;
            let rec: any = {};

            if (task_type === 'fiat') {
                const isBuy = r.transactionType === '0';
                payment_amount = parseFloat(isBuy ? r.sourceAmount : r.obtainAmount);
                rec = {
                    id: r.orderNo,
                    symbol: `${r.cryptoCurrency}/${r.fiatCurrency}`,
                    side: isBuy ? 'buy' : 'sell',
                    price: parseFloat(r.price),
                    amount: parseFloat(isBuy ? r.obtainAmount : r.sourceAmount),
                    fee: parseFloat(r.totalFee),
                    ts: r.createTime
                };
            } else if (task_type === 'simple-earn') {
                const isSubscription = !!r.purchaseId;
                payment_amount = parseFloat(r.amount);
                rec = {
                    id: r.purchaseId || r.redeemId,
                    symbol: r.asset,
                    side: isSubscription ? 'earn_subscribe' : 'earn_redeem',
                    price: 1,
                    amount: parseFloat(r.amount),
                    fee: 0,
                    ts: r.time
                };
            } else {
                payment_amount = r.cost;
                rec = {
                    id: r.id || r.txid,
                    symbol: r.symbol || r.currency,
                    side: r.side || r.type,
                    price: r.price,
                    amount: r.amount,
                    fee: r.fee?.cost,
                    ts: r.timestamp
                };
            }

            let value_usd: number | null = null;
            if (rec.symbol && rec.price != null && rec.amount != null) {
                const quoteCurrency = rec.symbol.split('/')[1];
                if (quoteCurrency === 'USD' || quoteCurrency === 'USDT') {
                    value_usd = rec.price * rec.amount;
                }
            }

            return {
                user_id: user.id,
                exchange: exchangeName,
                // ★ MODIFICATION 3: Add the connection ID to the final record
                exchange_connection_id: connection_id,
                trade_id: rec.id ? String(rec.id) : null,
                symbol: rec.symbol,
                side: rec.side,
                price: rec.price ?? 0,
                amount: rec.amount ?? 0,
                fee: rec.fee ?? 0,
                fee_currency: payment_amount ? String(payment_amount) : null,
                ts: rec.ts,
                value_usd: value_usd,
                raw_data: r,
            };
        });

        const recordsToSave = intermediateRecords.filter(r => {
            const isValidDate = r.ts && !isNaN(new Date(parseInt(String(r.ts), 10)).getTime());
            const isValid = r.trade_id && r.symbol && isValidDate;
            if (!isValid) {
                console.warn(`[WORKER] Filtering out invalid record due to missing id/symbol or invalid timestamp. Data:`, r.raw_data);
            }
            return isValid;
        }).map(r => {
            return { ...r, ts: new Date(parseInt(String(r.ts), 10)).toISOString() };
        });

        if (recordsToSave.length === 0) {
            return new Response(JSON.stringify({ message: "Fetched records were not in a savable format.", savedCount: 0 }), { headers: corsHeaders });
        }

        const { error: dbError, data: savedData } = await supabaseAdmin.from('exchange_trades').upsert(recordsToSave, { onConflict: 'user_id,exchange,trade_id' }).select();
        if (dbError) throw dbError;

        console.log(`[WORKER] VICTORY! Successfully saved ${savedData.length} records for task ${task_type}.`);
        return new Response(JSON.stringify({ message: `Saved ${savedData.length} records.`, savedCount: savedData.length }), { headers: corsHeaders });

    } catch (err) {
        console.error(`[WORK-CRASH] Unhandled exception for ${req.method} ${req.url}:`, err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
