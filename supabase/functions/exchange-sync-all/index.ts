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

        // ★ MODIFICATION 1: Make body parsing optional and handle different scenarios
        let body = {};
        try { body = await req.json(); } catch (e) { /* Ignore parsing error if body is empty */ }
        const { connection_id, exchange: exchangeName } = body as { connection_id?: number, exchange?: string };

        let connectionsToProcess: {id: number, exchange: string}[] = [];
        let query = supabaseAdmin.from('exchange_connections').select('id, exchange').eq('user_id', user.id);

        if (connection_id) {
            console.log(`[ALL-COMMANDER] Sync requested for specific connection ID: ${connection_id}`);
            query = query.eq('id', connection_id);
        } else if (exchangeName) {
            console.log(`[ALL-COMMANDER] Sync requested for exchange: ${exchangeName}`);
            query = query.eq('exchange', exchangeName);
        } else {
            console.log(`[ALL-COMMANDER] Sync requested for ALL connections.`);
        }

        const { data: connections, error: connsError } = await query;
        if (connsError) throw new Error(`Failed to fetch connections: ${connsError.message}`);
        if (connections) {
            connectionsToProcess = connections;
        }

        if (connectionsToProcess.length === 0) {
            return new Response(JSON.stringify({ message: "No matching connections found to sync." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`[ALL-COMMANDER] Found ${connectionsToProcess.length} connection(s) to process.`);
        let totalDispatchedTasks = 0;

        // Loop through each connection and dispatch tasks for it
        for (const conn of connectionsToProcess) {
            const currentExchangeName = conn.exchange;
            const currentConnectionId = conn.id;
            console.log(`[ALL-COMMANDER] Planning tasks for ${currentExchangeName} (Conn ID: ${currentConnectionId})`);

            const tasksToDispatch: any[] = [];
            const publicExchangeInstance = new ccxt[currentExchangeName](); 

            // Special tasks
            if (publicExchangeInstance.has['fetchDeposits']) tasksToDispatch.push({ task_type: 'deposits' });
            if (publicExchangeInstance.has['fetchWithdrawals']) tasksToDispatch.push({ task_type: 'withdrawals' });
            if (currentExchangeName === 'binance') {
                tasksToDispatch.push({ task_type: 'fiat' });
                tasksToDispatch.push({ task_type: 'simple-earn'}); 
                if (publicExchangeInstance.has['fetchConvertTradeHistory']) {
                    tasksToDispatch.push({ task_type: 'convert' });
                }
            }

            // Market trade tasks
            const { data: pastTrades, error: dbError } = await supabaseAdmin.from('exchange_trades').select('symbol').eq('user_id', user.id).eq('exchange_connection_id', currentConnectionId);
            if (dbError) console.warn(`Could not fetch past trades for Conn ID ${currentConnectionId}: ${dbError.message}`);

            const relevantAssets = new Set<string>();
            if (pastTrades) {
                pastTrades.forEach(trade => {
                    const assets = trade.symbol.split('/');
                    if(assets.length === 2) { relevantAssets.add(assets[0]); relevantAssets.add(assets[1]); }
                });
            }
            if (relevantAssets.size === 0) { ['BTC', 'ETH', 'USDT', 'JPY'].forEach(a => relevantAssets.add(a)); }

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

            if (tasksToDispatch.length > 0) {
                console.log(`[ALL-COMMANDER] Dispatching ${tasksToDispatch.length} tasks for Conn ID ${currentConnectionId}...`);
                const allInvocations = tasksToDispatch.map(task => 
                    supabaseAdmin.functions.invoke('exchange-sync-worker', {
                        headers: { 'Authorization': authorization },
                        // ★ MODIFICATION 2: Pass the specific connection_id for this loop iteration
                        body: { connection_id: currentConnectionId, ...task }
                    })
                );
                await Promise.allSettled(allInvocations);
                totalDispatchedTasks += tasksToDispatch.length;
            }
        }

        const successMessage = `Successfully dispatched a total of ${totalDispatchedTasks} tasks for ${connectionsToProcess.length} connection(s).`;
        console.log(`[ALL-COMMANDER] ${successMessage}`);
        return new Response(JSON.stringify({ message: successMessage }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error("[ALL-COMMANDER-CRASH] Plan building failed:", err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});
