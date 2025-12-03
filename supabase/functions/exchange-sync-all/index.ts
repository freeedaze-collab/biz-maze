

// supabase/functions/exchange-sync-all/index.ts

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

// ★ ステート（状態）の型定義
interface SyncState {
  marketsToProcess: string[];
  processedRecords: any[];
  since: number;
}

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
  if (!recordId) return null;
  const side = record.side || record.type;
  const symbol = record.symbol || record.currency;
  const price = record.price ?? 0;
  const fee_cost = record.fee?.cost;
  const fee_currency = record.fee?.currency;
  if (!symbol || !side || !record.amount || !record.timestamp) return null;

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (userError || !user) throw new Error('User not found.');

    const { exchange, state } = await req.json();
    if (!exchange) throw new Error("Exchange is not specified");

    const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('id, exchange, encrypted_blob').eq('user_id', user.id).eq('exchange', exchange).single();
    if (connError || !conn) throw new Error(`Connection not found for ${exchange}`);
    if (!conn.encrypted_blob) throw new Error(`Blob not found for ${exchange}`);

    const credentials = await decryptBlob(conn.encrypted_blob);
    const exchangeInstance = new ccxt[exchange]({
      apiKey: credentials.apiKey,
      secret: credentials.apiSecret,
      password: credentials.apiPassphrase,
      options: { 'defaultType': 'spot' }, 
    });

    // ========== ステート（状態）に応じた処理分岐 ========== 

    // 1. 初回リクエスト：初期設定を行い、処理すべき市場リストを返す
    if (!state) {
      console.log(`[LOG] Initializing sync for ${exchange}...`);
      await exchangeInstance.loadMarkets();
      const since = Date.now() - 90 * 24 * 60 * 60 * 1000;

      const relevantAssets = new Set<string>();
      const initialRecords: any[] = [];

      const balance = await exchangeInstance.fetchBalance();
      Object.keys(balance.total).filter(asset => balance.total[asset] > 0).forEach(asset => relevantAssets.add(asset));

      if (exchangeInstance.has['fetchDeposits']) {
        const deposits = await exchangeInstance.fetchDeposits(undefined, since);
        initialRecords.push(...deposits);
        deposits.forEach(d => relevantAssets.add(d.currency));
      }
      if (exchangeInstance.has['fetchWithdrawals']) {
        const withdrawals = await exchangeInstance.fetchWithdrawals(undefined, since);
        initialRecords.push(...withdrawals);
        withdrawals.forEach(w => relevantAssets.add(w.currency));
      }

      const quoteCurrencies = ['USDT', 'BTC', 'ETH', 'JPY', 'BUSD', 'USDC', 'BNB'];
      const marketsToProcess = new Set<string>();
      for (const asset of relevantAssets) {
        for (const quote of quoteCurrencies) {
          const symbol1 = `${asset}/${quote}`;
          if (exchangeInstance.markets[symbol1]?.spot) marketsToProcess.add(symbol1);
          const symbol2 = `${quote}/${asset}`;
          if (exchangeInstance.markets[symbol2]?.spot) marketsToProcess.add(symbol2);
        }
      }
      
      const nextState: SyncState = {
        marketsToProcess: Array.from(marketsToProcess),
        processedRecords: initialRecords,
        since: since
      };

      console.log(`[LOG] Initialization complete. Found ${nextState.marketsToProcess.length} markets to process.`);
      return new Response(JSON.stringify({ status: 'pending', state: nextState }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. 中間リクエスト：リストから1市場だけ処理し、残りの状態を返す
    const currentState: SyncState = state;
    if (currentState.marketsToProcess.length > 0) {
      const [marketToProcess, ...remainingMarkets] = currentState.marketsToProcess;
      console.log(`[LOG] Processing market: ${marketToProcess} (${remainingMarkets.length} remaining)`);

      const trades = await exchangeInstance.fetchMyTrades(marketToProcess, currentState.since);
      if (trades.length > 0) {
        console.log(`[LOG] Found ${trades.length} trades for ${marketToProcess}.`);
        currentState.processedRecords.push(...trades);
      }

      const nextState: SyncState = {
        ...currentState,
        marketsToProcess: remainingMarkets,
      };

      return new Response(JSON.stringify({ status: 'pending', state: nextState }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. 最終リクエスト：全市場の処理完了後、DBに保存
    console.log("[LOG] All markets processed. Upserting records to the database...");
    const allRecordsToUpsert = currentState.processedRecords
      .map(r => transformRecord(r, user.id, exchange))
      .filter(r => r !== null);

    if (allRecordsToUpsert.length === 0) {
      console.log("[LOG] No new records found to save.");
      return new Response(JSON.stringify({ status: 'complete', totalSaved: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 重複を排除
    const uniqueRecords = Array.from(new Map(allRecordsToUpsert.map(r => [`${r.exchange}-${r.trade_id}`, r])).values());
    console.log(`[LOG] Upserting ${uniqueRecords.length} unique records...`);

    const { data, error } = await supabaseAdmin.from('exchange_trades').upsert(uniqueRecords, { onConflict: 'user_id,exchange,trade_id' }).select();
    if (error) {
      console.error("[CRASH] DATABASE UPSERT FAILED:", error);
      throw error;
    }

    const totalSavedCount = data?.length ?? 0;
    console.log(`[LOG] VICTORY! Successfully upserted ${totalSavedCount} records.`);
    return new Response(JSON.stringify({ status: 'complete', totalSaved: totalSavedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error(`[CRASH] A critical error occurred in the function:`, err);
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
