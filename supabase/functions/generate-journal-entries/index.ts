// supabase/functions/generate-journal-entries/index.ts
// Deno Deploy / Supabase Edge Functions (Deno)
// Purpose: Generate minimal double-entry journal rows from wallet_transactions.
// Assumptions:
// - tables: wallet_transactions(id, user_id, tx_hash, direction, value_wei, asset_symbol, asset_decimals, price_usd, fiat_value_usd, timestamp)
// - tables: journal_entries(id, user_id, tx_hash, occurred_at, debit_account, credit_account, amount_usd, currency, notes)
// - We only create entries if journal_entries.tx_hash does not exist for this user.
// - Very-minimal heuristic:
//     direction = 'in'  -> Dr CryptoAssets  / Cr OtherIncome
//     direction = 'out' -> Dr OperatingExp / Cr CryptoAssets
// - amount_usd is derived by (fiat_value_usd) OR (value * price_usd). decimals default 18.
// - currency recorded as 'USD' (base reporting currency for MVP)

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const JSON_OK = (obj: any, init: ResponseInit = {}) =>
  new Response(JSON.stringify(obj, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
    ...init,
  })

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return JSON_OK({ error: 'unauthorized' }, { status: 401 })
    const userId = auth.user.id

    // Load recent transactions (limit to keep it safe)
    const { data: txs, error: txErr } = await supabase
      .from('wallet_transactions')
      .select('id, tx_hash, direction, value_wei, asset_symbol, asset_decimals, price_usd, fiat_value_usd, timestamp')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(500)

    if (txErr) throw txErr

    // Existing journalized hashes
    const { data: existing, error: exErr } = await supabase
      .from('journal_entries')
      .select('tx_hash')
      .eq('user_id', userId)
      .neq('tx_hash', null)
      .limit(2000)

    if (exErr) throw exErr

    const existingSet = new Set((existing ?? []).map((r: any) => r.tx_hash))
    const decimalsDefault = 18

    const toUsd = (row: any): number => {
      if (row?.fiat_value_usd != null) return Number(row.fiat_value_usd)
      const price = row?.price_usd != null ? Number(row.price_usd) : 0
      const dec = row?.asset_decimals != null ? Number(row.asset_decimals) : decimalsDefault
      const valueWei = row?.value_wei != null ? Number(row.value_wei) : 0
      const valueToken = valueWei / 10 ** dec
      return +(valueToken * price).toFixed(6)
    }

    const inserts: any[] = []
    for (const r of txs ?? []) {
      const hash = r.tx_hash
      if (!hash || existingSet.has(hash)) continue

      const amountUsd = toUsd(r)
      const when = r.timestamp ?? new Date().toISOString()

      if ((r.direction as string) === 'in') {
        inserts.push({
          user_id: userId,
          tx_hash: hash,
          occurred_at: when,
          debit_account: 'CryptoAssets',      // Dr
          credit_account: 'OtherIncome',      // Cr
          amount_usd: amountUsd,
          currency: 'USD',
          notes: `Auto from tx(in) ${hash} ${r.asset_symbol ?? ''}`,
        })
      } else if ((r.direction as string) === 'out') {
        inserts.push({
          user_id: userId,
          tx_hash: hash,
          occurred_at: when,
          debit_account: 'OperatingExpense',  // Dr
          credit_account: 'CryptoAssets',     // Cr
          amount_usd: amountUsd,
          currency: 'USD',
          notes: `Auto from tx(out) ${hash} ${r.asset_symbol ?? ''}`,
        })
      } else {
        // unknown direction -> skip for MVP
      }
    }

    let inserted = 0
    while (inserts.length) {
      const chunk = inserts.splice(0, 200)
      const { error: insErr } = await supabase.from('journal_entries').insert(chunk)
      if (insErr) throw insErr
      inserted += chunk.length
    }

    return JSON_OK({ ok: true, inserted })
  } catch (e: any) {
    return JSON_OK({ error: String(e?.message || e) }, { status: 500 })
  }
})
