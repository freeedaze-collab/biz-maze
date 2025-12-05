// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.46'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- 復号ロジック (他と共通) ---
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

// --- メインハンドラ ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let exchangeName = 'unknown', symbol = 'unknown' // for logging
  try {
    // ★ 司令塔(クライアント)から、必要な情報を全て受け取る
    const { encrypted_blob, exchange, market } = await req.json();
    exchangeName = exchange;
    symbol = market;

    if (!encrypted_blob || !exchangeName || !symbol) {
      throw new Error("encrypted_blob, exchange, and market are required.");
    }

    console.log(`[WORKER] Received job for ${exchangeName} - ${symbol}`);

    const credentials = await decryptBlob(encrypted_blob);

    // @ts-ignore
    const ex = new ccxt[exchangeName]({
      apiKey: credentials.apiKey,
      secret: credentials.apiSecret,
      password: credentials.apiPassphrase,
      options: { 'defaultType': 'spot' },
    });

    // ★ workerでmarketsをロードするのは必須
    await ex.loadMarkets();

    const since = Date.now() - 90 * 24 * 60 * 60 * 1000;

    // ★ fetchMyTradesがサポートされているか、marketが存在するかを確認
    if (!ex.has['fetchMyTrades'] || !ex.markets[symbol]) {
        console.warn(`[WORKER] Market ${symbol} not available or fetchMyTrades not supported on ${exchangeName}. Skipping.`);
        return new Response(JSON.stringify([]), { // 何もせず、空の配列を返す
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const trades = await ex.fetchMyTrades(symbol, since);
    console.log(`[WORKER] Fetched ${trades.length} trades for ${symbol}`);

    // ★★★ 最重要 ★★★
    // workerは取得した「生」のデータを、そのまま返すだけに徹する。
    // 変換処理(transform)やDB保存は、後続の「save」関数が担当する。
    return new Response(JSON.stringify(trades), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error(`[WORKER CRASH - ${exchangeName} ${symbol}]`, err);
    // エラーが発生した場合も、クライアントが処理を継続できるよう、エラーメッセージを返す
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
