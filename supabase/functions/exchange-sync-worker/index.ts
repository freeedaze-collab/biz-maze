
// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// ★★★ 致命的な構文エラーを修正 ★★★
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

  let exchange = 'unknown', symbol = 'unknown' // for logging
  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''))
    if (userError || !user) throw new Error(`User not found: ${userError?.message ?? 'Unknown error'}`)

    const body = await req.json()
    exchange = body.exchange
    symbol = body.symbol
    const { since, until } = body
    if (!exchange || !symbol) throw new Error("Exchange and symbol are required.")

    console.log(`[${exchange} WORKER] Syncing trades for ${symbol}. User: ${user.id}`)

    const { data: conn, error: connErr } = await supabaseAdmin
      .from('exchange_connections')
      .select('decrypted_api_key, decrypted_secret_key')
      .eq('user_id', user.id)
      .eq('exchange', exchange)
      .single()

    if (connErr || !conn) throw new Error(`API keys for ${exchange} not found.`)

    // @ts-ignore
    const ex = new ccxt[exchange]({
      apiKey: conn.decrypted_api_key,
      secret: conn.decrypted_secret_key,
    })

    const trades = await ex.fetchMyTrades(symbol, since, undefined, { until })

    console.log(`[${exchange} WORKER] Found ${trades.length} trades for ${symbol}.`)

    return new Response(JSON.stringify(trades), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    console.error(`[${exchange} WORKER CRASH - ${symbol}]`, err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
