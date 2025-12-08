
// supabase/functions/exchange-sync-all/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40' // 安定バージョンに固定
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

function transformRecord(record: any, userId: string, exchange: string) {
  const recordId = record.id || record.txid;
  if (!recordId) {
    console.warn("[TRANSFORM-WARN] Record is missing a unique ID. Skipping:", record);
    return null;
  }
  const side = record.side || record.type;
  const symbol = record.symbol || record.currency;
  const price = record.price ?? 0;
  const fee_cost = record.fee?.cost;
  const fee_currency = record.fee?.currency;
  if (!symbol || !side || !record.amount || !record.timestamp) {
      console.warn(`[TRANSFORM-WARN] Record is missing required fields. Skipping:`, record);
      return null;
  }
  return {
    user_id: userId,
    exchange: exchange,
    trade_id: String(recordId),
    symbol: symbol,
    side: side,
    price: price,
    amount: record.amount,
    fee: fee_cost,
    fee_asset: fee_currency,
    ts: new Date(record.timestamp).toISOString(),
    raw_data: record,
  };
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

    let allRecordsToUpsert: any[] = [];
    const since = Date.now() - 90 * 24 * 60 * 60 * 1000;

    for (const conn of connections) {
      console.log(`[LOG] Processing ${conn.exchange}...`);
      if (!conn.encrypted_blob) { console.warn(`[WARN] Skipping ${conn.exchange} due to missing blob.`); continue; }
      
      const credentials = await decryptBlob(conn.encrypted_blob);
      let allExchangeRecords: any[] = [];
      
      // @ts-ignore
      const exchangeInstance = new ccxt[conn.exchange]({
        apiKey: credentials.apiKey,
        secret: credentials.apiSecret,
        password: credentials.apiPassphrase,
        options: { 'defaultType': 'spot' },
      });
      
      await exchangeInstance.loadMarkets();

      // ★★★【最終・完全版ロジック】★★★

      // 1. アセットの網羅的洗い出し (残高＋入出金履歴)
      const relevantAssets = new Set<string>();
      console.log(`[LOG] ${conn.exchange}: Discovering relevant assets...`);

      // 1a. 残高からアセットを追加
      const balance = await exchangeInstance.fetchBalance().catch(() => ({ total: {} }));
      Object.keys(balance.total).filter(asset => balance.total[asset] > 0).forEach(asset => relevantAssets.add(asset));
      console.log(`[LOG] Found ${relevantAssets.size} assets from balance.`);

      // 1b. 入金履歴からアセットを追加 (ここで取得した入金は後で保存する)
      let deposits: any[] = [];
      if (exchangeInstance.has['fetchDeposits']) {
        try {
            deposits = await exchangeInstance.fetchDeposits(undefined, since);
            deposits.forEach(d => relevantAssets.add(d.currency));
            allExchangeRecords.push(...deposits);
            console.log(`[LOG] Found ${deposits.length} deposits & added their assets.`);
        } catch (e) { console.warn(`[WARN] ${conn.exchange}: Could not fetch deposits.`, e.message); }
      }

      // 1c. 出金履歴からアセットを追加 (ここで取得した出金は後で保存する)
      let withdrawals: any[] = [];
      if (exchangeInstance.has['fetchWithdrawals']) {
        try {
            withdrawals = await exchangeInstance.fetchWithdrawals(undefined, since);
            withdrawals.forEach(w => relevantAssets.add(w.currency));
            allExchangeRecords.push(...withdrawals);
            console.log(`[LOG] Found ${withdrawals.length} withdrawals & added their assets.`);
        } catch (e) { console.warn(`[WARN] ${conn.exchange}: Could not fetch withdrawals.`, e.message); }
      }
      console.log(`[LOG] Total unique relevant assets: ${relevantAssets.size}`);
      
      // 2. 網羅的な市場リストの作成
      const symbolsToFetch = new Set<string>();
      const quoteCurrencies = ['JPY', 'USDT', 'BTC', 'ETH', 'BUSD', 'USDC', 'BNB'];
      relevantAssets.forEach(asset => {
        quoteCurrencies.forEach(quote => {
          if (asset === quote) return;
          const pair1 = `${asset}/${quote}`;
          if (exchangeInstance.markets[pair1]) symbolsToFetch.add(pair1);
          const pair2 = `${quote}/${asset}`;
          if (exchangeInstance.markets[pair2]) symbolsToFetch.add(pair2);
        });
      });

      // 3. 売買履歴の取得
      console.log(`[LOG] Symbols to fetch trades for:`, Array.from(symbolsToFetch));
      for (const symbol of symbolsToFetch) {
        try {
          const trades = await exchangeInstance.fetchMyTrades(symbol, since);
          if (trades.length > 0) {
            console.log(`[LOG] ${conn.exchange}: Found ${trades.length} trades for ${symbol}.`);
            allExchangeRecords.push(...trades);
          }
        } catch (e) {
          console.warn(`[WARN] Could not fetch trades for symbol ${symbol}: ${e.message}`);
        }
      }
      
      console.log(`[LOG] Found a total of ${allExchangeRecords.length} records for ${conn.exchange}.`);
      if (allExchangeRecords.length > 0) {
        const transformed = allExchangeRecords.map(r => transformRecord(r, user.id, conn.exchange)).filter(r => r !== null);
        allRecordsToUpsert.push(...transformed);
      }
    }
    
    let totalSavedCount = 0;
    if (allRecordsToUpsert.length > 0) {
      console.log(`[LOG] Upserting ${allRecordsToUpsert.length} records to the database...`);
      const { data, error } = await supabaseAdmin.from('exchange_trades').upsert(allRecordsToUpsert, { onConflict: 'user_id,exchange,trade_id' }).select();
      
      if (error) {
          console.error("[CRASH] DATABASE UPSERT FAILED:", error);
          throw error;
      }
      totalSavedCount = data?.length ?? 0;
      console.log(`[LOG] VICTORY! Successfully upserted ${totalSavedCount} records.`);
    } else {
      console.log("[LOG] No new records found across all exchanges to save.");
    }

    return new Response(JSON.stringify({ message: 'Sync complete.', totalSaved: totalSavedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error(`[CRASH] A critical error occurred in the function:`, err);
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
