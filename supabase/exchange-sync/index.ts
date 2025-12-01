// supabase/functions/exchange-sync/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// CCXTライブラリをインポート
import ccxt from 'https://esm.sh/ccxt@4.3.40'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }) }

  try {
    // フロントエンドから 'exchange' 名を受け取る
    const { exchange } = await req.json()
    if (!exchange) throw new Error("Exchange name is required.");
    
    // 'binance' や 'coinbase' といった名前がccxtに存在するかチェック
    if (!ccxt.exchanges.includes(exchange)) {
      throw new Error(`Unsupported exchange: ${exchange}`);
    }

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user } } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (!user) throw new Error('Unauthorized.');

    // 環境変数から取引所名に応じたキーを取得 (例: BINANCE_API_KEY, COINBASE_API_KEY)
    const apiKey = Deno.env.get(`${exchange.toUpperCase()}_API_KEY`);
    const secret = Deno.env.get(`${exchange.toUpperCase()}_SECRET_KEY`);

    if (!apiKey || !secret) {
      throw new Error(`API keys for ${exchange} are not configured.`);
    }

    // CCXTを使って取引所インスタンスを動的に作成
    const exchangeInstance = new ccxt[exchange]({ apiKey, secret });

    // 取引履歴を取得
    const trades = await exchangeInstance.fetchMyTrades();

    if (trades.length === 0) {
      return new Response(JSON.stringify({ message: 'No new trades found.', count: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // CCXTの統一されたデータ形式を、私たちのDBスキーマに合わせて変換
    const tradesToUpsert = trades.map(trade => ({
      user_id: user.id,
      exchange: exchange,
      symbol: trade.symbol,
      trade_id: trade.id,
      // 'info'フィールドに取引所固有の生データが全て入っている
      raw: trade.info,
    }));

    const { data: upsertData, error } = await supabaseAdmin
      .from('exchange_trades')
      .upsert(tradesToUpsert, { onConflict: 'trade_id, user_id' })
      .select();

    if (error) throw error;
    
    const count = upsertData?.length ?? 0;
    return new Response(JSON.stringify({ message: `Sync successful for ${exchange}. ${count} trades saved.`, count: count }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    // CCXTからのエラーもキャッチして表示
    const errorMessage = err instanceof ccxt.NetworkError ? `Network error connecting to exchange: ${err.message}` : err.message;
    console.error(`!!!!!! Exchange Sync Error: ${errorMessage} !!!!!!`, err);
    return new Response(JSON.stringify({ error: errorMessage }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
