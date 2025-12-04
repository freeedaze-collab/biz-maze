
// supabase/functions/exchange-sync-prep/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import ccxt from "https://esm.sh/ccxt@4.3.46"
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- exchange-sync-all から移植された、唯一の正しい復号ロジック ---
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
// --- ここまでが移植されたコード ---

// ★★★ 90日間の壁を突破するための、賢い分割取得ヘルパー ★★★
async function fetchAllPaginated(fetchFunction: Function, symbol: string | undefined, since: number, limit: number | undefined, until: number) {
    let allResults: any[] = [];
    let currentSince = since;
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;

    console.log(`[PAGINATOR] Starting fetch from ${new Date(since).toISOString()} to ${new Date(until).toISOString()}`);

    while (currentSince < until) {
        const currentUntil = Math.min(currentSince + ninetyDays, until);
        console.log(`[PAGINATOR] Fetching chunk: ${new Date(currentSince).toISOString()} -> ${new Date(currentUntil).toISOString()}`);
        
        try {
            const results = await fetchFunction(symbol, currentSince, limit, { until: currentUntil });
            if (results.length > 0) {
                allResults = allResults.concat(results);
                console.log(`[PAGINATOR] Found ${results.length} records in this chunk. Total so far: ${allResults.length}`);
            } else {
                console.log(`[PAGINATOR] No records in this chunk.`);
            }
        } catch (error) {
            console.error(`[PAGINATOR] Error fetching chunk:`, error);
        }
        currentSince = currentUntil;
    }
    console.log(`[PAGINATOR] Completed fetch. Total records: ${allResults.length}`);
    return allResults;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let exchange = 'unknown' // for logging
  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''))
    if (userError || !user) throw new Error(`User not found: ${userError?.message ?? 'Unknown error'}`)

    const body = await req.json()
    exchange = body.exchange
    const { since, until } = body
    if (!exchange) throw new Error("Exchange is required.")

    console.log(`[${exchange} PREP] Received sync request. User: ${user.id}`)

    const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('user_id', user.id).eq('exchange', exchange).single();
    if (connError || !conn) throw new Error(`Connection not found for ${exchange}`);
    if (!conn.encrypted_blob) throw new Error(`Encrypted blob not found for ${exchange}`);
    
    const credentials = await decryptBlob(conn.encrypted_blob);

    // @ts-ignore
    const ex = new ccxt[exchange]({
      apiKey: credentials.apiKey,
      secret: credentials.apiSecret,
      password: credentials.apiPassphrase,
    })

    console.log(`[${exchange} PREP] Fetching markets, deposits, and withdrawals...`)
    await ex.loadMarkets()
    const marketsToFetch = ex.symbols.filter(s => s.endsWith('/USDT') || s.endsWith('/USD'));
    
    const startTime = since ? new Date(since).getTime() : Date.now() - (365 * 24 * 60 * 60 * 1000); // Default to 1 year ago if no since
    const endTime = until ? new Date(until).getTime() : Date.now();

    // ★★★ 90日チャンクで取得 ★★★
    const deposits = await fetchAllPaginated(ex.fetchDeposits.bind(ex), undefined, startTime, undefined, endTime);
    const withdrawals = await fetchAllPaginated(ex.fetchWithdrawals.bind(ex), undefined, startTime, undefined, endTime);

    console.log(`[${exchange} PREP] Found: ${marketsToFetch.length} markets, ${deposits.length} deposits, ${withdrawals.length} withdrawals.`)

    return new Response(JSON.stringify({ marketsToFetch, deposits, withdrawals }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    console.error(`[${exchange} PREP CRASH]`, err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
