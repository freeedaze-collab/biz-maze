// supabase/functions/exchange-sync-all/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.40'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

// --- 定数 ---
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const NINETY_DAYS_AGO = Date.now() - 90 * 24 * 60 * 60 * 1000;
const TRADE_FETCH_BATCH_SIZE = 5; // タイムアウトを確実に回避するための、超・小規模バッチサイズ

// --- ヘルパー関数 ---
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
  if (!symbol || !side || !record.amount || !record.timestamp) return null;

  return {
    user_id: userId,
    exchange: exchange,
    trade_id: String(recordId),
    symbol: symbol,
    side: side,
    price: record.price ?? 0,
    amount: record.amount,
    fee: record.fee?.cost,
    fee_asset: record.fee?.currency,
    ts: new Date(record.timestamp).toISOString(),
    raw_data: record,
  };
}

// --- メインハンドラ ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (userError || !user) throw new Error('User not found.');

    const { exchange: targetExchange } = await req.json();
    const { data: conn } = await supabaseAdmin.from('exchange_connections').select('id, exchange, encrypted_blob').eq('user_id', user.id).eq('exchange', targetExchange).single();
    if (!conn || !conn.encrypted_blob) {
      return new Response(JSON.stringify({ message: `Connection for ${targetExchange} not found or blob is missing.`, totalSaved: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let totalSavedCount = 0;
    const credentials = await decryptBlob(conn.encrypted_blob);
    
    // 【最重要】認証情報を、ccxtが要求する、正しいキー名で渡す
    // @ts-ignore
    const exchange = new ccxt[conn.exchange]({
        apiKey: credentials.apiKey,
        secret: credentials.apiSecret, // 'secret' が正しいキー
        password: credentials.apiPassphrase, // 'password' が正しいキー
        options: { 'defaultType': 'spot' },
    });

    await exchange.loadMarkets();

    // ★ STEP 1: 関連アセットを特定するための情報を、全て、先に、取得する（prepの思想）
    console.log(`[${conn.exchange}] STEP 1: Fetching balance, deposits, and withdrawals to determine relevant assets...`);
    const relevantAssets = new Set<string>();
    const initialRecords: any[] = [];

    const balance = await exchange.fetchBalance().catch(() => ({ total: {} }));
    Object.keys(balance.total).filter(asset => balance.total[asset] > 0).forEach(asset => relevantAssets.add(asset));

    if (exchange.has['fetchDeposits']) {
        const deposits = await exchange.fetchDeposits(undefined, NINETY_DAYS_AGO).catch(() => []);
        deposits.forEach(d => relevantAssets.add(d.currency));
        initialRecords.push(...deposits);
    }

    if (exchange.has['fetchWithdrawals']) {
        const withdrawals = await exchange.fetchWithdrawals(undefined, NINETY_DAYS_AGO).catch(() => []);
        withdrawals.forEach(w => relevantAssets.add(w.currency));
        initialRecords.push(...withdrawals);
    }
    console.log(`[${conn.exchange}] Found ${relevantAssets.size} relevant assets and ${initialRecords.length} initial records.`);

    // ★ STEP 2: 取得した入出金履歴を、まずDBに保存する（負荷分散の、第一段階）
    if (initialRecords.length > 0) {
        const transformed = initialRecords.map(r => transformRecord(r, user.id, conn.exchange)).filter(Boolean);
        if (transformed.length > 0) {
            console.log(`[${conn.exchange}] STEP 2: Saving ${transformed.length} initial records (deposits/withdrawals)...`);
            const { data, error } = await supabaseAdmin.from('exchange_trades').upsert(transformed, { onConflict: 'user_id,exchange,trade_id' }).select();
            if (error) console.error('DB error (initial records):', error.message);
            else totalSavedCount += data?.length ?? 0;
        }
    }

    // ★ STEP 3: 確定した、完全な、アセットリストに基づき、取引履歴を、バッチ処理で、取得＆保存する（workerとsaveの、思想の、融合）
    if (exchange.has['fetchMyTrades']) {
        const marketsToCheck = new Set<string>();
        const quoteCurrencies = ['USDT', 'BTC', 'BUSD', 'USDC', 'JPY', 'ETH', 'BNB'];
        relevantAssets.forEach(asset => {
            quoteCurrencies.forEach(quote => {
                if (asset === quote) return;
                if (exchange.markets[`${asset}/${quote}`]?.spot) marketsToCheck.add(`${asset}/${quote}`);
                if (exchange.markets[`${quote}/${asset}`]?.spot) marketsToCheck.add(`${quote}/${asset}`);
            });
        });

        const symbols = Array.from(marketsToCheck);
        console.log(`[${conn.exchange}] STEP 3: Found ${symbols.length} markets to check for trades. Starting batched fetch and save...`);

        for (let i = 0; i < symbols.length; i += TRADE_FETCH_BATCH_SIZE) {
            const batch = symbols.slice(i, i + TRADE_FETCH_BATCH_SIZE);
            console.log(`[${conn.exchange}] Processing batch ${i / TRADE_FETCH_BATCH_SIZE + 1} of ${Math.ceil(symbols.length / TRADE_FETCH_BATCH_SIZE)}...`);
            
            const promises = batch.map(symbol => exchange.fetchMyTrades(symbol, NINETY_DAYS_AGO).catch(() => []));
            const tradesInBatch = (await Promise.all(promises)).flat();

            if (tradesInBatch.length > 0) {
                const transformed = tradesInBatch.map(r => transformRecord(r, user.id, conn.exchange)).filter(Boolean);
                if (transformed.length > 0) {
                    console.log(`[${conn.exchange}] Saving ${transformed.length} trades from this batch...`);
                    const { data, error } = await supabaseAdmin.from('exchange_trades').upsert(transformed, { onConflict: 'user_id,exchange,trade_id' }).select();
                    if (error) console.error(`DB error (trades batch ${i}):`, error.message);
                    else totalSavedCount += data?.length ?? 0;
                }
            }
        }
    }

    console.log(`[${conn.exchange}] VICTORY! Sync complete. Total records saved: ${totalSavedCount}`);
    return new Response(JSON.stringify({ message: `Sync complete for ${conn.exchange}.`, totalSaved: totalSavedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error(`[FATAL] Function crashed:`, err.message);
    return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
