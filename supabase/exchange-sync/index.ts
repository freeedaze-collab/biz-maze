// supabase/functions/exchange-sync/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import ccxt from 'https://esm.sh/ccxt@4.3.40'

// ★★★ お客様の実際の復号ロジックをここに実装してください ★★★
async function decrypt(encryptedKey: string): Promise<string> {
  // これはダミーの実装です。必ず実際の復号ロジックに置き換えてください。
  throw new Error("Decryption function not implemented in exchange-sync/index.ts");
}

const corsHeaders = { /* ... */ }; // 変更なし

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') { /* ... */ }
  try {
    const { exchange } = await req.json();
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user } } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (!user) throw new Error('Unauthorized.');

    const { data: conn, error: connError } = await supabaseAdmin
      .from('exchange_connections')
      .select('api_key_encrypted, secret_key_encrypted')
      .eq('user_id', user.id)
      .eq('exchange', exchange)
      .single();

    if (connError || !conn) throw new Error(`API connection for ${exchange} not found.`);

    const apiKey = await decrypt(conn.api_key_encrypted);
    const secret = await decrypt(conn.secret_key_encrypted);

    const exchangeInstance = new ccxt[exchange]({ apiKey, secret });
    const trades = await exchangeInstance.fetchMyTrades();

    if (trades.length === 0) {
      return new Response(JSON.stringify({ message: 'No new trades found.', count: 0 }), { headers: corsHeaders, 'Content-Type': 'application/json' });
    }

    const tradesToUpsert = trades.map(trade => ({
      user_id: user.id,
      exchange: exchange,
      trade_id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      price: trade.price,
      amount: trade.amount,
      ts: new Date(trade.timestamp).toISOString(),
      fee: trade.fee?.cost,
      fee_asset: trade.fee?.currency,
      raw_data: trade, // CCXTの統一オブジェクトをそのまま格納
    }));

    const { data, error } = await supabaseAdmin
      .from('exchange_trades')
      .upsert(tradesToUpsert, { onConflict: 'user_id, exchange, trade_id' })
      .select();

    if (error) throw error;
    return new Response(JSON.stringify({ message: `Sync successful for ${exchange}. ${data?.length ?? 0} trades saved.`, count: data?.length ?? 0 }), { headers: corsHeaders, 'Content-Type': 'application/json' });
  } catch (err) {
    console.error(`!!!!!! Exchange Sync Error !!!!!!`, err);
    return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders, 'Content-Type': 'application/json', status: 500 });
  }
});
