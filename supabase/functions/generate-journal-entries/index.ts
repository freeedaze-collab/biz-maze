// Deno Edge Function: generate-journal-entries -> writes into your single-line journal_entries schema
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const JSON_OK = (obj: any, init: ResponseInit = {}) =>
  new Response(JSON.stringify(obj, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8' }, ...init
  })

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // auth
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return JSON_OK({ error: 'unauthorized' }, { status: 401 })
    const userId = auth.user.id

    // load recent wallet_transactions (plural) with amounts
    const { data: txs, error: txErr } = await supabase
      .from('wallet_transactions')
      .select('id, user_id, direction, tx_hash, occurred_at, fiat_value_usd')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .limit(1000)

    if (txErr) throw txErr

    // find already journalized tx_ids to avoid duplicates
    const { data: existing, error: exErr } = await supabase
      .from('journal_entries')
      .select('tx_id')
      .eq('user_id', userId)
      .not('tx_id', 'is', null)
      .limit(5000)

    if (exErr) throw exErr

    const done = new Set((existing ?? []).map((r: any) => r.tx_id))

    // build inserts as single-line entries (two rows per tx)
    // accounts used:
    //  - direction = 'in'  -> Dr CryptoAssets / Cr OtherIncome
    //  - direction = 'out' -> Dr OperatingExpense / Cr CryptoAssets
    const rows: any[] = []
    for (const t of txs ?? []) {
      if (!t?.id || done.has(t.id)) continue
      const amt = Number(t?.fiat_value_usd ?? 0)
      const entryDate = (t?.occurred_at ?? new Date().toISOString()).slice(0, 10)

      if ((t.direction as string) === 'in') {
        rows.push({ user_id: userId, tx_id: t.id, entry_date: entryDate, account: 'CryptoAssets',     dc: 'D', amount: amt })
        rows.push({ user_id: userId, tx_id: t.id, entry_date: entryDate, account: 'OtherIncome',      dc: 'C', amount: amt })
      } else if ((t.direction as string) === 'out') {
        rows.push({ user_id: userId, tx_id: t.id, entry_date: entryDate, account: 'OperatingExpense', dc: 'D', amount: amt })
        rows.push({ user_id: userId, tx_id: t.id, entry_date: entryDate, account: 'CryptoAssets',     dc: 'C', amount: amt })
      }
    }

    let inserted = 0
    while (rows.length) {
      const chunk = rows.splice(0, 500)
      const { error: insErr } = await supabase.from('journal_entries').insert(chunk)
      if (insErr) throw insErr
      inserted += chunk.length
    }

    return JSON_OK({ ok: true, inserted })
  } catch (e: any) {
    return JSON_OK({ error: String(e?.message || e) }, { status: 500 })
  }
})
