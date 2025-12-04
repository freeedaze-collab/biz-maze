
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

// --- 共通の復号ロジック ---
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let exchange = 'unknown'
  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''))
    if (userError || !user) throw new Error(`User not found: ${userError?.message ?? 'Unknown error'}`)

    const body = await req.json()
    exchange = body.exchange
    if (!exchange) throw new Error("Exchange is required.")

    console.log(`[${exchange} SYNC ALL] Received sync request. User: ${user.id}`)

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

    // Binanceは90日という制限がある
    const since = Date.now() - 89 * 24 * 60 * 60 * 1000; 

    console.log(`[${exchange} SYNC ALL] Fetching all trades, deposits, and withdrawals... (Last 90 days)`)
    
    // ★★★ お客様の正解：たった3回のAPI呼び出しで、全てを取得する ★★★
    const [trades, deposits, withdrawals] = await Promise.all([
        ex.fetchMyTrades(undefined, since), // シンボルを指定せず「全取引」を取得
        ex.fetchDeposits(undefined, since),
        ex.fetchWithdrawals(undefined, since)
    ]);

    console.log(`[${exchange} SYNC ALL] VICTORY! Found: ${trades.length} trades, ${deposits.length} deposits, ${withdrawals.length} withdrawals.`)

    // フロントエンドで処理しやすいように、取得したデータをそのまま返す
    const records = [...trades, ...deposits, ...withdrawals];

    return new Response(JSON.stringify(records), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    console.error(`[${exchange} SYNC ALL CRASH]`, err)
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
