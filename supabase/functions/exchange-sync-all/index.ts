// File: exchange-sync-all/index.ts
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
const quoteCurrencies = ['USDT', 'BTC', 'BUSD', 'USDC', 'JPY', 'ETH', 'BNB'];

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error } = await supabase.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (error || !user) throw new Error("User not found.");

    const { exchange } = await req.json();
    const { data: conn, error: connError } = await supabase
      .from('exchange_connections')
      .select('id, exchange, encrypted_blob')
      .eq('user_id', user.id)
      .eq('exchange', exchange)
      .single();

    if (connError || !conn?.encrypted_blob) throw new Error("Exchange connection not found.");

    const decryptedStr = await decrypt(conn.encrypted_blob);
    const credentials = JSON.parse(decryptedStr);
    const ccxtExchange = new ccxt[exchange]({
      apiKey: credentials.apiKey,
      secret: credentials.apiSecret,
      password: credentials.apiPassphrase,
      options: { defaultType: 'spot' }
    });

    await ccxtExchange.loadMarkets();
    const balance = await ccxtExchange.fetchBalance();
    const deposits = ccxtExchange.has['fetchDeposits'] ? await ccxtExchange.fetchDeposits(undefined, NINETY_DAYS_AGO) : [];
    const withdrawals = ccxtExchange.has['fetchWithdrawals'] ? await ccxtExchange.fetchWithdrawals(undefined, NINETY_DAYS_AGO) : [];

    const relevantAssets = new Set<string>();
    Object.keys(balance.total).filter(a => balance.total[a] > 0).forEach(a => relevantAssets.add(a));
    deposits.forEach(d => relevantAssets.add(d.currency));
    withdrawals.forEach(w => relevantAssets.add(w.currency));

    const marketsToFetch = new Set<string>();
    for (const asset of relevantAssets) {
      for (const quote of quoteCurrencies) {
        if (asset === quote) continue;
        const s1 = `${asset}/${quote}`;
        const s2 = `${quote}/${asset}`;
        if (ccxtExchange.markets[s1]?.spot) marketsToFetch.add(s1);
        if (ccxtExchange.markets[s2]?.spot) marketsToFetch.add(s2);
      }
    }

    const functionBaseUrl = Deno.env.get('FUNCTION_ENDPOINT');
    if (!functionBaseUrl) throw new Error("FUNCTION_ENDPOINT is not set.");
    const workerUrl = `${functionBaseUrl}/exchange-sync-worker`;

    let totalSaved = 0;
    for (const market of marketsToFetch) {
      const res = await fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          exchange,
          encrypted_blob: conn.encrypted_blob,
          markets: [market]
        })
      });

      if (res.ok) {
        const { totalSaved: saved } = await res.json();
        totalSaved += saved ?? 0;
      } else {
        const err = await res.text();
        console.warn(`[WARN] Worker failed for market ${market}:`, err);
      }
    }

    return new Response(JSON.stringify({ message: `sync-all completed`, totalSaved }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("[SYNC-ALL ERROR]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
