// supabase/functions/exchange-sync-all/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const authorization = req.headers.get('Authorization');
        if (!authorization) throw new Error('Authorization header is missing.');

        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authorization.replace('Bearer ', ''));
        if (userError || !user) throw new Error('User not found.');

        // ★ MODIFICATION 1: Expect 'connection_id' instead of 'exchangeName'
        const { connection_id } = await req.json();
        if (!connection_id) throw new Error('connection_id is required.');

        // Get the exchange name from the connection_id
        const { data: connection, error: connError } = await supabaseAdmin
            .from('exchange_connections')
            .select('exchange')
            .eq('id', connection_id)
            .eq('user_id', user.id) // Security check
            .single();

        if (connError || !connection) throw new Error(`Connection not found for id: ${connection_id}`);
        const exchangeName = connection.exchange;
        console.log(`[ALL-COMMANDER] Received plan request for: ${exchangeName} (Conn ID: ${connection_id})`);

        const tasksToDispatch: any[] = [];

        const publicExchangeInstance = new ccxt[exchangeName](); 
        if (publicExchangeInstance.has['fetchDeposits']) tasksToDispatch.push({ task_type: 'deposits' });
        if (publicExchangeInstance.has['fetchWithdrawals']) tasksToDispatch.push({ task_type: 'withdrawals' });
        if (exchangeName === 'binance') {
            tasksToDispatch.push({ task_type: 'fiat' });
            tasksToDispatch.push({ task_type: 'simple-earn'}); 
            if (publicExchangeInstance.has['fetchConvertTradeHistory']) {
                tasksToDispatch.push({ task_type: 'convert' });
            }
        }
        console.log(`[ALL-COMMANDER] Planned special tasks: ${tasksToDispatch.map(t=>t.task_type).join(', ')}`);

        console.log(`[ALL-COMMANDER] Finding relevant assets from internal database...`);
        const { data: pastTrades, error: dbError } = await supabaseAdmin.from('exchange_trades').select('symbol').eq('user_id', user.id).eq('exchange_connection_id', connection_id);
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

        if (tasksToDispatch.length === 0) {
            console.log(`[ALL-COMMANDER] No tasks to dispatch.`);
            return new Response(JSON.stringify({ message: `No tasks to dispatch.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        console.log(`[ALL-COMMANDER] Dispatching a total of ${tasksToDispatch.length} tasks to workers...`);
        
        // ★ MODIFICATION 2: Pass the 'connection_id' to the worker in the body
        const allInvocations = tasksToDispatch.map(task => 
            supabaseAdmin.functions.invoke('exchange-sync-worker', {
                headers: { 'Authorization': authorization },
                body: { connection_id: connection_id, ...task }
            })
        );

        await Promise.allSettled(allInvocations);

        console.log(`[ALL-COMMANDER] All ${tasksToDispatch.length} tasks have been dispatched.`);
        return new Response(JSON.stringify({ message: `Successfully dispatched ${tasksToDispatch.length} tasks for connection ${connection_id}.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error("[ALL-COMMANDER-CRASH] Plan building failed:", err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
