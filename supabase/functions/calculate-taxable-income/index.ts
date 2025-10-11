import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const JSON_OK = (o: any, i: ResponseInit = {}) =>
  new Response(JSON.stringify(o, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
    ...i,
  })

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const fx = Number(url.searchParams.get('fx') ?? '150') // JP換算のデフォルト

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return JSON_OK({ ok: false, error: 'unauthorized' }, { status: 401 })
    const uid = auth.user.id

    // profiles は country / entity_type がなくてもOKにする
    let country: 'US' | 'JP' = 'US'
    let entityType: 'personal' | 'corporate' = 'personal'
    try {
      const { data: prof } = await supabase.from('profiles')
        .select('*') // 列が無くても取得できるようにワイルドカード
        .eq('id', uid)
        .maybeSingle()
      if (prof) {
        if (typeof (prof as any).country === 'string') {
          const c = String((prof as any).country).toUpperCase()
          if (c === 'JP' || c === 'US') country = c as 'US' | 'JP'
        }
        if (typeof (prof as any).entity_type === 'string') {
          const e = String((prof as any).entity_type).toLowerCase()
          if (e === 'corporate' || e === 'personal') entityType = e as any
        }
      }
    } catch {
      // 列が無い/権限が無いなどは無視してデフォルトを適用
    }

    // journal_entries から集計（単式: account + dc）
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
    const taxable_usd = Math.max(0, income - expense)

    const summary: any = {
      country,
      entity_type: entityType,
      income_usd: +income.toFixed(2),
      expense_usd: +expense.toFixed(2),
      taxable_income_usd: +taxable_usd.toFixed(2),
    }
    if (country === 'JP') {
      summary.fx_used = fx
      summary.taxable_income_jpy = +(taxable_usd * fx).toFixed(0)
    }

    return JSON_OK({ ok: true, summary })
  } catch (e: any) {
    // 500を返す代わりに詳細をJSONで返す（デバッグ容易化）
    return JSON_OK({ ok: false, error: String(e?.message || e) }, { status: 200 })
  }
})
