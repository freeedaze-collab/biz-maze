// supabase/functions/exchange-sync/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import ccxt from 'https://esm.sh/ccxt@4.3.40'

// ★★★ お客様の復号ロジックをここに実装してください ★★★
// Supabase Vaultを使用している場合、または他の暗号化ライブラリのコードをここに記述
async function decrypt(encryptedKey: string): Promise<string> {
  // これはダミーの実装です。必ず実際の復号ロジックに置き換えてください。
  // 例: const decrypted = await someDecryptFunction(encryptedKey, DECRYPTION_KEY);
  console.warn("Using placeholder decryption. API keys will not work.");
  // 開発中は、一時的に平文を返すことも可能です。
  // return encryptedKey; 
  throw new Error("Decryption function not implemented. Please edit exchange-sync/index.ts");
}

Deno.serve(async (req) => {
  // ... (CORSヘッダーは変更なし)
  try {
    const { exchange } = await req.json();
    if (!exchange) throw new Error("Exchange name is required.");

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user } } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (!user) throw new Error('Unauthorized.');

    // [最重要修正] ユーザーIDと取引所名で、DBからAPIキー情報を取得
    const { data: connection, error: connError } = await supabaseAdmin
      .from('exchange_connections')
      .select('api_key_encrypted, secret_key_encrypted')
      .eq('user_id', user.id)
      .eq('exchange', exchange)
      .single();

    if (connError || !connection) {
      throw new Error(`API connection details for ${exchange} not found for this user.`);
    }

    // 取得したキーを復号
    const apiKey = await decrypt(connection.api_key_encrypted);
    const secret = await decrypt(connection.secret_key_encrypted);

    const exchangeInstance = new ccxt[exchange]({ apiKey, secret });
    const trades = await exchangeInstance.fetchMyTrades();

    if (trades.length === 0) { /* ... */ }

    const tradesToUpsert = trades.map(trade => ({
      user_id: user.id,
      exchange: exchange,
      symbol: trade.symbol,
      trade_id: trade.id,
      raw: trade.info,
    }));

    const { data: upsertData, error } = await supabaseAdmin
      .from('exchange_trades')
      .upsert(tradesToUpsert, { onConflict: 'trade_id, user_id' })
      .select();
    
    // ... (以降の処理は変更なし)
  } catch (err) { /* ... */ }
});
