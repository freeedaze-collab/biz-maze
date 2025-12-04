
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
    if (userError || !user) {
      throw new Error(`User not found: ${userError?.message ?? 'Unknown error'}`)
    }

    const body = await req.json()
    exchange = body.exchange
    const { since, until } = body
    if (!exchange) throw new Error("Exchange is required.")

    console.log(`[${exchange} PREP] Received sync request. User: ${user.id}`)

    const { data: conn, error: connErr } = await supabaseAdmin
      .from('exchange_connections')
      .select('api_key, api_secret')
      .eq('user_id', user.id)
      .eq('exchange', exchange)
      .single()

    if (connErr) throw new Error(`Failed to fetch API keys for ${exchange}. DB Error: ${connErr.message}`)
    if (!conn) throw new Error(`API key connection object not found for ${exchange}. It might not be set up.`)

    // ★★★ デバッグログを追加：取得したキーの中身を詳細に確認 ★★★
    console.log(`[${exchange} PREP] Retrieved conn object. api_key type: ${typeof conn.api_key}, api_secret type: ${typeof conn.api_secret}`);
    console.log(`[${exchange} PREP] api_key value: ${conn.api_key}`); // セキュリティのため、本番では削除すべきログ

    if (!conn.api_key || !conn.api_secret) {
      throw new Error(`Authentication failed: api_key or api_secret is missing from the fetched connection data for ${exchange}.`);
    }

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
