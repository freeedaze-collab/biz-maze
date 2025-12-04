
// supabase/functions/exchange-sync-prep/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import ccxt from "https://esm.sh/ccxt@4.3.46"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // ★★★ データベースを直接参照するのではなく、「神の関数」を呼び出す ★★★
    const { data: conn, error: connErr } = await supabaseAdmin
      .rpc('get_decrypted_connection', { p_user_id: user.id, p_exchange: exchange })
      .single()

    if (connErr) throw new Error(`Failed to call get_decrypted_connection. DB Error: ${connErr.message}`)
    if (!conn) throw new Error(`Decrypted connection object not found for ${exchange}.`)
    if (!conn.api_key || !conn.api_secret) throw new Error(`API key or secret is missing from decrypted data for ${exchange}.`)

    // @ts-ignore
    const ex = new ccxt[exchange]({
      apiKey: conn.api_key,
      secret: conn.api_secret,
    })

    console.log(`[${exchange} PREP] Fetching markets, deposits, and withdrawals...`)
    await ex.loadMarkets()
    const marketsToFetch = ex.symbols.filter(s => s.endsWith('/USDT') || s.endsWith('/USD'));
    const deposits = await ex.fetchDeposits(undefined, since, undefined)
    const withdrawals = await ex.fetchWithdrawals(undefined, since, undefined)

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
