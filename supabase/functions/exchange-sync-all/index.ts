
// supabase/functions/exchange-sync-all/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

// KMSキーを取得する（変更なし）
async function getKey() {
  const b64 = Deno.env.get("EDGE_KMS_KEY");
  if (!b64) throw new Error("EDGE_KMS_KEY secret is not set.");
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
}

// 暗号化されたBLOBを復号する（変更なし）
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> {
  const parts = blob.split(":");
  if (parts.length !== 3 || parts[0] !== 'v1') throw new Error("Invalid encrypted blob format.");
  const iv = decode(parts[1]);
  const ct = decode(parts[2]);
  const key = await getKey();
  const decryptedData = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(decryptedData));
}

// レコードの形式をDBスキーマに合わせる（変更なし）
function transformRecord(record: any, userId: string, exchange: string) {
  const recordId = record.id || record.txid;
  if (!recordId) {
    // console.warn("[TRANSFORM-WARN] Record is missing a unique ID. Skipping:", record);
    return null;
  }
  const side = record.side || record.type;
  const symbol = record.symbol || record.currency;
  const price = record.price ?? 0;
  const fee_cost = record.fee?.cost;
  const fee_currency = record.fee?.currency;
  if (!symbol || !side || !record.amount || !record.timestamp) {
      // console.warn(`[TRANSFORM-WARN] Record is missing required fields. Skipping:`, record);
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

// メインのDeno serveハンドラ
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (userError || !user) throw new Error('User not found.');

    const body = await req.json();
    const targetExchange = body.exchange;

    const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('id, exchange, encrypted_blob').eq('user_id', user.id).eq('exchange', targetExchange).single();
    if (connError) throw connError;
    if (!conn) {
      return new Response(JSON.stringify({ message: "No exchange connection found for " + targetExchange, totalSaved: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const since = Date.now() - 90 * 24 * 60 * 60 * 1000;
    let totalSavedCount = 0;

    console.log(`[LOG] Processing ${conn.exchange}...`);
    if (!conn.encrypted_blob) { throw new Error(`[ERROR] Skipping ${conn.exchange} due to missing blob.`); }
    
    const credentials = await decryptBlob(conn.encrypted_blob);
    // @ts-ignore
    const exchangeInstance = new ccxt[conn.exchange]({
      apiKey: credentials.apiKey,
      secret: credentials.apiSecret,
      password: credentials.apiPassphrase,
      options: { 'defaultType': 'spot' }, 
    });
    
    try {
      console.log(`[LOG] ${conn.exchange}: Fetching initial data...`);
      await exchangeInstance.loadMarkets();

      let initialRecords: any[] = [];
      const relevantAssets = new Set<string>();
      
      const balance = await exchangeInstance.fetchBalance();
      const balanceAssets = Object.keys(balance.total).filter(asset => balance.total[asset] > 0);
      balanceAssets.forEach(asset => relevantAssets.add(asset));
      console.log(`[LOG] Found ${balanceAssets.length} assets in balance.`);

      if (exchangeInstance.has['fetchDeposits']) {
          const deposits = await exchangeInstance.fetchDeposits(undefined, since);
          deposits.forEach(deposit => relevantAssets.add(deposit.currency));
          initialRecords.push(...deposits);
          console.log(`[LOG] Found ${deposits.length} deposits.`);
      }

      if (exchangeInstance.has['fetchWithdrawals']) {
          const withdrawals = await exchangeInstance.fetchWithdrawals(undefined, since);
          withdrawals.forEach(withdrawal => relevantAssets.add(withdrawal.currency));
          initialRecords.push(...withdrawals);
          console.log(`[LOG] Found ${withdrawals.length} withdrawals.`);
      }
      
      // まず、入出金履歴をDBに保存する
      if(initialRecords.length > 0) {
        console.log(`[LOG] Saving ${initialRecords.length} initial records (deposits/withdrawals)...`);
        const transformed = initialRecords.map(r => transformRecord(r, user.id, conn.exchange)).filter(r => r !== null);
        const { data, error } = await supabaseAdmin.from('exchange_trades').upsert(transformed, { onConflict: 'user_id,exchange,trade_id' }).select();
        if (error) {
          console.error("[CRASH] DATABASE UPSERT FAILED for initial records:", error);
          throw error;
        }
        totalSavedCount += data?.length ?? 0;
        console.log(`[LOG] Saved ${data?.length ?? 0} initial records.`);
      }

      // ここから取引(trade)の取得と保存
      if (exchangeInstance.has['fetchMyTrades']) {
          const marketsToCheck = new Set<string>();
          const quoteCurrencies = ['USDT', 'BTC', 'BUSD', 'USDC', 'JPY', 'ETH', 'BNB'];
          for (const asset of relevantAssets) {
              for (const quote of quoteCurrencies) {
                  if (asset === quote) continue;
                  const symbol1 = `${asset}/${quote}`;
                  if (exchangeInstance.markets[symbol1]?.spot) marketsToCheck.add(symbol1);
                  const symbol2 = `${quote}/${asset}`;
                  if (exchangeInstance.markets[symbol2]?.spot) marketsToCheck.add(symbol2);
              }
          }

          const symbols = Array.from(marketsToCheck);
          
          if (symbols.length > 0) {
            console.log(`[LOG] Found ${symbols.length} relevant markets to check for trades.`);
            
            // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
            // ★【革命】「分割統治」戦略：CPUタイムアウトを回避するため、処理をバッチに分割 ★
            // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
            const batchSize = 10; // 一度に処理するAPI呼び出しの数
            for (let i = 0; i < symbols.length; i += batchSize) {
                const batch = symbols.slice(i, i + batchSize);
                console.log(`[LOG] Processing batch ${i/batchSize + 1} / ${Math.ceil(symbols.length/batchSize)}: ${batch.join(', ')}`);

                const tradePromises = batch.map(symbol =>
                    exchangeInstance.fetchMyTrades(symbol, since)
                        .catch(e => {
                            console.warn(`[WARN] Could not fetch trades for symbol ${symbol}: ${e.message}`);
                            return []; // エラーが発生しても、他の処理を止めずに空の配列を返す
                        })
                );
                
                const tradesByMarket = await Promise.all(tradePromises);
                const tradesInBatch = tradesByMarket.flat();

                if (tradesInBatch.length > 0) {
                    console.log(`[LOG] Found ${tradesInBatch.length} trades in this batch. Saving to DB...`);
                    const transformedTrades = tradesInBatch.map(r => transformRecord(r, user.id, conn.exchange)).filter(r => r !== null);
                    
                    // バッチごとに即座にDBに保存
                    const { data, error } = await supabaseAdmin.from('exchange_trades').upsert(transformedTrades, { onConflict: 'user_id,exchange,trade_id' }).select();
                    if (error) {
                        console.error(`[CRASH] DATABASE UPSERT FAILED for batch ${i/batchSize + 1}:`, error);
                        // 1つのバッチが失敗しても、次のバッチの処理を続ける
                    } else {
                        const savedInBatch = data?.length ?? 0;
                        totalSavedCount += savedInBatch;
                        console.log(`[LOG] Successfully saved ${savedInBatch} trades from this batch.`);
                    }
                } else {
                  console.log(`[LOG] No new trades found in this batch.`);
                }
            }
          }
      }

    } catch (e) {
        console.error(`[ERROR] ${conn.exchange}: A critical error occurred during the fetch process.`, e.message);
    }
    
    console.log(`[LOG] VICTORY! Sync complete for ${conn.exchange}. Total new records saved: ${totalSavedCount}.`);

    return new Response(JSON.stringify({ message: `Sync complete for ${conn.exchange}.`, totalSaved: totalSavedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error(`[CRASH] A critical error occurred in the function:`, err);
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
