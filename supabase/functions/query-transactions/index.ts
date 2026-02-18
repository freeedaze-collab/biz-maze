import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const { query, sql, table, select = '*', limit = 100 } = body

    if (table) {
      console.log(`[TABLE] Querying ${table}...`)
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .limit(limit)
      if (error) throw error
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (sql) {
      console.log('[SQL] Executing raw SQL migration...')
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })
      if (error) throw error
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (query) {
      console.log('[QUERY] Executing custom query via RPC...')
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: query })
      if (error) throw error
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Default: Get all transactions from all_transactions view
    const { data: allTxs, error } = await supabase
      .from('all_transactions')
      .select('*')
      .order('date', { ascending: false })

    if (error) throw error

    return new Response(JSON.stringify({ transactions: allTxs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[ERROR]', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
