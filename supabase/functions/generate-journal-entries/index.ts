// supabase/functions/generate-journal-entries/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const JSON_OK = (obj: any, init: ResponseInit = {}) =>
  new Response(JSON.stringify(obj, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8' }, ...init })

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return JSON_OK({ error: 'unauthorized' }, { status: 401 })
    const userId = auth.user.id

    const { data: txs, error: txErr } = await supabase
      .from('wallet_transactions')
      .select('id, tx_hash, direction, value_wei, asset_symbol, asset_decimals, price_usd, fiat_value_usd, timestamp')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(500)
    if (txErr) throw txErr

    const { data: existing, error: exErr } = await supabase
      .from('journal_entries')
      .select('tx_hash')
      .eq('user_id', userId)
      .neq('tx_hash', null)
      .limit(5000)
    if (exErr) throw exErr
    const exists = new Set((existing ?? []).map((r: any) => r.tx_hash))

    const toUsd = (r: any) => {
      const dec = Number(r.asset_decimals ?? 18)
      const value = Number(r.value_wei ?? 0) / 10 ** dec
      const px = Number(r.price_usd ?? 0)
      const usd = r.fiat_value_usd != null ? Number(r.fiat_value_usd) : value * px
      return +(+usd).toFixed(6)
    }

    const rows: any[] = []
    for (const r of txs ?? []) {
      if (!r.tx_hash || exists.has(r.tx_hash)) continue
      const usd = toUsd(r)
      const when = r.timestamp ?? new Date().toISOString()
      if (r.direction === 'in') {
        rows.push({
          user_id: userId, tx_hash: r.tx_hash, occurred_at: when,
          debit_account: 'CryptoAssets', credit_account: 'OtherIncome',
          amount_usd: usd, currency: 'USD',
          notes: `Auto from tx(in) ${r.tx_hash} ${r.asset_symbol ?? ''}`
        })
      } else if (r.direction === 'out') {
        rows.push({
          user_id: userId, tx_hash: r.tx_hash, occurred_at: when,
          debit_account: 'OperatingExpense', credit_account: 'CryptoAssets',
          amount_usd: usd, currency: 'USD',
          notes: `Auto from tx(out) ${r.tx_hash} ${r.asset_symbol ?? ''}`
        })
      }
    }

    let inserted = 0
    while (rows.length) {
      const chunk = rows.splice(0, 200)
      const { error } = await supabase.from('journal_entries').insert(chunk)
      if (error) throw error
      inserted += chunk.length
    }
    return JSON_OK({ ok: true, inserted })
  } catch (e: any) {
    return JSON_OK({ error: String(e?.message || e) }, { status: 500 })
  }
})
