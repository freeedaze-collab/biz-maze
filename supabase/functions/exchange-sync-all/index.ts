// supabase/functions/exchange-sync-all/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import ccxt from 'https://esm.sh/ccxt@4.3.46'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

// --- 定数 ---
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const NINETY_DAYS_AGO = Date.now() - 90 * 24 * 60 * 60 * 1000;

// --- ヘルパー関数 (workerと共通) ---
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

// --- メインハンドラ (司令塔) ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (userError || !user) throw new Error('User not found.');

    const { exchange: targetExchange } = await req.json();
    if (!targetExchange) throw new Error("Exchange is required.");
    
    console.log(`[ALL - PREP] Received sync request for ${targetExchange}. User: ${user.id}`);

    const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('id, exchange, encrypted_blob').eq('user_id', user.id).eq('exchange', targetExchange).single();
    if (connError || !conn) throw new Error(`Connection not found for ${targetExchange}`);
    if (!conn.encrypted_blob) throw new Error(`Encrypted blob not found for ${targetExchange}`);

    const credentials = await decryptBlob(conn.encrypted_blob);
    
    // @ts-ignore
    const exchange = new ccxt[conn.exchange]({
        apiKey: credentials.apiKey,
        secret: credentials.apiSecret,
        password: credentials.apiPassphrase,
    });

    await exchange.loadMarkets();

    // ★ STEP 1: 関連アセット特定のため、残高・入出金を取得
    console.log(`[ALL - PREP] Fetching balance, deposits, and withdrawals...`);
    const relevantAssets = new Set<string>();
    const initialRecords: any[] = []; // 入出金履歴を格納

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
    console.log(`[ALL - PREP] Found ${relevantAssets.size} relevant assets and ${initialRecords.length} initial records.`);

    // ★ STEP 2: 関連アセットに基づいて、調査対象の取引ペアリストを作成
    const marketsToCheck = new Set<string>();
    const quoteCurrencies = ['USDT', 'BTC', 'BUSD', 'USDC', 'JPY', 'ETH', 'BNB'];
    relevantAssets.forEach(asset => {
        quoteCurrencies.forEach(quote => {
            if (asset === quote) return;
            if (exchange.markets[`${asset}/${quote}`]?.spot) marketsToCheck.add(`${asset}/${quote}`);
            if (exchange.markets[`${quote}/${asset}`]?.spot) marketsToCheck.add(`${quote}/${asset}`);
        });
    });

    const marketsToFetch = Array.from(marketsToCheck);
    console.log(`[ALL - PREP] Found ${marketsToFetch.length} markets to fetch trades from.`);

    // ★ STEP 3: 「計画書」として、入出金履歴と取引ペアリストをクライアントに返す
    return new Response(JSON.stringify({
        initialRecords,
        marketsToFetch,
        encrypted_blob: conn.encrypted_blob // workerが再利用できるようにblobも渡す
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error(`[ALL - PREP CRASH]`, err.message);
    return new Response(JSON.stringify({ error: err.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
    });
  }
});
