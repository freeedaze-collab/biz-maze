// supabase/functions/calculate-taxable-income/index.ts
// MVP aggregate (income/expense/taxable) + JP JPY estimate with fx
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
const JSON_OK = (o:any,i:ResponseInit={})=>new Response(JSON.stringify(o,null,2),{headers:{'content-type':'application/json; charset=utf-8'},...i})

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const fx = Number(url.searchParams.get('fx') ?? '150') // USD->JPY
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return JSON_OK({ error: 'unauthorized' }, { status: 401 })
    const userId = auth.user.id

    const { data: prof } = await supabase.from('profiles').select('country, entity_type').eq('id', userId).maybeSingle()
    const country = (prof?.country ?? 'US') as 'US'|'JP'

    const { data: rows, error } = await supabase
      .from('journal_entries')
      .select('debit_account, credit_account, amount_usd')
      .eq('user_id', userId).limit(10000)
    if (error) throw error

    let income = 0, expense = 0
    for (const r of rows ?? []) {
      if (r.credit_account === 'OtherIncome') income += Number(r.amount_usd ?? 0)
      if (r.debit_account === 'OperatingExpense') expense += Number(r.amount_usd ?? 0)
    }
    const taxable_usd = Math.max(0, income - expense)
    const res:any = {
      ok:true,
      summary:{
        country, entity_type: prof?.entity_type ?? 'personal',
        income_usd:+income.toFixed(2),
        expense_usd:+expense.toFixed(2),
        taxable_income_usd:+taxable_usd.toFixed(2)
      }
    }
    if (country === 'JP') {
      res.summary.fx_used = fx
      res.summary.taxable_income_jpy = +(taxable_usd * fx).toFixed(0)
    }
    return JSON_OK(res)
  } catch (e:any) {
    return JSON_OK({ error:String(e?.message || e) }, { status:500 })
  }
})
