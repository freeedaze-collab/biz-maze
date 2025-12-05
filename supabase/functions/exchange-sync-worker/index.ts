// supabase/functions/exchange-sync-worker/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import ccxt from "https://esm.sh/ccxt@4.3.40";
import { decode as b64decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getKey() {
  const b64 = Deno.env.get("EDGE_KMS_KEY");
  if (!b64) throw new Error("EDGE_KMS_KEY secret is not set.");
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
}

async function decryptBlob(blob: string): Promise<{ apiKey: string; secret: string; password?: string }> {
  const parts = blob.split(":");
  if (parts.length !== 3 || parts[0] !== "v1") throw new Error("Invalid encrypted blob format.");
  const iv = b64decode(parts[1]);
  const ct = b64decode(parts[2]);
  const key = await getKey();
  const decryptedData = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(decryptedData));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { encrypted_blob, market, exchange_name, user_id } = body;
    if (!encrypted_blob || !market || !exchange_name || !user_id) {
      throw new Error("Missing required fields in request body.");
    }

    const { apiKey, secret, password } = await decryptBlob(encrypted_blob);
    const exchange = new ccxt[exchange_name]({
      apiKey,
      secret,
      password,
      options: { defaultType: "spot" },
    });

    console.log(`[WORKER] Fetching trades for ${market}`);
    let trades: any[] = [];
    if (exchange.has["fetchMyTrades"]) {
      try {
        await exchange.loadMarkets();
        if (exchange.markets[market]) {
          trades = await exchange.fetchMyTrades(market, Date.now() - 90 * 24 * 60 * 60 * 1000);
          console.log(`[WORKER] Got ${trades.length} trades for ${market}`);
        } else {
          console.warn(`[WORKER] Market ${market} not supported on ${exchange_name}`);
        }
      } catch (err) {
        console.error(`[WORKER] Failed to fetch trades:`, err);
        throw err;
      }
    } else {
      console.warn(`[WORKER] fetchMyTrades not supported on ${exchange_name}`);
    }

    const result = trades.map((t) => ({
      user_id,
      exchange: exchange_name,
      trade_id: String(t.id || t.txid),
      symbol: t.symbol,
      side: t.side,
      price: t.price ?? 0,
      amount: t.amount,
      fee: t.fee?.cost ?? null,
      fee_asset: t.fee?.currency ?? null,
      ts: new Date(t.timestamp).toISOString(),
      raw_data: t,
    }));

    return new Response(JSON.stringify({ records: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`[CRASH]`, err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
