
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let exchange = 'unknown' // for logging
  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''))
    if (userError || !user) throw new Error(\`User not found: \${userError?.message ?? 'Unknown error'}\`)

    const body = await req.json()
    exchange = body.exchange
    // since, until は当面無視し、常に過去90日間に限定する
    // const { since, until } = body 
    if (!exchange) throw new Error("Exchange is required.")

    console.log(\`[\${exchange} PREP] Received sync request. User: \${user.id}\`)

    const { data: conn, error: connError } = await supabaseAdmin.from('exchange_connections').select('encrypted_blob').eq('user_id', user.id).eq('exchange', exchange).single();
    if (connError || !conn) throw new Error(\`Connection not found for \${exchange}\`);
    if (!conn.encrypted_blob) throw new Error(\`Encrypted blob not found for \${exchange}\`);
    
    const credentials = await decryptBlob(conn.encrypted_blob);

    // @ts-ignore
    const ex = new ccxt[exchange]({
      apiKey: credentials.apiKey,
      secret: credentials.apiSecret,
      password: credentials.apiPassphrase,
    })

    console.log(\`[\${exchange} PREP] Fetching markets, deposits, and withdrawals... (Last 90 days)\`)
    await ex.loadMarkets()
    const marketsToFetch = ex.symbols.filter(s => s.endsWith('/USDT') || s.endsWith('/USD'));
    
    // ★★★ 原点回帰：取得期間を「過去90日間」に固定 ★★★
    const since = Date.now() - 89 * 24 * 60 * 60 * 1000; // 安全マージンをとって89日

    const [deposits, withdrawals] = await Promise.all([
        ex.fetchDeposits(undefined, since, undefined),
        ex.fetchWithdrawals(undefined, since, undefined)
    ]);

    console.log(\`[\${exchange} PREP] Found: \${marketsToFetch.length} markets, \${deposits.length} deposits, \${withdrawals.length} withdrawals.\`)

    return new Response(JSON.stringify({ marketsToFetch, deposits, withdrawals }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    console.error(\`[\${exchange} PREP CRASH]\`, err)
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
