// supabase/functions/calculate-taxable-income/index.ts
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

async function readJson(req: Request): Promise<any> {
  try { return await req.json() } catch { return {} }
}

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

    // fx は body または query から受け取る（POST/GET両対応）
    const body = await readJson(req)
    const fxParam = Number(new URL(req.url).searchParams.get('fx') ?? '')
    const fx = Number.isFinite(fxParam) ? fxParam : Number(body?.fx ?? 150)

    const { data: txs, error } = await supabase
      .from('wallet_transactions')
      .select('user_id, direction, fiat_value_usd')
      .eq('user_id', userId)

    if (error) throw error

    let income = 0
    let expense = 0
    for (const t of txs ?? []) {
      const v = Number((t as any)?.fiat_value_usd ?? 0)
      if ((t as any)?.direction === 'in') income += v
      else if ((t as any)?.direction === 'out') expense += v
    }

    const taxable = income - expense
    const taxableJpy = taxable * fx

    return json({
      ok: true,
      summary: {
        country: 'US',
        entity_type: 'personal',
        income_usd: income,
        expense_usd: expense,
        taxable_income_usd: taxable,
        fx_used: fx,
        taxable_income_jpy: taxableJpy,
      },
    })
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
})
