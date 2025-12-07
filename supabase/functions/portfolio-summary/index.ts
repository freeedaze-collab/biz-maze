

// supabase/functions/portfolio-summary/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import ccxt from 'https://esm.sh/ccxt@4.3.40'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

// 今後、ユーザーが複数の取引所を接続することを想定し、
// 主要な取引所のインスタンスを保持するオブジェクト
const exchanges = {
    binance: new ccxt.binance(),
};

async function getTickerPrice(asset: string, costCurrency: string) {
    // まず、コスト通貨とのペアを試す (例: BTC/JPY)
    try {
        const ticker1 = await exchanges.binance.fetchTicker(`${asset}/${costCurrency}`);
        if (ticker1 && ticker1.last) return { price: ticker1.last, currency: costCurrency };
    } catch (e) { /* 市場が存在しない場合は無視 */ }

    // 次に、主要なステーブルコインであるUSDTとのペアを試す
    try {
        const ticker2 = await exchanges.binance.fetchTicker(`${asset}/USDT`);
        if (ticker2 && ticker2.last) return { price: ticker2.last, currency: 'USDT' };
    } catch (e) { /* 市場が存在しない場合は無視 */ }
    
    // 主要な仮想通貨であるBTCとのペアを試す
     try {
        const ticker3 = await exchanges.binance.fetchTicker(`${asset}/BTC`);
        if (ticker3 && ticker3.last) return { price: ticker3.last, currency: 'BTC' };
    } catch (e) { /* 市場が存在しない場合は無視 */ }

    // それでも見つからない場合はnullを返す
    return null;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not found');

        //【第一段階】で作成したv_holdingsビューを呼び出す
        const { data: holdings, error: holdingsError } = await supabase.from('v_holdings').select('*');
        if (holdingsError) throw new Error(`Failed to fetch holdings: ${holdingsError.message}`);
        if (!holdings || holdings.length === 0) {
            return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 各資産の現在価格を取得する
        const portfolio = await Promise.all(holdings.map(async (holding) => {
            const ticker = await getTickerPrice(holding.asset, holding.cost_currency);

            const current_price = ticker?.price ?? null;
            const current_value = current_price ? current_price * holding.current_amount : null;
            const unrealized_pnl = current_value ? current_value - holding.total_cost : null;
            const unrealized_pnl_percent = (unrealized_pnl && holding.total_cost > 0) ? (unrealized_pnl / holding.total_cost) * 100 : null;

            return {
                ...holding,
                current_price,
                current_price_currency: ticker?.currency,
                current_value,
                unrealized_pnl,
                unrealized_pnl_percent
            };
        }));

        return new Response(JSON.stringify(portfolio), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
