// supabase/functions/exchange-sync-all/index.ts

// [最重要修正] お客様の他のファイルに倣い、正しいデフォルトインポート形式に修正
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// お客様のコードに倣い、ccxtライブラリの標準形式でシンボルを定義
const BINANCE_SYMBOLS = ["BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT"];

// --- 復号ロジック (変更なし) ---
async function getKey() {
  const b64 = Deno.env.get("EDGE_KMS_KEY");
  if (!b64) throw new Error("EDGE_KMS_KEY secret is not set.");
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
}

async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> {
  const parts = blob.split(":");
  if (parts.length !== 3 || parts[0] !== 'v1') throw new Error("Invalid encrypted blob format.");
  const iv = decode(parts[1]);
  const ct = decode(parts[2]);
  const key = await getKey();
  const decryptedData = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(decryptedData));
}

// --- メインのサーバー処理 (変更なし) ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user } } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (!user) throw new Error('User not found.');

    const { data: connections, error: connError } = await supabaseAdmin
      .from('exchange_connections')
      .select('id, exchange, encrypted_blob')
      .eq('user_id', user.id);

    if (connError) throw connError;
    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ message: "No exchange connections found.", totalSaved: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const allTradesToUpsert = [];

    for (const conn of connections) {
      if (!conn.encrypted_blob) continue;
      
      const credentials = await decryptBlob(conn.encrypted_blob);
      const exchangeInstance = new ccxt[conn.exchange]({
        apiKey: credentials.apiKey,
        secret: credentials.apiSecret,
        password: credentials.apiPassphrase,
      });

      let trades = [];

      if (conn.exchange === 'binance') {
        for (const symbol of BINANCE_SYMBOLS) {
          try {
            const symbolTrades = await exchangeInstance.fetchMyTrades(symbol);
            if (symbolTrades.length > 0) trades.push(...symbolTrades);
          } catch (e) {
            console.warn(`Could not fetch trades for ${symbol} on Binance. Error: ${e.message}`);
          }
        }
      } else {
        trades = await exchangeInstance.fetchMyTrades();
      }

      if (trades.length > 0) {
        const tradesToUpsert = trades.map(trade => ({
            user_id: user.id,
            exchange: conn.exchange,
            raw_data: trade
        }));
        allTradesToUpsert.push(...tradesToUpsert);
      }
    }
    
    let totalSavedCount = 0;
    if (allTradesToUpsert.length > 0) {
      const { data, error } = await supabaseAdmin.from('exchange_trades').upsert(allTradesToUpsert, { onConflict: "user_id,exchange,(raw_data->>'id')" }).select();
      if (error) throw error;
      totalSavedCount = data?.length ?? 0;
    }

    return new Response(JSON.stringify({ message: `Sync complete.`, totalSaved: totalSavedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error(`!!!!!! Exchange Sync All Error !!!!!!`, err);
    return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
