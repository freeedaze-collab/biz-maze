// supabase/functions/exchange-sync-all/index.ts

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (userError || !user) throw new Error('User not found.');

    const { data: connections, error: connError } = await supabaseAdmin.from('exchange_connections').select('id, exchange, encrypted_blob').eq('user_id', user.id);
    if (connError) throw connError;
    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ message: "No exchange connections found.", totalSaved: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const allRecordsToUpsert = [];
    const since = Date.now() - 90 * 24 * 60 * 60 * 1000; 

    for (const conn of connections) {
      console.log(`[LOG] Processing ${conn.exchange}...`);
      if (!conn.encrypted_blob) {
        console.warn(`[WARN] Skipping ${conn.exchange} due to missing blob.`);
        continue;
      }
      
      const credentials = await decryptBlob(conn.encrypted_blob);
      let allExchangeRecords: any[] = [];
      
      const exchangeInstance = new ccxt[conn.exchange]({
          apiKey: credentials.apiKey,
          secret: credentials.apiSecret,
          password: credentials.apiPassphrase,
      });

      // [修正1] BinanceのfetchMyTradesに 'type':'spot' を指定する
      const params = conn.exchange === 'binance' ? { 'type': 'spot' } : {};

      // 1. トレードの取得
      try {
          console.log(`[LOG] ${conn.exchange}: Fetching trades...`);
          const trades = await exchangeInstance.fetchMyTrades(undefined, since, undefined, params);
          if (trades.length > 0) {
              console.log(`[LOG] ${conn.exchange}: Found ${trades.length} trades.`);
              allExchangeRecords.push(...trades);
          }
      } catch (e) { console.warn(`[WARN] ${conn.exchange}: Could not fetch trades.`, e.message); }

      // 2. 入金の取得 (Binanceのみ)
      if (conn.exchange === 'binance') {
          try {
              console.log("[LOG] Binance (Spot): Fetching deposits...");
              const deposits = await exchangeInstance.fetchDeposits(undefined, since);
              if (deposits.length > 0) {
                  console.log(`[LOG] Binance (Spot): Found ${deposits.length} deposits.`);
                  allExchangeRecords.push(...deposits);
              }
          } catch (e) { console.warn(`[WARN] Binance (Spot): Could not fetch deposits.`, e.message); }
      }

      // 3. 出金の取得 (Binanceのみ)
      if (conn.exchange === 'binance') {
          try {
              console.log("[LOG] Binance (Spot): Fetching withdrawals...");
              const withdrawals = await exchangeInstance.fetchWithdrawals(undefined, since);
              if (withdrawals.length > 0) {
                  console.log(`[LOG] Binance (Spot): Found ${withdrawals.length} withdrawals.`);
                  allExchangeRecords.push(...withdrawals);
              }
          } catch (e) { console.warn(`[WARN] Binance (Spot): Could not fetch withdrawals.`, e.message); }
      }
      
      console.log(`[LOG] Found a total of ${allExchangeRecords.length} records for ${conn.exchange}.`);
      if (allExchangeRecords.length > 0) {
        // [修正2] テーブル構造に合わせてデータを整形する
        const records = allExchangeRecords.map(record => ({
          user_id: user.id,
          exchange: conn.exchange,
          raw_data: record // 全てのデータをraw_dataに格納
        }));
        allRecordsToUpsert.push(...records);
      }
    }
    
    let totalSavedCount = 0;
    if (allRecordsToUpsert.length > 0) {
      console.log(`[LOG] Upserting ${allRecordsToUpsert.length} records to the database...`);
      // [修正2] onConflict句を実際のユニーク制約に合わせる
      const { data, error } = await supabaseAdmin.from('exchange_trades').upsert(allRecordsToUpsert, { onConflict: 'user_id,exchange,raw_data' }).select();
      
      if (error) {
          console.error("[CRASH] DATABASE UPSERT FAILED:", error);
          throw error;
      }
      totalSavedCount = data?.length ?? 0;
      console.log(`[LOG] VICTORY! Successfully upserted ${totalSavedCount} records.`);
    } else {
      console.log("[LOG] No new records found across all exchanges to save.");
    }

    return new Response(JSON.stringify({ message: `Sync complete.`, totalSaved: totalSavedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error(`[CRASH] A critical error occurred in the function:`, err);
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
