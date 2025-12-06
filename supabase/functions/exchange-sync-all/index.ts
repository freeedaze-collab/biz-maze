
// supabase/functions/exchange-sync-all/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

// ★★★【最終・絶対修正：司令官の越権行為の禁止】★★★
// 司令官は、作戦計画の立案に専念し、一切、プライベートAPI（fetchBalanceなど）を呼び出さない。
// 関連市場の特定は、我々のDB内の既存データ（exchange_trades）のみを元に行う。
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

        // 1.【特殊任務の計画】APIアクセス不要
        // ccxtのインスタンスは、has[]のチェックのためだけに、認証情報なしで作成
        const publicExchangeInstance = new ccxt[exchangeName](); 
        if (publicExchangeInstance.has['fetchDeposits']) tasksToDispatch.push({ task_type: 'deposits' });
        if (publicExchangeInstance.has['fetchWithdrawals']) tasksToDispatch.push({ task_type: 'withdrawals' });
        if (exchangeName === 'binance' && publicExchangeInstance.has['fetchConvertTradeHistory']) tasksToDispatch.push({ task_type: 'convert' });
        console.log(`[ALL-COMMANDER] Planned special tasks: ${tasksToDispatch.map(t=>t.task_type).join(', ')}`);

        // 2.【市場取引の計画】DB内のデータのみを元に、APIアクセスなしで計画
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

        // もしDBに履歴が全くない場合、主要通貨だけでもスキャン対象に加える
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

        // 3.【司令部から工作員へ】全計画をワーカーに指令として渡す
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
