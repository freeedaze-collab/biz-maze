
// supabase/functions/exchange-sync-all/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40' 
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

async function getKey() { /* ... */ return (await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"])) }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> { /* ... */ const p = blob.split(":"); const k = await getKey(); const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2])); return JSON.parse(new TextDecoder().decode(d)) }

// ★★★【最終修正版】★★★
// "spot"(現物)市場を明確に指定
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
        if (userError || !user) throw new Error('User not found.');
        
        const { exchange: exchangeName } = await req.json();
        if (!exchangeName) throw new Error("Exchange is required.");

        console.log(`[ALL - Commander] Received request for ${exchangeName}.`);

        const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('user_id', user.id).eq('exchange', exchangeName).single();
        if (connError || !conn) throw new Error(`Connection not found for ${exchangeName}`);

        const credentials = await decryptBlob(conn.encrypted_blob!);
        
        // @ts-ignore
        const exchangeInstance = new ccxt[exchangeName]({
            apiKey: credentials.apiKey, 
            secret: credentials.apiSecret, 
            password: credentials.apiPassphrase,
            options: { 'defaultType': 'spot' }, // ★★★【最重要修正】現物取引を明示的に指定！
        });

        await exchangeInstance.loadMarkets();

        const relevantAssets = new Set<string>();
        const since = Date.now() - 90 * 24 * 60 * 60 * 1000;

        const balance = await exchangeInstance.fetchBalance().catch(() => ({ total: {} }));
        Object.keys(balance.total).filter(asset => balance.total[asset] > 0).forEach(asset => relevantAssets.add(asset));
        
        //【司令塔の責務】入出金もここで取得し、DBに保存する
        const allNonTradeRecords: any[] = [];
        if (exchangeInstance.has['fetchDeposits']) {
            const deposits = await exchangeInstance.fetchDeposits(undefined, since).catch(() => []);
            deposits.forEach(d => relevantAssets.add(d.currency));
            allNonTradeRecords.push(...deposits);
        }
        if (exchangeInstance.has['fetchWithdrawals']) {
            const withdrawals = await exchangeInstance.fetchWithdrawals(undefined, since).catch(() => []);
            withdrawals.forEach(w => relevantAssets.add(w.currency));
            allNonTradeRecords.push(...withdrawals);
        }
        // (transformRecordの定義はworkerと同じなので省略)
        function transform(r: any, uid: string, ex: string) { const rid=r.id||r.txid; if(!rid)return null; const s=r.side||r.type; const sy=r.symbol||r.currency; if(!sy||!s||!r.amount||!r.timestamp)return null; return {user_id:uid,exchange:ex,trade_id:String(rid),symbol:sy,side:s,price:r.price??0,amount:r.amount,fee:r.fee?.cost,fee_asset:r.fee?.currency,ts:new Date(r.timestamp).toISOString(),raw_data:r} }
        if (allNonTradeRecords.length > 0) {
            const transformed = allNonTradeRecords.map(r => transform(r, user.id, exchangeName)).filter(r => r !== null);
            await supabaseAdmin.from('exchange_trades').upsert(transformed, { onConflict: 'user_id,exchange,trade_id' });
            console.log(`[ALL - Commander] Saved ${transformed.length} deposit/withdrawal records.`);
        }

        console.log(`[ALL - Commander] Found ${relevantAssets.size} relevant assets for ${exchangeName}.`);

        const symbolsToFetch = new Set<string>();
        const quoteCurrencies = ['JPY', 'USDT', 'BTC', 'ETH', 'BUSD', 'USDC', 'BNB'];
        relevantAssets.forEach(asset => {
            quoteCurrencies.forEach(quote => {
                if (asset === quote) return;
                // ★★★ 現物(spot)市場のみをリストアップ ★★★
                const market1 = exchangeInstance.markets[`${asset}/${quote}`];
                if (market1 && market1.spot) symbolsToFetch.add(market1.symbol);
                const market2 = exchangeInstance.markets[`${quote}/${asset}`];
                if (market2 && market2.spot) symbolsToFetch.add(market2.symbol);
            });
        });
        
        const symbolList = Array.from(symbolsToFetch);
        console.log(`[ALL - Commander] Created a plan with ${symbolList.length} spot market symbols for ${exchangeName}.`);

        return new Response(JSON.stringify({ symbols: symbolList }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error(`[ALL - Commander CRASH]`, err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
