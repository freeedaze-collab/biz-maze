
// supabase/functions/exchange-sync-all/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

async function getKey() { return (await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"])) }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> { const p = blob.split(":"); const k = await getKey(); const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2])); return JSON.parse(new TextDecoder().decode(d)) }

// ★★★【司令官の復権】★★★
// フロントに計画を返すのではなく、司令部が直接ワーカーを起動(invoke)する方式に完全に戻す
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
        if (userError || !user) throw new Error('User not found.');

        const { exchange: exchangeName } = await req.json();
        if (!exchangeName) throw new Error('Exchange name is required.');
        console.log(`[ALL-COMMANDER] Received request to build a plan for ${exchangeName}.`);

        const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('user_id', user.id).eq('exchange', exchangeName).single();
        if (connError || !conn) throw new Error(`Connection not found for ${exchangeName}.`);

        const credentials = await decryptBlob(conn.encrypted_blob!);
        // @ts-ignore
        const exchangeInstance = new ccxt[exchangeName]({ apiKey: credentials.apiKey, secret: credentials.apiSecret, password: credentials.apiPassphrase });

        let tasksToDispatch: any[] = [];

        // 1.【特殊任務の特定】
        const specialTasks: string[] = [];
        if(exchangeInstance.has['fetchDeposits']) specialTasks.push('deposits');
        if(exchangeInstance.has['fetchWithdrawals']) specialTasks.push('withdrawals');
        if(exchangeName === 'binance' && exchangeInstance.has['fetchConvertTradeHistory']) specialTasks.push('convert');
        console.log(`[ALL-COMMANDER] Identified special tasks: [${specialTasks.join(', ')}]`);
        tasksToDispatch.push(...specialTasks.map(task => ({ task_type: task })));

        // 2.【市場取引の調査対象を特定】
        await exchangeInstance.loadMarkets();
        const balance = await exchangeInstance.fetchBalance().catch(() => ({ total: {} }));
        const relevantAssets = new Set<string>();
        Object.keys(balance.total).filter(asset => balance.total[asset] > 0).forEach(asset => relevantAssets.add(asset));
        const { data: recentTradeAssets } = await supabaseAdmin.from('exchange_trades').select('symbol').eq('user_id', user.id).eq('exchange', exchangeName);
        if(recentTradeAssets) {
             recentTradeAssets.forEach(trade => {
                 const assets = trade.symbol.split('/');
                 assets.forEach(a => relevantAssets.add(a));
             });
        }
        console.log(`[ALL-COMMANDER] Found ${relevantAssets.size} relevant assets for market trade search.`);
        
        const spotMarketSymbols = new Set<string>();
        if(exchangeInstance.symbols) {
            for (const symbol of exchangeInstance.symbols) {
                if (symbol.endsWith('/USDT') || symbol.endsWith('/BTC') || symbol.endsWith('/ETH') || symbol.endsWith('/JPY') || symbol.endsWith('/BUSD')) {
                    const base = symbol.split('/')[0];
                    const quote = symbol.split('/')[1];
                    if (relevantAssets.has(base) || relevantAssets.has(quote)) {
                        spotMarketSymbols.add(symbol);
                    }
                }
            }
        }
        console.log(`[ALL-COMMANDER] Created a plan with ${spotMarketSymbols.size} spot market symbols.`);
        tasksToDispatch.push(...Array.from(spotMarketSymbols).map(symbol => ({ task_type: 'trade', symbol: symbol })));

        // 3.【最終修正】司令部が直接、全ワーカーの出撃命令を出す
        console.log(`[ALL-COMMANDER] Dispatching ${tasksToDispatch.length} tasks to workers...`);

        const allInvocations = tasksToDispatch.map(task => 
            supabaseAdmin.functions.invoke('exchange-sync-worker', {
                body: { 
                    exchange: exchangeName, 
                    task_type: task.task_type,
                    symbol: task.symbol
                }
            })
        );

        const results = await Promise.allSettled(allInvocations);
        const successfulInvocations = results.filter(r => r.status === 'fulfilled').length;
        console.log(`[ALL-COMMANDER] Successfully dispatched ${successfulInvocations} out of ${tasksToDispatch.length} tasks.`);

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`[ALL-COMMANDER] Failed to dispatch task #${index} (${tasksToDispatch[index].task_type} ${tasksToDispatch[index].symbol || ''}):`, result.reason);
            }
        });

        return new Response(JSON.stringify({ message: `Dispatched ${successfulInvocations} tasks.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error("[ALL-COMMANDER-CRASH] Plan building failed:", err);
        return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});

