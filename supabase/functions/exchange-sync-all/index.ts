
// supabase/functions/exchange-sync-all/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40' 
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const NINETY_DAYS_AGO = Date.now() - 90 * 24 * 60 * 60 * 1000;

async function getKey() { /* ... */ return (await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"])) }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> { /* ... */ const p = blob.split(":"); const k = await getKey(); const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2])); return JSON.parse(new TextDecoder().decode(d)) }

// ★★★【最終形態】★★★
// Binance Convert（両替）履歴の取得機能を追加！
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
        if (userError || !user) throw new Error('User not found.');
        
        const { exchange: exchangeName } = await req.json();
        if (!exchangeName) throw new Error("Exchange is required.");

        console.log(`[ALL - Commander V3] Received request for ${exchangeName}.`);

        const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('user_id', user.id).eq('exchange', exchangeName).single();
        if (connError || !conn) throw new Error(`Connection not found for ${exchangeName}`);

        const credentials = await decryptBlob(conn.encrypted_blob!);
        
        // @ts-ignore
        const exchangeInstance = new ccxt[exchangeName]({ apiKey: credentials.apiKey, secret: credentials.apiSecret, password: credentials.apiPassphrase, options: { 'defaultType': 'spot' } });

        await exchangeInstance.loadMarkets();

        const relevantAssets = new Set<string>();
        const allNonTradeRecords: any[] = [];

        // 1. 残高を取得し、関連アセットを特定
        const balance = await exchangeInstance.fetchBalance().catch(() => ({ total: {} }));
        Object.keys(balance.total).filter(asset => balance.total[asset] > 0).forEach(asset => relevantAssets.add(asset));
        
        // 2. 入金履歴を取得
        if (exchangeInstance.has['fetchDeposits']) {
            const deposits = await exchangeInstance.fetchDeposits(undefined, NINETY_DAYS_AGO).catch(() => []);
            deposits.forEach(d => relevantAssets.add(d.currency));
            allNonTradeRecords.push(...deposits);
        }
        
        // 3. 出金履歴を取得
        if (exchangeInstance.has['fetchWithdrawals']) {
            const withdrawals = await exchangeInstance.fetchWithdrawals(undefined, NINETY_DAYS_AGO).catch(() => []);
            withdrawals.forEach(w => relevantAssets.add(w.currency));
            allNonTradeRecords.push(...withdrawals);
        }

        // 4. ★★★【新機能】Binance Convert（両替）履歴を取得 ★★★
        if (exchangeInstance.id === 'binance' && exchangeInstance.has['fetchConvertTradeHistory']) {
             console.log("[ALL - Commander V3] Fetching Binance Convert history...");
            // ccxtは `fetchConvertTradeHistory` のsinceをサポートしていないため、全件取得して後でフィルタリングする
            const convertTrades = await exchangeInstance.fetchConvertTradeHistory().catch(() => []);
            const recentConvertTrades = convertTrades.filter((t: any) => t.timestamp >= NINETY_DAYS_AGO);
            console.log(`[ALL - Commander V3] Found ${recentConvertTrades.length} recent Convert trades.`);
            allNonTradeRecords.push(...recentConvertTrades);
        }

        // 5. 取得した全ての非取引レコード（入出金・両替）をDBに保存
        let nonTradeCount = 0;
        if (allNonTradeRecords.length > 0) {
             // `transformRecord` をこの場で定義
            function transform(r: any, uid: string, ex: string) {
                // Convertのデータ構造は特殊なので、ここでアダプターを入れる
                if (r.info && r.info.orderId) { // Binance Convertの判定
                    const fromAsset = r.info.fromAsset;
                    const toAsset = r.info.toAsset;
                    const fromAmount = parseFloat(r.info.fromAmount);
                    const toAmount = parseFloat(r.info.toAmount);
                    const price = toAmount / fromAmount; 
                    return {
                        user_id:uid, exchange:ex, trade_id: String(r.info.orderId),
                        symbol: `${fromAsset}/${toAsset}`, side: 'convert', price: price,
                        amount: fromAmount, fee: 0, fee_asset: fromAsset,
                        ts: new Date(r.timestamp).toISOString(), raw_data: r
                    };
                }
                // 通常の入出金の処理
                const rid=r.id||r.txid; if(!rid)return null; const s=r.side||r.type; const sy=r.symbol||r.currency; if(!sy||!s||!r.amount||!r.timestamp)return null; return {user_id:uid,exchange:ex,trade_id:String(rid),symbol:sy,side:s,price:r.price??0,amount:r.amount,fee:r.fee?.cost,fee_asset:r.fee?.currency,ts:new Date(r.timestamp).toISOString(),raw_data:r}
            }
            const transformed = allNonTradeRecords.map(r => transform(r, user.id, exchangeName)).filter(r => r !== null);
            const { data, error } = await supabaseAdmin.from('exchange_trades').upsert(transformed, { onConflict: 'user_id,exchange,trade_id' });
            if(error) {  console.error("[ALL-CRASH] Upserting non-trades failed:", error); } else {
                nonTradeCount = data?.length ?? 0;
                console.log(`[ALL - Commander V3] Saved ${nonTradeCount} non-trade records (deposits, withdrawals, converts).`);
            }
        }

        // 6. 市場取引（Trade）のための調査計画を作成
        console.log(`[ALL - Commander V3] Found ${relevantAssets.size} relevant assets for market trade search.`);
        const symbolsToFetch = new Set<string>();
        const quoteCurrencies = ['JPY', 'USDT', 'BTC', 'ETH', 'BUSD', 'USDC', 'BNB'];
        relevantAssets.forEach(asset => {
            quoteCurrencies.forEach(quote => {
                if (asset === quote) return;
                const market1 = exchangeInstance.markets[`${asset}/${quote}`];
                if (market1 && market1.spot) symbolsToFetch.add(market1.symbol);
                const market2 = exchangeInstance.markets[`${quote}/${asset}`];
                if (market2 && market2.spot) symbolsToFetch.add(market2.symbol);
            });
        });
        
        const symbolList = Array.from(symbolsToFetch);
        console.log(`[ALL - Commander V3] Created a plan with ${symbolList.length} spot market symbols for ${exchangeName}.`);

        return new Response(JSON.stringify({ symbols: symbolList, nonTradeCount: nonTradeCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error(`[ALL - Commander V3 CRASH]`, err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
