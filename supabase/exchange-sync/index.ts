// supabase/functions/exchange-sync/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BINANCE_API_KEY = Deno.env.get('BINANCE_API_KEY')!
const BINANCE_SECRET_KEY = Deno.env.get('BINANCE_SECRET_KEY')!
const BINANCE_API_URL = 'https://api.binance.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }) }

  try {
    const { exchange } = await req.json()
    if (exchange.toLowerCase() !== 'binance') {
      throw new Error('Only Binance is supported at this time.')
    }

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user } } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (!user) throw new Error('Unauthorized.');

    const query = `timestamp=${Date.now()}`
    const signature = createHmac('sha256', BINANCE_SECRET_KEY).update(query).digest('hex')
    
    // 全ての取引シンボル(例: BTCUSDT, ETHUSDT)を取得
    const symbolsResponse = await fetch(`${BINANCE_API_URL}/api/v3/exchangeInfo`);
    const exchangeInfo = await symbolsResponse.json();
    const tradeableSymbols = exchangeInfo.symbols.map(s => s.symbol);

    let allTrades = [];
    console.log(`Fetching trades for ${tradeableSymbols.length} symbols...`);

    // 各シンボルごとに取引履歴を取得
    for (const symbol of tradeableSymbols) {
      const tradesQuery = `symbol=${symbol}&timestamp=${Date.now()}`
      const tradesSignature = createHmac('sha256', BINANCE_SECRET_KEY).update(tradesQuery).digest('hex')
      const url = `${BINANCE_API_URL}/api/v3/myTrades?${tradesQuery}&signature=${tradesSignature}`
      
      const response = await fetch(url, { headers: { 'X-MBX-APIKEY': BINANCE_API_KEY } });
      const trades = await response.json();

      if (Array.isArray(trades) && trades.length > 0) {
        allTrades.push(...trades);
      }
    }
    
    if (allTrades.length === 0) {
      return new Response(JSON.stringify({ message: 'No new trades found.', count: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tradesToUpsert = allTrades.map(trade => ({
      user_id: user.id,
      exchange: 'binance',
      symbol: trade.symbol,
      trade_id: trade.id.toString(), // trade_idを文字列として保存
      raw: trade, // Binanceからの生データをそのまま保存
    }));

    const { data: upsertData, error } = await supabaseAdmin
      .from('exchange_trades')
      .upsert(tradesToUpsert, { onConflict: 'trade_id, user_id' })
      .select();

    if (error) throw error;
    
    const count = upsertData?.length ?? 0;
    return new Response(JSON.stringify({ message: `Sync successful. ${count} trades saved.`, count: count }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error("!!!!!! Exchange Sync Error !!!!!!", err);
    return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
