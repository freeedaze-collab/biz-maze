
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

    // ★★★ フロントエンドからのリクエストボディを正しく処理 ★★★
    const body = await req.json();
    const targetExchange = body.exchange; // フロントは取引所を一つずつ指定してくる

    const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('id, exchange, encrypted_blob').eq('user_id', user.id).eq('exchange', targetExchange).single();
    if (connError) throw connError;
    if (!conn) {
      return new Response(JSON.stringify({ message: "No exchange connection found for " + targetExchange, totalSaved: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let allRecordsToUpsert = [];
    const since = Date.now() - 90 * 24 * 60 * 60 * 1000;

    console.log(`[LOG] Processing ${conn.exchange}...`);
    if (!conn.encrypted_blob) { throw new Error(`[ERROR] Skipping ${conn.exchange} due to missing blob.`); }
    
    const credentials = await decryptBlob(conn.encrypted_blob);
    let allExchangeRecords: any[] = [];
    
    // @ts-ignore
    const exchangeInstance = new ccxt[conn.exchange]({
      apiKey: credentials.apiKey,
      secret: credentials.apiSecret,
      password: credentials.apiPassphrase,
      options: { 'defaultType': 'spot' }, 
    });
    
    try {
      console.log(`[LOG] ${conn.exchange}: Fetching data via Sequential-Intelligent method...`);
      await exchangeInstance.loadMarkets();

      const relevantAssets = new Set<string>();
      
      // 1. 最初に、取引調査のヒントとなる情報を全て取得
      const balance = await exchangeInstance.fetchBalance();
      const balanceAssets = Object.keys(balance.total).filter(asset => balance.total[asset] > 0);
      balanceAssets.forEach(asset => relevantAssets.add(asset));
      console.log(`[LOG] Found ${balanceAssets.length} assets in balance.`);

      if (exchangeInstance.has['fetchDeposits']) {
          const deposits = await exchangeInstance.fetchDeposits(undefined, since);
          deposits.forEach(deposit => relevantAssets.add(deposit.currency));
          allExchangeRecords.push(...deposits);
          console.log(`[LOG] Found ${deposits.length} deposits.`);
      }

      if (exchangeInstance.has['fetchWithdrawals']) {
          const withdrawals = await exchangeInstance.fetchWithdrawals(undefined, since);
          withdrawals.forEach(withdrawal => relevantAssets.add(withdrawal.currency));
          allExchangeRecords.push(...withdrawals);
          console.log(`[LOG] Found ${withdrawals.length} withdrawals.`);
      }

      console.log(`[LOG] Total relevant assets: ${Array.from(relevantAssets).join(', ')}`);

      // 2. 資産リストを基に、売買履歴を調査
      if (exchangeInstance.has['fetchMyTrades']) {
          const marketsToCheck = new Set<string>();
          const quoteCurrencies = ['USDT', 'BTC', 'ETH', 'JPY', 'BUSD', 'USDC', 'BNB'];
          for (const asset of relevantAssets) {
              for (const quote of quoteCurrencies) {
                  const symbol1 = `${asset}/${quote}`;
                  if (exchangeInstance.markets[symbol1]?.spot) marketsToCheck.add(symbol1);
                  const symbol2 = `${quote}/${asset}`;
                  if (exchangeInstance.markets[symbol2]?.spot) marketsToCheck.add(symbol2);
              }
          }

          const symbols = Array.from(marketsToCheck);
          
          // ★★★★★ 最終修正：CPUタイムアウトを回避するため、並列処理(Promise.all)を直列処理(for...of)に変更 ★★★★★
          if (symbols.length > 0) {
            console.log(`[LOG] Checking for trades in ${symbols.length} relevant markets sequentially...`);
            const allTrades: ccxt.Trade[] = [];
            for (const symbol of symbols) {
                try {
                    const trades = await exchangeInstance.fetchMyTrades(symbol, since);
                    if (trades.length > 0) {
                        console.log(`[LOG] Found ${trades.length} trades for ${symbol}.`);
                        allTrades.push(...trades);
                    }
                } catch (e) {
                    console.warn(`[WARN] Could not fetch trades for symbol ${symbol}: ${e.message}`);
                }
            }
            if (allTrades.length > 0) {
                console.log(`[LOG] Found a total of ${allTrades.length} trades.`);
                allExchangeRecords.push(...allTrades);
            }
          } else {
            console.log(`[LOG] No relevant markets to check for trades.`);
          }
      }

    } catch (e) {
        console.error(`[ERROR] ${conn.exchange}: A critical error occurred during the fetch process.`, e.message);
    }
    
    console.log(`[LOG] Found a total of ${allExchangeRecords.length} records for ${conn.exchange}.`);
    if (allExchangeRecords.length > 0) {
      const transformed = allExchangeRecords.map(r => transformRecord(r, user.id, conn.exchange)).filter(r => r !== null);
      allRecordsToUpsert.push(...transformed);
    }
    
    let totalSavedCount = 0;
    if (allRecordsToUpsert.length > 0) {
      console.log(`[LOG] Upserting ${allRecordsToUpsert.length} records to the database...`);
      // フロントエンドからの呼び出しは単一の取引所に対するものなので、DB保存もここで行う
      const { data, error } = await supabaseAdmin.from('exchange_trades').upsert(allRecordsToUpsert, { onConflict: 'user_id,exchange,trade_id' }).select();
      if (error) {
          console.error("[CRASH] DATABASE UPSERT FAILED:", error);
          throw error;
      }
      totalSavedCount = data?.length ?? 0;
      console.log(`[LOG] VICTORY! Successfully upserted ${totalSavedCount} records for ${conn.exchange}.`);
    } else {
      console.log(`[LOG] No new records found for ${conn.exchange} to save.`);
    }

    // フロントエンドは、呼び出しごとにレスポンスを期待している
    return new Response(JSON.stringify({ message: `Sync complete for ${conn.exchange}.`, totalSaved: totalSavedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error(`[CRASH] A critical error occurred in the function:`, err);
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
