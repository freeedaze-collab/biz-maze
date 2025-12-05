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

async function getKey() {
  const b64 = Deno.env.get("EDGE_KMS_KEY");
  if (!b64) throw new Error("EDGE_KMS_KEY secret is not set.");
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
}

async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> {
  const parts = blob.split(":"), iv = decode(parts[1]), ct = decode(parts[2]);
  const key = await getKey();
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(decrypted));
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
    const body = await req.json();
    const { user_id, exchange: exchangeName, encrypted_blob, markets } = body;
    if (!user_id || !encrypted_blob || !exchangeName || !markets?.length) {
      throw new Error("Missing required input.");
    }

    const creds = await decryptBlob(encrypted_blob);
    const exchange = new ccxt[exchangeName]( {
      apiKey: creds.apiKey,
      secret: creds.apiSecret,
      password: creds.apiPassphrase,
      options: { defaultType: 'spot' }
    });

    await exchange.loadMarkets();
    let totalSaved = 0;

    for (let i = 0; i < markets.length; i += TRADE_FETCH_BATCH_SIZE) {
      const batch = markets.slice(i, i + TRADE_FETCH_BATCH_SIZE);
      const trades = (await Promise.all(
        batch.map(sym => exchange.fetchMyTrades(sym, NINETY_DAYS_AGO).catch(() => []))
      )).flat();

      if (trades.length > 0) {
        const records = trades.map(r => transformRecord(r, user_id, exchangeName)).filter(Boolean);
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
