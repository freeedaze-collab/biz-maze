import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import ccxt from 'https://esm.sh/ccxt@4.3.40';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

async function getKey() {
  const b64 = Deno.env.get("EDGE_KMS_KEY");
  if (!b64) throw new Error("EDGE_KMS_KEY secret is not set.");
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
}

async function decryptBlob(blob: string) {
  const [v, ivB64, ctB64] = blob.split(":");
  const iv = decode(ivB64);
  const ct = decode(ctB64);
  const key = await getKey();
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { exchange, encrypted_blob, markets } = await req.json();
    if (!exchange || !encrypted_blob || !Array.isArray(markets)) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    const credentials = await decryptBlob(encrypted_blob);
    const ccxtExchange = new ccxt[exchange]({
      apiKey: credentials.apiKey,
      secret: credentials.apiSecret,
      password: credentials.apiPassphrase,
      options: { defaultType: 'spot' }
    });

    await ccxtExchange.loadMarkets();

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let totalSaved = 0;
    for (const symbol of markets) {
      const trades = await ccxtExchange.fetchMyTrades(symbol);
      if (!trades || trades.length === 0) continue;

      const userRes = await supabase
        .from('exchange_connections')
        .select('user_id')
        .eq('exchange', exchange)
        .eq('encrypted_blob', encrypted_blob)
        .maybeSingle();

      const userId = userRes.data?.user_id;
      if (!userId) throw new Error("User not found");

      const existing = await supabase
        .from('exchange_trades')
        .select('external_id')
        .eq('user_id', userId)
        .eq('exchange', exchange)
        .in('external_id', trades.map(t => t.id));

      const existingIds = new Set(existing.data?.map((t) => t.external_id) ?? []);

      const newTrades = trades.filter((t) => !existingIds.has(t.id)).map((t) => ({
        user_id: userId,
        exchange,
        symbol: t.symbol,
        side: t.side,
        amount: t.amount,
        price: t.price,
        fee: t.fee?.cost ?? null,
        fee_currency: t.fee?.currency ?? null,
        external_id: t.id,
        raw_data: t,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        trade_id: t.order ?? null,
        fee_asset: t.fee?.currency ?? null,
        ts: new Date(t.timestamp).toISOString()
      }));

      if (newTrades.length > 0) {
        const { error } = await supabase.from('exchange_trades').insert(newTrades);
        if (error) throw error;
        totalSaved += newTrades.length;
      }
    }

    return new Response(JSON.stringify({ message: 'Sync complete', totalSaved }), {
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
