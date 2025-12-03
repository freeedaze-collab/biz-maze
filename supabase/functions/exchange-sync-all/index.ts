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

// ccxtのレコードをDBスキーマに正確にマッピングする関数
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
      });
      
      // ★★★★★ インテリジェント方式での取引取得 ★★★★★
      // 1. 売買履歴の取得
      try {
        console.log(`[LOG] ${conn.exchange}: Fetching trades intelligently...`);
        if (exchangeInstance.has['fetchMyTrades']) {
            await exchangeInstance.loadMarkets();

            // 1a. ユーザーの保有資産リストを取得
            const balance = await exchangeInstance.fetchBalance();
            const assets = Object.keys(balance.total).filter(asset => balance.total[asset] > 0);
            console.log(`[LOG] User has non-zero balance for: ${assets.join(', ') || 'none'}`);

            // 1b. 関連する可能性のある「現物」通貨ペアを構築
            const marketsToCheck = new Set<string>();
            const quoteCurrencies = ['USDT', 'BTC', 'ETH', 'JPY', 'BUSD', 'USDC']; // 主要な基軸通貨

            for (const asset of assets) {
                for (const quote of quoteCurrencies) {
                    const symbol1 = `${asset}/${quote}`;
                    if (exchangeInstance.markets[symbol1]?.spot) marketsToCheck.add(symbol1);
                    const symbol2 = `${quote}/${asset}`;
                    if (exchangeInstance.markets[symbol2]?.spot) marketsToCheck.add(symbol2);
                }
            }

            const symbols = Array.from(marketsToCheck);
            if (symbols.length > 0) {
                console.log(`[LOG] Checking for trades in ${symbols.length} relevant markets...`);

                // 1c. 関連する通貨ペアの取引履歴を一括（並列）で取得
                const promises = symbols.map(symbol =>
                    exchangeInstance.fetchMyTrades(symbol, since)
                        .then(trades => {
                            if (trades.length > 0) {
                                console.log(`[LOG] ${conn.exchange}: Found ${trades.length} trades for ${symbol}.`);
                                return trades;
                            }
                            return [];
                        })
                        .catch(e => {
                            console.warn(`[WARN] Could not fetch trades for symbol ${symbol}: ${e.message}`);
                            return [];
                        })
                );
                
                const tradesBySymbol = await Promise.all(promises);
                const allTrades = tradesBySymbol.flat();
                allExchangeRecords.push(...allTrades);
            } else {
                console.log(`[LOG] No relevant markets to check for trades based on current balances.`);
            }
        }
      } catch (e) {
          console.error(`[ERROR] ${conn.exchange}: Failed during intelligent trade fetching process.`, e.message);
      }

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
