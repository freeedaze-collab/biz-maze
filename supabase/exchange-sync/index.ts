// supabase/functions/exchange-sync/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import ccxt from 'https://esm.sh/ccxt@4.3.40'

// --- ここからが復号ロジックの完全な実装です ---

// `exchange-save-keys` と全く同じマスターキー取得ロジック
async function getKey() {
  const b64 = Deno.env.get("EDGE_KMS_KEY");
  if (!b64) throw new Error("EDGE_KMS_KEY is not set in environment variables.");
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

// Base64デコードのためのヘルパー関数
function b64decode(s: string) {
  let bin = ""; atob(s).split("").forEach(c => bin += String.fromCharCode(c.charCodeAt(0)));
  const u8 = new Uint8Array(bin.length);
  for(let i=0; i<bin.length; i++) { u8[i] = bin.charCodeAt(i); }
  return u8;
}

// 暗号化された文字列を復号し、元のJSONオブジェクトに戻すメイン関数
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> {
  const parts = blob.split(":");
  if (parts.length !== 3 || parts[0] !== 'v1') {
    throw new Error("Invalid encrypted data format.");
  }
  const iv = b64decode(parts[1]);
  const ct = b64decode(parts[2]);
  const key = await getKey();
  
  const decryptedData = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  const jsonString = new TextDecoder().decode(decryptedData);
  
  return JSON.parse(jsonString);
}

// --- ここまでが復号ロジックの完全な実装です ---

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }) }
  try {
    const { exchange } = await req.json();
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user } } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (!user) throw new Error('Unauthorized.');

    const { data: conn, error: connError } = await supabaseAdmin
      .from('exchange_connections')
      .select('id, encrypted_blob, meta') // `encrypted_blob` を取得
      .eq('user_id', user.id)
      .eq('exchange', exchange)
      .single();

    if (connError || !conn || !conn.encrypted_blob) {
      throw new Error(`API connection details for ${exchange} not found or incomplete.`);
    }

    // `decryptBlob` を呼び出してAPIキーを復号
    const credentials = await decryptBlob(conn.encrypted_blob);

    const exchangeOptions = {
      apiKey: credentials.apiKey,
      secret: credentials.apiSecret,
    };
    if (exchange === "okx" && credentials.apiPassphrase) {
        exchangeOptions.password = credentials.apiPassphrase;
    }
    
    const exchangeInstance = new ccxt[exchange](exchangeOptions);
    const trades = await exchangeInstance.fetchMyTrades();

    // ... (以降のDB保存ロジックは変更なし)
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
      raw_data: trade,
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
