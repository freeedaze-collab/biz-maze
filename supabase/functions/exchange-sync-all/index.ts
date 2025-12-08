
// supabase/functions/exchange-sync-all/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

// ★★★【最終改修：ユーザー指摘の完全反映】★★★
// fiat(法定通貨購入)タスクに加え、bn-flexのような収益プロダクトの申込/償還を
// 取得するための `simple-earn` タスクを司令部の作戦計画に追加する。
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

        const tasksToDispatch: any[] = [];

        // 1.【特殊任務の計画】
        const publicExchangeInstance = new ccxt[exchangeName](); 
        if (publicExchangeInstance.has['fetchDeposits']) tasksToDispatch.push({ task_type: 'deposits' });
        if (publicExchangeInstance.has['fetchWithdrawals']) tasksToDispatch.push({ task_type: 'withdrawals' });
        if (exchangeName === 'binance') {
            tasksToDispatch.push({ task_type: 'fiat' });
            //【最重要修正】シンプルアーン（bn-flexなど）用のタスクを追加
            tasksToDispatch.push({ task_type: 'simple-earn'}); 
            if (publicExchangeInstance.has['fetchConvertTradeHistory']) {
                tasksToDispatch.push({ task_type: 'convert' });
            }
        }
        console.log(`[ALL-COMMANDER] Planned special tasks: ${tasksToDispatch.map(t=>t.task_type).join(', ')}`);

        // 2.【市場取引の計画】
        console.log(`[ALL-COMMANDER] Finding relevant assets from internal database...`);
        const { data: pastTrades, error: dbError } = await supabaseAdmin.from('exchange_trades').select('symbol').eq('user_id', user.id).eq('exchange', exchangeName);
        if (dbError) throw new Error(`Failed to fetch past trades from DB: ${dbError.message}`);

        const relevantAssets = new Set<string>();
        if(pastTrades) {
            pastTrades.forEach(trade => {
                const assets = trade.symbol.split('/');
                if(assets.length === 2) {
                    relevantAssets.add(assets[0]);
                    relevantAssets.add(assets[1]);
                }
            });
        }

        if (relevantAssets.size === 0) {
            console.log(`[ALL-COMMANDER] No past trades found. Adding default major assets to scan.`);
            ['BTC', 'ETH', 'USDT', 'JPY'].forEach(a => relevantAssets.add(a));
        }

        console.log(`[ALL-COMMANDER] Found ${relevantAssets.size} relevant assets. Planning market scan...`);

        await publicExchangeInstance.loadMarkets();
        const symbolsToFetch = new Set<string>();
        const majorCurrencies = ['USDT', 'BTC', 'ETH', 'JPY', 'BUSD'];

        for (const asset of relevantAssets) {
            for (const currency of majorCurrencies) {
                if (publicExchangeInstance.markets[`${asset}/${currency}`]) symbolsToFetch.add(`${asset}/${currency}`);
                if (publicExchangeInstance.markets[`${currency}/${asset}`]) symbolsToFetch.add(`${currency}/${asset}`);
            }
        }
        tasksToDispatch.push(...Array.from(symbolsToFetch).map(symbol => ({ task_type: 'trade', symbol: symbol })));

        // 3.【司令部から工作員へ】
        if (tasksToDispatch.length === 0) {
            console.log(`[ALL-COMMANDER] No tasks to dispatch.`);
            return new Response(JSON.stringify({ message: `No tasks to dispatch.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        console.log(`[ALL-COMMANDER] Dispatching a total of ${tasksToDispatch.length} tasks to workers...`);
        const allInvocations = tasksToDispatch.map(task => 
            supabaseAdmin.functions.invoke('exchange-sync-worker', {
                headers: { 'Authorization': authorization },
                body: { exchange: exchangeName, ...task }
            })
        );

        await Promise.allSettled(allInvocations);

        console.log(`[ALL-COMMANDER] All ${tasksToDispatch.length} tasks have been dispatched.`);
        return new Response(JSON.stringify({ message: `Successfully dispatched ${tasksToDispatch.length} tasks.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error("[ALL-COMMANDER-CRASH] Plan building failed:", err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
