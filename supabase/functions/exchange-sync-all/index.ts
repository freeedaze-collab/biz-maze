// supabase/functions/exchange-sync-all/index.ts
// // import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.46'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) throw new Error('Authorization header is missing.');

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authorization.replace('Bearer ', ''));
    if (userError || !user) throw new Error('User not found.');

    // Parse body for selective sync
    let body = {};
    try { body = await req.json(); } catch (e) { /* empty body ok */ }
    const { connection_id, exchange: exchangeName } = body as { connection_id?: any, exchange?: string };

    let query = supabaseAdmin.from('exchange_connections').select('id, exchange').eq('user_id', user.id);

    if (connection_id) {
      const idNum = parseInt(String(connection_id));
      console.log(`[ALL-COMMANDER] Sync requested for specific connection ID: ${idNum}`);
      query = query.eq('id', idNum);
    } else if (exchangeName) {
      console.log(`[ALL-COMMANDER] Sync requested for exchange: ${exchangeName}`);
      query = query.eq('exchange', exchangeName);
    }

    const { data: connections, error: connsError } = await query;
    if (connsError) throw new Error(`Failed to fetch connections: ${connsError.message}`);

    const connectionsToProcess = connections || [];
    if (connectionsToProcess.length === 0) {
      return new Response(JSON.stringify({ message: "No matching connections found." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[ALL-COMMANDER] Found ${connectionsToProcess.length} connection(s) to process.`);
    let totalDispatchedTasks = 0;

    for (const connRow of connectionsToProcess) {
      const currentExchangeName = connRow.exchange;
      const currentConnectionId = connRow.id;
      console.log(`[ALL-COMMANDER] Planning tasks for ${currentExchangeName} (Conn ID: ${currentConnectionId})`);

      const tasksToDispatch: any[] = [];
      const publicExchangeInstance = new ccxt[currentExchangeName]();

      // Unified capability-based task generation
      if (publicExchangeInstance.has['fetchDeposits']) tasksToDispatch.push({ task_type: 'deposits' });
      if (publicExchangeInstance.has['fetchWithdrawals']) tasksToDispatch.push({ task_type: 'withdrawals' });

      // Special/Proprietary endpoints for specific exchanges
      if (currentExchangeName === 'binance') {
        tasksToDispatch.push({ task_type: 'fiat' }, { task_type: 'simple-earn' });
        if (publicExchangeInstance.has['fetchConvertTradeHistory']) {
          tasksToDispatch.push({ task_type: 'convert' });
        }
      }

      // Asset awareness: Fetch symbols used in past trades AND deposits/withdrawals to fetch new history
      const { data: pastTrades, error: dbError } = await supabaseAdmin
        .from('exchange_trades')
        .select('symbol')
        .eq('exchange_connection_id', currentConnectionId);

      const relevantAssets = new Set<string>();
      if (pastTrades) {
        pastTrades.forEach(t => {
          if (t.symbol.includes('/')) {
            const parts = t.symbol.split('/');
            relevantAssets.add(parts[0]); relevantAssets.add(parts[1]);
          } else {
            relevantAssets.add(t.symbol);
          }
        });
      }

      // Seed common assets and stablecoins to ensure we find common pairs even for new connections
      ['BTC', 'ETH', 'USDT', 'USDC', 'DAI', 'JPY', 'BNB', 'SOL', 'AVAX', 'MATIC'].forEach(a => relevantAssets.add(a));

      await publicExchangeInstance.loadMarkets();
      const symbolsToFetch = new Set<string>();
      const majorCurrencies = ['USDT', 'USDC', 'BTC', 'ETH', 'JPY'];

      for (const asset of relevantAssets) {
        for (const currency of majorCurrencies) {
          const s1 = `${asset}/${currency}`;
          const s2 = `${currency}/${asset}`;
          if (publicExchangeInstance.markets[s1]) symbolsToFetch.add(s1);
          if (publicExchangeInstance.markets[s2]) symbolsToFetch.add(s2);
        }
      }

      tasksToDispatch.push(...Array.from(symbolsToFetch).map(s => ({ task_type: 'trade', symbol: s })));

      if (tasksToDispatch.length > 0) {
        console.log(`[ALL-COMMANDER] Dispatching ${tasksToDispatch.length} tasks for Conn ID ${currentConnectionId}...`);
        const allInvocations = tasksToDispatch.map(task =>
          supabaseAdmin.functions.invoke('exchange-sync-worker', {
            headers: { 'Authorization': authorization },
            body: { connection_id: currentConnectionId, ...task }
          })
        );
        await Promise.allSettled(allInvocations);
        totalDispatchedTasks += tasksToDispatch.length;
      }
    }

    const successMessage = `Dispatched ${totalDispatchedTasks} tasks for ${connectionsToProcess.length} connection(s).`;
    console.log(`[ALL-COMMANDER] ${successMessage}`);
    return new Response(JSON.stringify({ message: successMessage, count: totalDispatchedTasks }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error("[ALL-COMMANDER-CRASH]", err);
    return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  }
});
