// File: exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import ccxt from 'https://esm.sh/ccxt@4.3.40';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const NINETY_DAYS_AGO = Date.now() - 89 * 24 * 60 * 60 * 1000;
const TRADE_FETCH_BATCH_SIZE = 5;

async function decrypt(blob: string): Promise<string> {
  const parts = blob.split(":");
  if (parts.length !== 3 || parts[0] !== "v1") throw new Error("Invalid encrypted blob format.");
  const iv = decode(parts[1]);
  const ct = decode(parts[2]);
  const keyRaw = Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", keyRaw, "AES-GCM", false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(decrypted);
}

function transformRecord(record: any, userId: string, exchange: string) {
  const id = record.id || record.txid;
  if (!id || !record.amount || !record.timestamp) return null;
  return {
    user_id: userId,
    exchange,
    trade_id: String(id),
    symbol: record.symbol || record.currency,
    side: record.side || record.type,
    price: record.price ?? 0,
    amount: record.amount,
    fee: record.fee?.cost,
    fee_asset: record.fee?.currency,
    ts: new Date(record.timestamp).toISOString(),
    raw_data: record
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (error || !user) throw new Error("User not found.");

    const body = await req.json();
    const { exchange: exchangeName, encrypted_blob, markets } = body;
    if (!encrypted_blob || !exchangeName || !markets?.length) throw new Error("Missing input.");

    const decryptedStr = await decrypt(encrypted_blob);
    const creds = JSON.parse(decryptedStr);
    const exchange = new ccxt[exchangeName]({
      apiKey: creds.apiKey,
      secret: creds.apiSecret,
      password: creds.apiPassphrase,
      options: { 'defaultType': 'spot' }
    });

    await exchange.loadMarkets();
    let totalSaved = 0;

    for (let i = 0; i < markets.length; i += TRADE_FETCH_BATCH_SIZE) {
      const batch = markets.slice(i, i + TRADE_FETCH_BATCH_SIZE);
      const trades = (await Promise.all(
        batch.map(sym => exchange.fetchMyTrades(sym, NINETY_DAYS_AGO).catch(() => []))
      )).flat();

      if (trades.length > 0) {
        const records = trades.map(r => transformRecord(r, user.id, exchangeName)).filter(Boolean);
        const { error: upsertError } = await supabaseAdmin.from('exchange_trades')
          .upsert(records, { onConflict: 'user_id,exchange,trade_id' });
        if (upsertError) console.error("[DB UPSERT ERROR]", upsertError);
        totalSaved += records.length;
      }
    }

    return new Response(JSON.stringify({ message: `Worker sync done`, totalSaved }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("[WORKER ERROR]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
