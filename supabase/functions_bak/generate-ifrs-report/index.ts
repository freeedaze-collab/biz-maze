// supabase/functions/generate-ifrs-report/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, content-type, apikey, x-client-info, x-supabase-authorization',
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

    const { data: entries, error } = await supabase
      .from('journal_entries')
      .select('account, dc, amount')
      .eq('user_id', userId)

    if (error) throw error

    let revenue = 0, expense = 0
    const trial: Record<string, { debit: number; credit: number }> = {}

    for (const e of entries ?? []) {
      const amt = Number((e as any)?.amount ?? 0)
      const dc = String((e as any)?.dc ?? 'C')
      const account = String((e as any)?.account ?? '')

      if (!trial[account]) trial[account] = { debit: 0, credit: 0 }
      if (dc === 'D') trial[account].debit += amt
      else trial[account].credit += amt

      if (account === 'OtherIncome') revenue += amt
      if (account === 'OperatingExpense') expense += amt
    }

    const profit = revenue - expense
    const tb = Object.entries(trial).map(([a, v]) => ({
      account: a,
      debit: v.debit,
      credit: v.credit,
    }))

    return json({
      ok: true,
      pl: { revenue_usd: revenue, expense_usd: expense, profit_usd: profit },
      trial_balance: tb,
    })
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
})
