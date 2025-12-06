
// supabase/functions/exchange-sync-all/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

async function getKey() { return (await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"])) }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> { const p = blob.split(":"); const k = await getKey(); const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2])); return JSON.parse(new TextDecoder().decode(d)) }

// ★★★【最終作戦：原点回帰・司令部】★★★
// 過去の正常コードのロジックを「作戦計画の立案」に特化させて再実装。
// タイムアウトを避けるため、APIの実行は全てワーカーに任せる。
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const authorization = req.headers.get('Authorization');
        if (!authorization) throw new Error('Authorization header is missing.');

        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authorization.replace('Bearer ', ''));
        if (userError || !user) throw new Error('User not found.');

        const { exchange: exchangeName } = await req.json();
        if (!exchangeName) throw new Error('Exchange name is required.');
        console.log(`[ALL-COMMANDER] Received plan request for: ${exchangeName}`);

        const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('user_id', user.id).eq('exchange', exchangeName).single();
        if (connError || !conn) throw new Error(`Connection not found for ${exchangeName}`);

        const credentials = await decryptBlob(conn.encrypted_blob!);
        // @ts-ignore
        const exchangeInstance = new ccxt[exchangeName]({ apiKey: credentials.apiKey, secret: credentials.apiSecret, password: credentials.apiPassphrase });

        const tasksToDispatch: any[] = [];

        // 1.【特殊任務の計画】過去コードにはなかった「Convert」も網羅
        if (exchangeInstance.has['fetchDeposits']) tasksToDispatch.push({ task_type: 'deposits' });
        if (exchangeInstance.has['fetchWithdrawals']) tasksToDispatch.push({ task_type: 'withdrawals' });
        if (exchangeName === 'binance' && exchangeInstance.has['fetchConvertTradeHistory']) tasksToDispatch.push({ task_type: 'convert' });
        console.log(`[ALL-COMMANDER] Planned special tasks: ${tasksToDispatch.map(t=>t.task_type).join(', ')}`);

        // 2.【市場取引の計画】過去コードの優れたロジックを完全に再現
        await exchangeInstance.loadMarkets();
        const balance = await exchangeInstance.fetchBalance();
        const heldAssets = Object.keys(balance.total).filter(asset => balance.total[asset] > 0);
        const symbolsToFetch = new Set<string>();
        const majorCurrencies = ['USDT', 'BTC', 'ETH', 'JPY', 'BUSD']; // JPYやBUSDも考慮

        for (const asset of heldAssets) {
            for (const currency of majorCurrencies) {
                if (exchangeInstance.markets[`${asset}/${currency}`]) symbolsToFetch.add(`${asset}/${currency}`);
                if (exchangeInstance.markets[`${currency}/${asset}`]) symbolsToFetch.add(`${currency}/${asset}`);
            }
        }
        console.log(`[ALL-COMMANDER] Found ${heldAssets.length} assets, planning to scan ${symbolsToFetch.size} relevant markets.`);
        tasksToDispatch.push(...Array.from(symbolsToFetch).map(symbol => ({ task_type: 'trade', symbol: symbol })));

        // 3.【司令部から工作員へ】全計画をワーカーに指令として渡す
        console.log(`[ALL-COMMANDER] Dispatching a total of ${tasksToDispatch.length} tasks to workers...`);
        const allInvocations = tasksToDispatch.map(task => 
            supabaseAdmin.functions.invoke('exchange-sync-worker', {
                headers: { 'Authorization': authorization },
                body: { exchange: exchangeName, ...task }
            })
        );

        await Promise.allSettled(allInvocations); // 司令官は指令を出したら完了

        console.log(`[ALL-COMMANDER] All ${tasksToDispatch.length} tasks have been dispatched.`);
        return new Response(JSON.stringify({ message: `Successfully dispatched ${tasksToDispatch.length} tasks.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error("[ALL-COMMANDER-CRASH] Plan building failed:", err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
