// supabase/functions/exchange-sync-all/index.ts

import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (userError || !user) throw new Error('User not found.');

    const { data: connections, error: connError } = await supabaseAdmin.from('exchange_connections').select('id, exchange, encrypted_blob').eq('user_id', user.id);
    if (connError) throw connError;
    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ message: "No exchange connections found.", totalSaved: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const allTradesToUpsert = [];
    const since = Date.now() - 90 * 24 * 60 * 60 * 1000; 

    for (const conn of connections) {
      console.log(`[LOG] Processing ${conn.exchange}...`);
      if (!conn.encrypted_blob) { console.warn(`[WARN] Skipping ${conn.exchange} due to missing blob.`); continue; }
      
      const credentials = await decryptBlob(conn.encrypted_blob);
      const exchangeInstance = new ccxt[conn.exchange]({ apiKey: credentials.apiKey, secret: credentials.apiSecret, password: credentials.apiPassphrase });
      let trades = [];
      
      console.log(`[LOG] Fetching trades since ${new Date(since).toISOString()}`);

      if (conn.exchange === 'binance') {
        // [最終最重要修正] JPYを含む全ての可能性を考慮し、シンボルを完全に動的検出する
        console.log("[LOG] Binance: Fetching balance and loading all markets...");
        const balance = await exchangeInstance.fetchBalance();
        const markets = await exchangeInstance.loadMarkets();
        
        const heldAssets = Object.keys(balance.total).filter(asset => balance.total[asset] > 0);
        console.log(`[LOG] Binance: User holds assets: ${heldAssets.join(', ')}`);

        const symbolsToFetch = new Set<string>();
        const allMarketSymbols = Object.keys(markets);

        // 保有資産と、全市場情報をクロスチェックし、可能性のある全シンボルを洗い出す
        for (const asset of heldAssets) {
            for (const marketSymbol of allMarketSymbols) {
                if (marketSymbol === `${asset}/JPY` || marketSymbol === `${asset}/USDT` || marketSymbol === `${asset}/BUSD`) {
                    symbolsToFetch.add(marketSymbol);
                }
            }
        }
        
        if (symbolsToFetch.size === 0) {
          console.log("[LOG] Binance: No relevant symbols (like .../JPY, .../USDT) found from balance.");
        } else {
          console.log(`[LOG] Binance: Found symbols to check: ${Array.from(symbolsToFetch).join(', ')}`);
          for (const symbol of symbolsToFetch) {
            try {
              const symbolTrades = await exchangeInstance.fetchMyTrades(symbol, since);
              if (symbolTrades.length > 0) {
                console.log(`[LOG] Binance: SUCCESS! Found ${symbolTrades.length} trades for ${symbol}`);
                trades.push(...symbolTrades);
              }
            } catch (e) { console.warn(`[WARN] Binance: Could not fetch trades for ${symbol}. It's ok.`, e.message); }
          }
        }
      } else {
        console.log(`[LOG] ${conn.exchange}: Fetching all trades...`);
        trades = await exchangeInstance.fetchMyTrades(undefined, since);
      }

      console.log(`[LOG] Found a total of ${trades.length} trades for ${conn.exchange}.`);
      if (trades.length > 0) {
        allTradesToUpsert.push(...trades.map(trade => ({ user_id: user.id, exchange: conn.exchange, raw_data: trade })));
      }
    }
    
    let totalSavedCount = 0;
    if (allTradesToUpsert.length > 0) {
      console.log(`[LOG] Upserting ${allTradesToUpsert.length} trades to the database...`);
      const { data, error } = await supabaseAdmin.from('exchange_trades').upsert(allTradesToUpsert, { onConflict: "user_id,exchange,(raw_data->>'id')" }).select();
      if (error) throw error;
      totalSavedCount = data?.length ?? 0;
      console.log(`[LOG] VICTORY! Successfully upserted ${totalSavedCount} trades.`);
    } else {
      console.log("[LOG] No new trades found across all exchanges to save.");
    }

    return new Response(JSON.stringify({ message: `Sync complete.`, totalSaved: totalSavedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error(`[CRASH] A critical error occurred in exchange-sync-all:`, err);
    return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
