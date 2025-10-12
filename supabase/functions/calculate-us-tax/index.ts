import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
}

const json = (obj: any, init: ResponseInit = {}) =>
  new Response(JSON.stringify(obj, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders },
    ...init,
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )

    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return json({ ok: false, error: 'unauthorized' }, { status: 401 })
    const userId = auth.user.id

    const { data: txs, error } = await supabase
      .from('wallet_transactions')
      .select('user_id, direction, fiat_value_usd')
      .eq('user_id', userId)

    if (error) throw error

    let income = 0
    let expense = 0
    for (const t of txs ?? []) {
      const v = Number(t.fiat_value_usd ?? 0)
      if (t.direction === 'in') income += v
      else if (t.direction === 'out') expense += v
    }

    const taxable = income - expense
    const deduction = Math.min(13000, taxable * 0.1)
    const taxableAfter = Math.max(taxable - deduction, 0)
    const tax = Math.round(taxableAfter * 0.22)

    return json({
      ok: true,
      entity_type: 'personal',
      income_usd: income,
      expense_usd: expense,
      taxable_income_usd: taxable,
      taxable_after_deduction_usd: taxableAfter,
      estimated_federal_tax_usd: tax,
      notes: 'MVP flat-rate estimation (22%)',
    })
  } catch (e: any) {
    return json({ ok: false, error: String(e.message || e) }, { status: 500 })
  }
})
