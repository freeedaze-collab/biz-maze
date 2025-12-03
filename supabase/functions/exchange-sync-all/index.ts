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

// [最重要修正] ccxtの多様なレコードを、DBスキーマに正確にマッピングする
function transformRecord(record: any, userId: string, exchange: string) {
  // trade, deposit, withdrawalでIDのフィールド名が異なるため統一
  const recordId = record.id || record.txid;
  if (!recordId) {
    console.warn("[TRANSFORM-WARN] Record is missing a unique ID. Skipping:", record);
    return null; // IDがないレコードは処理不能なのでスキップ
  }

  // レコードタイプを判定 (trade, deposit, withdrawal)
  // 'side'があればtrade、なければ'type' (deposit/withdrawal) を使う
  const side = record.side || record.type;
  
  // symbolがなければcurrencyを使う (deposit/withdrawalのため)
  const symbol = record.symbol || record.currency;

  // priceがない場合(deposit/withdrawal)は0をセット
  const price = record.price ?? 0;
  
  // feeがない場合を考慮
  const fee_cost = record.fee?.cost;
  const fee_currency = record.fee?.currency;

  // すべてのNOT NULL制約カラムに値を提供する
  return {
    user_id: userId,
    exchange: exchange,
    trade_id: String(recordId), // UNIQUE制約(user_id, exchange, trade_id) のため
    symbol: symbol,             // NOT NULL
    side: side,                 // NOT NULL
    price: price,               // NOT NULL
    amount: record.amount,      // NOT NULL
    fee: fee_cost,              // NULL許容
    // fee_asset: fee_currency, // スキーマに存在しないため削除
    ts: new Date(record.timestamp).toISOString(), // NOT NULL
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

    let allRecordsToUpsert = [];
    const since = Date.now() - 90 * 24 * 60 * 60 * 1000; 

    for (const conn of connections) {
      console.log(`[LOG] Processing ${conn.exchange}...`);
      if (!conn.encrypted_blob) { console.warn(`[WARN] Skipping ${conn.exchange} due to missing blob.`); continue; }
      
      const credentials = await decryptBlob(conn.encrypted_blob);
      let allExchangeRecords: any[] = [];
      
      const exchangeInstance = new ccxt[conn.exchange]({
        apiKey: credentials.apiKey,
        secret: credentials.apiSecret,
        password: credentials.apiPassphrase,
        options: { 'defaultType': 'spot' }, // [修正] 'linear'エラーを回避するため、現物口座を明示
      });
      
      // 1. トレードの取得
      try {
        console.log(`[LOG] ${conn.exchange}: Fetching trades...`);
        // シンボル指定なしでエラーが出るため、保有資産からシンボルを特定して取得する
        await exchangeInstance.loadMarkets();
        const balance = await exchangeInstance.fetchBalance();
        const heldAssets = Object.keys(balance.total).filter(asset => balance.total[asset] > 0);
        const symbolsToFetch = new Set<string>();
        
        // JPYとUSDTペアを優先的に探す
        for (const asset of heldAssets) {
          if (exchangeInstance.markets[`${asset}/JPY`]) symbolsToFetch.add(`${asset}/JPY`);
          if (exchangeInstance.markets[`${asset}/USDT`]) symbolsToFetch.add(`${asset}/USDT`);
        }
        
        // もしJPY/USDTペアが見つからなければ、他の主要通貨とのペアも探す
        if (symbolsToFetch.size === 0) {
            for (const asset of heldAssets) {
                if (exchangeInstance.markets[`${asset}/BTC`]) symbolsToFetch.add(`${asset}/BTC`);
                if (exchangeInstance.markets[`${asset}/ETH`]) symbolsToFetch.add(`${asset}/ETH`);
            }
        }
        
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
      } catch (e) { console.error(`[WARN] ${conn.exchange}: Failed during trade fetching process.`, e.message); }

      // 2. 入金の取得
      if (exchangeInstance.has['fetchDeposits']) {
        try {
            console.log(`[LOG] ${conn.exchange}: Fetching deposits...`);
            const deposits = await exchangeInstance.fetchDeposits(undefined, since);
            if (deposits.length > 0) {
                console.log(`[LOG] ${conn.exchange}: Found ${deposits.length} deposits.`);
                allExchangeRecords.push(...deposits);
            }
        } catch (e) { console.warn(`[WARN] ${conn.exchange}: Could not fetch deposits.`, e.message); }
      }

      // 3. 出金の取得
      if (exchangeInstance.has['fetchWithdrawals']) {
        try {
            console.log(`[LOG] ${conn.exchange}: Fetching withdrawals...`);
            const withdrawals = await exchangeInstance.fetchWithdrawals(undefined, since);
            if (withdrawals.length > 0) {
                console.log(`[LOG] ${conn.exchange}: Found ${withdrawals.length} withdrawals.`);
                allExchangeRecords.push(...withdrawals);
            }
        } catch (e) { console.warn(`[WARN] ${conn.exchange}: Could not fetch withdrawals.`, e.message); }
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
      // [最終修正] 正しいユニーク制約カラムを指定してupsertを再実行
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

    return new Response(JSON.stringify({ message: `Sync complete.`, totalSaved: totalSavedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error(`[CRASH] A critical error occurred in the function:`, err);
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
