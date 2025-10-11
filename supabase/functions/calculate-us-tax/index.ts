import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const JSON_OK = (o: any, i: ResponseInit = {}) =>
  new Response(JSON.stringify(o, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
    ...i,
  })

const BRACKETS_2024_SINGLE = [
  { upTo: 11600, rate: 0.10 },
  { upTo: 47150, rate: 0.12 },
  { upTo: 100525, rate: 0.22 },
  { upTo: 191950, rate: 0.24 },
  { upTo: 243725, rate: 0.32 },
  { upTo: 609350, rate: 0.35 },
  { upTo: Infinity, rate: 0.37 },
]
const STANDARD_DEDUCTION_SINGLE = 14600
const CORP_FLAT_RATE = 0.21

function taxByBrackets(taxable: number, brackets = BRACKETS_2024_SINGLE) {
  let remain = taxable, last = 0, tax = 0
  for (const b of brackets) {
    const span = Math.max(0, Math.min(remain, b.upTo - last))
    tax += span * b.rate
    remain -= span
    last = b.upTo
    if (remain <= 0) break
  }
  return Math.max(0, +tax.toFixed(2))
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return JSON_OK({ ok: false, error: 'unauthorized' }, { status: 401 })
    const uid = auth.user.id

    // journal_entries からまずベース課税所得
    const { data: rows, error } = await supabase
      .from('journal_entries')
      .select('account, dc, amount')
      .eq('user_id', uid)
      .limit(10000)
    if (error) throw error

    let income = 0, expense = 0
    for (const r of rows ?? []) {
      const amt = Number((r as any).amount ?? 0)
      if ((r as any).account === 'OtherIncome' && (r as any).dc === 'C') income += amt
      if ((r as any).account === 'OperatingExpense' && (r as any).dc === 'D') expense += amt
    }
    const baseTaxable = Math.max(0, income - expense)

    // profilesのentity_typeが無くても動くよう防御
    let entity: 'personal' | 'corporate' = 'personal'
    try {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
      if (prof && typeof (prof as any).entity_type === 'string') {
        const e = String((prof as any).entity_type).toLowerCase()
        if (e === 'corporate' || e === 'personal') entity = e as any
      }
    } catch { /* ignore */ }

    let taxableUsed = baseTaxable
    let estTax = 0
    if (entity === 'corporate') {
      estTax = +(baseTaxable * CORP_FLAT_RATE).toFixed(2)
    } else {
      taxableUsed = Math.max(0, baseTaxable - STANDARD_DEDUCTION_SINGLE)
      estTax = taxByBrackets(taxableUsed)
    }

    return JSON_OK({
      ok: true,
      entity_type: entity,
      income_usd: +income.toFixed(2),
      expense_usd: +expense.toFixed(2),
      taxable_income_usd: +baseTaxable.toFixed(2),
      taxable_after_deduction_usd: +taxableUsed.toFixed(2),
      estimated_federal_tax_usd: estTax,
      notes: "MVP rough estimate. Not tax advice.",
    })
  } catch (e: any) {
    return JSON_OK({ ok: false, error: String(e?.message || e) }, { status: 200 })
  }
})
