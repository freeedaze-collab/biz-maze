
// supabase/functions/exchange-sync-all/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40' 
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

async function getKey() { return (await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"])) }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> { const p = blob.split(":"); const k = await getKey(); const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2])); return JSON.parse(new TextDecoder().decode(d)) }

// ★★★【司令塔・最終形態】★★★
// データ取得は一切行わず、「作戦計画書」の立案にのみ専念する
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
        if (userError || !user) throw new Error('User not found.');
        
        const { exchange: exchangeName } = await req.json();
        if (!exchangeName) throw new Error("Exchange is required.");

        console.log(`[ALL-COMMANDER] Received request to build a plan for ${exchangeName}.`);

        const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('user_id', user.id).eq('exchange', exchangeName).single();
        if (connError || !conn) throw new Error(`Connection not found for ${exchangeName}`);

        const credentials = await decryptBlob(conn.encrypted_blob!);
        
        // @ts-ignore
        const exchangeInstance = new ccxt[exchangeName]({ apiKey: credentials.apiKey, secret: credentials.apiSecret, password: credentials.apiPassphrase, options: { 'defaultType': 'spot' } });

        // === 作戦計画立案フェーズ ===

        // 1.【特別任務の特定】取引所がサポートする機能（入出金・両替）を特定
        const special_tasks: string[] = [];
        if (exchangeInstance.has['fetchDeposits']) {
            special_tasks.push('deposits');
        }
        if (exchangeInstance.has['fetchWithdrawals']) {
            special_tasks.push('withdrawals');
        }
        // 'convert' は binance のみ
        if (exchangeName === 'binance' && exchangeInstance.has['fetchConvertTradeHistory']) {
            special_tasks.push('convert');
        }
        console.log(`[ALL-COMMANDER] Identified special tasks: [${special_tasks.join(', ')}]`);


        // 2.【市場取引の調査対象を特定】
        // 資産を持つ通貨ペアを洗い出す（この処理は軽量なので司令塔が担当してOK）
        await exchangeInstance.loadMarkets();
        const balance = await exchangeInstance.fetchBalance().catch(() => ({ total: {} }));
        const relevantAssets = new Set<string>();
        Object.keys(balance.total).filter(asset => balance.total[asset] > 0).forEach(asset => relevantAssets.add(asset));
        
        // 保有資産がなくても、過去のDB記録から関連アセットを追加する
        const { data: recentTradeAssets } = await supabaseAdmin.from('exchange_trades').select('symbol').eq('user_id', user.id).eq('exchange', exchangeName);
        if(recentTradeAssets) {
             recentTradeAssets.forEach(trade => {
                 const assets = trade.symbol.split('/');
                 assets.forEach(a => relevantAssets.add(a));
             });
        }

        console.log(`[ALL-COMMANDER] Found ${relevantAssets.size} relevant assets for market trade search.`);
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
        console.log(`[ALL-COMMANDER] Created a plan with ${symbolList.length} spot market symbols.`);

        // 3.【作戦計画書の返却】
        return new Response(JSON.stringify({ 
            special_tasks: special_tasks,
            symbols: symbolList
        }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });

    } catch (err) {
        console.error(`[ALL-COMMANDER-CRASH]`, err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
