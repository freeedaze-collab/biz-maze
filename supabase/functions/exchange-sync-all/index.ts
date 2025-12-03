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

    let allRecordsToInsert = [];
    const since = Date.now() - 90 * 24 * 60 * 60 * 1000; 

    for (const conn of connections) {
      console.log(`[LOG] Processing ${conn.exchange}...`);
      if (!conn.encrypted_blob) { console.warn(`[WARN] Skipping ${conn.exchange} due to missing blob.`); continue; }
      
      const credentials = await decryptBlob(conn.encrypted_blob);
      const exchangeInstance = new ccxt[conn.exchange]({
          apiKey: credentials.apiKey,
          secret: credentials.apiSecret,
          password: credentials.apiPassphrase,
      });

      let exchangeRecords: any[] = [];
      
      // 1. Fetch Trades
      try {
          console.log(`[LOG] ${conn.exchange}: Fetching trades...`);
          // Binanceの場合、 'type':'spot' を明示しないと 'linear' エラーが出るため、パラメータを追加
          const params = conn.exchange === 'binance' ? { 'type': 'spot' } : {};
          const trades = await exchangeInstance.fetchMyTrades(undefined, since, undefined, params);
          if (trades.length > 0) {
              console.log(`[LOG] ${conn.exchange}: Found ${trades.length} trades.`);
              exchangeRecords.push(...trades);
          }
      } catch (e) {
          // fetchMyTradesのエラーは警告としてログに出力し、処理を続行する
          console.warn(`[WARN] ${conn.exchange}: Could not fetch trades.`, e.message);
      }

      // 2. Fetch Deposits & Withdrawals (Binance specific for now)
      if (conn.exchange === 'binance') {
          try {
              console.log(`[LOG] Binance: Fetching deposits...`);
              const deposits = await exchangeInstance.fetchDeposits(undefined, since);
              if (deposits.length > 0) {
                  console.log(`[LOG] Binance: Found ${deposits.length} deposits.`);
                  exchangeRecords.push(...deposits);
              }
          } catch (e) { console.warn(`[WARN] Binance: Could not fetch deposits.`, e.message); }

          try {
              console.log(`[LOG] Binance: Fetching withdrawals...`);
              const withdrawals = await exchangeInstance.fetchWithdrawals(undefined, since);
              if (withdrawals.length > 0) {
                  console.log(`[LOG] Binance: Found ${withdrawals.length} withdrawals.`);
                  exchangeRecords.push(...withdrawals);
              }
          } catch (e) { console.warn(`[WARN] Binance: Could not fetch withdrawals.`, e.message); }
      }
      
      console.log(`[LOG] Found a total of ${exchangeRecords.length} records for ${conn.exchange}.`);
      if (exchangeRecords.length > 0) {
        const recordsToInsert = exchangeRecords.map(record => ({
          user_id: user.id,
          exchange: conn.exchange,
          raw_data: record // 全てのデータをそのままraw_dataに格納
        }));
        allRecordsToInsert.push(...recordsToInsert);
      }
    }
    
    let totalSavedCount = 0;
    if (allRecordsToInsert.length > 0) {
      console.log(`[LOG] Inserting ${allRecordsToInsert.length} records to the database...`);
      
      // ★★★ 修正点: upsertからinsertに変更 ★★★
      // これにより、onConflictエラーを回避し、まずは書き込みが成功するかを確認します。
      // 注意: このままでは重複データが登録される可能性があります。
      const { data, error } = await supabaseAdmin.from('exchange_trades').insert(allRecordsToInsert).select();
      
      if (error) {
          console.error("[CRASH] DATABASE INSERT FAILED:", error);
          throw error;
      }
      totalSavedCount = data?.length ?? 0;
      console.log(`[LOG] SUCCESS! Inserted ${totalSavedCount} records.`);
    } else {
      console.log("[LOG] No new records found across all exchanges to save.");
    }

    return new Response(JSON.stringify({ message: `Sync complete. Inserted ${totalSavedCount} records. Duplicates may exist.`, totalSaved: totalSavedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error(`[CRASH] A critical error occurred in the function:`, err);
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
