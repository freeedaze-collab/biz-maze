
// supabase/functions/exchange-sync-all/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import ccxt from "https://esm.sh/ccxt@4.3.46"
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- 共通の復号ロジック (変更なし) ---
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

// ★★★ お客様の洞察に基づき、ccxtを捨て、直接APIを呼び出すロジックを実装 ★★★
async function fetchBinanceTradesDirectly(apiKey: string, apiSecret: string, since: number): Promise<any[]> {
    console.log("[Binance Direct] Starting direct API fetch for trades.");
    const BINANCE_API_ENDPOINT = "https://api.binance.com";
    // Binance APIが要求する 'BTCUSDT' 形式のシンボルリスト (ccxtの '/' 区切りではない)
    const BINANCE_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"];
    const allTrades: any[] = [];

    // 各シンボルに対して、署名付きリクエストを作成
    for (const symbol of BINANCE_SYMBOLS) {
        const params = {
            symbol,
            startTime: since.toString(),
            limit: "1000",
            timestamp: Date.now().toString(),
        };
        const queryString = new URLSearchParams(params).toString();

        // HMAC-SHA256 署名の作成
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw', 
            encoder.encode(apiSecret), 
            { name: 'HMAC', hash: 'SHA-256' }, 
            false, 
            ['sign']
        );
        const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(queryString));
        const signature = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

        const url = `${BINANCE_API_ENDPOINT}/api/v3/myTrades?${queryString}&signature=${signature}`;

        try {
            const res = await fetch(url, { headers: { "X-MBX-APIKEY": apiKey } });
            if (!res.ok) {
                console.warn(`[Binance Direct] Failed to fetch trades for ${symbol}: ${res.statusText}`);
                continue; // 失敗した場合は次のシンボルへ
            }
            const trades = await res.json();
            if (trades.length > 0) {
                console.log(`[Binance Direct] Fetched ${trades.length} trades for ${symbol}.`);
                // ccxtのフォーマットに合わせるため、sourceとtypeを付与
                const formattedTrades = trades.map(t => ({ ...t, source: 'binance', type: 'trade' }));
                allTrades.push(...formattedTrades);
            }
        } catch (e) {
            console.warn(`[Binance Direct] Error fetching trades for ${symbol}:`, e);
        }
    }
    return allTrades;
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let exchange = 'unknown'
  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''))
    if (userError || !user) throw new Error(`User not found: ${userError?.message ?? 'Unknown error'}`)

    const body = await req.json()
    exchange = body.exchange
    if (!exchange) throw new Error("Exchange is required.")

    const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('user_id', user.id).eq('exchange', exchange).single();
    if (connError || !conn) throw new Error(`Connection not found for ${exchange}`);
    
    const credentials = await decryptBlob(conn.encrypted_blob);

    const since = Date.now() - 89 * 24 * 60 * 60 * 1000;

    // ccxtインスタンスは、入出金取得と、Binance以外の取引所のために引き続き使用
    // @ts-ignore
    const ex = new ccxt[exchange]({ apiKey: credentials.apiKey, secret: credentials.apiSecret, password: credentials.apiPassphrase, });

    // --- 1. 入金と出金の取得 (ここはccxtで問題なし) ---
    console.log(`[${exchange}] Fetching deposits and withdrawals via ccxt...`);
    const [deposits, withdrawals] = await Promise.all([
        ex.fetchDeposits(undefined, since),
        ex.fetchWithdrawals(undefined, since)
    ]);
    console.log(`[${exchange}] Found ${deposits.length} deposits, ${withdrawals.length} withdrawals.`);

    // --- 2. 取引履歴の取得 (取引所に応じて戦略を切り替え) ---
    let trades: any[] = [];
    if (exchange === 'binance') {
        trades = await fetchBinanceTradesDirectly(credentials.apiKey, credentials.apiSecret, since);
    } else {
        console.log(`[${exchange}] Fetching trades via ccxt...`);
        try {
            trades = await ex.fetchMyTrades(undefined, since);
        } catch (e) {
            console.warn(`[${exchange}] ccxt.fetchMyTrades failed. This exchange might need a direct API implementation like Binance.`, e);
        }
    }

    console.log(`[${exchange} SYNC ALL] FINAL TALLY: ${trades.length} trades, ${deposits.length} deposits, ${withdrawals.length} withdrawals.`)

    const records = [...trades, ...deposits, ...withdrawals];

    return new Response(JSON.stringify(records), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (err) {
    console.error(`[${exchange} SYNC ALL CRASH]`, err)
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
})
