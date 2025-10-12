// supabase/functions/generate-journal-entries/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

// === CORS ===
// 本番でオリジンを絞る場合は "*" を具体的なドメインに変更してください。
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
}

const jsonResponse = (obj: any, init: ResponseInit = {}) =>
  new Response(JSON.stringify(obj, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders },
    ...init,
  })

Deno.serve(async (req) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )

    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return jsonResponse({ ok: false, error: 'unauthorized' }, { status: 401 })
    const userId = auth.user.id

    // 取引取得（必要な列名はあなたのスキーマに合わせてあります）
    const { data: txs, error: txErr } = await supabase
      .from('wallet_transactions')
      .select('id, user_id, direction, tx_hash, occurred_at, fiat_value_usd')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .limit(1000)

    if (txErr) throw txErr

    // 既に仕訳済みの tx を除外
    const { data: existing, error: exErr } = await supabase
      .from('journal_entries')
      .select('tx_id')
      .eq('user_id', userId)
      .not('tx_id', 'is', null)
      .limit(5000)

    if (exErr) throw exErr
    const done = new Set((existing ?? []).map((r: any) => r.tx_id))

    const rows: any[] = []
    for (const t of txs ?? []) {
      if (!t?.id || done.has(t.id)) continue

      // 金額と日付が欠けていたらスキップ（MVP防御）
      const amt = Number((t as any)?.fiat_value_usd ?? 0)
      const occurred = (t as any)?.occurred_at as string | null
      if (!Number.isFinite(amt) || amt === 0 || !occurred) continue

      const entryDate = occurred.slice(0, 10)
      const direction = String((t as any)?.direction ?? '').toLowerCase()

      if (direction === 'in') {
        rows.push({ user_id: userId, tx_id: t.id, entry_date: entryDate, account: 'CryptoAssets',     dc: 'D', amount: amt })
        rows.push({ user_id: userId, tx_id: t.id, entry_date: entryDate, account: 'OtherIncome',      dc: 'C', amount: amt })
      } else if (direction === 'out') {
        rows.push({ user_id: userId, tx_id: t.id, entry_date: entryDate, account: 'OperatingExpense', dc: 'D', amount: amt })
        rows.push({ user_id: userId, tx_id: t.id, entry_date: entryDate, account: 'CryptoAssets',     dc: 'C', amount: amt })
      }
    }

    let inserted = 0
    while (rows.length) {
      const chunk = rows.splice(0, 500)
      if (chunk.length === 0) break
      const { error: insErr } = await supabase.from('journal_entries').insert(chunk)
      if (insErr) throw insErr
      inserted += chunk.length
    }

    return jsonResponse({ ok: true, inserted })
  } catch (e: any) {
    // 500ではなく 200 + ok:false にしても良いですが、ここでは500のまま返します
    return jsonResponse({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
})
