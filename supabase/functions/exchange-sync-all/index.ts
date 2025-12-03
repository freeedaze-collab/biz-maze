
// supabase/functions/exchange-sync-all/index.ts

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

// --- 反復処理のStateは完全に削除 ---

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

// --- メインロジックをシンプル化 ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (userError || !user) throw new Error('User not found.');

    // フロントエンドからの指定を正しく受け取る
    const { exchange, since: sinceStr, until, symbols: symbolsStr } = await req.json();
    if (!exchange) throw new Error("Exchange is not specified");

    const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('user_id', user.id).eq('exchange', exchange).single();
    if (connError || !conn) throw new Error(`Connection not found for ${exchange}`);
    if (!conn.encrypted_blob) throw new Error(`Blob not found for ${exchange}`);

    const credentials = await decryptBlob(conn.encrypted_blob);
    const exchangeInstance = new ccxt[exchange]({
      apiKey: credentials.apiKey,
      secret: credentials.apiSecret,
      password: credentials.apiPassphrase,
      options: { 'defaultType': 'spot' }, 
    });

    console.log(`[LOG] Starting sync for ${exchange} for user ${user.id}`);
    await exchangeInstance.loadMarkets();

    // 期間の指定。指定がなければ過去90日間にフォールバック
    const since = sinceStr ? new Date(sinceStr).getTime() : Date.now() - 90 * 24 * 60 * 60 * 1000;

    const allRecords: any[] = [];
    
    // 1. 通貨ペアが指定されている場合の処理
    if (symbolsStr) {
        console.log(`[LOG] Syncing for specified symbols: ${symbolsStr}`);
        const symbols = symbolsStr.split(',').map(s => s.trim());
        const tradePromises = symbols.map(symbol => exchangeInstance.fetchMyTrades(symbol, since, undefined, { until }));
        const tradesBySymbol = await Promise.allSettled(tradePromises);

        for (const result of tradesBySymbol) {
            if (result.status === 'fulfilled') {
                allRecords.push(...result.value);
            }
        }
    // 2. 通貨ペアが指定されていない場合の処理 (最も効率的な方法)
    } else {
        console.log("[LOG] No symbols specified, fetching all relevant data.");

        // 先に入出金履歴を取得し、関連する通貨を特定 (最も効率的)
        const relevantAssets = new Set<string>();
        if (exchangeInstance.has['fetchDeposits']) {
            const deposits = await exchangeInstance.fetchDeposits(undefined, since, undefined, { until });
            allRecords.push(...deposits);
            deposits.forEach(d => relevantAssets.add(d.currency));
        }
        if (exchangeInstance.has['fetchWithdrawals']) {
            const withdrawals = await exchangeInstance.fetchWithdrawals(undefined, since, undefined, { until });
            allRecords.push(...withdrawals);
            withdrawals.forEach(w => relevantAssets.add(w.currency));
        }

        console.log(`[LOG] Found ${relevantAssets.size} relevant assets from deposits/withdrawals.`);

        // ccxtの統一メソッド `fetchMyTrades` を使い、全履歴を一度に取得
        // (内部でccxtが取引所ごとの最適化を行ってくれる)
        if (exchangeInstance.has['fetchMyTrades']) {
            const allTrades = await exchangeInstance.fetchMyTrades(undefined, since, undefined, { until });
            allRecords.push(...allTrades);
        }
    }

    if (allRecords.length === 0) {
        console.log("[LOG] No new records found.");
        return new Response(JSON.stringify({ totalSaved: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[LOG] Found a total of ${allRecords.length} records. Transforming and upserting...`);

    const transformedRecords = allRecords.map(r => transformRecord(r, user.id, exchange)).filter(r => r !== null);
    const uniqueRecords = Array.from(new Map(transformedRecords.map(r => [`${r.exchange}-${r.trade_id}`, r])).values());
    
    if (uniqueRecords.length === 0) {
        console.log("[LOG] No valid or new records to save after transformation.");
        return new Response(JSON.stringify({ totalSaved: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[LOG] Upserting ${uniqueRecords.length} unique records...`);

    const { data, error } = await supabaseAdmin.from('exchange_trades').upsert(uniqueRecords, { onConflict: 'user_id,exchange,trade_id' }).select();

    if (error) {
      console.error("[CRASH] DATABASE UPSERT FAILED:", error);
      throw error;
    }

    const totalSavedCount = data?.length ?? 0;
    console.log(`[LOG] VICTORY! Successfully upserted ${totalSavedCount} records.`);
    return new Response(JSON.stringify({ totalSaved: totalSavedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error(`[CRASH] A critical error occurred in the function:`, err);
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
