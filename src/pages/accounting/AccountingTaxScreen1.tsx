// supabase/functions/generate-journal-entries/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*', // 本番は必要なオリジンに絞ってください
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  // supabase-js invoke が付けるヘッダを許可
  'Access-Control-Allow-Headers':
    'authorization, content-type, apikey, x-client-info, x-supabase-authorization',
}

const json = (obj: any, init: ResponseInit = {}) =>
  new Response(JSON.stringify(obj, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders },
    ...init,
  })

Deno.serve(async (req) => {
  console.log('[generate-journal-entries] received', {
    method: req.method,
    url: req.url,
    hasAuth: !!req.headers.get('Authorization'),
  })

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
    console.log('[generate-journal-entries] user', userId)

    // トランザクション取得（MVP要件: direction / occurred_at / fiat_value_usd が必要）
    const { data: txs, error: txErr } = await supabase
      .from('wallet_transactions')
      .select('id, user_id, direction, tx_hash, occurred_at, fiat_value_usd')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .limit(1000)
    if (txErr) throw txErr
    console.log('[generate-journal-entries] fetched', txs?.length ?? 0)

    // 既存仕訳の tx_id を除外
    const { data: existing, error: exErr } = await supabase
      .from('journal_entries')
      .select('tx_id')
      .eq('user_id', userId)
      .not('tx_id', 'is', null)
      .limit(5000)
    if (exErr) throw exErr
    const done = new Set((existing ?? []).map((r: any) => r.tx_id))
    console.log('[generate-journal-entries] already done', done.size)

    let skippedDuplicate = 0
    let skippedMissing = 0
    const rows: any[] = []

    for (const t of txs ?? []) {
      if (!t?.id) { skippedMissing++; continue }
      if (done.has(t.id)) { skippedDuplicate++; continue }

      const amt = Number((t as any)?.fiat_value_usd ?? 0)
      const occurred = (t as any)?.occurred_at as string | null
      const dir = String((t as any)?.direction ?? '').toLowerCase()

      if (!Number.isFinite(amt) || amt === 0 || !occurred || (dir !== 'in' && dir !== 'out')) {
        skippedMissing++
        continue
      }
      const entryDate = occurred.slice(0, 10)

      if (dir === 'in') {
        rows.push({ user_id: userId, tx_id: t.id, entry_date: entryDate, account: 'CryptoAssets',     dc: 'D', amount: amt })
        rows.push({ user_id: userId, tx_id: t.id, entry_date: entryDate, account: 'OtherIncome',      dc: 'C', amount: amt })
      } else {
        rows.push({ user_id: userId, tx_id: t.id, entry_date: entryDate, account: 'OperatingExpense', dc: 'D', amount: amt })
        rows.push({ user_id: userId, tx_id: t.id, entry_date: entryDate, account: 'CryptoAssets',     dc: 'C', amount: amt })
      }
    }

    console.log('[generate-journal-entries] will insert', rows.length, { skippedDuplicate, skippedMissing })

    let inserted = 0
    while (rows.length) {
      const chunk = rows.splice(0, 500)
      if (!chunk.length) break
      const { error: insErr } = await supabase.from('journal_entries').insert(chunk)
      if (insErr) throw insErr
      inserted += chunk.length
    }

    const result = { ok: true, inserted, skippedDuplicate, skippedMissing, totalTxs: txs?.length ?? 0 }
    console.log('[generate-journal-entries] result', result)
    return json(result)
  } catch (e: any) {
    console.error('[generate-journal-entries] ERROR', e)
    return json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
})
